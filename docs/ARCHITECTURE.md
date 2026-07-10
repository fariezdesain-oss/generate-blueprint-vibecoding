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

- Next.js 14.x (App Router)
- React 18.x
- TypeScript 5.x
- TailwindCSS 3.4.x
- Radix UI primitives
- Zustand (state management ringan)
- React Hook Form
- next-themes (dark mode)
- react-markdown + remark-gfm + rehype-highlight
- Mermaid (diagram rendering)

Runtime:
- Node.js 20.x

---

### 2.2 Backend (API Layer)

- Next.js Route Handlers
- Supabase JS SDK 2.x (SSR cookie auth)
- Supabase service role (server-only privileged ops)
- Server-side AI provider abstraction (Gemini, OpenRouter, Groq, DeepSeek, OpenAI-compatible)
- Encryption (AES-256-GCM untuk API keys)
- Rate limiting (in-memory per-user)
- Provider fallback chain

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

```
.
├── app/
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Home (redirect based on auth)
│   ├── providers.tsx               # Client providers
│   ├── globals.css                 # Global styles
│   ├── middleware.ts               # Auth guard
│   ├── (auth)/                     # Auth pages
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── update-password/page.tsx
│   ├── auth/callback/route.ts      # Supabase auth callback
│   ├── (dashboard)/                # Protected pages
│   │   ├── layout.tsx              # Dashboard shell (sidebar, nav)
│   │   ├── chat/page.tsx
│   │   ├── chat/ChatContent.tsx    # Main chat UI controller
│   │   ├── history/page.tsx
│   │   ├── settings/page.tsx
│   │   └── generate/results/page.tsx
│   └── api/                        # Route handlers
│       ├── chat/route.ts
│       ├── upload/route.ts
│       ├── cleanup-files/route.ts
│       ├── auth/logout/route.ts
│       ├── sessions/route.ts
│       ├── sessions/[id]/route.ts
│       ├── sessions/[id]/files/route.ts
│       ├── providers/route.ts
│       ├── providers/[id]/route.ts
│       ├── providers/test/route.ts
│       └── generate/
│           ├── start/route.ts
│           ├── sequential/route.ts
│           ├── resume/route.ts
│           ├── n8n/route.ts
│           └── download/route.ts
├── components/ui/                  # React components
│   ├── ChatWindow.tsx
│   ├── MessageBubble.tsx
│   ├── MarkdownRenderer.tsx
│   ├── MermaidBlock.tsx
│   ├── FilePicker.tsx
│   ├── FilePreviewModal.tsx
│   ├── SidebarHistory.tsx
│   ├── MobileNav.tsx
│   ├── ProviderSelector.tsx
│   ├── ProviderBadge.tsx
│   ├── SessionManager.tsx
│   ├── SessionTimeoutModal.tsx
│   ├── ThemeToggle.tsx
│   ├── LogoutButton.tsx
│   ├── GeminiLoader.tsx
│   └── AnimatedBackground.tsx
├── lib/
│   ├── ai/                         # AI provider abstraction
│   │   ├── provider.interface.ts
│   │   ├── provider.factory.ts
│   │   ├── gemini.provider.ts
│   │   ├── openrouter.provider.ts
│   │   ├── groq.provider.ts
│   │   ├── deepseek.provider.ts
│   │   └── custom.provider.ts
│   ├── db/                         # Database clients
│   │   ├── supabaseServerClient.ts
│   │   ├── supabaseBrowserClient.ts
│   │   └── ensureProfile.ts
│   └── utils/                      # Utility functions
│       ├── apiAuth.ts
│       ├── aiErrorHandler.ts
│       ├── attachments.ts
│       ├── encryption.ts
│       ├── generate.ts
│       ├── modelCapabilities.ts
│       ├── n8nPrompt.ts
│       ├── n8nValidator.ts
│       ├── providerConfig.ts
│       ├── providerFallback.ts
│       ├── rateLimit.ts
│       ├── sequentialPrompts.ts
│       └── zipGenerator.ts
├── store/
│   └── useChatStore.ts             # Zustand state
├── types/
│   └── chat.ts                     # Shared types
├── hooks/
│   └── useInactivityTimeout.ts
├── supabase/migrations/            # DB schema & migrations
├── netlify/
│   ├── functions/generate-background.mjs
│   └── shared/                     # Shared .mjs modules
│       ├── constants.mjs
│       ├── utils.mjs
│       └── ai.mjs
├── tests/                          # Unit & E2E tests
├── docs/                           # Documentation
└── public/
```

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
