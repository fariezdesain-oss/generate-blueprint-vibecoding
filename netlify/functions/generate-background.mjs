// Netlify background function for long-running doc/n8n generation.
// ponytail: orchestration only — shared logic lives in ../shared/.
import { createClient } from '@supabase/supabase-js';
import { FILE_ORDER, FILE_LABELS } from '../shared/constants.mjs';
import { extractJson, generateId, autoFixWorkflow, validateN8nWorkflow } from '../shared/utils.mjs';
import {
  decrypt, detectModelCapabilities, isFallbackableAIError,
  buildAIConfig, buildProviderFallbackCandidates, callAI, generateWithProviderFallback,
} from '../shared/ai.mjs';

function countGeneratedSpecFiles(files) {
  if (!files) return 0;
  return FILE_ORDER.filter(name => typeof files[name] === 'string' && files[name].trim().length > 0).length;
}

async function updateSessionWithRetry(supabase, sessionId, updateData) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (!error) return;
    lastError = error;
    await new Promise(r => setTimeout(r, 1000));
  }

  throw lastError || new Error('Failed to update session');
}

async function updateGenerationProgress(supabase, sessionId, progress) {
  try {
    await supabase
      .from('sessions')
      .update({ generation_progress: progress, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  } catch {}
}

function getPreviewLimit(config) {
  if (typeof config.previewLimit === 'number') return config.previewLimit;
  if (config.contextLevel === 'low') return 900;
  if (config.contextLevel === 'medium') return 1600;
  return 3000;
}

function buildProgress(fileIndex, fileName, fileProgress, stage, message) {
  return {
    currentFileIndex: fileIndex,
    currentFileName: fileName,
    currentFileProgress: fileProgress,
    overallProgress: Math.round(((fileIndex + fileProgress / 100) / FILE_ORDER.length) * 100),
    stage,
    message,
  };
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
    const text = previewLimit > 0
      ? extractDocumentSummary(content, previewLimit)
      : content;
    return `--- ${name} (REFERENSI) ---\n${text}`;
  }).join('\n\n');
}

const BASE_SYSTEM = `Anda adalah senior software architect dan technical writer. Output Anda harus presisi, terstruktur, dan lengkap. WAJIB GUNAKAN BAHASA INDONESIA.

ATURAN KUALITAS:
1. KONSISTENSI - 9 dokumen dalam satu proyek HARUS konsisten satu sama lain. 01_PRD.md adalah ACUAN UTAMA. Jika ada konflik, ikuti 01_PRD.md.
2. BATAS DOKUMEN - tulis hanya topik yang diminta pada dokumen saat ini. Jangan mencampur PRD, arsitektur, data model, standar proyek, design system, delivery, dan agent context.
3. DILARANG placeholder - jangan gunakan "TODO", "TBD", "sesuaikan dengan kebutuhan", "ganti dengan...", atau kata serupa. Semua konten harus terisi dengan nilai SPESIFIK dan KONKRET.
4. LENGKAP - setiap bagian yang disebutkan dalam template harus diisi. Jangan lewati bagian manapun.
5. SPESIFIK - gunakan contoh konkret, bukan abstraksi. Misalnya jangan tulis "framework populer" tapi tulis "Next.js 14.2 dengan App Router".
6. CROSS-REFERENCE - setiap klaim teknis harus konsisten dengan 01_PRD.md. Jika ada konflik, 01_PRD.md selalu menang.
7. ZERO HALLUCINATION - jangan mengarang fitur, teknologi, tabel, API, atau requirement yang tidak ada di percakapan atau dokumen referensi. Jika informasi tidak ada: BERHENTI dan minta klarifikasi. JANGAN mengisi dengan asumsi. JANGAN melanjutkan dengan konteks yang tidak jelas. Setiap klaim teknis harus bisa ditelusuri ke percakapan user atau dokumen sebelumnya.
8. URUTAN IMPLEMENTASI - 08_TASKS.md WAJIB menyusun phase dengan urutan: FASE 1 setup dan konfigurasi awal proyek; FASE 2 desain dan implementasi UI (halaman, komponen, routing, state); FASE 3 integrasi API/backend dari sisi frontend (fetch, form, auth flow di UI); FASE 4 backend/API logic (endpoint, database, business logic); FASE 5 integrasi penuh frontend-backend; FASE 6 testing, security, deployment. AI implementer WAJIB mengerjakan FASE 2 sebelum FASE 4.`;

function buildConsistencyPrompt(files) {
  const prdContent = files ? files['01_PRD.md'] : null;
  if (!prdContent) return '';

  let prompt = `Anda adalah senior QA document reviewer. Periksa KONSISTENSI 9 dokumen spesifikasi proyek berikut.

01_PRD.md adalah ACUAN UTAMA yang HARUS diikuti oleh SEMUA dokumen lainnya.

Tugas Anda:
1. Baca 01_PRD.md sebagai acuan utama.
2. Baca dokumen 02 sampai 09.
3. Periksa kontradiksi, istilah tidak selaras, fitur hilang, tech stack tidak konsisten, dan boundary dokumen yang tercampur.
4. Jika SEMUA konsisten, balas hanya dengan teks: SEMUA KONSISTEN
5. Jika ada yang perlu diperbaiki, keluarkan ULANG hanya file yang bermasalah secara LENGKAP, diawali dengan "# NAMAFILE.md".

--- 01_PRD.md (ACUAN UTAMA - LENGKAP) ---
${prdContent}
`;

  for (const name of FILE_ORDER.filter(fileName => fileName !== '01_PRD.md')) {
    if (files[name]) {
      prompt += `\n--- ${name} (RINGKASAN) ---\n${extractDocumentSummary(files[name], 1000)}\n`;
    }
  }

  prompt += `\nSETELAH memeriksa, jika SEMUA KONSISTEN balas "SEMUA KONSISTEN". Jika ada kontradiksi, keluarkan ULANG hanya file bermasalah LENGKAP dengan perbaikan, diawali dengan "# NAMAFILE.md".`;

  return prompt;
}

// ponytail: keep in sync with docSummary.ts extractDocumentSummary
function extractDocumentSummary(content, maxChars) {
  if (!content) return '';
  if (content.length <= maxChars) return content;

  const lines = content.split('\n');
  const extractedLines = [];
  let currentLength = 0;
  let inCodeBlock = false;
  let paragraphLinesAdded = 0;

  for (const line of lines) {
    if (line.startsWith('\`\`\`')) inCodeBlock = !inCodeBlock;

    const isHeading = line.startsWith('#');
    const isEmpty = line.trim() === '';

    if (isHeading) {
      paragraphLinesAdded = 0;
      extractedLines.push(line);
      currentLength += line.length + 1;
    } else if (!isEmpty && !inCodeBlock && paragraphLinesAdded < 3) {
      extractedLines.push(line);
      currentLength += line.length + 1;
      paragraphLinesAdded++;
    }

    if (currentLength >= maxChars * 0.8) break;
  }

  const remainingTarget = maxChars - currentLength;
  if (remainingTarget > 100) {
    const tail = content.slice(-remainingTarget);
    return extractedLines.join('\n') + '\n\n... [potongan] ...\n\n' + tail;
  }

  return extractedLines.join('\n') + '\n\n... [dokumen dipotong untuk menghemat konteks]';
}

// ponytail: buildDocPrompt parallels sequentialPrompts.ts buildFilePrompt — keep in sync.
function buildDocPrompt(fileIndex, messages, previousFiles, previewLimit, contextLevel = 'high', projectState, rollingSummary) {
  const fileName = FILE_ORDER[fileIndex];
  
  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
  
  function isProjectStateUseful(state) {
    if (!isPlainObject(state)) return false;
    return Object.values(state).some(value => {
      if (Array.isArray(value)) return value.length > 0;
      if (isPlainObject(value)) return isProjectStateUseful(value);
      return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
    });
  }
  
  function buildProjectContext(state, summary) {
    const sections = [];
    if (isProjectStateUseful(state)) {
      sections.push(`PROJECT STATE (SUMBER KEBENARAN TERSTRUKTUR):\n${JSON.stringify(state, null, 2)}`);
    }
    if (summary?.trim()) {
      sections.push(`ROLLING SUMMARY (RINGKASAN PERCAKAPAN):\n${summary.trim()}`);
    }
    return sections.join('\n\n');
  }

  const projectContext = buildProjectContext(projectState, rollingSummary);
  const hasProjectContext = isProjectStateUseful(projectState) || !!rollingSummary?.trim();

  const conversation = formatConversation(messages);
  const prdSection = formatPRDFull(previousFiles);
  const otherSection = formatOtherFiles(previousFiles, previewLimit);
  const isPrdVeryLong = prdSection.length > 8000;

  let contextSection = '';
  if (prdSection || otherSection) {
    contextSection = '\n\nREFERENSI DOKUMEN SEBELUMNYA:\n\n';
    if (prdSection) contextSection += prdSection + '\n';
    if (otherSection) contextSection += '\n' + otherSection;
    if (isPrdVeryLong) {
      contextSection += '\n\n[CATATAN: PRD di atas sangat lengkap. Fokus pada informasi yang RELEVAN untuk dokumen ini saja. Hindari mengulang semua detail PRD — cukup referensikan jika diperlukan.]';
    }
  }

  let filePrompt = '';

  switch (fileName) {
    case '01_PRD.md':
      filePrompt = `Buat dokumen 01_PRD.md. Dokumen ini HANYA membahas "apa yang dibangun". Dokumen ini adalah SINGLE SOURCE OF TRUTH untuk semua dokumen lain. Tulis seolah AI implementer hanya membaca PRD ini saat terjadi konflik; setiap fitur harus cukup jelas untuk diimplementasikan tanpa asumsi.

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
- URUTAN BACA WAJIB (BACA DULU SEBELUM APAPUN): 07_AGENT_CONTEXT.md → 01_PRD.md → 08_TASKS.md → 09_AI_RULES.md → dokumen teknis terkait task
- File acuan per jenis task: 02_ARCHITECTURE.md untuk arsitektur, 03_DATA_MODELS.md untuk database, 04_PROJECT_STANDARDS.md untuk coding standard, 05_DESIGN_SYSTEM.md untuk UI/UX, 06_DELIVERY.md untuk testing/deploy
- Rujukan implementasi: mulai dari 08_TASKS.md dan patuhi 09_AI_RULES.md
- Urutan implementasi: Frontend dulu (UI/komponen/routing/state) → baru Backend (API/database/server logic)
- Larangan urutan: jangan kerjakan backend sebelum skeleton UI dan komponen utamanya ada
- Anti-halusinasi: DO NOT ASSUME ANYTHING NOT IN THESE DOCUMENTS; IF UNSURE, RE-READ 01_PRD.md FIRST

ATURAN KHUSUS:
- Jangan panjang.
- Jangan menambah informasi baru yang tidak ada di dokumen 01 sampai 06.
- Pindahkan konsep checklist VIBECODING_STEPS lama hanya sebagai Progress, Current Task, Next Task, dan Blocked jika relevan.
- Tulis jelas bahwa implementasi wajib dimulai dari 08_TASKS.md dan mengikuti 09_AI_RULES.md.
- Format harus mudah dipakai AI saat sesi baru.`;
      break;

    case '08_TASKS.md':
      filePrompt = `Buat dokumen 08_TASKS.md. Dokumen ini adalah daftar task atomic untuk proses vibecoding, terutama agar aman dipakai model AI gratis, lambat, atau low-context.

WAJIB berisi:
- Prinsip penggunaan task: kerjakan berurutan, satu task per sesi AI jika model terbatas
- Phase pembangunan linear dari setup sampai release dengan urutan frontend-first: setup → UI/komponen/routing/state → integrasi API dari frontend → backend/API/database logic → integrasi penuh → testing/security/deploy
- Task atomic dengan format tabel: ID, Phase, Goal, Dokumen Wajib Dibaca, Input Dokumen Acuan, Instruksi Untuk AI, Expected Output, Definition of Done, Test/Check Command, Depends On
- Tiap task harus kecil, spesifik, dan bisa dikerjakan tanpa membaca semua dokumen sekaligus
- Aturan berhenti jika blocker muncul
- Cara melanjutkan setelah task selesai

ATURAN URUTAN WAJIB:
- Phase FRONTEND (UI, halaman, komponen, routing, state management) HARUS dikerjakan SEBELUM phase BACKEND (API endpoint, database logic, server-side logic).
- Alasan: memastikan UI shape, user flow, dan data contract jelas sebelum implementasi server.
- Jangan buat task backend fungsional sebelum semua halaman utama dan komponen UI-nya sudah ada skeleton/struktur dasarnya.

ATURAN KHUSUS:
- Jangan membuat task terlalu besar.
- Jangan menggabungkan banyak fitur dalam satu task.
- Pastikan setiap task menunjuk Dokumen Wajib Dibaca secara eksplisit dari 01 sampai 09.
- Setiap task harus bisa dikerjakan model low-context tanpa membaca semua dokumen; hanya baca file yang tercantum di kolom Dokumen Wajib Dibaca.
- Tulis task agar user bisa copy-paste satu task ke model AI gratis/9router.`;
      break;

    case '09_AI_RULES.md':
      filePrompt = `Buat dokumen 09_AI_RULES.md. Dokumen ini adalah aturan kerja AI saat mengimplementasikan proyek agar tidak ngawur, terutama untuk model gratis, lambat, atau low-context. KHUSUS dokumen ini: tulis output dalam ENGLISH agar bisa dipahami model AI internasional.

WAJIB berisi dalam English:
- Session Start Protocol: read 07_AGENT_CONTEXT.md, then 01_PRD.md, then current task in 08_TASKS.md, then only referenced docs for that task
- Required reading order before coding
- Low-context model rules
- How to execute tasks from 08_TASKS.md
- Frontend-First Rule: always implement UI skeleton, pages, routing, state, and components before writing backend/API/database logic. Never write an API endpoint for a feature that has no UI skeleton yet.
- Stop-and-Ask Rule: if context is missing, unclear, contradictory, or not traceable to 01_PRD.md or referenced docs, STOP and ask the user. Never guess, invent, or continue with assumptions.
- Zero Hallucination Rules: never assume features outside 01_PRD.md, never use libraries outside 02_ARCHITECTURE.md, never create tables/fields outside 03_DATA_MODELS.md, stop and ask if context is missing
- Anti-Drift Rules: never refactor unrelated code, never add scope, never guess env secrets, never continue with unclear context
- Duties: short plan first, small edits, run task-specific tests, report changed files, report blockers, confirm Definition of Done before moving to next task
- Ready-to-copy prompt template for another AI model
- Recovery flow if AI errors, times out, loses context, or rate-limit happens
- Quality checklist before a task is considered done

ATURAN KHUSUS:
- Fokus pada instruksi operasional untuk AI implementer.
- Jangan mengulang PRD panjang.
- Jangan menambah fitur baru di luar dokumen sebelumnya.
- Buat aturan tegas tapi tetap praktis untuk model AI gratis/9router.`;
      break;

    default:
      filePrompt = `Buat dokumen ${fileName} berdasarkan percakapan dan dokumen sebelumnya.`;
  }

  const conversationSection = fileIndex === 0
    ? hasProjectContext
      ? `\n${projectContext}\n\nCATATAN: Gunakan Project State sebagai sumber utama. Chat history tidak dikirim untuk menghemat konteks dan menghindari timeout.`
      : `\nCONVERSATION:\n${conversation}`
    : '';
  const contextModeInstruction = contextLevel === 'low'
    ? '\nMODE LOW-CONTEXT:\n- Tulis padat, tetap lengkap secara operasional.\n- Prioritaskan poin penting, tabel, dan checklist.\n- Hindari pengulangan panjang dari dokumen referensi.\n- Jika detail perlu dipecah, buat struktur task kecil yang mudah dilanjutkan.'
    : '';

  return `${BASE_SYSTEM}

${filePrompt}
${contextModeInstruction}
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

async function generateDocs(supabase, sessionId, messages, config, fallbackCandidates) {
  const { data: session } = await supabase
    .from('sessions')
    .select('generated_files, project_state, rolling_summary')
    .eq('id', sessionId)
    .single();

  let existingFiles = (session?.generated_files || {});

  const pushProgress = async (i, fileName, progress, stage, message) => {
    await updateGenerationProgress(supabase, sessionId, buildProgress(i, fileName, progress, stage, message));
  };

  for (let i = 0; i < FILE_ORDER.length; i++) {
    const fileName = FILE_ORDER[i];

    if (existingFiles[fileName]) continue;

    const fileLabel = FILE_LABELS[fileName] || fileName;
    await pushProgress(i, fileName, 0, 'preparing', `Menganalisis konteks untuk ${fileLabel}...`);

    const candidates = fallbackCandidates && fallbackCandidates.length ? fallbackCandidates : [{ id: 'primary', config, isPrimary: true }];
    const buildPromptForConfig = candidateConfig => {
      const candidatePreviewLimit = countGeneratedSpecFiles(existingFiles) > 2 ? getPreviewLimit(candidateConfig) : 0;
      return buildDocPrompt(
        i,
        messages,
        existingFiles,
        candidatePreviewLimit,
        candidateConfig.contextLevel || 'high',
        session?.project_state,
        session?.rolling_summary
      );
    };

    await pushProgress(i, fileName, 25, 'generating', `Menulis ${fileLabel}...`);
    let result = await generateWithProviderFallback(candidates, buildPromptForConfig);
    let aiResponse = result.response;

    let fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;

    await pushProgress(i, fileName, 70, 'generating', `Memeriksa kualitas ${fileLabel}...`);

    const placeholderPatterns = [
      /TODO/i, /TBD/i, /placeholder/i,
      /sesuaikan\s+dengan\s+kebutuhan/i,
      /ganti\s+dengan/i, /ubah\s+sesuai/i,
      /isi\s+dengan/i, /contoh:\s*\w+/i,
      /misalnya:?\s*\w+/i,
    ];
    const hasPlaceholder = placeholderPatterns.some(p => p.test(fileContent));

    if (hasPlaceholder) {
      await pushProgress(i, fileName, 80, 'fixing_placeholders', `Memperbaiki placeholder di ${fileLabel}...`);
      const correctionPrompt = `${buildPromptForConfig(result.config)}\n\nPERINGATAN: Hasil generate sebelumnya mengandung placeholder (TODO, "sesuaikan", "ganti dengan", dll). HARAM menggunakan placeholder. Tulis ulang dengan konten SPESIFIK dan LENGKAP. Jangan gunakan kata "TODO", "sesuaikan", "ganti dengan", "contoh", atau "misalnya".`;
      result = await generateWithProviderFallback(candidates, () => correctionPrompt, 2);
      aiResponse = result.response;
      fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;
    }

    await pushProgress(i, fileName, 95, 'saving', `Menyimpan ${fileLabel}...`);
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
    await updateSessionWithRetry(supabase, sessionId, updateData);

    await new Promise(r => setTimeout(r, 1500));

  }

  await updateGenerationProgress(supabase, sessionId, {
    currentFileIndex: FILE_ORDER.length - 1,
    currentFileName: FILE_ORDER[FILE_ORDER.length - 1],
    currentFileProgress: 100,
    overallProgress: 95,
    stage: 'consistency_check',
    message: 'Final consistency check...',
  });

  // Final consistency check against PRD
  const { data: latestBeforeConsistency } = await supabase
    .from('sessions')
    .select('generated_files')
    .eq('id', sessionId)
    .single();
  existingFiles = latestBeforeConsistency?.generated_files || existingFiles;

  const candidates = fallbackCandidates && fallbackCandidates.length ? fallbackCandidates : [{ id: 'primary', config, isPrimary: true }];
  const consistencyPrompt = config.consistencyMode === 'light' ? '' : buildConsistencyPrompt(existingFiles);
  if (consistencyPrompt) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const consistencyResult = await generateWithProviderFallback(candidates, () => consistencyPrompt, 2);
        const consistencyResponse = consistencyResult.response;
        if (consistencyResponse.includes('SEMUA KONSISTEN')) break;

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

        if (repairedCount > 0) {
          await updateSessionWithRetry(supabase, sessionId, { generated_files: existingFiles, updated_at: new Date().toISOString() });
        }
        break;
      } catch {
        if (attempt === 0) continue;
      }
    }
  }

  await updateGenerationProgress(supabase, sessionId, {
    currentFileIndex: FILE_ORDER.length - 1,
    currentFileName: FILE_ORDER[FILE_ORDER.length - 1],
    currentFileProgress: 100,
    overallProgress: 100,
    stage: 'done',
    message: 'Selesai',
  });

  await updateSessionWithRetry(supabase, sessionId, { generated_at: new Date().toISOString() });
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

  const backgroundSecret = process.env.BACKGROUND_SECRET;
  if (!backgroundSecret || req.headers.get('X-Background-Secret') !== backgroundSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
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

    const providerName = providerConfig.provider_name || 'gemini';
    const modelName = providerConfig.model_name || 'gemini-2.5-flash';
    const capabilities = detectModelCapabilities(providerName, modelName);

    const aiConfig = {
      providerName,
      apiKey,
      modelName,
      baseUrl: providerConfig.base_url || undefined,
      maxTokens: capabilities.maxTokens,
      contextLevel: capabilities.contextLevel,
      timeoutMs: capabilities.timeoutMs,
      retryCount: capabilities.retryCount,
      previewLimit: capabilities.previewLimit,
      consistencyMode: capabilities.consistencyMode,
    };

    const startedAt = new Date().toISOString();
    const { error: startUpdateError } = await supabase
      .from('sessions')
      .update({ updated_at: startedAt, generation_status: 'generating', generation_error: null, generation_started_at: startedAt })
      .eq('id', sessionId);

    if (startUpdateError) {
      await supabase
        .from('sessions')
        .update({ updated_at: startedAt, generation_status: 'generating', generation_error: null })
        .eq('id', sessionId);
    }

    if (mode === 'n8n') {
      await generateN8n(supabase, sessionId, messages, aiConfig);
    } else {
      const { data: allProviders } = await supabase
        .from('provider_configs')
        .select('id, provider_name, model_name, api_key, base_url, is_active, created_at')
        .eq('user_id', session.user_id);
      const fallbackCandidates = buildProviderFallbackCandidates(allProviders || []);
      await generateDocs(supabase, sessionId, messages, aiConfig, fallbackCandidates);
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
