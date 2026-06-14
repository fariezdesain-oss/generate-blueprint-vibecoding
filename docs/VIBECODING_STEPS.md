# VIBECODING_STEPS.md  
Master Build Checklist (Atomic Development Plan)  
Program Generate Dokumentasi Instruksi Untuk Vibecoding  

---

## 1. Tujuan Dokumen

Dokumen ini adalah checklist pembangunan aplikasi secara linear dan atomik.

Setiap langkah memiliki:

- Deskripsi tugas
- Output jelas
- Definition of Done (DoD)

Prinsip:

✅ Satu langkah = satu hasil konkret  
✅ Bisa diuji  
✅ Bisa diverifikasi  
✅ Tidak ambigu  

---

# PHASE 1 — PROJECT INITIALIZATION

---

## Step 1 — Initialize Next.js Project

Tugas:
- Buat project Next.js dengan TypeScript
- Setup Tailwind
- Setup ESLint + Prettier

DoD:
✅ Project bisa dijalankan dengan `npm run dev`  
✅ Tidak ada error lint  
✅ Tailwind aktif  

---

## Step 2 — Setup Folder Structure

Tugas:
- Buat folder sesuai ARCHITECTURE.md
- Pisahkan lib, components, store, types

DoD:
✅ Struktur folder sesuai dokumentasi  
✅ Tidak ada folder kosong tanpa tujuan  

---

## Step 3 — Setup Supabase Project

Tugas:
- Buat project Supabase
- Ambil URL & Anon Key
- Tambahkan ke `.env.local`

DoD:
✅ Bisa connect ke Supabase dari server  
✅ Tidak ada error connection  

---

## Step 4 — Implement Database Schema

Tugas:
- Jalankan SQL dari DATA_MODELS.md
- Aktifkan RLS
- Buat index

DoD:
✅ Semua tabel berhasil dibuat  
✅ RLS aktif  
✅ Insert gagal jika bukan pemilik  

---

# PHASE 2 — AUTHENTICATION

---

## Step 5 — Integrate Supabase Auth

Tugas:
- Setup login & register
- Gunakan Supabase Auth

DoD:
✅ User bisa register  
✅ User bisa login  
✅ JWT tersimpan aman  
✅ Logout berhasil  

---

## Step 6 — Protect Dashboard Route

Tugas:
- Middleware untuk auth check

DoD:
✅ Jika belum login → redirect ke login  
✅ Jika login → bisa akses dashboard  

---

# PHASE 3 — CHAT SYSTEM

---

## Step 7 — Create Session API

Tugas:
- POST /api/sessions
- GET /api/sessions
- DELETE /api/sessions/:id

DoD:
✅ Session tersimpan di database  
✅ Hanya user pemilik yang bisa akses  

---

## Step 8 — Create Message API

Tugas:
- POST message ke session
- Simpan ke tabel messages

DoD:
✅ Message tersimpan  
✅ Relasi session_id benar  

---

## Step 9 — Build Chat UI

Tugas:
- Chat window
- Input prompt
- Display message bubble

DoD:
✅ User bisa kirim pesan  
✅ Pesan tampil di UI  
✅ Tidak refresh page  

---

# PHASE 4 — AI PROVIDER LAYER

---

## Step 10 — Create AI Provider Interface

Tugas:
- Buat interface standar generateChat()

DoD:
✅ Semua provider implement interface  
✅ Tidak ada type error  

---

## Step 11 — Implement Gemini Provider

Tugas:
- Integrasi Gemini API
- Gunakan model free-tier

DoD:
✅ Prompt terkirim  
✅ Response diterima  
✅ Error tertangani  

---

## Step 12 — Implement Provider Factory

Tugas:
- Factory untuk memilih provider aktif

DoD:
✅ Provider sesuai config user  
✅ Provider invalid → error PROVIDER_NOT_FOUND  

---

## Step 13 — Connect Chat API to AI Provider

Tugas:
- Endpoint /api/chat memanggil provider

DoD:
✅ User kirim prompt  
✅ AI merespon  
✅ Message tersimpan ke DB  
✅ Status 200  

---

# PHASE 5 — STOP & STREAM FEATURE

---

## Step 14 — Implement Streaming Response

Tugas:
- Gunakan ReadableStream
- Tampilkan token secara realtime

DoD:
✅ Response tampil bertahap  
✅ UI tetap responsif  

---

## Step 15 — Implement Stop Button

Tugas:
- Gunakan AbortController
- Tambahkan tombol STOP

DoD:
✅ Klik STOP menghentikan response  
✅ Tidak crash  
✅ Bisa lanjut chat lagi  

---

# PHASE 6 — PROVIDER CONFIG SYSTEM

---

## Step 16 — Create Provider Config Table Logic

Tugas:
- CRUD provider_configs

DoD:
✅ User bisa simpan API key  
✅ API key terenkripsi  
✅ Hanya satu provider aktif  

---

## Step 17 — Build Settings UI

Tugas:
- Form input API key
- Dropdown pilih provider & model

DoD:
✅ User bisa ganti provider  
✅ Chat menggunakan provider baru  

---

# PHASE 7 — DOCUMENT GENERATION

---

## Step 18 — Create Generate Endpoint

Tugas:
- Endpoint /api/generate
- Kirim structured prompt ke AI

DoD:
✅ AI mengembalikan 9 dokumen  
✅ Tidak kosong  

---

## Step 19 — Markdown Split Engine

Tugas:
- Pisahkan output jadi 9 file

DoD:
✅ File sesuai nama standar  
✅ Format Markdown valid  

---

## Step 20 — Implement ZIP Generator

Tugas:
- Gunakan JSZip
- Generate file .zip

DoD:
✅ File ZIP dapat diunduh  
✅ Semua 9 file ada di dalam ZIP  

---

# PHASE 8 — HISTORY SYSTEM

---

## Step 21 — Sidebar History UI

Tugas:
- Tampilkan daftar session

DoD:
✅ Bisa klik session  
✅ Load chat history sesuai  

---

## Step 22 — Delete Session Feature

Tugas:
- Tambahkan delete button

DoD:
✅ Session terhapus  
✅ Messages ikut terhapus  

---

# PHASE 9 — UI POLISHING

---

## Step 23 — Responsive Design

Tugas:
- Mobile layout
- Sidebar jadi drawer

DoD:
✅ Tampilan rapi di mobile  
✅ Tidak overflow  

---

## Step 24 — Dark Elegant Theme

Tugas:
- Implement design guideline
- Hindari warna ungu

DoD:
✅ Konsisten  
✅ Profesional  
✅ Tidak mencolok  

---

# PHASE 10 — TESTING & DEPLOYMENT

---

## Step 25 — Write Unit Tests

DoD:
✅ Coverage minimal 80%  

---

## Step 26 — Write E2E Critical Test

DoD:
✅ Full generate flow lolos  

---

## Step 27 — Deploy to Netlify

Tugas:
- Setup environment variable
- Build production

DoD:
✅ Website live  
✅ Tidak ada error build  
✅ Supabase production terkoneksi  

---

# FINAL DEFINITION OF DONE (PROJECT LEVEL)

Project dianggap selesai jika:

✅ User bisa login  
✅ Bisa chat dengan AI  
✅ Bisa STOP generation  
✅ Bisa ganti provider  
✅ Bisa generate 9 file  
✅ Bisa download ZIP  
✅ History tersimpan  
✅ UI responsive & elegan  
✅ Tidak ada error critical  
✅ Lolos minimal 80% coverage  

---