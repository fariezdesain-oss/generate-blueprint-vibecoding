// Shared AI utilities for standalone Netlify edge function runtime.
// ponytail: raw HTTP fetch (no SDKs) — simpler and avoids bundling provider SDKs.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const LEGACY_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_VERSION = 'v3';
const PREVIOUS_ENCRYPTION_VERSION = 'v2';

function getKey(salt) {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is not set');
  return crypto.scryptSync(secret, salt, 32);
}

export function decrypt(encryptedText) {
  const parts = encryptedText.split(':');

  if (parts[0] === ENCRYPTION_VERSION) {
    const [, saltHex, ivHex, authTagHex, encrypted] = parts;
    if (parts.length !== 5 || !saltHex || !ivHex || !authTagHex || !encrypted) throw new Error('Invalid encrypted text');
    const key = getKey(Buffer.from(saltHex, 'hex'));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  const key = getKey('salt');

  if (parts[0] === PREVIOUS_ENCRYPTION_VERSION) {
    const [, ivHex, authTagHex, encrypted] = parts;
    if (parts.length !== 4 || !ivHex || !authTagHex || !encrypted) throw new Error('Invalid encrypted text');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  if (/^v\d+$/.test(parts[0])) throw new Error('Invalid encrypted text');

  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function detectModelCapabilities(providerName, modelName) {
  const provider = providerName.toLowerCase();
  const model = modelName.toLowerCase();
  const low = /free|8b|7b|(^|[-_/:])mini($|[-_/:])|(^|[-_/:])small($|[-_/:])|flash-lite|gemma|llama-3\.1-8b|llama-3\.2-3b/i.test(model);
  const high = /gemini-1\.5-pro|gemini-1\.5-flash|gemini-2\.|claude-3\.?5|claude-3\.?7|claude-sonnet-4|gpt-4o|gpt-4\.1|o1|o3|128k|200k|1m/i.test(model) || provider === 'gemini';

  if (low) return { contextLevel: 'low', maxTokens: 12000, previewLimit: 900, timeoutMs: provider === 'groq' ? 120000 : 150000, retryCount: 5, consistencyMode: 'light' };
  if (high) return { contextLevel: 'high', maxTokens: 32000, previewLimit: 3000, timeoutMs: 240000, retryCount: 3, consistencyMode: 'full' };
  return { contextLevel: 'medium', maxTokens: 20000, previewLimit: 1600, timeoutMs: 180000, retryCount: 4, consistencyMode: 'light' };
}

export function isFallbackableAIError(err) {
  const message = err?.message || String(err || '');
  return /timeout|quota|rate|429|500|502|503|504|service unavailable|overloaded|temporarily unavailable|payment required|insufficient.*credit|credit.*exhaust|resource exhausted|empty response|failed to generate/i.test(message);
}

export function buildAIConfig(row) {
  const capabilities = detectModelCapabilities(row.provider_name || 'gemini', row.model_name || 'gemini-2.5-flash');
  return {
    providerName: row.provider_name || 'gemini',
    apiKey: decrypt(row.api_key),
    modelName: row.model_name || 'gemini-2.5-flash',
    baseUrl: row.base_url || undefined,
    maxTokens: capabilities.maxTokens,
    contextLevel: capabilities.contextLevel,
    timeoutMs: capabilities.timeoutMs,
    retryCount: capabilities.retryCount,
    previewLimit: capabilities.previewLimit,
    consistencyMode: capabilities.consistencyMode,
  };
}

export function buildProviderFallbackCandidates(rows) {
  const active = rows.filter(row => row.api_key && row.api_key.length > 0);
  const primary = active.find(row => row.is_active) || active[0];
  if (!primary) return [];
  const scores = { high: 3, medium: 2, low: 1 };
  const fallbackRows = active
    .filter(row => row.id !== primary.id)
    .sort((a, b) => {
      const ac = detectModelCapabilities(a.provider_name, a.model_name);
      const bc = detectModelCapabilities(b.provider_name, b.model_name);
      const diff = scores[bc.contextLevel] - scores[ac.contextLevel];
      if (diff !== 0) return diff;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
  return [primary, ...fallbackRows].map(row => ({ id: row.id, config: buildAIConfig(row), isPrimary: row.id === primary.id })).filter(c => c.config.apiKey);
}

export async function callAI(prompt, config) {
  const isGemini = config.providerName === 'gemini';
  const maxTokens = config.maxTokens || 32000;
  let url, headers, body;

  if (isGemini) {
    const model = config.modelName || 'gemini-2.5-flash';
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    });
  } else {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    url = `${baseUrl}/chat/completions`;
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    };
    body = JSON.stringify({
      model: config.modelName,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      stream: true,
    });
  }

  let timer;
  const timeoutMs = config.timeoutMs || 600000;
  const controller = new AbortController();
  
  const resetTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  
  resetTimer();

  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API error (${res.status}): ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      resetTimer();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (isGemini) {
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            fullResponse += text;
          } else {
            const text = parsed.choices?.[0]?.delta?.content || '';
            fullResponse += text;
          }
        } catch {
          // skip invalid json chunk
        }
      }
    }

    if (buffer) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6).trim();
        if (dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr);
            if (isGemini) {
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              fullResponse += text;
            } else {
              const text = parsed.choices?.[0]?.delta?.content || '';
              fullResponse += text;
            }
          } catch {}
        }
      }
    }

    if (!fullResponse.trim()) throw new Error('AI empty response');
    return fullResponse;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateWithProviderFallback(candidates, buildPromptForConfig, maxAttemptsOverride) {
  let lastError;
  for (const candidate of candidates) {
    const prompt = buildPromptForConfig(candidate.config);
    const maxAttempts = maxAttemptsOverride || candidate.config.retryCount || 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await callAI(prompt, candidate.config);
        return { response, config: candidate.config, usedFallback: !candidate.isPrimary };
      } catch (err) {
        lastError = err;
        const msg = err.message || '';
        const retryable = isFallbackableAIError(err);
        if (attempt < maxAttempts - 1 && retryable) {
          const delay = /quota|rate|429/i.test(msg) ? 30000 * (attempt + 1) : 5000 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (!retryable) throw err;
        break;
      }
    }
  }
  throw lastError || new Error('AI generation failed on all providers');
}
