# AGENTS.md — Vibecoding Docs Generator

Panduan spesifik repositori untuk AI coding agent. Bahasa Indonesia dipakai di semua kode, komentar, dan interaksi UI (kecuali `09_AI_RULES.md` yang wajib English).

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Dev server (Next.js 14 App Router) |
| `npm test` | Jest unit tests (hanya `tests/`, skip `tests/e2e/`) |
| `npm run test:coverage` | Jest + coverage (threshold 80% di `lib/**/*.ts`) |
| `npm run test:e2e` | Playwright E2E (auto-start dev server, Chromium saja) |
| `npm run lint` | ESLint (`next/core-web-vitals` + `prettier` + `unused-imports`) |
| `npm run build` | `next build` |
| `npx tsc --noEmit` | Type-check (tidak ada di package.json, jalan terpisah) |

**Urutan run:** `npm run lint && npx tsc --noEmit && npm test && npm run build`

## Arsitektur

- **Rendering:** Next.js 14 App Router (`app/`) — route groups `(auth)`, `(dashboard)`
- **Style:** TailwindCSS + `class` dark mode (always dark via `app/providers.tsx`: `next-themes` `ThemeProvider`, `defaultTheme="dark"`, `enableSystem: false`)
- **Auth:** Supabase SSR (`@supabase/ssr`). Server client = `lib/db/supabaseServerClient.ts` (cookies). Browser client = `lib/db/supabaseBrowserClient.ts`.
- **Middleware:** `middleware.ts` melindungi `/chat`, `/history`, `/settings`. Redirect `/login`/`/register` → `/chat` jika sudah login.
- **State:** Zustand (`store/useChatStore.ts`). Mode: `'docs'` | `'n8n'`.
- **Enkripsi:** AES-256-GCM, prefix `v2:`. `ENCRYPTION_SECRET` wajib stabil — tidak ada migrasi untuk kunci terenkripsi yang sudah ada. Legacy CBC (`v1`) masih didukung untuk decrypt.
- **AI Providers:** `lib/ai/` — Gemini, OpenRouter, Groq, DeepSeek, custom OpenAI-compatible. Factory pattern `provider.factory.ts`.
- **Hooks:** `hooks/useInactivityTimeout.ts` — session timeout otomatis.
- **CI/CD:** Tidak ada CI pipeline (tidak ada `.github/`). Tidak ada pre-commit hooks.

## Struktur Proyek

```
lib/
  ai/          # Implementasi AI provider
  db/          # Supabase clients (server + browser)
  utils/       # Shared logic: apiAuth, encryption, generate, workflowJson, docQuality, dll
app/
  api/         # 15 route API (auth, chat, generate, providers, sessions, upload, cleanup-files)
  (dashboard)/ # chat/, generate/results/, history/, settings/
  (auth)/      # login/, register/, forgot-password/, update-password/
components/ui/ # 16 komponen UI (ChatWindow, MarkdownRenderer, SessionManager, dll)
store/         # Zustand store
hooks/         # useInactivityTimeout
tests/         # Jest (8 file, bukan __tests__)
  e2e/         # Playwright E2E (auth.spec.ts saja)
supabase/migrations/  # 15 migrations (001–015, skip 006), run in order
netlify/       # Netlify function + shared utilities (duplikasi dari lib/)
docs/          # Output generated app (9 file spesifikasi), bukan dokumentasi dev
```

## API Conventions

- Semua API route pakai `withAuth` HOF dari `lib/utils/apiAuth.ts` (wrapper Supabase auth check)
- Signature handler: `(_req: Request, _context: { params: Record<string, string> })`
- Error response: `{ success: false, error: { code: string, message: string } }`
- Ownership check: `checkOwnership(supabase, user, tableName, recordId)` → `{ notFound, forbidden }`

## Generation Pipeline

- **2 mode:** `docs` (9 file markdown bernomor) atau `n8n` (workflow JSON + setup instructions)
- **9 docs output:** `01_PRD.md` → `02_ARCHITECTURE.md` → `03_DATA_MODELS.md` → `04_PROJECT_STANDARDS.md` → `05_DESIGN_SYSTEM.md` → `06_DELIVERY.md` → `07_AGENT_CONTEXT.md` → `08_TASKS.md` → `09_AI_RULES.md`
- **Dual code path:**
  - Client-initiated: `app/api/generate/sequential/route.ts` → `lib/utils/generate.ts` (pakai `buildFilePrompt` dari `sequentialPrompts.ts`)
  - Background (production): `netlify/functions/generate-background.mjs` (pakai `buildDocPrompt` — duplikasi dari `buildFilePrompt`)
- **Context levels:** Providers/models diklasifikasikan sebagai low/medium/high context (mempengaruhi ukuran prompt dan atomisitas task)
- **Background gen:** Netlify function (`netlify/functions/generate-background.mjs`) diproteksi `BACKGROUND_SECRET` via header `X-Background-Secret`
- **Batasan:** `FILE_ORDER` dan `FILE_LABELS` terduplikasi di `lib/utils/sequentialPrompts.ts` dan `netlify/shared/constants.mjs` — wajib sinkron manual
- **Netlify shared/:** `netlify/shared/` berisi duplikasi logika enkripsi, AI, dan utility dari `lib/` — karena Netlify Function runtime tidak bisa import TS dengan path alias `@/`

## Testing Notes

- `tests/` saja — tidak ada `__tests__`. Test import via `@/` alias.
- Test set `process.env.ENCRYPTION_SECRET` inline (contoh: `'test-secret-key-for-unit-testing-32ch'`)
- Coverage exclude `lib/db/**` dan `lib/ai/*.provider.ts` (terlalu banyak branches/mocks)
- E2E pakai `webServer` config: auto-start dev server, reuse existing jika sudah jalan
- Selector E2E harus cocok dengan teks Bahasa Indonesia (contoh: heading `'Vibecoding Docs'`, `'Buat Akun'`)

## Environment

Variabel wajib (set `.env.local` dan Netlify):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_SECRET` — stabil; mengubahnya merusak kunci provider terenkripsi
- `CRON_SECRET`
- `BACKGROUND_SECRET` — untuk background function (`X-Background-Secret` header)

## Deployment

- **Platform:** Netlify dengan `@netlify/plugin-nextjs` + `netlify.toml`
- **Build:** `next build`, Node 20
- **Background function:** `netlify/functions/generate-background.mjs` (entrypoint terpisah, import dari `netlify/shared/`)
- **Supabase:** Jalan semua migrasi di `supabase/migrations/` berurutan; bucket `chat-attachments` wajib ada
- **Auth:** Email/password enabled di Supabase Auth

## Constraints Penting

- `ENCRYPTION_SECRET` pake salt hardcoded di `lib/utils/encryption.ts:11` — jangan diubah, tidak ada migration path
- `ChatContent.tsx` (`app/(dashboard)/chat/ChatContent.tsx`, ~859 baris) — sengaja tidak didekomposisi; hindari refactor besar
- `buildDocPrompt` (.mjs) vs `buildFilePrompt` (.ts) — duplikasi naming, tidak digabung karena boundary deployment
- `lang="id"` di root layout (`app/layout.tsx:24`)
- `PLAYWRIGHT_SECRET` tidak dipakai — endpoint background pakai `BACKGROUND_SECRET`
- `session-ses_*.md` ada di `.gitignore` — file session note aman di-commit tanpa sengaja
