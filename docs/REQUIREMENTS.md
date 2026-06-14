# REQUIREMENTS.md  
Dependency & Version Management  
Program Generate Dokumentasi Instruksi Untuk Vibecoding  

---

## 1. Tujuan Dokumen

Dokumen ini mendefinisikan seluruh dependensi proyek secara:

- Terstruktur
- Terpisah berdasarkan layer
- Menggunakan versi stabil spesifik
- Menghindari dependency conflict (dependency hell)

Semua versi ditentukan menggunakan versi stabil terbaru yang aman digunakan di production (tanpa alpha/beta).

Runtime utama:

- Node.js 20.x LTS

---

# 2. Root Application Dependencies

## 2.1 Core Framework

| Package | Version | Keterangan |
|----------|----------|------------|
| next | 14.2.3 | Framework utama |
| react | 18.2.0 | UI library |
| react-dom | 18.2.0 | React DOM renderer |
| typescript | 5.4.5 | Type safety |

---

# 3. Frontend Layer Dependencies

## 3.1 UI & Styling

| Package | Version | Keterangan |
|----------|----------|------------|
| tailwindcss | 3.4.4 | Utility CSS framework |
| postcss | 8.4.38 | CSS processor |
| autoprefixer | 10.4.19 | CSS vendor prefix |
| class-variance-authority | 0.7.0 | Styling utility |
| clsx | 2.1.1 | Conditional className |
| tailwind-merge | 2.3.0 | Merge Tailwind classes |
| lucide-react | 0.378.0 | Icon set |

---

## 3.2 UI Components

| Package | Version |
|----------|----------|
| @radix-ui/react-dialog | 1.0.5 |
| @radix-ui/react-dropdown-menu | 2.0.6 |
| @radix-ui/react-scroll-area | 1.0.5 |
| @radix-ui/react-tabs | 1.0.4 |

(ShadCN UI berbasis Radix + Tailwind)

---

## 3.3 Form & Validation

| Package | Version |
|----------|----------|
| react-hook-form | 7.51.3 |
| zod | 3.23.8 |
| @hookform/resolvers | 3.3.4 |

---

## 3.4 State Management

| Package | Version |
|----------|----------|
| zustand | 4.5.2 |

---

# 4. Backend / API Layer Dependencies

## 4.1 Supabase

| Package | Version |
|----------|----------|
| @supabase/supabase-js | 2.43.4 |

---

## 4.2 AI Provider SDK

Disarankan tidak menggunakan SDK berat jika bisa menggunakan fetch native.

Namun jika diperlukan:

| Package | Version |
|----------|----------|
| openai | 4.47.1 |
| @google/generative-ai | 0.15.0 |

Untuk provider lain (OpenRouter, Groq, DeepSeek):
- Gunakan fetch native (OpenAI-compatible endpoint)

---

## 4.3 Utility

| Package | Version |
|----------|----------|
| axios | 1.7.2 |
| jszip | 3.10.1 |
| file-saver | 2.0.5 |
| uuid | 9.0.1 |

---

# 5. Authentication Layer

| Package | Version |
|----------|----------|
| @supabase/auth-helpers-nextjs | 0.10.0 |

---

# 6. Development Dependencies

## 6.1 Linting & Formatting

| Package | Version |
|----------|----------|
| eslint | 8.57.0 |
| eslint-config-next | 14.2.3 |
| prettier | 3.2.5 |
| eslint-config-prettier | 9.1.0 |
| eslint-plugin-unused-imports | 3.2.0 |

---

## 6.2 Testing

| Package | Version |
|----------|----------|
| jest | 29.7.0 |
| @testing-library/react | 14.2.1 |
| @testing-library/jest-dom | 6.4.2 |
| @testing-library/user-event | 14.5.2 |
| supertest | 6.3.4 |
| playwright | 1.44.1 |

---

## 6.3 Type Definitions

| Package | Version |
|----------|----------|
| @types/node | 20.12.7 |
| @types/react | 18.2.66 |
| @types/react-dom | 18.2.22 |
| @types/uuid | 9.0.8 |

---

# 7. Dependency Separation Strategy

Untuk mencegah konflik:

### 7.1 Prinsip

- Tidak mencampur versi major berbeda
- Hindari multiple state management library
- Gunakan fetch native dibanding SDK berat jika memungkinkan
- Lock file wajib digunakan (package-lock.json)

---

### 7.2 Layer Isolation

Frontend:
- UI
- Form
- State
- Styling

Backend:
- Supabase
- AI Provider abstraction
- Validation

Testing:
- Terpisah dari production dependency

---

# 8. Node & Environment Version

Gunakan file `.nvmrc`: 20


Atau tentukan di package.json:

```json
"engines": {
  "node": ">=20.0.0"
}

9. Free Tier Compatibility
Semua dependency:

✅ Tidak membutuhkan lisensi berbayar
✅ Compatible dengan Netlify
✅ Compatible dengan Supabase Free Tier

10. Dependency Update Policy
Minor update boleh
Major update harus diuji
Lock version exact (tanpa ^ jika production critical)
Disarankan:
npm install --save-exact

