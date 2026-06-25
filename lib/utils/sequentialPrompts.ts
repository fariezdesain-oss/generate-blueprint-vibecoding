export const FILE_ORDER: string[] = [
  'PRD.md',
  'ARCHITECTURE.md',
  'REQUIREMENTS.md',
  'DATA_MODELS.md',
  'ENV_SCHEMA.md',
  'CONVENTIONS.md',
  'TEST_STRATEGY.md',
  'SECURITY.md',
  'DEPLOYMENT.md',
  'CHANGELOG.md',
  'VIBECODING_STEPS.md',
  'AGENT_CONTEXT.md',
];

export const FILE_LABELS: Record<string, string> = {
  'PRD.md': 'Product Requirements Document',
  'ARCHITECTURE.md': 'System Architecture',
  'REQUIREMENTS.md': 'Dependency & Version Management',
  'DATA_MODELS.md': 'Database Schema & Data Models',
  'ENV_SCHEMA.md': 'Environment Variable Schema',
  'CONVENTIONS.md': 'Code & Project Conventions',
  'TEST_STRATEGY.md': 'Testing Strategy',
  'SECURITY.md': 'Security Document',
  'DEPLOYMENT.md': 'Deployment Guide',
  'CHANGELOG.md': 'Changelog & ADR',
  'VIBECODING_STEPS.md': 'Master Build Checklist',
  'AGENT_CONTEXT.md': 'Root AI Context File',
};

function formatConversation(messages: { role: string; content: string }[]): string {
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
}

function formatPRDFull(files: Record<string, string>): string {
  const prdContent = files['PRD.md'];
  if (!prdContent) return '';
  return `--- PRD.md (ACUAN UTAMA — LENGKAP) ---\n${prdContent}`;
}

function formatOtherFiles(
  files: Record<string, string>,
  previewLimit: number = 0,
): string {
  return Object.entries(files)
    .filter(([name]) => name !== 'PRD.md')
    .map(([name, content]) => {
      const text = previewLimit > 0 && content.length > previewLimit
        ? content.slice(0, previewLimit) + '\n\n... [dokumen dipotong untuk menghemat konteks]'
        : content;
      return `--- ${name} (REFERENSI) ---\n${text}`;
    })
    .join('\n\n');
}

const BASE_SYSTEM = `Anda adalah senior software architect dan technical writer. Output Anda harus presisi, terstruktur, dan lengkap. WAJIB GUNAKAN BAHASA INDONESIA.

ATURAN KUALITAS:
1. KONSISTENSI — semua dokumen dalam satu proyek HARUS konsisten satu sama lain. PRD.md adalah ACUAN UTAMA. Jangan kontradiksi dengan PRD.md. Jika ada perbedaan, sesuaikan dengan PRD.md.
2. DILARANG placeholder — jangan gunakan "TODO", "TBD", "sesuaikan dengan kebutuhan", "ganti dengan...", atau kata serupa. Semua konten harus terisi dengan nilai SPESIFIK dan KONKRET.
3. LENGKAP — setiap bagian yang disebutkan dalam template harus diisi. Jangan lewati bagian manapun.
4. SPESIFIK — gunakan contoh konkret, bukan abstraksi. Misalnya jangan tulis "framework populer" tapi tulis "Next.js 14.2 dengan App Router".`;

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
  const prdContent = files['PRD.md'];
  if (!prdContent) return '';

  const otherEntries = Object.entries(files).filter(([name]) => name !== 'PRD.md');

  let prompt = `Anda adalah senior QA document reviewer. Periksa KONSISTENSI dokumen spesifikasi proyek berikut.

PRD.md adalah ACUAN UTAMA yang HARUS diikuti oleh SEMUA dokumen lainnya.

Tugas Anda:
1. Baca PRD.md (ACUAN UTAMA)
2. Baca dokumen lainnya
3. Periksa apakah ada KONTRADIKSI atau KETIDAKSESUAIAN dengan PRD.md
4. Jika SEMUA konsisten → balas hanya dengan teks: SEMUA KONSISTEN
5. Jika ada yang perlu diperbaiki → keluarkan ULANG file yang bermasalah LENGKAP dengan perbaikan, diawali dengan "# NAMAFILE.md"

--- PRD.md (ACUAN UTAMA - LENGKAP) ---
${prdContent}

`;

  for (const [name, content] of otherEntries) {
    prompt += `\n--- ${name} ---\n${content}\n`;
  }

  prompt += `\n\nSETELAH memeriksa, jika SEMUA KONSISTEN balas "SEMUA KONSISTEN". Jika ada yang kontradiksi, keluarkan ULANG file tersebut LENGKAP dengan perbaikan, diawali dengan "# NAMAFILE.md".`;

  return prompt;
}

export function buildFilePrompt(
  fileIndex: number,
  messages: { role: string; content: string }[],
  previousFiles: Record<string, string>,
  previewLimit: number = 0,
): string {
  const fileName = FILE_ORDER[fileIndex];

  if (!checkConversation(messages) && fileIndex === 0) {
    return insufficientContextMessage();
  }

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
      filePrompt = `Buat dokumen ARCHITECTURE.md (System Architecture Document) berdasarkan deskripsi proyek dan dokumen PRD.md sebagai acuan utama di bawah.

Dokumen ini WAJIB berisi:
- Detail tech stack beserta versi runtime yang digunakan (framework, bahasa, database, cache, ORM, auth, storage, deployment) — HARUS KONSISTEN dengan PRD.md
- Struktur folder proyek lengkap dengan keterangan fungsi tiap folder dan file penting
- Alur data antar modul menggunakan format diagram teks Mermaid.js (arsitektur umum dan sequence diagram request-response)
- Mekanisme autentikasi dan keamanan (jenis token, storage di client, expiry, refresh strategy, dan mitigasi ancaman seperti XSS/CSRF/SQL Injection)
- Strategi state management di frontend dan caching strategy di backend beserta TTL per jenis data

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan PRD.md. Jangan gunakan placeholder.`;
      break;

    case 'REQUIREMENTS.md':
      filePrompt = `Buat dokumen REQUIREMENTS.md (Dependency & Version Management) berdasarkan deskripsi proyek serta referensi PRD.md dan ARCHITECTURE.md di bawah.

Dokumen ini WAJIB berisi:
- Semua dependensi production dan development beserta versi spesifiknya yang stabil, dipisahkan berdasarkan layer atau modul aplikasi (core framework, database & ORM, autentikasi, state management, UI components, validasi, utilities, linting, testing)
- Versi runtime dan package manager yang digunakan beserta lock file yang wajib di-commit
- Catatan eksplisit tentang kombinasi versi yang tidak kompatibel untuk mencegah dependency hell

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan ARCHITECTURE.md.`;
      break;

    case 'DATA_MODELS.md':
      filePrompt = `Buat dokumen DATA_MODELS.md (Database Schema & Data Models) berdasarkan proyek dan referensi dokumen di bawah.

Dokumen ini WAJIB berisi:
- Skema database lengkap mencakup semua entitas, field, tipe data, primary key, foreign key, indeks, dan constraint per tabel
- Relasi antar tabel menggunakan format diagram teks Mermaid.js ERD
- Detail skema per tabel dalam bentuk tabel dokumentasi
- Draf skema dalam bahasa ORM yang dipakai (Prisma Schema, SQL DDL, atau Mongoose Schema)
- Strategi migrasi database termasuk tooling, branching migrasi, rollback, dan seeding data awal

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`;
      break;

    case 'ENV_SCHEMA.md':
      filePrompt = `Buat dokumen ENV_SCHEMA.md (Environment Variable Schema) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Daftar lengkap semua environment variable yang dibutuhkan aplikasi, dikelompokkan per kategori (application, database, authentication, OAuth, email, storage, payment, monitoring)
- Keterangan apakah setiap variabel bersifat wajib (required) atau opsional
- Contoh nilai samaran (mock values) yang aman untuk dicantumkan
- Deskripsi fungsi tiap variabel
- Tabel perbedaan nilai per environment (development, staging, production)
- File .env.example lengkap yang siap di-commit ke repository

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`;
      break;

    case 'CONVENTIONS.md':
      filePrompt = `Buat dokumen CONVENTIONS.md (Code & Project Conventions) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Aturan penamaan (naming conventions) untuk file, folder, variabel, fungsi, class, konstanta, enum, kolom database, dan environment variable menggunakan gaya yang konsisten (PascalCase, camelCase, snake_case, kebab-case, SCREAMING_SNAKE_CASE sesuai konteksnya)
- Konfigurasi ESLint dan Prettier yang digunakan beserta rules yang diterapkan
- Format standar API Response untuk kondisi sukses dan gagal yang wajib diikuti semua endpoint
- Daftar HTTP status code beserta kapan digunakan
- Struktur error global termasuk error codes yang distandarisasi dan custom error class
- Aturan Git commit message menggunakan Conventional Commits (feat, fix, docs, refactor, test, chore, dll)

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`;
      break;

    case 'TEST_STRATEGY.md':
      filePrompt = `Buat dokumen TEST_STRATEGY.md (Testing Strategy Document) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Filosofi dan pendekatan testing yang digunakan (misalnya Testing Trophy)
- Jenis test yang diterapkan (Unit, Integration, Component, E2E, API) beserta framework dan library yang dipakai untuk masing-masing jenis
- Target code coverage minimal per layer aplikasi (service, API route, utility, component, repository) dengan overall minimum yang ditetapkan
- Checklist skenario wajib lolos uji per fitur utama termasuk happy path dan error scenario
- Tabel edge cases yang harus diuji mencakup kategori input, autentikasi, database, file upload, rate limiting, dan pagination
- Cara menjalankan masing-masing jenis test dan setup database khusus untuk testing

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`;
      break;

    case 'SECURITY.md':
      filePrompt = `Buat dokumen SECURITY.md (Security Document) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Threat model aplikasi (aset yang dilindungi, potensi ancaman, dan tingkat risikonya)
- OWASP Top 10 checklist beserta status implementasi mitigasinya di proyek ini
- Kebijakan penanganan data sensitif dan PII (Personally Identifiable Information) termasuk enkripsi at-rest dan in-transit
- Konfigurasi rate limiting per endpoint beserta batas yang ditetapkan
- Kebijakan CORS (origin yang diizinkan, method, headers)
- Security headers yang wajib dipasang (CSP, HSTS, X-Frame-Options, dll)
- Prosedur dan kontak darurat jika terjadi security breach atau kebocoran data
- Kebijakan rotasi secret dan API key

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`;
      break;

    case 'DEPLOYMENT.md':
      filePrompt = `Buat dokumen DEPLOYMENT.md (Deployment Guide) berdasarkan proyek dan dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Daftar environment yang ada (development, staging, production) beserta URL, branch Git yang terhubung, dan kebijakan auto-deploy masing-masing
- Langkah-langkah deploy ke staging dan production secara detail
- Alur CI/CD pipeline dari push kode hingga live di server
- Prosedur menjalankan database migration saat deploy di production
- Prosedur rollback lengkap jika deploy gagal (revert kode, rollback migrasi, notifikasi tim)
- Daftar endpoint health check beserta expected response yang digunakan untuk monitoring ketersediaan sistem

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`;
      break;

    case 'CHANGELOG.md':
      filePrompt = `Buat dokumen CHANGELOG.md (Changelog & ADR) berdasarkan proyek dan dokumen sebelumnya. Ini adalah proyek yang BELUM mulai coding, jadi versi saat ini adalah v0.1.0 (initial draft).

Dokumen ini WAJIB berisi:
- Catatan perubahan per versi menggunakan format standar (Added, Changed, Fixed, Removed, Security) — versi 0.1.0 mencatat inisialisasi proyek
- Architecture Decision Records (ADR) yang mencatat keputusan teknis atau arsitektur penting beserta alasan di baliknya dan tanggal pengambilan keputusan

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan dokumen sebelumnya.`;
      break;

    case 'VIBECODING_STEPS.md':
      filePrompt = `Buat dokumen VIBECODING_STEPS.md (Master Build Checklist) berdasarkan proyek dan SEMUA dokumen sebelumnya.

Dokumen ini WAJIB berisi:
- Master checklist pembangunan aplikasi yang dipecah secara linear menjadi fase-fase besar (Setup, Autentikasi, Fitur Utama 1, Fitur Utama 2, Testing, Deployment)
- Di dalam setiap fase terdapat tugas-tugas mikro atomik yang tidak ambigu
- Setiap langkah wajib memiliki Definition of Done (DoD) berupa kriteria keberhasilan yang terukur dan spesifik
- Blocker log untuk mencatat hambatan yang ditemui beserta statusnya
- Instruksi cara menggunakan dokumen ini (kerjakan linear, jangan lanjut sebelum DoD terpenuhi)

Tulis konten LENGKAP dan SPESIFIK. Pastikan KONSISTEN dengan SEMUA dokumen sebelumnya.`;
      break;

    case 'AGENT_CONTEXT.md':
      filePrompt = `Buat dokumen AGENT_CONTEXT.md (Root AI Context File) — dokumen PALING AKHIR yang merangkum SEMUA dokumen 1-11.

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

Tulis konten LENGKAP yang merangkum SEMUA dokumen 1-11. Jangan tambahkan informasi baru yang tidak ada di dokumen sebelumnya.`;
      break;

    default:
      filePrompt = `Buat dokumen ${fileName} berdasarkan deskripsi proyek dari percakapan dan dokumen sebelumnya yang sudah ada.`;
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
