# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Development Server:** `npm run dev`
- **Build Production:** `npm run build`
- **Start Production:** `npm run start`
- **Linting:** `npm run lint`
- **Unit Tests:** `npm test`
- **Test Coverage:** `npm run test:coverage`
- **End-to-End Tests:** `npm run test:e2e` (Ensure `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` are set if running protected E2E tests).

## High-Level Architecture

This project is a Next.js 14 (App Router) web application designed to help users discover project requirements through AI chat, subsequently generating project specifications or n8n workflows.

**Core Principles:**
- Serverless-first architecture deployed on Netlify.
- Multi-provider AI abstraction supporting Gemini, OpenRouter, Groq, DeepSeek, and custom OpenAI-compatible endpoints.
- High security: API keys are encrypted at rest using AES-256-GCM and only decrypted server-side.

**Key Directories:**
- `app/`: Next.js App Router structure. Contains both the UI routes (`(auth)`, `(dashboard)`) and the serverless Route Handlers (`api/`).
- `app/api/`: The backend API layer. Handles auth, sessions, chat streaming, and background generation.
- `components/ui/`: React UI components built with Tailwind CSS and Radix UI. UI logic only, no complex business logic.
- `lib/ai/`: The AI Provider Abstraction layer. Different providers implement `AIProviderInterface`. Contains factory and specific provider implementations.
- `lib/db/`: Supabase client initialization (browser, server, and admin service role clients).
- `lib/utils/`: Core utilities including encryption, generation logic, and rate limiting.
- `store/`: Zustand state management (e.g., `useChatStore.ts`).
- `supabase/migrations/`: Database schema and RLS policies.
- `tests/`: Contains Jest unit tests and Playwright E2E tests.

## Development Conventions

- **Code Style:** TypeScript with ESLint and Prettier. Explicit return types for important functions, strict typing (avoid `any`), and no unused variables/imports.
- **Error Handling:** Centralized API error structure: `{ success: false, error: { code: 'DOMAIN_REASON', message: '...' } }`. No stack traces in production responses.
- **State Management:** Zustand is used. Keep business logic out of UI components; handle it in the store or backend.
- **Git Commits:** Follow Conventional Commits format (`<type>(scope): description`).
- **Database:** Supabase with Row Level Security (RLS) is strictly enforced for data isolation per user.
- **AI Integration:** Prompts should be deterministic and mandate Markdown output. The system classifies models as low, medium, or high context to adjust prompt strategies dynamically.
