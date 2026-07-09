# Vibecoding Docs Generator

Aplikasi web untuk membantu user menggali kebutuhan proyek melalui chat AI, lalu menghasilkan dokumen spesifikasi atau workflow n8n dari hasil percakapan. Aplikasi memakai Next.js App Router, Supabase Auth/PostgreSQL/Storage, dan abstraksi multi AI provider.

## Fitur Utama

- Chat requirement discovery dalam Bahasa Indonesia.
- Mode generate dokumentasi spesifikasi proyek.
- Mode generate n8n workflow dan setup instructions.
- Multi-provider AI: Gemini, OpenRouter, Groq, DeepSeek, dan OpenAI-compatible custom endpoint.
- Session history, generated files, download ZIP, dan attachment upload.
- API key provider disimpan terenkripsi di database dan hanya dipakai server-side.

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript 5
- TailwindCSS
- Supabase Auth, PostgreSQL, Storage
- Zustand
- Jest dan Playwright
- Netlify Functions untuk background generate

## Persiapan Lokal

Install dependency:

```bash
npm install
```

Buat file `.env.local` dan isi variabel berikut:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_SECRET=
CRON_SECRET=
```

Catatan:

- `ENCRYPTION_SECRET` wajib kuat dan stabil karena dipakai untuk encrypt/decrypt API key provider.
- `SUPABASE_SERVICE_ROLE_KEY` hanya boleh tersedia di server/runtime deployment, jangan expose ke client.
- Detail environment yang dihasilkan generator akan masuk ke `04_PROJECT_STANDARDS.md`.

## Setup Supabase

1. Buat project Supabase.
2. Jalankan semua migration di folder `supabase/migrations` secara berurutan.
3. Pastikan bucket `chat-attachments` dibuat oleh migration dan policy storage sudah aktif.
4. Aktifkan email/password auth di Supabase Auth.

Migration penting:

- `001_initial_schema.sql`: tabel profile, session, message, provider config, dan RLS dasar.
- `005_add_message_attachments.sql`: kolom attachment dan bucket storage.
- `012_restrict_chat_attachment_storage.sql`: policy storage agar file hanya bisa diakses pemilik session.

## Menjalankan Aplikasi

Development server:

```bash
npm run dev
```

Buka `http://localhost:3000`.

Build production:

```bash
npm run build
npm run start
```

## Testing

Unit test:

```bash
npm test
```

Coverage:

```bash
npm run test:coverage
```

End-to-end test:

```bash
npm run test:e2e
```

## Keamanan

- API key AI provider dienkripsi sebelum disimpan ke database.
- Endpoint provider tidak mengirim API key mentah atau decrypted key ke frontend.
- Upload attachment memvalidasi session milik user login.
- Metadata attachment chat divalidasi agar `storagePath` harus berada di `{user_id}/{session_id}/...`.
- Supabase Storage policy membatasi akses object berdasarkan user dan session owner.
- Endpoint cleanup memakai `CRON_SECRET` dan service role client server-side.

## Deployment Netlify

1. Set semua environment variable di Netlify.
2. Pastikan `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_SECRET`, dan `CRON_SECRET` tidak diawali `NEXT_PUBLIC_`.
3. Deploy aplikasi dengan konfigurasi `netlify.toml`.
4. Netlify Function `netlify/functions/generate-background.mjs` dipakai untuk background generate saat production.

## Dokumentasi Tambahan

Generator dokumentasi proyek menghasilkan 9 file bernomor:

- `01_PRD.md`
- `02_ARCHITECTURE.md`
- `03_DATA_MODELS.md`
- `04_PROJECT_STANDARDS.md`
- `05_DESIGN_SYSTEM.md`
- `06_DELIVERY.md`
- `07_AGENT_CONTEXT.md`
- `08_TASKS.md`
- `09_AI_RULES.md`

Sistem otomatis mengklasifikasikan provider/model sebagai low, medium, atau high context. Model low-context memakai prompt lebih hemat dan task lebih atomic agar cocok untuk model gratis/9router.

Dokumentasi internal aplikasi ini tetap tersedia di folder `docs/`.
