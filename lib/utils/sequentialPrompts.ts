export const FILE_ORDER: string[] = [
  '01_PRD.md',
  '02_ARCHITECTURE.md',
  '03_DATA_MODELS.md',
  '04_PROJECT_STANDARDS.md',
  '05_DESIGN_SYSTEM.md',
  '06_DELIVERY.md',
  '07_AGENT_CONTEXT.md',
];

export const FILE_LABELS: Record<string, string> = {
  '01_PRD.md': 'Product Requirements Document',
  '02_ARCHITECTURE.md': 'System Architecture',
  '03_DATA_MODELS.md': 'Data Models & Database Schema',
  '04_PROJECT_STANDARDS.md': 'Project Standards',
  '05_DESIGN_SYSTEM.md': 'Design System',
  '06_DELIVERY.md': 'Testing, Security & Delivery',
  '07_AGENT_CONTEXT.md': 'Root AI Context File',
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
      const text = previewLimit > 0 && content.length > previewLimit
        ? content.slice(0, previewLimit) + '\n\n... [dokumen dipotong untuk menghemat konteks]'
        : content;
      return `--- ${name} (REFERENSI) ---\n${text}`;
    })
    .join('\n\n');
}

const BASE_SYSTEM = `Anda adalah senior software architect dan technical writer. Output Anda harus presisi, terstruktur, dan lengkap. WAJIB GUNAKAN BAHASA INDONESIA.

ATURAN KUALITAS:
1. KONSISTENSI - 7 dokumen dalam satu proyek HARUS konsisten satu sama lain. 01_PRD.md adalah ACUAN UTAMA. Jika ada konflik, ikuti 01_PRD.md.
2. BATAS DOKUMEN - tulis hanya topik yang diminta pada dokumen saat ini. Jangan mencampur PRD, arsitektur, data model, standar proyek, design system, delivery, dan agent context.
3. DILARANG placeholder - jangan gunakan "TODO", "TBD", "sesuaikan dengan kebutuhan", "ganti dengan...", atau kata serupa. Semua konten harus terisi dengan nilai SPESIFIK dan KONKRET.
4. LENGKAP - setiap bagian yang disebutkan dalam template harus diisi. Jangan lewati bagian manapun.
5. SPESIFIK - gunakan contoh konkret, bukan abstraksi. Misalnya jangan tulis "framework populer" tapi tulis "Next.js 14.2 dengan App Router".`;

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

  for (const name of FILE_ORDER.filter((fileName) => fileName !== '01_PRD.md')) {
    if (files[name]) prompt += `\n--- ${name} ---\n${files[name]}\n`;
  }

  prompt += `\nSETELAH memeriksa, jika SEMUA KONSISTEN balas "SEMUA KONSISTEN". Jika ada kontradiksi, keluarkan ULANG hanya file bermasalah LENGKAP dengan perbaikan, diawali dengan "# NAMAFILE.md".`;

  return prompt;
}

export function buildFilePrompt(
  fileIndex: number,
  messages: { role: string; content: string }[],
  previousFiles: Record<string, string>,
  previewLimit: number = 0,
): string {
  const fileName = FILE_ORDER[fileIndex];

  if (!checkConversation(messages) && fileIndex === 0) return insufficientContextMessage();

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

  const conversationSection = fileIndex === 0 ? `\nCONVERSATION:\n${conversation}` : '';

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
