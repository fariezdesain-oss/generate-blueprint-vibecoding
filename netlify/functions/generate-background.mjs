import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const FILE_ORDER = [
  'PRD.md', 'ARCHITECTURE.md', 'REQUIREMENTS.md', 'DATA_MODELS.md',
  'ENV_SCHEMA.md', 'CONVENTIONS.md', 'TEST_STRATEGY.md', 'SECURITY.md',
  'DEPLOYMENT.md', 'CHANGELOG.md', 'VIBECODING_STEPS.md', 'AGENT_CONTEXT.md',
];

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey() {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is not set');
  return crypto.scryptSync(secret, 'salt', 32);
}

function decrypt(encryptedText) {
  const key = getKey();
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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

function formatPreviousFiles(files, previewLimit) {
  const entries = files ? Object.entries(files) : [];
  return entries.map(([name, content]) => {
    const text = previewLimit > 0 && content.length > previewLimit
      ? content.slice(0, previewLimit) + '\n\n... [dokumen dipotong untuk menghemat konteks]'
      : content;
    return `--- ${name} ---\n${text}`;
  }).join('\n\n');
}

const BASE_SYSTEM = `Anda adalah senior software architect dan technical writer. Output Anda harus presisi, terstruktur, dan lengkap. WAJIB GUNAKAN BAHASA INDONESIA.

ATURAN KUALITAS:
1. KONSISTENSI — semua dokumen dalam satu proyek HARUS konsisten satu sama lain. Jangan kontradiksi dengan dokumen sebelumnya. Jika ada perbedaan, sesuaikan dengan dokumen yang sudah ada.
2. DILARANG placeholder — jangan gunakan "TODO", "TBD", "sesuaikan dengan kebutuhan", "ganti dengan...", atau kata serupa. Semua konten harus terisi dengan nilai SPESIFIK dan KONKRET.
3. LENGKAP — setiap bagian yang disebutkan dalam template harus diisi. Jangan lewati bagian manapun.
4. SPESIFIK — gunakan contoh konkret, bukan abstraksi. Misalnya jangan tulis "framework populer" tapi tulis "Next.js 14.2 dengan App Router".`;

function buildDocPrompt(fileIndex, messages, previousFiles, previewLimit) {
  const fileName = FILE_ORDER[fileIndex];
  const conversation = formatConversation(messages);
  const previousContent = formatPreviousFiles(previousFiles, previewLimit);

  let filePrompt = '';

  switch (fileName) {
    case 'PRD.md':
      filePrompt = `Buat dokumen PRD.md (Product Requirements Document) berdasarkan deskripsi proyek dari percakapan di bawah.

Dokumen ini WAJIB berisi:
- Problem statement (masalah nyata yang diselesaikan)
- Deskripsi aplikasi
- Tujuan aplikasi
- Target pengguna beserta persona-nya (minimal 2 persona)
- Daftar fitur utama (Core Features) yang diprioritaskan menggunakan metode MoSCoW (Must Have / Should Have / Could Have / Won't Have)
- Batasan sistem (Scope Constraints — apa yang secara eksplisit tidak dibuat di versi ini)
- Success metrics atau KPI yang terukur untuk menentukan keberhasilan aplikasi
- User Flow utama dalam bentuk teks langkah-langkah per skenario (minimal 3 skenario)
- Asumsi dan dependensi eksternal yang memengaruhi sistem

Tulis konten LENGKAP dan SPESIFIK untuk setiap bagian. Jangan gunakan placeholder atau "TODO".`;
      break;

    case 'ARCHITECTURE.md':
      filePrompt = `Buat dokumen ARCHITECTURE.md (System Architecture Document) berdasarkan deskripsi proyek dari percakapan dan dokumen PRD.md yang sudah ada di bawah.

Dokumen PRD.md yang sudah digenerate:
${previousContent}

Dokumen ini WAJIB berisi:
- Detail tech stack beserta versi runtime yang digunakan (framework, bahasa, database, cache, ORM, auth, storage, deployment) — HARUS KONSISTEN dengan PRD.md
- Struktur folder proyek lengkap dengan keterangan fungsi tiap folder dan file penting
- Alur data antar modul menggunakan format diagram teks Mermaid.js (arsitektur umum dan sequence diagram request-response)
- Mekanisme autentikasi dan keamanan (jenis token, storage di client, expiry, refresh strategy, dan mitigasi ancaman seperti XSS/CSRF/SQL Injection)
- Strategi state management di frontend dan caching strategy di backend beserta TTL per jenis data

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan PRD.md. Jangan gunakan placeholder.`;
      break;

    default: {
      const labels = {
        'REQUIREMENTS.md': `Buat dokumen REQUIREMENTS.md (Dependency & Version Management) berdasarkan deskripsi proyek, PRD.md, dan ARCHITECTURE.md yang sudah ada.

Dokumen ini WAJIB berisi:
- Semua dependensi production dan development beserta versi spesifiknya yang stabil, dipisahkan berdasarkan layer atau modul aplikasi (core framework, database & ORM, autentikasi, state management, UI components, validasi, utilities, linting, testing)
- Versi runtime dan package manager yang digunakan beserta lock file yang wajib di-commit
- Catatan eksplisit tentang kombinasi versi yang tidak kompatibel untuk mencegah dependency hell

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan ARCHITECTURE.md.`,
        'DATA_MODELS.md': `Buat dokumen DATA_MODELS.md (Database Schema & Data Models) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Skema database lengkap mencakup semua entitas, field, tipe data, primary key, foreign key, indeks, dan constraint per tabel
- Relasi antar tabel menggunakan format diagram teks Mermaid.js ERD
- Detail skema per tabel dalam bentuk tabel dokumentasi
- Draf skema dalam bahasa ORM yang dipakai (Prisma Schema, SQL DDL, atau Mongoose Schema)
- Strategi migrasi database termasuk tooling, branching migrasi, rollback, dan seeding data awal

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`,
        'ENV_SCHEMA.md': `Buat dokumen ENV_SCHEMA.md (Environment Variable Schema) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Daftar lengkap semua environment variable yang dibutuhkan aplikasi, dikelompokkan per kategori (application, database, authentication, OAuth, email, storage, payment, monitoring)
- Keterangan apakah setiap variabel bersifat wajib (required) atau opsional
- Contoh nilai samaran (mock values) yang aman untuk dicantumkan
- Deskripsi fungsi tiap variabel
- Tabel perbedaan nilai per environment (development, staging, production)
- File .env.example lengkap yang siap di-commit ke repository

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`,
        'CONVENTIONS.md': `Buat dokumen CONVENTIONS.md (Code & Project Conventions) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Aturan penamaan (naming conventions) untuk file, folder, variabel, fungsi, class, konstanta, enum, kolom database, dan environment variable menggunakan gaya yang konsisten (PascalCase, camelCase, snake_case, kebab-case, SCREAMING_SNAKE_CASE sesuai konteksnya)
- Konfigurasi ESLint dan Prettier yang digunakan beserta rules yang diterapkan
- Format standar API Response untuk kondisi sukses dan gagal yang wajib diikuti semua endpoint
- Daftar HTTP status code beserta kapan digunakan
- Struktur error global termasuk error codes yang distandarisasi dan custom error class
- Aturan Git commit message menggunakan Conventional Commits (feat, fix, docs, refactor, test, chore, dll)

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`,
        'TEST_STRATEGY.md': `Buat dokumen TEST_STRATEGY.md (Testing Strategy Document) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Filosofi dan pendekatan testing yang digunakan (misalnya Testing Trophy)
- Jenis test yang diterapkan (Unit, Integration, Component, E2E, API) beserta framework dan library yang dipakai untuk masing-masing jenis
- Target code coverage minimal per layer aplikasi (service, API route, utility, component, repository) dengan overall minimum yang ditetapkan
- Checklist skenario wajib lolos uji per fitur utama termasuk happy path dan error scenario
- Tabel edge cases yang harus diuji mencakup kategori input, autentikasi, database, file upload, rate limiting, dan pagination
- Cara menjalankan masing-masing jenis test dan setup database khusus untuk testing

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`,
        'SECURITY.md': `Buat dokumen SECURITY.md (Security Document) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Threat model aplikasi (aset yang dilindungi, potensi ancaman, dan tingkat risikonya)
- OWASP Top 10 checklist beserta status implementasi mitigasinya di proyek ini
- Kebijakan penanganan data sensitif dan PII (Personally Identifiable Information) termasuk enkripsi at-rest dan in-transit
- Konfigurasi rate limiting per endpoint beserta batas yang ditetapkan
- Kebijakan CORS (origin yang diizinkan, method, headers)
- Security headers yang wajib dipasang (CSP, HSTS, X-Frame-Options, dll)
- Prosedur dan kontak darurat jika terjadi security breach atau kebocoran data
- Kebijakan rotasi secret dan API key

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`,
        'DEPLOYMENT.md': `Buat dokumen DEPLOYMENT.md (Deployment Guide) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Daftar environment yang ada (development, staging, production) beserta URL, branch Git yang terhubung, dan kebijakan auto-deploy masing-masing
- Langkah-langkah deploy ke staging dan production secara detail
- Alur CI/CD pipeline dari push kode hingga live di server
- Prosedur menjalankan database migration saat deploy di production
- Prosedur rollback lengkap jika deploy gagal (revert kode, rollback migrasi, notifikasi tim)
- Daftar endpoint health check beserta expected response yang digunakan untuk monitoring ketersediaan sistem

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`,
        'CHANGELOG.md': `Buat dokumen CHANGELOG.md (Changelog & ADR) berdasarkan proyek dan dokumen sebelumnya. Ini adalah proyek yang BELUM mulai coding, jadi versi saat ini adalah v0.1.0 (initial draft).

Dokumen ini WAJIB berisi:
- Catatan perubahan per versi menggunakan format standar (Added, Changed, Fixed, Removed, Security) — versi 0.1.0 mencatat inisialisasi proyek
- Architecture Decision Records (ADR) yang mencatat keputusan teknis atau arsitektur penting beserta alasan di baliknya dan tanggal pengambilan keputusan

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`,
        'VIBECODING_STEPS.md': `Buat dokumen VIBECODING_STEPS.md (Master Build Checklist) berdasarkan proyek dan SEMUA dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Master checklist pembangunan aplikasi yang dipecah secara linear menjadi fase-fase besar (Setup, Autentikasi, Fitur Utama 1, Fitur Utama 2, Testing, Deployment)
- Di dalam setiap fase terdapat tugas-tugas mikro atomik yang tidak ambigu
- Setiap langkah wajib memiliki Definition of Done (DoD) berupa kriteria keberhasilan yang terukur dan spesifik
- Blocker log untuk mencatat hambatan yang ditemui beserta statusnya
- Instruksi cara menggunakan dokumen ini (kerjakan linear, jangan lanjut sebelum DoD terpenuhi)

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan SEMUA dokumen sebelumnya.`,
        'AGENT_CONTEXT.md': `Buat dokumen AGENT_CONTEXT.md (Root AI Context File) — dokumen PALING AKHIR yang merangkum SEMUA dokumen 1-11.

Dokumen ini adalah ROOT CONTEXT yang dirancang khusus agar AI dapat langsung memahami seluruh konteks proyek di awal sesi baru tanpa perlu penjelasan ulang.

WAJIB mencakup:
- Project overview (nama, deskripsi, status, versi)
- Tech stack ringkas dalam satu blok teks
- Ringkasan arsitektur sistem beserta alur request utama
- Gambaran struktur folder proyek
- Tabel status fitur (done, WIP, not started)
- Progress saat ini (fase dan step terakhir yang diselesaikan berikut step selanjutnya)
- Tabel keputusan teknis penting beserta alasannya
- Conventions quick reference (naming, commit, API response format)
- Lokasi file-file penting
- Bagian Next Task yang selalu diperbarui berisi deskripsi task saat ini, context yang relevan, dan hal yang tidak boleh dilakukan AI

Tulis konten LENGKAP yang merangkum SEMUA dokumen 1-11. Jangan tambahkan informasi baru yang tidak ada di dokumen sebelumnya.`,
      };
      filePrompt = labels[fileName] || `Buat dokumen ${fileName} berdasarkan deskripsi proyek dari percakapan dan dokumen sebelumnya yang sudah ada.`;
    }
  }

  const conversationSection = fileIndex === 0
    ? `\nCONVERSATION:\n${conversation}`
    : '';

  return `${BASE_SYSTEM}

${filePrompt}

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
  let previewLimit = Object.keys(existingFiles).length > 2 ? 2000 : 0;

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
        if (msg.includes('quota') || msg.includes('rate') || msg.includes('429')) {
          throw err;
        }
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
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
      aiResponse = await callAI(correctionPrompt, config);
      fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;
    }

    existingFiles[fileName] = fileContent;

    const updateData = {
      generated_files: existingFiles,
      updated_at: new Date().toISOString(),
    };
    if (i === FILE_ORDER.length - 1) {
      updateData.generated_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (updateError) {
      throw new Error(`Failed to save ${fileName}: ${updateError.message}`);
    }

    await new Promise(r => setTimeout(r, 1500));

    if (Object.keys(existingFiles).length > 2) {
      previewLimit = 2000;
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

    let apiKey = '';
    try {
      apiKey = decrypt(providerConfig.api_key);
    } catch {
      apiKey = providerConfig.api_key;
    }

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
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (mode === 'n8n') {
      await generateN8n(supabase, sessionId, messages, aiConfig);
    } else {
      await generateDocs(supabase, sessionId, messages, aiConfig);
    }

    await supabase
      .from('sessions')
      .update({ updated_at: new Date().toISOString() })
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
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch {}

    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
