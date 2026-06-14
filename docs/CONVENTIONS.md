# CONVENTIONS.md  
Code & Project Conventions  
Program Generate Dokumentasi Instruksi Untuk Vibecoding  

---

## 1. Tujuan Dokumen

Dokumen ini menetapkan standar penulisan kode, struktur error, format API response, dan aturan Git agar:

- Konsisten
- Mudah dibaca
- Mudah di-maintain
- Siap diskalakan
- Mudah dipahami AI agent

---

# 2. Code Style & Formatting

## 2.1 Linting

Menggunakan:

- ESLint
- eslint-config-next
- eslint-config-prettier
- eslint-plugin-unused-imports

### Aturan Utama:

- Tidak boleh ada unused import
- Tidak boleh ada unused variable
- Gunakan explicit return type untuk function penting
- Hindari `any` (gunakan `unknown` jika perlu)
- Gunakan optional chaining jika diperlukan

---

## 2.2 Prettier Config

Contoh `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}

Aturan:

Wajib pakai semicolon
Gunakan single quote
Maksimal 100 karakter per baris
3. Naming Convention
3.1 File Naming
Tipe	Format	Contoh
React Component	PascalCase	ChatWindow.tsx
Hook	camelCase + prefix use	useChatStore.ts
Utility	camelCase	zipGenerator.ts
Type	camelCase	chat.ts
Constant	UPPER_SNAKE_CASE	MAX_MESSAGE_LENGTH
3.2 Variable & Function
Tipe	Format
Variable	camelCase
Function	camelCase
Class	PascalCase
Interface	PascalCase
Enum	PascalCase
Contoh:
const currentSessionId: string;
function generateDocumentation(): Promise<void>;
interface AIProviderConfig {}

3.3 Database Naming (SQL)
Elemen	Format
Table	snake_case
Column	snake_case
Index	idx_<table>_<column>
Contoh:

sessions
provider_configs
created_at
4. Struktur Error Global
Semua error API harus mengikuti struktur berikut:
{
  success: false,
  error: {
    code: "PROVIDER_NOT_FOUND",
    message: "AI provider tidak ditemukan",
    stack?: "stack trace (only development)"
  }
}

4.1 Error Code Format
Format:
DOMAIN_REASON

Contoh:

AUTH_UNAUTHORIZED
SESSION_NOT_FOUND
PROVIDER_INVALID_KEY
GENERATION_FAILED
VALIDATION_ERROR
INTERNAL_SERVER_ERROR

4.2 Error Handling Rule
Jangan expose stack trace di production
Semua error harus ditangkap (no unhandled promise rejection)
Gunakan centralized error handler

5. Standard API Response Format
5.1 Success Response
{
  success: true,
  data: {
    // response data
  }
}

5.2 Fail Response
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Deskripsi error"
  }
}

5.3 HTTP Status Code Convention
Status	Digunakan Untuk
200	Success GET/POST
201	Resource created
400	Validation error
401	Unauthorized
403	Forbidden
404	Not found
429	Rate limit
500	Internal error
6. Folder Structure Convention
Setiap folder maksimal memiliki tanggung jawab tunggal.

Contoh prinsip:

/lib/ai → semua logic AI provider
/lib/db → semua logic database
/components → UI only (no business logic)
/app/api → endpoint layer
Jangan campur:

Business logic di komponen UI
Database query di frontend
7. State Management Convention (Zustand)
Satu store per domain
Tidak boleh ada business logic kompleks di UI
Store hanya menangani:
State
Setter
Async action ringan
Contoh:
interface ChatState {
  messages: Message[];
  isGenerating: boolean;
  sendMessage: (content: string) => Promise<void>;
}

8. Git Convention
Menggunakan Conventional Commits.

Format:
<type>(scope): short description

8.1 Commit Type
Type	Digunakan Untuk
feat	Fitur baru
fix	Bug fix
refactor	Refactor tanpa ubah behavior
style	Format code
docs	Dokumentasi
test	Testing
chore	Dependency / config

Contoh Commit :
feat(chat): add stop generation feature
fix(provider): handle invalid api key error
docs(prd): update scope constraints
refactor(ai): simplify provider factory

9. Branching Strategy
Branch utama:

main → production
develop → integration
feature/<feature-name>
fix/<bug-name>
10. Logging Convention
Gunakan:

console.log hanya di development
Jangan log API key
Gunakan format:
[MODULE] Action description
Contoh:
[AI_PROVIDER] Gemini request initiated

11. UI/UX Convention
11.1 Design Rules
Hindari warna ungu
Dark mode default
Gunakan spacing konsisten (8px grid)
Rounded corner medium (rounded-xl)

Animasi subtle (tidak berlebihan)
11.2 Responsive Rule
Mobile first
Sidebar → Drawer di mobile
Button minimal 44px height (touch friendly)

12. AI Prompting Convention
Semua prompt generation harus:
Deterministik
Menggunakan struktur eksplisit
Tidak ambigu
Memaksa AI output dalam format Markdown
Gunakan:
System prompt tetap
Instruction template konsisten
Jangan menggabungkan beberapa tujuan dalam satu prompt
