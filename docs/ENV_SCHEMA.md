# ENV_SCHEMA.md  
Environment Variable Schema  
Program Generate Dokumentasi Instruksi Untuk Vibecoding  

---

## 1. Tujuan Dokumen

Dokumen ini mendefinisikan seluruh environment variable yang digunakan oleh aplikasi untuk:

- Local development
- Staging
- Production (Netlify)

Setiap variabel mencakup:

- Nama variabel
- Contoh nilai (mock value)
- Deskripsi fungsi
- Required / Optional

---

# 2. Global Runtime Configuration

## 2.1 Node Runtime

| Variable | Example | Required | Description |
|-----------|----------|----------|-------------|
| NODE_ENV | development | ✅ | Environment aplikasi (development / production) |
| NEXT_PUBLIC_APP_ENV | local | ✅ | Mode aplikasi (local / staging / production) |
| NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES | 30 | ❌ | Durasi inactivity timeout (dalam menit) sebelum auto-logout. Default: 30 |

---

# 3. Supabase Configuration

Digunakan untuk autentikasi, database, dan RLS.

| Variable | Example | Required | Description |
|-----------|----------|----------|-------------|
| NEXT_PUBLIC_SUPABASE_URL | https://xyzcompany.supabase.co | ✅ | URL project Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock | ✅ | Public anon key (frontend safe) |
| SUPABASE_SERVICE_ROLE_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service | ✅ (server) | Service role key (server only, jangan expose ke client) |

⚠️ `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di server-side (API route).

---

# 4. AI Provider Configuration (Server-Side Only)

Walaupun user dapat menyimpan API key di database, sistem tetap mendukung default fallback API key via environment.

## 4.1 Google Gemini

| Variable | Example | Required | Description |
|-----------|----------|----------|-------------|
| GEMINI_API_KEY | AIzaSyMockGeminiKey | ❌ | API key fallback Gemini |
| GEMINI_DEFAULT_MODEL | gemini-2.5-flash | ❌ | Default model jika user belum set |

---

## 4.2 OpenRouter

| Variable | Example | Required | Description |
|-----------|----------|----------|-------------|
| OPENROUTER_API_KEY | sk-or-v1-mock | ❌ | API key fallback OpenRouter |
| OPENROUTER_BASE_URL | https://openrouter.ai/api/v1 | ❌ | Custom endpoint |

---

## 4.3 Groq

| Variable | Example | Required | Description |
|-----------|----------|----------|-------------|
| GROQ_API_KEY | gsk_mock_key | ❌ | API key Groq console |

---

## 4.4 DeepSeek (OpenAI Compatible)

| Variable | Example | Required | Description |
|-----------|----------|----------|-------------|
| DEEPSEEK_API_KEY | sk-deepseek-mock | ❌ | API key DeepSeek |
| DEEPSEEK_BASE_URL | https://api.deepseek.com/v1 | ❌ | Endpoint DeepSeek |

---

## 4.5 OpenAI Compatible (Generic)

| Variable | Example | Required | Description |
|-----------|----------|----------|-------------|
| OPENAI_COMPATIBLE_API_KEY | sk-mock-key | ❌ | Generic API key |
| OPENAI_COMPATIBLE_BASE_URL | https://api.example.com/v1 | ❌ | Custom OpenAI-compatible endpoint |

---

# 5. Encryption & Security

Untuk mengenkripsi API key yang disimpan di database.

| Variable | Example | Required | Description |
|-----------|----------|----------|-------------|
| ENCRYPTION_SECRET | super-long-random-secret-32-chars | ✅ | Secret untuk encrypt/decrypt API key user |
| JWT_SECRET | ultra-secure-jwt-secret | ✅ | Secret tambahan jika dibutuhkan custom JWT |

✅ Minimal 32 karakter  
✅ Tidak boleh di-commit ke repository  

---

# 6. Netlify Deployment Variables

Tambahkan di Netlify Dashboard → Site Settings → Environment Variables.

Production biasanya hanya membutuhkan:
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ENCRYPTION_SECRET=...


AI provider fallback optional jika user menyimpan API key sendiri.

---

# 7. Local Development (.env.local)

Contoh file `.env.local`:
NODE_ENV=development
NEXT_PUBLIC_APP_ENV=local

NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key

ENCRYPTION_SECRET=local-super-secret-32-chars

GEMINI_API_KEY=your-local-gemini-key
GEMINI_DEFAULT_MODEL=gemini-2.5-flash


File ini:
✅ Tidak boleh di-commit  
✅ Masuk ke `.gitignore`

---

# 8. Environment Separation Strategy

## 8.1 Local
- Gunakan `.env.local`
- Debug mode aktif
- Logging verbose

## 8.2 Staging
- Supabase project terpisah
- AI key test
- Logging aktif

## 8.3 Production
- Supabase production
- Rate limit aktif
- Logging minimal
- Semua secret via Netlify environment

---

# 9. Variable Exposure Rules

### Boleh diakses frontend:
- NEXT_PUBLIC_*

### Tidak boleh diakses frontend:
- SUPABASE_SERVICE_ROLE_KEY
- ENCRYPTION_SECRET
- Semua API KEY provider
- JWT_SECRET

---

# 10. Security Best Practice

- Jangan pernah hardcode API key
- Gunakan server-side fetch untuk AI call
- Gunakan encryption sebelum menyimpan API key user
- Gunakan HTTPS (Netlify default)
- Aktifkan RLS Supabase

---

