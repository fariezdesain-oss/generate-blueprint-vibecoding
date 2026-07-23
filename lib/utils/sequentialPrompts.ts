import { buildProjectContext, isProjectStateUseful, type ProjectState } from '@/lib/utils/projectState';
import { extractDocumentSummary } from '@/lib/utils/docSummary';

export const FILE_ORDER: string[] = [
  '01_PRD.md',
  '02_ARCHITECTURE.md',
  '03_DATA_MODELS.md',
  '04_PROJECT_STANDARDS.md',
  '05_DESIGN_SYSTEM.md',
  '06_DELIVERY.md',
  '07_AGENT_CONTEXT.md',
  '08_TASKS.md',
  '09_AI_RULES.md',
];

export const FILE_LABELS: Record<string, string> = {
  '01_PRD.md': 'Product Requirements Document',
  '02_ARCHITECTURE.md': 'System Architecture',
  '03_DATA_MODELS.md': 'Data Models & Database Schema',
  '04_PROJECT_STANDARDS.md': 'Project Standards',
  '05_DESIGN_SYSTEM.md': 'Design System',
  '06_DELIVERY.md': 'Testing, Security & Delivery',
  '07_AGENT_CONTEXT.md': 'Root AI Context File',
  '08_TASKS.md': 'Atomic Vibecoding Tasks',
  '09_AI_RULES.md': 'AI Implementation Rules',
};

export function countGeneratedSpecFiles(files: Record<string, string> | null | undefined): number {
  if (!files) return 0;
  return FILE_ORDER.filter((name) => typeof files[name] === 'string' && files[name].trim().length > 0).length;
}

export function hasAllSpecFiles(files: Record<string, string> | null | undefined): boolean {
  return countGeneratedSpecFiles(files) === FILE_ORDER.length;
}

export function getNextMissingSpecFile(files: Record<string, string> | null | undefined): string {
  if (!files) return FILE_ORDER[0];
  return FILE_ORDER.find((name) => !files[name] || files[name].trim().length === 0) || '';
}

function formatConversation(messages: { role: string; content: string }[]): string {
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
}

function formatPRDFull(files: Record<string, string>): string {
  const prdContent = files['01_PRD.md'];
  if (!prdContent) return '';
  return `--- 01_PRD.md (ACUAN UTAMA - LENGKAP) ---\n${prdContent}`;
}

function formatOtherFiles(files: Record<string, string>, previewLimit: number = 0): string {
  return FILE_ORDER
    .filter((name) => name !== '01_PRD.md' && files[name])
    .map((name) => {
      const content = files[name];
      const text = previewLimit > 0
        ? extractDocumentSummary(content, previewLimit)
        : content;
      return `--- ${name} (REFERENSI) ---\n${text}`;
    })
    .join('\n\n');
}

const BASE_SYSTEM = `Anda adalah senior software architect dan technical writer. Output Anda harus presisi, terstruktur, dan lengkap. WAJIB GUNAKAN BAHASA INDONESIA.

ATURAN KUALITAS:
1. KONSISTENSI KETAT - 9 dokumen dalam satu proyek HARUS konsisten secara absolut satu sama lain. 01_PRD.md adalah ACUAN UTAMA. Jika Anda diberikan file yang sudah di-generate sebelumnya (sebagai REFERENSI DOKUMEN SEBELUMNYA), Anda WAJIB merujuk padanya. DILARANG KERAS mengubah arsitektur, tech stack, skema database, atau nama variabel yang sudah didefinisikan di dokumen sebelumnya.
2. BATAS DOKUMEN - tulis hanya topik yang diminta pada dokumen saat ini. Jangan mencampur PRD, arsitektur, data model, standar proyek, design system, delivery, dan agent context.
3. DILARANG placeholder - jangan gunakan "TODO", "TBD", "sesuaikan dengan kebutuhan", "ganti dengan...", atau kata serupa. Semua konten harus terisi dengan nilai SPESIFIK dan KONKRET.
4. LENGKAP - setiap bagian yang disebutkan dalam template harus diisi. Jangan lewati bagian manapun.
5. SPESIFIK - gunakan contoh konkret, bukan abstraksi. Misalnya jangan tulis "framework populer" tapi tulis "Next.js 14.2 dengan App Router".
6. CROSS-REFERENCE - setiap klaim teknis harus konsisten dengan 01_PRD.md dan DOKUMEN SEBELUMNYA. Jika ada konflik, 01_PRD.md selalu menang, diikuti oleh dokumen dengan nomor urut lebih kecil.
7. ZERO HALLUCINATION - jangan mengarang fitur, teknologi, tabel, API, atau requirement yang tidak ada di percakapan atau dokumen referensi. Jika informasi tidak ada: BERHENTI dan minta klarifikasi. JANGAN mengisi dengan asumsi. Setiap klaim teknis harus bisa ditelusuri ke dokumen sebelumnya.
8. URUTAN IMPLEMENTASI - 08_TASKS.md WAJIB menyusun phase dengan urutan: FASE 1 setup dan konfigurasi awal proyek; FASE 2 desain dan implementasi UI (halaman, komponen, routing, state); FASE 3 integrasi API/backend dari sisi frontend (fetch, form, auth flow di UI); FASE 4 backend/API logic (endpoint, database, business logic); FASE 5 integrasi penuh frontend-backend; FASE 6 testing, security, deployment. AI implementer WAJIB mengerjakan FASE 2 sebelum FASE 4.`;

function checkConversation(messages: { role: string; content: string }[]): boolean {
  const fullText = messages.map((m) => m.content).join(' ').toLowerCase();
  const hasProblem = /membuat|bikin|bangun|aplikasi|program|sistem|website|mobile|fitur/.test(fullText);
  const hasGoal = /tujuan|masalah|solve|atasi|butuh|ingin|need/.test(fullText);
  return hasProblem || hasGoal;
}

function insufficientContextMessage(): string {
  return 'INSUFFICIENT_CONTEXT: Maaf, percakapan ini belum memiliki detail proyek yang cukup. Silakan lanjutkan diskusi dan tentukan dulu proyek atau program apa yang ingin Anda bangun.';
}

export function buildConsistencyPrompt(files: Record<string, string>): string {
  const prdContent = files['01_PRD.md'];
  if (!prdContent) return '';

  let prompt = `Anda adalah senior QA document reviewer. Periksa KONSISTENSI 9 dokumen spesifikasi proyek berikut.

01_PRD.md adalah ACUAN UTAMA yang HARUS diikuti oleh SEMUA dokumen lainnya.

Tugas Anda:
1. Baca 01_PRD.md sebagai acuan utama.
2. Baca ringkasan dokumen 02 sampai 09.
3. Periksa kontradiksi, istilah tidak selaras, fitur hilang, tech stack tidak konsisten, dan boundary dokumen yang tercampur.
4. Jika SEMUA konsisten, balas hanya dengan teks: SEMUA KONSISTEN
5. Jika ada yang perlu diperbaiki, keluarkan ULANG hanya file yang bermasalah secara LENGKAP, diawali dengan "# NAMAFILE.md".

--- 01_PRD.md (ACUAN UTAMA - LENGKAP) ---
${prdContent}
`;

  for (const name of FILE_ORDER.filter((fileName) => fileName !== '01_PRD.md')) {
    if (files[name]) {
      prompt += `\n--- ${name} (RINGKASAN) ---\n${extractDocumentSummary(files[name], 1000)}\n`;
    }
  }

  prompt += `\nSETELAH memeriksa, jika SEMUA KONSISTEN balas "SEMUA KONSISTEN". Jika ada kontradiksi, keluarkan ULANG hanya file bermasalah LENGKAP dengan perbaikan, diawali dengan "# NAMAFILE.md".`;

  return prompt;
}

export function buildSingleFileConsistencyPrompt(
  fileName: string,
  fileContent: string,
  files: Record<string, string>,
  previewLimit: number = 1200,
): string {
  const prdContent = files['01_PRD.md'];
  if (!prdContent || fileName === '01_PRD.md') return '';

  const otherFiles = FILE_ORDER
    .filter((name) => name !== fileName && name !== '01_PRD.md' && files[name])
    .map((name) => {
      const content = files[name];
      const text = extractDocumentSummary(content, previewLimit);
      return `--- ${name} (REFERENSI KONSISTENSI - WAJIB DIIKUTI) ---\n${text}`;
    })
    .join('\n\n');

  return `Anda adalah senior QA document reviewer sekaligus system architect. Tugas Anda adalah melakukan REGENERATE pada file ${fileName} dan memastikan konsistensinya dengan 01_PRD.md dan dokumen referensi lain yang sudah ada.

ATURAN REGENERATE:
1. 01_PRD.md adalah source of truth utama.
2. DOKUMEN REFERENSI LAINNYA ADALAH FINAL. Anda tidak boleh menentang arsitektur, tech stack, skema database, atau nama variabel yang sudah ada di dokumen referensi.
3. Jangan menambah fitur, teknologi, tabel, API, atau scope baru yang tidak ada di 01_PRD.md atau dokumen referensi.
4. Jaga topik utama file ${fileName} sesuai dengan batasan scope dokumennya (jangan campur aduk).
5. Jika file sudah konsisten dan tidak perlu perbaikan, balas HANYA dengan teks: KONSISTEN
6. Jika perlu diperbaiki atau di-regenerate, keluarkan HANYA isi lengkap file ${fileName} yang baru dan sudah konsisten, diawali dengan "# ${fileName}". Jangan beri komentar tambahan.

--- 01_PRD.md (SOURCE OF TRUTH) ---
${prdContent}

${otherFiles ? `${otherFiles}\n\n` : ''}--- ${fileName} (FILE YANG HARUS DI-REGENERATE / DIPERIKSA) ---
${fileContent}

Balas "KONSISTEN" jika sudah sempurna, atau keluarkan ulang seluruh isi file ${fileName} yang sudah diperbaiki.`;
}

export function buildFilePrompt(
  fileIndex: number,
  messages: { role: string; content: string }[],
  previousFiles: Record<string, string>,
  previewLimit: number = 0,
  contextLevel: 'low' | 'medium' | 'high' = 'high',
  projectState?: ProjectState,
  rollingSummary?: string,
): string {
  const fileName = FILE_ORDER[fileIndex];

  const projectContext = buildProjectContext(projectState, rollingSummary);
  const hasProjectContext = isProjectStateUseful(projectState) || !!rollingSummary?.trim();

  if (!hasProjectContext && !checkConversation(messages) && fileIndex === 0) return insufficientContextMessage();

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
