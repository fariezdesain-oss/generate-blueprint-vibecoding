# ARCHITECTURE.md  
System Architecture Document  
Program Generate Dokumentasi Instruksi Untuk Vibecoding  

---

## 1. High-Level Architecture Overview

Aplikasi ini menggunakan arsitektur modern berbasis:

- Frontend: Next.js (App Router)
- Backend: Next.js Route Handlers (Serverless API)
- Database: Supabase (PostgreSQL)
- Deployment: Netlify
- AI Provider: Multi-provider (Gemini, OpenRouter, Groq, DeepSeek, OpenAI-compatible)

Arsitektur bersifat:

- Serverless-first
- Modular
- Provider-agnostic (AI abstraction layer)
- 100% free-tier compatible

---

## 2. Tech Stack Detail

### 2.1 Frontend

- Next.js 14.x
- React 18.x
- TypeScript 5.x
- TailwindCSS 3.4.x
- ShadCN UI
- Zustand (state management ringan)
- React Hook Form
- Zod (schema validation)

Runtime:
- Node.js 20.x

---

### 2.2 Backend (API Layer)

- Next.js Route Handlers
- Supabase JS SDK 2.x
- Zod validation
- Server-side AI provider abstraction

---

### 2.3 Database

- Supabase (PostgreSQL 15)
- Row Level Security enabled

---

### 2.4 AI Layer

AI Provider Abstraction Layer:

Supported:

- Google Gemini (Gemini 2.5 Flash Free)
- OpenRouter
- Groq Console
- DeepSeek
- OpenAI-compatible endpoint

Konsep:
AIProviderInterface
├── GeminiProvider
├── OpenRouterProvider
├── GroqProvider
├── DeepSeekProvider
└── OpenAICompatibleProvider


Semua provider mengikuti interface standar:

- generateChat()
- streamChat()
- validateConfig()

---

## 3. Struktur Folder Proyek
/app
/api
/chat
route.ts
/generate
route.ts
/sessions
route.ts
/providers
route.ts
/(dashboard)
/chat
/history
/settings
layout.tsx
page.tsx

/components
/ui
ChatWindow.tsx
MessageBubble.tsx
SidebarHistory.tsx
ProviderSelector.tsx
StopButton.tsx

/lib
/ai
provider.interface.ts
provider.factory.ts
gemini.provider.ts
openrouter.provider.ts
groq.provider.ts
deepseek.provider.ts
/db
supabaseClient.ts
/utils
zipGenerator.ts
markdownGenerator.ts

/store
useChatStore.ts
useProviderStore.ts

/types
chat.ts
session.ts
provider.ts

/styles
globals.css

/app
/api
/chat
route.ts
/generate
route.ts
/sessions
route.ts
/providers
route.ts
/(dashboard)
/chat
/history
/settings
layout.tsx
page.tsx

/components
/ui
ChatWindow.tsx
MessageBubble.tsx
SidebarHistory.tsx
ProviderSelector.tsx
StopButton.tsx

/lib
/ai
provider.interface.ts
provider.factory.ts
gemini.provider.ts
openrouter.provider.ts
groq.provider.ts
deepseek.provider.ts
/db
supabaseClient.ts
/utils
zipGenerator.ts
markdownGenerator.ts

/store
useChatStore.ts
useProviderStore.ts

/types
chat.ts
session.ts
provider.ts

/styles
globals.css

4.2 Generate Documentation Flow
sequenceDiagram
    participant User
    participant UI
    participant API
    participant AIProvider
    participant MarkdownEngine
    participant ZipEngine

    User->>UI: Klik Generate
    UI->>API: POST /api/generate
    API->>AIProvider: Final structured prompt
    AIProvider-->>API: Structured documentation
    API->>MarkdownEngine: Split to 9 docs
    MarkdownEngine-->>API: Markdown files
    API->>ZipEngine: Optional ZIP
    API-->>UI: File(s)

5. Mekanisme Autentikasi & Keamanan
5.1 Authentication
Menggunakan:

Supabase Auth
Email + Password
OAuth (opsional future)
JWT disimpan secara:

HttpOnly cookie
Secure
SameSite=Lax
5.2 Authorization
Row Level Security (RLS)
Setiap session hanya bisa diakses oleh user pemiliknya
Policy contoh:
user_id = auth.uid()

5.3 API Key Protection
API key provider disimpan terenkripsi di database
Tidak pernah dikirim ke frontend
Digunakan hanya di server-side

5.4 Rate Limiting (Future Enhancement)
Basic request throttling per user
Limit generate endpoint
6. State Management Strategy
Menggunakan Zustand:

Global states:

Current session
Chat messages
Provider config
Generation state
Stop flag
State dipisahkan:

UI state
Chat state
Provider state
7. Caching Strategy
7.1 Frontend
React memo
Suspense boundary
Debounce input
7.2 Backend
Tidak cache response AI (karena dinamis)
Session disimpan di database
Optional future: Redis cache
8. Stop Mechanism (Interrupt AI)
Implementasi:

AbortController
Streaming fetch
Stop button trigger abort()
Flow:

User klik STOP
AbortController cancel request
API stop stream
UI freeze response

9. Export Mechanism
9.1 Single File Download
Blob generation
FileSaver API
9.2 ZIP Download
JSZip
Generate di server
Return binary

10. Deployment Architecture
User
  ↓
Netlify CDN
  ↓
Next.js App (Serverless)
  ↓
Supabase
  ↓
AI Provider API

Environment:
Production: Netlify
Database: Supabase Free Tier
AI: Free-tier provider

11. Scalability Consideration
Karena serverless:

Auto scaling dari Netlify
Supabase auto managed
AI tergantung rate limit provider
12. Design System Architecture
UI Principles:

Clean
Professional
Dark mode first
No purple tones
Responsive mobile-first
Sidebar layout desktop
Drawer layout mobile
Color palette:

Background: #0F172A
Surface: #111827
Accent: Emerald / Cyan
Text: White / Gray-300
