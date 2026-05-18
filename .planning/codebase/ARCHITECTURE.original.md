<!-- refreshed: 2026-05-17 -->
# Architecture

**Analysis Date:** 2026-05-17

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                       CLIENT (Browser)                               │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │   Sidebar    │  │  ChatInterface   │  │     SettingsPanel        │  │
│  │  (session    │  │ (fetch + Reader  │  │  (provider/model config)  │  │
│  │   list, nav)  │  │  stream parser) │  │                          │  │
│  └──────┬──────┘  └────────┬─────────┘  └──────────┬───────────────┘  │
│         │                  │                        │                   │
│         └──────────────────┼────────────────────────┘                   │
│                            │                                            │
│                     ┌──────▼──────┐                                     │
│                     │  Zustand    │ ← optimistic updates → localStorage │
│                     │  (store.ts) │      (provider, model prefs)        │
│                     └──────┬──────┘                                     │
│                            │ fetch()                                     │
└────────────────────────────┼───────────────────────────────────────────┘
                             │
    ┌────────────────────────┼────────────────────────────────────────┐
    │           ENTRY:        │         Next.js 16 App Router          │
    │                        ▼                                        │
    │  ┌──────────────────────────────────────────────────────────┐    │
    │  │                 API Routes (apps/web/app/api/)            │    │
    │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌────┐  │    │
    │  │  │chat  │ │sess. │ │auth  │ │keys  │ │memory  │ │... │  │    │
    │  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └───┬────┘ └────┘  │    │
    │  └─────┼────────┼────────┼────────┼──────────┼──────────────┘    │
    │        │        │        │        │          │                    │
    │  ┌─────▼────────▼────────▼────────▼──────────▼──────────────┐    │
    │  │              Server-Side DB Layer (apps/web/lib/db.ts)     │    │
    │  │   projects │ sessions │ messages │ users │ api_keys │     │    │
    │  └──────────────────────────────────────────────────────────┘    │
    │        │                                                        │
    │  ┌─────▼─────────────────────────────────────────────────────┐  │
    │  │           packages/db (Drizzle ORM + libsql)               │  │
    │  │  schema.ts │ client.ts │ migrate.ts                       │  │
    │  └───────────────────────────────────────────────────────────┘  │
    │                         │                                       │
    │                    ┌────▼─────┐                                  │
    │                    │ SQLite   │                                  │
    │                    │(local.db)│                                  │
    │                    └──────────┘                                  │
    │                                                                  │
    │  ┌──────────────────────────────────────────────────────────┐    │
    │  │          packages/core (LLM Tools + Context)             │    │
    │  │  ┌────────────────────────────────────────────────────┐  │    │
    │  │  │  Tool Registry:  terminal, read_file, write_file,  │  │    │
    │  │  │  web_search, web_fetch, list_directory,            │  │    │
    │  │  │  search_files, execute_code, git, db_query,        │  │    │
    │  │  │  api_test                                          │  │    │
    │  │  └────────────────────────────────────────────────────┘  │    │
    │  │  ┌────────────────────────────────────────────────────┐  │    │
    │  │  │  Context compression: countTokens, trimToTokenLimit │  │    │
    │  │  └────────────────────────────────────────────────────┘  │    │
    │  └──────────────────────────────────────────────────────────┘    │
    │                        │                                         │
    │  ┌─────────────────────▼───────────────────────────────────────┐ │
    │  │  AI SDK v4: streamText({ model, messages, tools, maxSteps }) │ │
    │  │  Providers: OpenAI / OpenRouter / DeepSeek (via @ai-sdk/    │ │
    │  │             openai createOpenAI)                             │ │
    │  └─────────────────────────────────────────────────────────────┘ │
    └──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root Layout | HTML shell, font loading, skip-to-content link | `apps/web/app/layout.tsx` |
| Home Page | Shell layout: Sidebar + header + ChatInterface | `apps/web/app/page.tsx` |
| ChatInterface | Full chat UI: message list, input, file upload, streaming | `apps/web/components/chat/chat-interface.tsx` |
| Sidebar | Session list, tool display, context/skills panel, import/export | `apps/web/components/layout/sidebar.tsx` |
| SettingsPanel | Provider/model selection, API key management | `apps/web/components/settings-panel.tsx` |
| Zustand Store | Client state: sessions, messages, UI prefs (with optimistic updates) | `apps/web/lib/store.ts` |
| Server DB Layer | All DB operations: projects, sessions, messages, memories, API keys, auth | `apps/web/lib/db.ts` |
| Auth Lib | Password hashing, session token management, user CRUD | `apps/web/lib/auth.ts` |
| Chat API Route | POST handler: builds system prompt, creates LLM client, streams response | `apps/web/app/api/chat/route.ts` |
| Sessions Routes | GET/POST/PATCH/DELETE for sessions CRUD | `apps/web/app/api/sessions/route.ts` |
| Messages Routes | GET/POST/PATCH/DELETE for messages CRUD per session | `apps/web/app/api/sessions/[id]/messages/route.ts` |
| Auth Routes | Login, logout, me, register, password, users | `apps/web/app/api/auth/*/route.ts` |
| Config Status | GET: checks env vars for provider API keys | `apps/web/app/api/config/status/route.ts` |
| Memory Routes | GET/POST/DELETE for persistent key-value memories | `apps/web/app/api/memory/route.ts` |
| Upload Routes | POST file upload, POST file preview parsing | `apps/web/app/api/upload/*/route.ts` |
| Skills Route | GET: list installed skills from disk SKILL.md files | `apps/web/app/api/skills/route.ts` |
| Keys Routes | POST/DELETE for user API keys in DB | `apps/web/app/api/keys/route.ts` |
| Search Route | Text search across sessions/messages | `apps/web/app/api/search/route.ts` |
| Core Package | Exports: tool registry, context compression, types | `packages/core/src/index.ts` |
| Tool Registry | Registers 11 tools (terminal, file, web, git, db, etc.) | `packages/core/src/tools/registry.ts` |
| DB Package | Drizzle schema, libsql client, migration runner | `packages/db/src/` |
| DB Schema | Tables: users, projects, sessions, messages, api_keys, auth_tokens, obsidian_config, memories | `packages/db/src/schema.ts` |
| Context Compression | Token counting, sliding window context trimming | `packages/core/src/context.ts` |
| Path Security | Resolves file paths, restricts to workspace, blocks system dirs | `packages/core/src/tools/path-security.ts` |
| Terminal Tool | Shell command execution (local or Docker sandbox) | `packages/core/src/tools/terminal/index.ts` |
| Execute Code Tool | JS/TS sandboxed execution (local or Docker) | `packages/core/src/tools/execute-code/index.ts` |

## Pattern Overview

**Overall:** Layered architecture with event-driven streaming

**Key Characteristics:**
- **Monorepo** with pnpm workspaces and Turborepo orchestration
- **Layered separation**: UI components → Zustand store → API routes → server DB layer → ORM/DB
- **Streaming-first**: Chat responses use AI SDK v4 `toDataStreamResponse()` with manual client-side stream parsing
- **Optimistic updates**: Zustand store mutations apply locally first, persist to DB asynchronously with rollback on failure
- **Multi-provider LLM**: Abstraction over OpenAI, OpenRouter, and DeepSeek via `createOpenAI()`
- **Authentication**: Cookie-based session tokens with bcrypt password hashing, enforced via `getUserIdFromRequest()` middleware on all DB routes

## Layers

**Presentation Layer (Client-side React):**
- Purpose: Renders the chat UI, handles user input, manages local state
- Location: `apps/web/app/page.tsx`, `apps/web/components/**/*.tsx`
- Contains: Client components using "use client" directive
- Depends on: Zustand store, fetch API
- Key abstractions: Optimistic UI updates via `appendLocalMessage`/`patchLocalMessage`

**Client State Layer (Zustand):**
- Purpose: Central client-side state management with optimistic update patterns
- Location: `apps/web/lib/store.ts`
- Contains: Session/message lists, UI preferences, provider config, skill toggles
- Depends on: fetch API for persistence
- Key abstractions: `snapshotSessions()`/`rollbackSessions()` for optimistic rollback, `patchLocalMessage` with `requestAnimationFrame`-batched stream updates

**API Layer (Next.js Route Handlers):**
- Purpose: Server endpoints for chat, CRUD, auth, file operations
- Location: `apps/web/app/api/**/route.ts`
- Contains: RESTful handlers for sessions, messages, auth, memory, upload, keys, skills, search, Obsidian sync
- Depends on: `apps/web/lib/db.ts` (server DB layer), `apps/web/lib/auth.ts`, `packages/core`
- Patterns: Zod schema validation on every mutating route

**Server DB Layer:**
- Purpose: Business logic for all database operations
- Location: `apps/web/lib/db.ts`
- Contains: CRUD functions for projects, sessions, messages, memories, API keys, Obsidian config
- Depends on: `packages/db` (Drizzle ORM + libsql)
- Key patterns: `ensureMigrated()` lazy-init guard before every operation, `import "server-only"` to prevent client bundling

**Data Package Layer:**
- Purpose: Database schema definitions, client singleton, migration runner
- Location: `packages/db/src/`
- Contains: Drizzle ORM schema (`schema.ts`), libsql client singleton (`client.ts`), raw SQL migrations (`migrate.ts`)
- Exports: `.` (schema + client + migrate), `./schema`, `./client`

**Core Package Layer:**
- Purpose: Shared LLM tool implementations, context compression, types
- Location: `packages/core/src/`
- Contains: Tool definitions using `ai/tool` + `zod`, context compression utilities, TypeScript types
- Exports: `.` (types + context + tool descriptions + tool registry), `./tools` (tool registry), `./types`

## Data Flow

### Primary Chat Request Path

1. **User types message** in `ChatInterface` → `handleSend()` creates `ChatMessage` with `genId()`
2. **Optimistic insert** via `addMessage()` → Zustand appends locally, then POSTs to `/api/sessions/[id]/messages`
3. **Chat submission** via `submitChat()` → builds message history array from current session
4. **Stream request** via `streamChat()` → `fetch(POST /api/chat)` with JSON body `{ messages, provider, model, enabledSkills, files }`
5. **Server side** (`/api/chat` route):
   - Validates API key from env
   - Creates LLM client via `createOpenAI()` (with provider-specific config: OpenRouter custom baseURL, DeepSeek fetch wrapper to disable thinking)
   - Builds system prompt: base instructions + attached file paths + enabled skills descriptions + memories (if enabled)
   - Applies context compression: `countMessagesTokens()` → `trimToTokenLimit()` sliding window (preserves system + first user + most recent)
   - Calls `streamText({ model, messages, tools, maxSteps: 8 })`
   - Returns `toDataStreamResponse()` — Vercel AI SDK data stream
6. **Client stream parsing**: `streamChat()` uses `getReader()` loop, parses chunk prefixes: `0:` text, `1:` tool call, `2:` tool result, `3:` error, `9:` Vercel tool start, `a:` Vercel tool result
7. **Real-time UI updates**: `patchLocalMessage()` batches updates via `requestAnimationFrame` to avoid excessive re-renders
8. **Post-stream persistence**: After stream completes, final text is persisted to DB via `persistMessage()`

### Session CRUD Flow

1. **Hydration**: On load, `Sidebar` calls `hydrate()` → `GET /api/sessions` → list all sessions → populate Zustand
2. **Session switching**: `setActiveSession(id)` → updates Zustand + calls `loadSessionMessages(id)` → `GET /api/sessions/[id]/messages`
3. **Create/Delete/Rename**: Optimistic local update → `fetch` to API → rollback on failure via `snapshotSessions()`/`rollbackSessions()`

### Tools Execution Flow

1. LLM decides to use a tool → AI SDK handles server-side execution
2. Tool implementations in `packages/core/src/tools/` receive arguments, execute, return results
3. Results stream back through the data stream as tool result chunks
4. Client updates tool call bubbles in real-time showing running state → completed state

**State Management:**
- **Client (Zustand)**: Sessions, messages, UI prefs, provider/model config — persisted to SQLite via API calls with optimistic updates
- **localStorage**: Only UI preferences (sidebar state, provider, model) stored locally under `"agent-web-ui-prefs"`
- **Server (SQLite)**: All sessions and messages survive page reloads via `libsql`/Drizzle ORM
- **Stream state**: Local-only insert (`appendLocalMessage`) + batched update (`patchLocalMessage`) for streaming response, then persisted after stream completes

## Key Abstractions

**Tool System:**
- Purpose: Provides LLM with executable capabilities
- Examples: `packages/core/src/tools/terminal/index.ts`, `packages/core/src/tools/file-read.ts`, `packages/core/src/tools/web-search.ts`
- Pattern: Each tool is defined with `tool()` from the `ai` SDK, uses Zod for parameter schema, and implements an `execute` function
- Backend abstraction: Terminal and execute-code tools support `local` or `docker` backend via `TERMINAL_BACKEND` env var
- Path security: File tools use `resolveSafePath()` from `packages/core/src/tools/path-security.ts` to restrict access to project workspace

**LLM Provider Abstraction:**
- Purpose: Unifies multiple LLM providers under a single interface
- Examples: `apps/web/app/api/chat/route.ts` lines 139-175
- Pattern: Provider-specific branches creating `createOpenAI()` clients with different baseURLs and optional fetch wrappers

**Optimistic Update Pattern:**
- Purpose: Immediate UI responsiveness with asynchronous persistence
- Examples: `apps/web/lib/store.ts` - `addMessage`, `deleteSession`, `updateMessage`, etc.
- Pattern: Apply mutation → snapshot state → fire API call → on error, restore from snapshot

**Context Compression:**
- Purpose: Keep LLM context within token limits without losing critical messages
- Examples: `packages/core/src/context.ts`
- Pattern: Character-based token estimation (char/4), sliding window that preserves system prompt + first user message + most recent messages

## Entry Points

**Web App:**
- Location: `apps/web/app/page.tsx`
- Triggers: User navigates to `/`
- Responsibilities: Renders shell layout, initializes sidebar and chat interface

**Chat API:**
- Location: `apps/web/app/api/chat/route.ts`
- Triggers: POST request from ChatInterface
- Responsibilities: Validate request, build system prompt, create LLM client, stream response with tools

**Login:**
- Location: `apps/web/app/login/page.tsx`
- Triggers: User navigates to `/login`
- Responsibilities: Authenticate user, set session cookie, redirect

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop; streaming uses async iteration
- **Global state:** Zustand singleton at module level; libsql DB client singleton in `packages/db/src/client.ts`
- **Server-only imports:** `apps/web/lib/db.ts` and `apps/web/lib/auth.ts` use `import "server-only"` to prevent accidental client bundling
- **Webpack required:** Next.js config forces webpack (not Turbopack) to avoid client-side tracing of server-only Node.js deps via `@agent-web/core`
- **Node externals:** `@libsql/client`, `pdf-parse`, `mammoth`, `xlsx` are marked as `serverExternalPackages` in `next.config.ts` since they are native/Node-only modules
- **Transpilation:** `@agent-web/core` and `@agent-web/db` are `transpilePackages` since they are tsc-built but need to be handled by Next.js bundler

## Anti-Patterns

### Duplicate Provider Branch

**What happens:** The `/api/chat` route has a dead branch — `provider === "deepseek"` appears twice (lines 146 and 165 in route.ts), with the second branch unreachable.
**Why it's wrong:** Dead code adds confusion and suggests an incomplete refactor.
**Do this instead:** Remove the second `else if (provider === "deepseek")` block or consolidate into a single branch.

### Inline Stream Parser Duplicates AI SDK Logic

**What happens:** The client manually parses the Vercel AI SDK data stream format (`0:`, `1:`, `2:`, `9:`, `a:` prefixes) instead of using the `useChat` hook from `ai/react`.
**Why it's wrong:** The custom parser must maintain compatibility with multiple stream format versions and may miss edge cases the SDK handles.
**Do this instead:** This is an accepted trade-off — the custom parser was chosen deliberately for full control. But it adds a maintenance burden that should be documented.

## Error Handling

**Strategy:** Try/catch at API route boundaries, error messages returned as JSON with appropriate HTTP status codes

**Patterns:**
- API routes wrap handler logic in try/catch, return `{ error: message }` with 400/401/500 status
- Chat streaming errors are embedded in the data stream as `3:` error chunks
- Optimistic updates rollback state on API failure
- Rate limiting via in-memory sliding window (`apps/web/lib/rate-limit.ts`)

## Cross-Cutting Concerns

**Logging:** `console.error` for server-side errors; toast notifications for client-side user-visible errors
**Validation:** Zod schemas on all mutating API routes
**Authentication:** Cookie-based `session_token` validated via `getUserIdFromRequest()` for all DB-touching routes; public routes (chat, config status) use server env vars directly
**Rate Limiting:** In-memory sliding window rate limiter in `apps/web/lib/rate-limit.ts` (default: 100 requests per 60s window per IP)

---

*Architecture analysis: 2026-05-17*
