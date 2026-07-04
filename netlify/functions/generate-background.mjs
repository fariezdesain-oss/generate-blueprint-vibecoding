import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const FILE_ORDER = [
  '01_PRD.md',
  '02_ARCHITECTURE.md',
  '03_DATA_MODELS.md',
  '04_PROJECT_STANDARDS.md',
  '05_DESIGN_SYSTEM.md',
  '06_DELIVERY.md',
  '07_AGENT_CONTEXT.md',
];

const ALGORITHM = 'aes-256-gcm';
const LEGACY_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const ENCRYPTION_VERSION = 'v2';

function getKey() {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is not set');
  return crypto.scryptSync(secret, 'salt', 32);
}

function decrypt(encryptedText) {
  const key = getKey();
  const parts = encryptedText.split(':');

  if (parts[0] === ENCRYPTION_VERSION) {
    const [, ivHex, authTagHex, encrypted] = parts;
    if (!ivHex || !authTagHex || !encrypted) throw new Error('Invalid encrypted text');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function countGeneratedSpecFiles(files) {
  if (!files) return 0;
  return FILE_ORDER.filter(name => typeof files[name] === 'string' && files[name].trim().length > 0).length;
}

async function callAI(prompt, config) {
  const isGemini = config.providerName === 'gemini';
  const maxTokens = config.maxTokens || 32000;
  let url, headers, body;

  if (isGemini) {
    const model = config.modelName || 'gemini-2.5-flash';
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
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
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600000);

  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API error (${res.status}): ${errText}`);
    }

    if (isGemini) {
      const json = await res.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const json = await res.json();
      return json.choices?.[0]?.message?.content || '';
    }
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function formatConversation(messages) {
  return messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
}

function formatPRDFull(files) {
  const prdContent = files ? files['01_PRD.md'] : null;
  if (!prdContent) return '';
  return `--- 01_PRD.md (ACUAN UTAMA - LENGKAP) ---\n${prdContent}`;
}

function formatOtherFiles(files, previewLimit) {
  if (!files) return '';
  return FILE_ORDER
    .filter(name => name !== '01_PRD.md' && files[name])
    .map(name => {
    const content = files[name];
    const text = previewLimit > 0 && content.length > previewLimit
      ? content.slice(0, previewLimit) + '\n\n... [dokumen dipotong untuk menghemat konteks]'
      : content;
    return `--- ${name} (REFERENSI) ---\n${text}`;
  }).join('\n\n');
}

const BASE_SYSTEM = `Anda adalah senior software architect dan technical writer. Output Anda harus presisi, terstruktur, dan lengkap. WAJIB GUNAKAN BAHASA INDONESIA.

ATURAN KUALITAS:
1. KONSISTENSI - 7 dokumen dalam satu proyek HARUS konsisten satu sama lain. 01_PRD.md adalah ACUAN UTAMA. Jika ada konflik, ikuti 01_PRD.md.
2. BATAS DOKUMEN - tulis hanya topik yang diminta pada dokumen saat ini. Jangan mencampur PRD, arsitektur, data model, standar proyek, design system, delivery, dan agent context.
3. DILARANG placeholder - jangan gunakan "TODO", "TBD", "sesuaikan dengan kebutuhan", "ganti dengan...", atau kata serupa. Semua konten harus terisi dengan nilai SPESIFIK dan KONKRET.
4. LENGKAP - setiap bagian yang disebutkan dalam template harus diisi. Jangan lewati bagian manapun.
5. SPESIFIK - gunakan contoh konkret, bukan abstraksi. Misalnya jangan tulis "framework populer" tapi tulis "Next.js 14.2 dengan App Router".`;

function buildConsistencyPrompt(files) {
  const prdContent = files ? files['01_PRD.md'] : null;
  if (!prdContent) return '';

  let prompt = `Anda adalah senior QA document reviewer. Periksa KONSISTENSI 7 dokumen spesifikasi proyek berikut.

01_PRD.md adalah ACUAN UTAMA yang HARUS diikuti oleh SEMUA dokumen lainnya.

Tugas Anda:
1. Baca 01_PRD.md sebagai acuan utama.
2. Baca dokumen 02 sampai 07.
3. Periksa kontradiksi, istilah tidak selaras, fitur hilang, tech stack tidak konsisten, dan boundary dokumen yang tercampur.
4. Jika SEMUA konsisten, balas hanya dengan teks: SEMUA KONSISTEN
5. Jika ada yang perlu diperbaiki, keluarkan ULANG hanya file yang bermasalah secara LENGKAP, diawali dengan "# NAMAFILE.md".

--- 01_PRD.md (ACUAN UTAMA - LENGKAP) ---
${prdContent}
`;

  for (const name of FILE_ORDER.filter(fileName => fileName !== '01_PRD.md')) {
    if (files[name]) prompt += `\n--- ${name} ---\n${files[name]}\n`;
  }

  prompt += `\nSETELAH memeriksa, jika SEMUA KONSISTEN balas "SEMUA KONSISTEN". Jika ada kontradiksi, keluarkan ULANG hanya file bermasalah LENGKAP dengan perbaikan, diawali dengan "# NAMAFILE.md".`;

  return prompt;
}

function buildDocPrompt(fileIndex, messages, previousFiles, previewLimit) {
  const fileName = FILE_ORDER[fileIndex];
  const conversation = formatConversation(messages);
  const prdSection = formatPRDFull(previousFiles);
  const otherSection = formatOtherFiles(previousFiles, previewLimit);

  let contextSection = '';
  if (prdSection || otherSection) {
    contextSection = '\n\nREFERENSI DOKUMEN SEBELUMNYA:\n\n';
    if (prdSection) contextSection += prdSection + '\n';
    if (otherSection) contextSection += '\n' + otherSection;
  }

  let filePrompt = '';

  switch (fileName) {
    case '01_PRD.md':
      filePrompt = `Buat dokumen 01_PRD.md. Dokumen ini HANYA membahas "apa yang dibangun".

WAJIB berisi:
- Problem Statement
- Deskripsi aplikasi
- Tujuan
- Target User & Persona
- Core Features dengan prioritas MoSCoW (Must Have, Should Have, Could Have, Won't Have)
- Scope: In Scope dan Out of Scope
- User Flow utama
- Success Metrics
- Assumptions & Dependencies

LARANGAN:
- Jangan membahas database, API, struktur folder, desain visual, testing, security detail, deployment, atau CI/CD.
- Jangan membuat detail implementasi teknis.`;
      break;

    case '02_ARCHITECTURE.md':
      filePrompt = `Buat dokumen 02_ARCHITECTURE.md. Dokumen ini HANYA membahas "bagaimana sistem dibangun" secara arsitektural.

WAJIB berisi:
- Tech Stack + versi yang realistis dan konsisten dengan PRD
- Folder Structure
- ADR (Architecture Decision Record) untuk keputusan teknis penting
- Mermaid Architecture Diagram
- Sequence Diagram untuk flow utama
- Database Overview hanya gambaran relasi, bukan detail tabel
- Authentication Flow
- State Management
- Caching Strategy

LARANGAN:
- Jangan menulis detail skema database, field, index, constraint, atau migration lengkap.
- Jangan menulis design system.
- Jangan menulis deployment/runbook.`;
      break;

    case '03_DATA_MODELS.md':
      filePrompt = `Buat dokumen 03_DATA_MODELS.md. Dokumen ini HANYA membahas semua hal yang berhubungan dengan data.

WAJIB berisi:
- ERD Mermaid
- Semua tabel/entity
- Semua field beserta tipe data
- Primary Key
- Foreign Key
- Index
- Constraint
- ORM Schema atau SQL DDL yang sesuai tech stack
- Migration Strategy
- Seed Data

LARANGAN:
- Jangan membahas API endpoint.
- Jangan membahas folder structure.
- Jangan membahas tech stack umum di luar tooling data.
- Jangan membahas auth flow kecuali relasi data yang diperlukan.`;
      break;

    case '04_PROJECT_STANDARDS.md':
      filePrompt = `Buat dokumen 04_PROJECT_STANDARDS.md. Dokumen ini menggabungkan standar coding/proyek dan environment schema.

WAJIB berisi:
- Naming Convention untuk file, folder, variable, function, class, table, column, dan env variable
- ESLint rules yang direkomendasikan
- Prettier config
- API Response Standard
- HTTP Status usage
- Error Format dan error code convention
- Commit Convention
- Environment Variables lengkap
- .env.example aman untuk repository
- Environment Matrix untuk development, staging, production

LARANGAN:
- Jangan membahas visual design system.
- Jangan membahas deployment langkah demi langkah.
- Jangan mengulang detail schema database.`;
      break;

    case '05_DESIGN_SYSTEM.md':
      filePrompt = `Buat dokumen 05_DESIGN_SYSTEM.md. Dokumen ini HANYA membahas visual dan pengalaman antarmuka.

WAJIB berisi:
- Color palette lengkap dengan fungsi warna
- Typography
- Radius
- Spacing
- Layout
- Grid
- Component State (default, hover, active, disabled, loading, error, success)
- Animation dan motion rules
- Responsive Breakpoint

LARANGAN:
- Jangan membahas coding implementation.
- Jangan membahas API.
- Jangan membahas database.
- Jangan membahas deployment atau testing.`;
      break;

    case '06_DELIVERY.md':
      filePrompt = `Buat dokumen 06_DELIVERY.md. Dokumen ini menggabungkan testing, security, dan delivery/release.

WAJIB berisi:
- Unit Testing
- Integration Testing
- E2E Testing
- Coverage target per layer
- Edge Case checklist
- Security OWASP checklist
- Rate Limit policy
- CORS policy
- Security Headers
- Secret management
- PII handling
- Deployment Environment
- CI/CD pipeline
- Migration saat release
- Rollback procedure
- Health Check

LARANGAN:
- Jangan mengulang PRD panjang.
- Jangan mengulang detail table schema.
- Jangan menulis design system.`;
      break;

    case '07_AGENT_CONTEXT.md':
      filePrompt = `Buat dokumen 07_AGENT_CONTEXT.md. Dokumen ini dibuat TERAKHIR sebagai root context ringkas untuk AI agent.

WAJIB berisi secara ringkas:
- Project Overview
- Ringkasan Tech Stack
- Ringkasan Folder
- Ringkasan Architecture
- Ringkasan Feature
- Progress
- Current Task
- Next Task
- Do Not Do

ATURAN KHUSUS:
- Jangan panjang.
- Jangan menambah informasi baru yang tidak ada di dokumen 01 sampai 06.
- Pindahkan konsep checklist VIBECODING_STEPS lama hanya sebagai Progress, Current Task, Next Task, dan Blocked jika relevan.
- Format harus mudah dipakai AI saat sesi baru.`;
      break;

    default:
      filePrompt = `Buat dokumen ${fileName} berdasarkan percakapan dan dokumen sebelumnya.`;
  }

  const conversationSection = fileIndex === 0
    ? `\nCONVERSATION:\n${conversation}`
    : '';

  return `${BASE_SYSTEM}

${filePrompt}
${contextSection}

OUTPUT FORMAT:
- Mulai dengan "# ${fileName}" sebagai heading level-1
- Tulis konten lengkap setelah heading
- Jangan tambahkan teks apapun sebelum atau sesudah file ini
- Jangan gunakan placeholder, "TODO", atau "sesuaikan dengan kebutuhan"
- Semua konten harus SPESIFIK dan LENGKAP
${conversationSection}

Generate only the file ${fileName} now.`;
}

async function generateDocs(supabase, sessionId, messages, config) {
  const { data: session } = await supabase
    .from('sessions')
    .select('generated_files')
    .eq('id', sessionId)
    .single();

  let existingFiles = (session?.generated_files || {});
  let previewLimit = countGeneratedSpecFiles(existingFiles) > 2 ? 2000 : 0;

  for (let i = 0; i < FILE_ORDER.length; i++) {
    const fileName = FILE_ORDER[i];

    if (existingFiles[fileName]) continue;

    const prompt = buildDocPrompt(i, messages, existingFiles, previewLimit);

    let aiResponse = '';

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        aiResponse = await callAI(prompt, config);
        if (aiResponse) break;
      } catch (err) {
        const msg = err.message || '';
        const isRetryable = msg.includes('quota') || msg.includes('rate') || msg.includes('429');
        if (attempt < 2) {
          const delay = isRetryable ? 30000 * (attempt + 1) : 5000 * Math.pow(2, attempt);
          console.log(`Retry ${fileName} attempt ${attempt + 1} after ${delay}ms: ${msg.slice(0, 100)}`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    if (!aiResponse) {
      throw new Error(`Failed to generate ${fileName} after 3 attempts`);
    }

    let fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;

    const placeholderPatterns = [
      /TODO/i, /TBD/i, /placeholder/i,
      /sesuaikan\s+dengan\s+kebutuhan/i,
      /ganti\s+dengan/i, /ubah\s+sesuai/i,
      /isi\s+dengan/i, /contoh:\s*\w+/i,
      /misalnya:?\s*\w+/i,
    ];
    const hasPlaceholder = placeholderPatterns.some(p => p.test(fileContent));

    if (hasPlaceholder) {
      const correctionPrompt = `${prompt}\n\nPERINGATAN: Hasil generate sebelumnya mengandung placeholder (TODO, "sesuaikan", "ganti dengan", dll). HARAM menggunakan placeholder. Tulis ulang dengan konten SPESIFIK dan LENGKAP. Jangan gunakan kata "TODO", "sesuaikan", "ganti dengan", "contoh", atau "misalnya".`;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          aiResponse = await callAI(correctionPrompt, config);
          break;
        } catch (err) {
          if (attempt < 1) {
            await new Promise(r => setTimeout(r, 5000 * Math.pow(2, attempt)));
          }
        }
      }
      fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;
    }

    const { data: latestSession } = await supabase
      .from('sessions')
      .select('generated_files')
      .eq('id', sessionId)
      .single();

    const latestFiles = latestSession?.generated_files || {};
    if (latestFiles[fileName]) {
      existingFiles = latestFiles;
      continue;
    }

    existingFiles = { ...latestFiles, [fileName]: fileContent };

    const updateData = {
      generated_files: existingFiles,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (updateError) {
      throw new Error(`Failed to save ${fileName}: ${updateError.message}`);
    }

    await new Promise(r => setTimeout(r, 1500));

    if (countGeneratedSpecFiles(existingFiles) > 2) {
      previewLimit = 2000;
    }
  }

  // Final consistency check against PRD
  const { data: latestBeforeConsistency } = await supabase
    .from('sessions')
    .select('generated_files')
    .eq('id', sessionId)
    .single();
  existingFiles = latestBeforeConsistency?.generated_files || existingFiles;

  const consistencyPrompt = buildConsistencyPrompt(existingFiles);
  if (consistencyPrompt) {
    try {
      const consistencyResponse = await callAI(consistencyPrompt, config);
      if (!consistencyResponse.includes('SEMUA KONSISTEN')) {
        const sections = consistencyResponse.split(/\n(?=# .+\.md)/);
        let repairedCount = 0;
        for (const section of sections) {
          const firstNewline = section.indexOf('\n');
          if (firstNewline === -1) continue;
          const header = section.slice(0, firstNewline).trim();
          const content = section.slice(firstNewline + 1).trim();
          const match = header.match(/^# (.+\.md)$/);
          if (match && existingFiles[match[1]] && match[1] !== '01_PRD.md') {
            existingFiles[match[1]] = `# ${match[1]}\n\n${content}`;
            repairedCount++;
          }
        }
        if (repairedCount === 0) {
          throw new Error('Consistency check did not return valid document repairs');
        }
        await supabase
          .from('sessions')
          .update({ generated_files: existingFiles, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      }
    } catch (err) {
      throw err;
    }
  }

  await supabase
    .from('sessions')
    .update({ generated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

const N8N_SYSTEM_PROMPT = `Anda adalah senior n8n workflow engineer. Tugas Anda adalah membuat workflow n8n yang AKURAT, SIAP PAKAI, dan BEBAS ERROR berdasarkan percakapan user di bawah.

PENTING: Workflow harus valid saat di-import ke n8n. DILARANG keras menggunakan placeholder, "TODO", "ganti dengan...", atau "sesuaikan". Semua parameter harus terisi nilai konkret.

========================================
CONTOH WORKFLOW VALID (jadikan referensi)
========================================
{
  "name": "Kirim Notifikasi Email untuk Order Baru",
  "nodes": [
    {
      "id": "webhook-001",
      "name": "Terima Order dari Shopee",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 300],
      "parameters": { "path": "shopee-new-order", "httpMethod": "POST", "responseMode": "onReceived", "options": {} }
    },
    {
      "id": "respond-001",
      "name": "Konfirmasi ke Shopee",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": { "respondWith": "json", "options": { "responseBody": "={{\\n  \\"status\\": \\"ok\\", \\"message\\": \\"Order diterima\\"\n}}" } }
    },
    {
      "id": "set-001",
      "name": "Siapkan Data Email",
      "type": "n8n-nodes-base.set",
      "typeVersion": 2,
      "position": [500, 300],
      "parameters": { "values": { "string": [ { "name": "toEmail", "value": "={{ \\$json.customer_email }}" }, { "name": "subject", "value": "Order Baru #{{ \\$json.order_id }}" } ] }, "options": {} }
    },
    {
      "id": "email-001",
      "name": "Kirim Email Notifikasi",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 1,
      "position": [750, 300],
      "parameters": { "fromEmail": "noreply@tokoku.com", "toEmail": "={{ \\$json.toEmail }}", "subject": "={{ \\$json.subject }}", "text": "Halo, order baru diterima.", "options": {} }
    }
  ],
  "connections": {
    "Terima Order dari Shopee": [ [ { "node": "Konfirmasi ke Shopee", "type": "main", "index": 0 } ] ],
    "Konfirmasi ke Shopee": [ [ { "node": "Siapkan Data Email", "type": "main", "index": 0 } ] ],
    "Siapkan Data Email": [ [ { "node": "Kirim Email Notifikasi", "type": "main", "index": 0 } ] ]
  }
}

=============================
ATURAN PENTING
=============================
1. Workflow HARUS valid JSON siap import — tidak boleh error di n8n
2. Gunakan nama node deskriptif (bukan "Webhook" tapi "Terima Pesanan")
3. Posisi node: trigger di x:0, proses di x:250-500, output di x:750+
4. Branching: atur posisi y berbeda untuk tiap cabang
5. Kredential kosongkan — user isi sendiri setelah import
6. typeVersion: 2 untuk node modern (Webhook, HTTP Request, Set), 1 untuk sisanya
7. Minimal workflow: 1 trigger + 1 proses + 1 output

=============================
OUTPUT FORMAT — HARUS JSON MURNI
=============================
{
  "workflow": {
    "name": "Nama Workflow",
    "nodes": [ ... ],
    "connections": { ... }
  },
  "setupInstructions": "markdown dengan 10 seksi lengkap"
}

=============================
PERCAKAPAN USER
=============================`;

function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function generateId() {
  return 'node-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function autoFixWorkflow(workflow) {
  const fixes = [];
  const nodes = workflow.nodes;
  if (!Array.isArray(nodes)) return { workflow, fixes };

  const hasWebhook = nodes.some(n => n.type === 'n8n-nodes-base.webhook');
  const hasRespond = nodes.some(n => n.type === 'n8n-nodes-base.respondToWebhook');

  if (hasWebhook && !hasRespond) {
    const webhookNode = nodes.find(n => n.type === 'n8n-nodes-base.webhook');
    const webhookName = (webhookNode?.name) || 'Webhook';
    const respondId = generateId();
    const respondNode = {
      id: respondId,
      name: 'Balas Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [250, 300],
      parameters: { respondWith: 'json', options: {} },
    };

    const lastNode = nodes[nodes.length - 1];
    const lastX = (lastNode?.position?.[0] || 250) + 250;
    respondNode.position = [lastX, 300];
    nodes.push(respondNode);

    let connections = workflow.connections || {};
    const connectionsObj = connections;
    const webhookConns = connectionsObj[webhookName];

    if (webhookConns && webhookConns.length > 0) {
      const firstTarget = webhookConns[0]?.[0]?.node;
      if (firstTarget) {
        connectionsObj[respondNode.name] = [
          [{ node: firstTarget, type: 'main', index: 0 }],
        ];
        webhookConns[0] = [{ node: respondNode.name, type: 'main', index: 0 }];
      }
    }
    workflow.connections = connectionsObj;
    fixes.push('Auto-fix: Menambahkan Respond to Webhook node');
  }

  for (const node of nodes) {
    if (!node.id || node.id === '') {
      node.id = generateId();
      fixes.push(`Auto-fix: Mengisi ID untuk node "${node.name}"`);
    }
    if (node.typeVersion === undefined || node.typeVersion === null) {
      const typeStr = node.type || '';
      if (typeStr.includes('webhook') || typeStr.includes('httpRequest') || typeStr.includes('set')) {
        node.typeVersion = 2;
      } else {
        node.typeVersion = 1;
      }
      fixes.push(`Auto-fix: Mengisi typeVersion untuk node "${node.name}"`);
    }
  }

  return { workflow, fixes };
}

function validateN8nWorkflow(workflowJson) {
  const errors = [];
  const warnings = [];
  const KNOWN_PREFIXES = ['n8n-nodes-base.', 'n8n-nodes-langchain.', '@n8n/'];

  let parsed;
  try {
    parsed = JSON.parse(workflowJson);
  } catch {
    return { valid: false, errors: ['Invalid JSON'], warnings: [], workflow: null };
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    errors.push('Missing or invalid "name"');
  }

  const nodes = parsed.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push('Missing or empty "nodes"');
    return { valid: false, errors, warnings: [], workflow: null };
  }

  if (nodes.length < 2) {
    errors.push('Minimal 2 nodes');
  }

  const nodeNames = new Set();
  const nodeIds = new Set();
  let hasWebhook = false;
  let hasRespondWebhook = false;
  let hasTrigger = false;

  for (const node of nodes) {
    if (!node.name || typeof node.name !== 'string') {
      errors.push(`Node missing name`);
    } else if (nodeNames.has(node.name)) {
      errors.push(`Duplicate name: "${node.name}"`);
    } else {
      nodeNames.add(node.name);
    }

    if (!node.id || typeof node.id !== 'string') {
      errors.push(`Node "${node.name}" missing id`);
    } else if (nodeIds.has(node.id)) {
      errors.push(`Duplicate id: "${node.id}"`);
    } else {
      nodeIds.add(node.id);
    }

    if (!node.type || typeof node.type !== 'string') {
      errors.push(`Node "${node.name}" missing type`);
    } else {
      const nodeType = node.type;
      const valid = KNOWN_PREFIXES.some(p => nodeType.startsWith(p));
      if (!valid) errors.push(`Node "${node.name}" invalid type prefix`);
      if (nodeType === 'n8n-nodes-base.webhook') { hasWebhook = true; hasTrigger = true; }
      if (nodeType === 'n8n-nodes-base.respondToWebhook') hasRespondWebhook = true;
      if (nodeType === 'n8n-nodes-base.scheduleTrigger') hasTrigger = true;
    }
  }

  if (hasWebhook && !hasRespondWebhook) {
    errors.push('Webhook tanpa Respond to Webhook');
  }
  if (!hasTrigger) {
    errors.push('Tidak ada trigger node');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    workflow: errors.length === 0 ? parsed : null,
  };
}

async function generateN8n(supabase, sessionId, messages, config) {
  const conversation = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const prompt = `${N8N_SYSTEM_PROMPT}\n${conversation}`;

  let parsed = null;
  let lastError = '';
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let currentPrompt = prompt;
    if (attempt > 0 && lastError) {
      currentPrompt += `\n\nPERBAIKAN (Attempt ${attempt + 1}):\nGenerate sebelumnya memiliki error:\n${lastError}\n\nPerbaiki workflow dan pastikan tidak ada error yang sama.`;
    }

    const aiResponse = await callAI(currentPrompt, config);

    try {
      const cleaned = aiResponse.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      const jsonStr = extractJson(cleaned);
      if (!jsonStr) {
        lastError = 'AI response tidak mengandung JSON valid';
        continue;
      }
      const raw = JSON.parse(jsonStr);

      if (raw.workflow && typeof raw.workflow === 'object') {
        const fixed = autoFixWorkflow(raw.workflow);
        raw.workflow = fixed.workflow;
        const workflowJson = JSON.stringify(raw.workflow, null, 2);
        const validation = validateN8nWorkflow(workflowJson);

        if (validation.valid) {
          parsed = {
            workflow: raw.workflow,
            setupInstructions: typeof raw.setupInstructions === 'string' ? raw.setupInstructions : '',
          };
          if (fixed.fixes.length > 0) {
            parsed.setupInstructions = (parsed.setupInstructions || '') +
              '\n\n### Catatan Auto-Fix\n' + fixed.fixes.map(f => `- ${f}`).join('\n');
          }
          break;
        } else {
          lastError = 'Workflow tidak valid: ' + validation.errors.join('; ');
        }
      } else {
        lastError = 'Response tidak memiliki field "workflow"';
      }
    } catch (e) {
      lastError = 'Gagal parse JSON: ' + (e.message || String(e));
    }
  }

  if (!parsed) {
    throw new Error(`Gagal generate n8n workflow setelah ${MAX_ATTEMPTS} percobaan. ${lastError ? 'Error: ' + lastError : ''}`);
  }

  const updateData = {
    n8n_workflow: parsed.workflow,
    n8n_generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (parsed.setupInstructions) {
    updateData.n8n_setup_instructions = parsed.setupInstructions;
  }

  const { error: updateError } = await supabase
    .from('sessions')
    .update(updateData)
    .eq('id', sessionId);

  if (updateError) {
    throw new Error('Gagal menyimpan workflow: ' + updateError.message);
  }
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { sessionId, mode } = body;

  if (!sessionId || !mode) {
    return new Response(JSON.stringify({ error: 'sessionId and mode required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: providerConfig } = await supabase
      .from('provider_configs')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('is_active', true)
      .single();

    if (!providerConfig) {
      return new Response(JSON.stringify({ error: 'No active provider' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = decrypt(providerConfig.api_key);

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const aiConfig = {
      providerName: providerConfig.provider_name || 'gemini',
      apiKey,
      modelName: providerConfig.model_name || 'gemini-2.5-flash',
      baseUrl: providerConfig.base_url || undefined,
      maxTokens: 32000,
    };

    await supabase
      .from('sessions')
      .update({ updated_at: new Date().toISOString(), generation_status: 'generating', generation_error: null })
      .eq('id', sessionId);

    if (mode === 'n8n') {
      await generateN8n(supabase, sessionId, messages, aiConfig);
    } else {
      await generateDocs(supabase, sessionId, messages, aiConfig);
    }

    await supabase
      .from('sessions')
      .update({ updated_at: new Date().toISOString(), generation_status: 'completed' })
      .eq('id', sessionId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorMsg = err.message || 'Unknown error';
    try {
      await supabase
        .from('sessions')
        .update({ updated_at: new Date().toISOString(), generation_status: 'failed', generation_error: errorMsg })
        .eq('id', sessionId);
    } catch {}

    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
