# Architecture Overview

**Date:** 2026-05-17
**Focus:** Architecture analysis

## Pattern Overview

Agent Web follows a **monorepo-based, layered architecture** with a clear separation between frontend (Next.js 16), shared business logic (`@agent-web/core`), and data persistence (`@agent-web/db`). The application is a chat-based AI developer command center that combines an LLM-powered conversational interface with eight locally-executed tools (terminal, files, web, code execution).

**Overall pattern:** Vertical-slice layered monorepo using pnpm workspaces orchestrated by Turbo.

**Key characteristics:**

- **Monorepo partitioned by concern**: Three packages — `apps/web` (Next.js app), `packages/core` (LLM client, tool definitions, types), `packages/db` (Drizzle schema, migrations, credential storage).
- **Frontend-driven state**: Zustand v5 store holds all client state; data persistence happens via REST API calls with optimistic updates and rollback on failure.
- **Custom streaming integration**: The chat UI does **not** use `useChat` from `ai/react`. Instead, it manually POSTs to `/api/chat`, reads a `ReadableStream` via `getReader()`, and parses the AI SDK v4 data stream protocol (`0:` text, `3:` error, `9:` tool call, `a:` tool result, `d:` done).
- **Tool system as a plugin layer**: Eight tools defined in `packages/core/src/tools/`, registered in a central registry, wired into the chat API route via `streamText({ tools })`.
- **Local-first with server persistence**: UI preferences go to `localStorage`; sessions, messages, projects, and API keys persisted to SQLite via REST endpoints with optimistic local updates and rollback on server failure.
- **Dark-first design system**: Custom CSS variables in `globals.css` define a "Signal Cockpit" theme with electric (lime), cyan, magenta, and amber accents. Tailwind maps tokens to utility classes.
- **Docker deployment with sandbox isolation**: `Dockerfile` has three build targets — `development`, `production`, and `sandbox`. Sandbox container provides resource-limited code execution.

---

## Layers

### Layer 1: Presentation (Frontend)

**Location:** `apps/web/app/`, `apps/web/components/`

**Purpose:** Browser-side UI rendering, user interaction, optimistic state management.

**Contains:**
- `app/page.tsx` — Main page: assembles the "cockpit shell" with Sidebar, CommandRail, ChatInterface, and ContextPanel.
- `app/layout.tsx` — Root layout: font loading, `<Toaster>`, `<ChatErrorBoundary>`, skip-to-content link.
- `components/chat/` — ChatInterface, ChatInput, MessageBubble, MarkdownRenderer, ToolCallBubble, WelcomeHero, TypingIndicator, FileUpload, CompareRow.
- `components/layout/` — Sidebar (session list, tools, skills), ContextPanel (right panel: stats, token usage, project files).
- `components/settings-panel.tsx` — Provider/model selection, API key management.
- `components/skeleton-loader.tsx` — SSR loading skeleton.
- `components/async-view.tsx` — Generic async data rendering.
- `components/error-boundary.tsx` — React class error boundary.

**Depends on:** `@agent-web/core` (types, tool descriptions), Zustand store, custom hooks.

**Used by:** Browser (directly).

---

### Layer 2: API Routes (Server-side endpoints)

**Location:** `apps/web/app/api/`

**Purpose:** HTTP endpoints for chat streaming, session CRUD, project management, skills loading, file upload, key management, import/export.

**Contains:**
- `api/chat/route.ts` — POST /api/chat: Validate, resolve project path from DB, load skills, look up API keys, configure streamText, return toDataStreamResponse().
- `api/sessions/route.ts` — CRUD for sessions.
- `api/sessions/[id]/messages/route.ts` — CRUD for messages.
- `api/sessions/export/route.ts` — Export all sessions as JSON.
- `api/sessions/import/route.ts` — Import sessions from JSON.
- `api/projects/route.ts` — CRUD for projects.
- `api/projects/[id]/files/route.ts` — List/read project files.
- `api/keys/route.ts` — CRUD for encrypted API key storage.
- `api/upload/route.ts` — File upload and text extraction (PDF, DOCX, XLSX, etc.).
- `api/skills/route.ts` — List available skills.

**Depends on:** `@agent-web/core/tools`, `lib/db.ts`, `lib/crypto.ts`, `@agent-web/db`.

**Used by:** Browser client.

---

### Layer 3: Core (Shared business logic)

**Location:** `packages/core/src/`

**Purpose:** LLM client configuration, tool definitions, shared TypeScript types.

**Contains:**
- `types.ts` — Core data types: ChatMessageData, SessionData, ToolResult, Role.
- `llm/client.ts` — Factory function createOpenAI() with per-provider base URLs.
- `tools/` — Eight tool definitions using tool() from AI SDK with Zod schemas: terminal, file-read, file-write, web-search (DDG with LRU cache), web-fetch (URL text extraction), list-directory, search-files, execute-code.
- `tools/registry.ts` — Central registry exporting all tools and metadata.
- `tools/tool-descriptions.ts` — Human-readable descriptions and status for each tool.
- `tools/path-security.ts` — resolveSafePath() validates workspace confine with OS-aware system directory protection.
- `index.ts` — Package entry: re-exports types and tool descriptions.

**Depends on:** `ai` (AI SDK v4), `zod`.

**Used by:** `apps/web`.

---

### Layer 4: Database (Persistence)

**Location:** `packages/db/src/`

**Purpose:** Schema definition, DB client factory, migration runner for SQLite via libsql.

**Contains:**
- `schema.ts` — Drizzle ORM schema: projects, sessions, messages, api_keys tables. Includes relations() for FK relationships.
- `client.ts` — Singleton factory getDb() creating libsql client from DATABASE_URL (default file:./data/local.db).
- `migrate.ts` — runMigrations() and ensureMigrated() using raw SQL.
- `index.ts` — Package entry: re-exports schema, client, migrations.

**Depends on:** @libsql/client, drizzle-orm.

**Used by:** apps/web/lib/db.ts.

---

### Layer 5: Server-side DB Access Layer

**Location:** apps/web/lib/db.ts

**Purpose:** Thin wrapper over Drizzle queries with migration readiness and API key encryption/decryption.

**Contains:** listProjects, createProject, getProjectById, listSessions, createSession, addMessage, listMessages, saveApiKey, getApiKey, deleteApiKey, importSessions.

**Depends on:** @agent-web/db, lib/crypto.ts.

**Used by:** API route handlers.

---

## Data Flow

### Chat Request Lifecycle

```
User types message
       |
       v
ChatInterface.handleSend()
  +- 1. Attach file contents to message
  +- 2. addMessage(userMsg) -> optimistic local insert -> POST /api/sessions/:id/messages
  +- 3. submitChat([messages])
  |      +- runSingle() per model (parallel in compare mode)
  |           +- streamChat()
  |                +- POST /api/chat (with payload)
  |                     |
  |                     v
  |                API Route (/api/chat/route.ts)
  |                  +- Validate with Zod
  |                  +- Resolve project root path from DB
  |                  +- Load skills content from filesystem
  |                  +- Look up API key from encrypted DB store
  |                  +- Configure LLM client (provider-specific base URL)
  |                  +- fitContext() -> trim to ~100k token budget
  |                  +- streamText({ model, messages, tools, maxSteps: 8, system })
  |                  +- Return toDataStreamResponse()
  |                     |
  |                     v
  |                Client reads stream via getReader()
  |                  +- "0:" -> text delta -> patchLocalMessage()
  |                  +- "3:" -> error
  |                  +- "9:" -> tool call -> patchLocalToolInvocations()
  |                  +- "a:" -> tool result -> update invocation state
  |                  +- "d:" -> done
  |
  +- 4. persistMessage() -> POST /api/sessions/:id/messages
```

### State Management

| Concern | Mechanism | Location |
|---------|-----------|----------|
| Chat messages | Zustand store (optimistic + API sync) | lib/store.ts |
| Provider/model prefs | localStorage (subset) | lib/store.ts |
| Session/project CRUD | Zustand -> REST API -> SQLite | lib/store.ts |
| UI preferences | localStorage only | lib/store.ts |
| API keys (encrypted) | DB (api_keys table) | lib/db.ts, lib/crypto.ts |

**Optimistic update:** Every mutating operation updates Zustand first, then calls API. On failure, state rolls back from pre-mutation snapshot.

**Streaming coalescing:** patchLocalMessage batches text updates via requestAnimationFrame to avoid 50+ re-renders/sec.

---

## Key Abstractions

### Chat Store (Zustand)

**Location:** apps/web/lib/store.ts

**Pattern:** Zustand store with co-located actions. Pure functions (genId, snapshotSessions, rollbackSessions) exported for testing. API interop via local apiFetch() helper.

### Tool Registry

**Location:** packages/core/src/tools/registry.ts

**Pattern:** Plain object map of ai SDK tool() instances. Each has Zod param schema, description, async execute().

### DB Access Layer

**Location:** apps/web/lib/db.ts

**Pattern:** Module-level migrationPromise ensures migrations run once before any query. Each function calls await ready(). Uses Drizzle ORM query builders.

### Path Security

**Location:** packages/core/src/tools/path-security.ts

**Pattern:** resolveSafePath() resolves to absolute path, validates within workspace. OS-aware system directory protection.

### Encrypted Credential Storage

**Location:** apps/web/lib/crypto.ts

**Pattern:** AES-256-GCM encryption with 32-byte key from ENCRYPTION_KEY env var. Format: iv.base64.authTag.base64.ciphertext.base64.

---

## Entry Points

| Entry Point | Location | Trigger | Responsibility |
|---|---|---|---|
| Root Layout | apps/web/app/layout.tsx | Every page load | Load fonts, render Toaster, ChatErrorBoundary |
| Home Page | apps/web/app/page.tsx | GET / | Assemble cockpit UI |
| Chat API | apps/web/app/api/chat/route.ts | POST /api/chat | Validate, stream LLM response with tools |
| Store Hydration | apps/web/lib/store.ts | Client mount useEffect | Load data from API, restore localStorage |
| Package entry | packages/core/src/index.ts | import @agent-web/core | Export types and tool descriptions |
| Package entry | packages/db/src/index.ts | import @agent-web/db | Export schema, client, migrations |

---

## Error Handling

| Layer | Strategy |
|---|---|
| API Route | Try/catch, returns { error } JSON with HTTP status |
| Streaming | AI SDK getErrorMessage callback |
| Frontend fetch | streamChat() retries up to 2x on network/5xx/429 |
| DB operations | Optimistic updates with snapshot rollback |
| React rendering | ChatErrorBoundary class component |
| Path traversal | resolveSafePath throws Error |
| File too large | Descriptive error if exceeds 5MB |

### Patterns

- Fail-visible on auth: Missing API key returns HTTP 401 with clear message.
- Graceful degradation on tool error: Tools return [error] strings, LLM can adapt.
- Snapshot-rollback for data integrity.

---

## Cross-Cutting Concerns

### Logging
Console-based (console.error). No structured logging.

### Validation
Zod for API inputs, resolveSafePath for file paths, protocol check for URLs, size/type checks for uploads.

### Authentication
No user auth (single-user local-first). API keys encrypted in DB with AES-256-GCM. ENCRYPTION_KEY env var.

### Configuration
.env.local for DB URL, encryption key, sandbox settings, terminal backend, memory limits. UI config in localStorage.

### Security
- File tools locked to workspace (path traversal protection).
- System directories blocked.
- Docker sandbox for code execution.
- AES-256-GCM for stored API keys.
- No client-provided paths trusted.
- serverExternalPackages in next.config.ts.
