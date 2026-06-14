# TEST_STRATEGY.md  
Testing Strategy Document  
Program Generate Dokumentasi Instruksi Untuk Vibecoding  

---

## 1. Tujuan Dokumen

Dokumen ini mendefinisikan strategi pengujian untuk memastikan:

- Sistem stabil
- Tidak terjadi regresi
- Fitur core berjalan sesuai desain
- Dokumentasi yang dihasilkan konsisten
- Integrasi AI provider aman

Target utama:

✅ Minimal 80% code coverage  
✅ Semua core flow lolos Unit + Integration test  
✅ Critical path lolos E2E test  

---

# 2. Jenis Pengujian

Aplikasi menggunakan 3 level pengujian:

1. Unit Test
2. Integration Test
3. End-to-End (E2E) Test

---

# 3. Testing Stack

| Jenis | Tools |
|-------|-------|
| Unit | Jest |
| Component | Testing Library |
| Integration | Jest + Supertest |
| E2E | Playwright |
| Coverage | Jest Coverage Report |

---

# 4. Unit Testing

## 4.1 Target

- Utility function
- AI provider abstraction
- Markdown generator
- Zip generator
- Validation schema (Zod)
- Store logic (Zustand)

---

## 4.2 Contoh Unit Case

### ✅ AI Provider Factory

Test:
- Jika provider_name = gemini → return GeminiProvider
- Jika provider_name tidak valid → throw PROVIDER_NOT_FOUND

---

### ✅ Markdown Generator

Test:
- Split output menjadi 9 file
- Nama file sesuai standar
- Format Markdown tidak kosong

---

### ✅ Encryption Utility

Test:
- Encrypt → Decrypt → hasil sama
- Decrypt invalid input → error

---

# 5. Integration Testing

Menggunakan:

- Jest
- Supertest

Mengujikan:

- Endpoint API
- Database interaction
- Auth flow
- AI provider mock

---

## 5.1 Endpoint yang Wajib Diuji

### POST /api/chat

✅ Mengembalikan status 200  
✅ Menyimpan message user  
✅ Menyimpan message assistant  
✅ Response sesuai format API  

---

### POST /api/generate

✅ Menghasilkan 9 dokumen  
✅ Tidak ada file kosong  
✅ Format Markdown valid  

---

### GET /api/sessions

✅ Hanya mengambil session milik user  
✅ Tidak bocor ke user lain  

---

### DELETE /api/sessions/:id

✅ Hanya bisa delete milik sendiri  
✅ Cascade delete messages  

---

# 6. End-to-End Testing (Playwright)

Mengujikan flow pengguna dari UI.

---

## 6.1 Critical E2E Scenario

### Scenario 1: Full Generate Flow

1. User login
2. Buat session baru
3. Kirim prompt
4. AI merespon
5. Klik Generate
6. 9 file muncul
7. Download ZIP sukses

✅ Test selesai jika:
- Semua langkah berhasil
- Tidak ada console error
- File ZIP valid

---

### Scenario 2: Stop Generation

1. User kirim prompt panjang
2. Klik STOP
3. Response berhenti

✅ Tidak crash  
✅ UI kembali normal  

---

### Scenario 3: Switch Provider

1. User buka settings
2. Ganti provider
3. Simpan
4. Kirim chat

✅ AI menggunakan provider baru  
✅ Tidak error auth  

---

### Scenario 4: History Access

1. Buat 2 session
2. Buka session pertama
3. Pastikan message sesuai

✅ Data konsisten  

---

# 7. Edge Case Testing (Wajib Lolos)

## 7.1 AI Provider Edge Cases

- API key salah
- Rate limit
- Timeout
- Provider down
- Response format tidak sesuai

Expected:
- Error tertangani
- Tidak crash
- Error message jelas

---

## 7.2 User Input Edge Cases

- Prompt kosong
- Prompt terlalu panjang
- Special characters
- Markdown injection

Expected:
- Validation error
- Sanitized output

---

## 7.3 Database Edge Cases

- Session tidak ditemukan
- User akses session orang lain
- Double generate request

Expected:
- 404 jika tidak ada
- 403 jika bukan pemilik
- Request kedua ditolak jika sedang generate

---

# 8. Coverage Target

Minimum coverage:

| Area | Target |
|------|--------|
| Utility | 90% |
| Provider Layer | 85% |
| API Routes | 80% |
| Overall | 80% |

Perintah:
npm run test -- --coverage


---

# 9. Mocking Strategy

Untuk menghindari biaya AI:

✅ Mock AI provider response  
✅ Jangan panggil API asli saat testing  
✅ Gunakan dependency injection pada provider factory  

Contoh:

```ts
jest.mock('../lib/ai/provider.factory')

10. Performance Testing (Optional Future)
Target:

Chat response < 10 detik
Generate < 20 detik
UI tetap responsif saat streaming
11. CI/CD Testing Flow (Future)
Saat push ke branch develop:

Install dependencies
Run lint
Run unit test
Run integration test
Build project
Deployment hanya jika semua test lulus.

12. Definition of Done (Testing Level)
Sebuah fitur dianggap selesai jika:

✅ Unit test ada
✅ Integration test ada (jika API)
✅ Tidak ada lint error
✅ Coverage tidak turun di bawah 80%
✅ E2E critical path tidak gagal