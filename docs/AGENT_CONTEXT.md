# AGENT_CONTEXT.md  
Root AI Context File  
Program Generate Dokumentasi Instruksi Untuk Vibecoding  

---

# 1. High-Level Project Overview

Program Generate Dokumentasi Instruksi Untuk Vibecoding adalah aplikasi web berbasis AI yang memungkinkan pengguna berinteraksi dengan model AI untuk merancang blueprint proyek software secara sistematis.

Aplikasi ini:

- Bekerja seperti ChatGPT
- Memiliki fokus khusus pada perancangan proyek software
- Menghasilkan 9 file dokumentasi engineering dalam format Markdown
- Mendukung multi AI provider (Gemini, OpenRouter, Groq, DeepSeek, OpenAI-compatible)
- Menggunakan free-tier infrastructure
- Dideploy di Netlify
- Menggunakan Supabase sebagai database

Output utama sistem adalah paket dokumentasi:

1. PRD.md  
2. ARCHITECTURE.md  
3. REQUIREMENTS.md  
4. DATA_MODELS.md  
5. ENV_SCHEMA.md  
6. CONVENTIONS.md  
7. TEST_STRATEGY.md  
8. VIBECODING_STEPS.md  
9. AGENT_CONTEXT.md  

---

# 2. Core Purpose of This System

Tujuan sistem:

- Menghilangkan planning paralysis
- Memberikan struktur profesional sebelum coding
- Membantu vibecoding secara sistematis
- Menyediakan dokumentasi yang siap dibaca AI agent di sesi berikutnya

---

# 3. Tech Stack Summary

## Frontend

- Next.js 14.x
- React 18
- TypeScript 5.x
- TailwindCSS
- ShadCN UI
- Zustand (state management)

## Backend

- Next.js Route Handlers
- Supabase PostgreSQL
- Supabase Auth
- AI Provider Abstraction Layer

## AI Providers

- Gemini (default free tier)
- OpenRouter
- Groq
- DeepSeek
- OpenAI-compatible endpoint

## Deployment

- Netlify
- Supabase Free Tier

---

# 4. Key System Architecture

## Layered Architecture

1. UI Layer
2. State Layer (Zustand)
3. API Layer (Next.js route handler)
4. AI Provider Abstraction Layer
5. Database Layer (Supabase)
6. External AI Provider

---

## Simplified Flow

User → UI → API → AI Provider → API → DB → UI

Generate Flow:

User → API/generate → AI → Markdown Engine → ZIP Engine → UI Download

---

# 5. Folder Structure Overview
/app
/api
/chat
/generate
/sessions
/providers
/(dashboard)
/chat
/history
/settings

/components
/lib
/ai
/db
/utils
/store
/types


---

# 6. Database Structure Overview

Tables:

- profiles
- sessions
- messages
- provider_configs

Relasi utama:

- User memiliki banyak session
- Session memiliki banyak message
- User memiliki banyak provider config
- Hanya satu provider aktif per user

RLS aktif pada semua tabel.

---

# 7. Core Features Summary

✅ Interactive AI requirement discovery  
✅ Stop generation feature  
✅ Multi provider switching  
✅ Session history  
✅ Session deletion  
✅ Markdown generation (9 files)  
✅ ZIP export  
✅ Elegant responsive UI  
✅ Secure API key storage  

---

# 8. Security Model

- Supabase Auth
- RLS enforced
- API key encrypted
- Server-side AI call only
- No API key exposed to frontend
- HttpOnly cookie auth

---

# 9. Current Project Status

Status: ✅ Planning & Documentation Completed  

Completed:

- PRD
- Architecture Design
- Dependency Planning
- Database Schema
- Environment Schema
- Code Conventions
- Testing Strategy
- Atomic Build Plan

Belum dilakukan:

- Implementasi kode
- Setup Supabase
- Integrasi AI provider
- Deployment

---

# 10. System Constraints

- 100% Free Tier
- No paid services
- No collaboration feature (single user only)
- No real-time multi-device sync (phase 1)
- No code scaffolding generator (documentation only)

---

# 11. Design Principles

UI:

- Dark mode first
- Modern & professional
- No purple tones
- Emerald / Cyan accent
- Clean spacing
- Mobile-first responsive

Code:

- Strong typing (TypeScript)
- 80%+ coverage
- Conventional commits
- Modular AI abstraction

---

# 12. AI Behavior Guidelines (Important for Future Sessions)

AI yang membaca file ini harus:

- Selalu menjaga konsistensi antar 9 dokumen
- Tidak mengubah struktur standar file
- Tidak menghapus bagian penting
- Selalu mempertahankan format Markdown
- Mengikuti CONVENTIONS.md
- Mengikuti REQUIREMENTS.md versi dependency

Jika ada perubahan arsitektur:
- Semua dokumen harus diperbarui konsisten

---

# 13. Current Task / Next Step

NEXT STEP:

Mulai implementasi PHASE 1 dari VIBECODING_STEPS.md:

Step 1:
Initialize Next.js project with:
- TypeScript
- Tailwind
- ESLint
- Prettier

Setelah itu lanjut ke:
- Setup folder structure
- Setup Supabase
- Implement database schema

---

# 14. How AI Should Continue From Here

Jika sesi baru dimulai:

1. Baca AGENT_CONTEXT.md terlebih dahulu
2. Periksa Current Task
3. Lanjutkan dari step berikutnya dalam VIBECODING_STEPS.md
4. Jangan mengulang perencanaan kecuali diminta
5. Pastikan perubahan sinkron di seluruh dokumentasi

---