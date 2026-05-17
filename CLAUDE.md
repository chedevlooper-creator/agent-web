# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
pnpm dev              # Start all packages + Next.js dev server (turbo)
pnpm build            # Build all packages + Next.js for production
pnpm lint             # ESLint across monorepo (flat config, eslint v9)
pnpm format           # Prettier on **/*.{ts,tsx,md}
pnpm test             # Run all tests (Vitest) — depends on ^build

# Package-scoped
pnpm --filter @agent-web/core build      # Build core package (tsc)
pnpm --filter @agent-web/db build        # Build db package (tsc)
pnpm --filter web dev                    # Next.js dev only
pnpm --filter web exec tsc --noEmit      # Type-check web app (no emit)

# Web app tests (Vitest + happy-dom)
pnpm --filter web test                   # Run once
pnpm --filter web test:watch             # Watch mode
pnpm --filter web test:coverage          # Coverage report

# Docker
pnpm docker:dev      # Dev in Docker Compose (CHOKIDAR_USEPOLLING=true)
pnpm docker:dev:down # Tear down dev containers
pnpm docker:prod     # Production Docker Compose
pnpm docker:prod:down
```

## Architecture

Monorepo: pnpm workspaces (`apps/*`, `packages/*`) + Turborepo. `build`/`dev`/`test` tasks
depend on `^build`, so the two packages must compile before the web app.

### Packages

- **`packages/core`** (`@agent-web/core`) — Shared LLM tools, token counting, context
  compression, MCP client. Built via `tsc` to `dist/`. Exports three entrypoints:
  `.` (types + context utils), `./tools` (tool registry + tool descriptions), `./types`.
- **`packages/db`** (`@agent-web/db`) — Drizzle ORM schema (SQLite via libsql), migration
  runner (V1–V6, idempotent), client singleton, and CRUD helpers for memories, knowledge
  bases, and agents. Built via `tsc` to `dist/`. Exports `.`, `./schema`, `./client`.

### App: `apps/web`

Next.js **16.2.6** App Router, React **19.2.4**. No `src/` — pages/API routes under
`app/`, components under `components/`, server logic under `lib/`. Two pages: `/`
(main chat UI) and `/login` (auth form).

**Chat flow (POST /api/chat):**
1. `ChatInterface` (client) → custom `fetch` + `getReader()` loop sends
   `{ messages, provider, model, enabledSkills?, files?, ... }` to `/api/chat`
2. Route resolves the authenticated user, builds the system prompt (tools list +
   attached files + skills SKILL.md + memories from DB if `ENABLE_MEMORY=true`)
3. Creates an AI SDK client via `createOpenAI()` — providers: `openai` (native),
   `openrouter` (custom baseURL), `deepseek` (baseURL + fetch wrapper that disables
   thinking mode)
4. Applies context compression: `countMessagesTokens` → `trimToTokenLimit` (sliding
   window; preserves system msg + first user msg + most recent)
5. Calls `streamText({ model, messages, tools, ... })` with real tool implementations
   from `@agent-web/core`, plus optional `experimental_telemetry` (Langfuse)
6. Returns `toDataStreamResponse()` — the client manually parses the Vercel AI SDK
   data stream. Handled line prefixes: `0:` text, `1:`/`9:` tool call,
   `2:`/`a:` tool result, `3:` error. The client does **not** use `useChat`.

**State management:** Zustand store (`lib/store.ts`) with optimistic updates — mutations
apply locally first, then persist via API calls to `/api/sessions/...`. Sessions, messages,
and projects live in SQLite (not localStorage). Only UI prefs persist to localStorage.

**Auth:** Username/password (bcryptjs). A `session_token` HttpOnly cookie (7-day) is
validated in middleware and per-route via a `getUserIdFromRequest()`-style helper in
`lib/auth.ts`. Protected routes return 401 when unauthenticated.

### API Routes (`app/api/**`)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/chat` | POST | Streaming LLM completion with tools, skills, files, memory injection |
| `/api/auth/login` `/register` `/logout` `/me` `/password` `/users` | POST/GET | Auth + user management |
| `/api/sessions` | GET/POST/PATCH/DELETE | Session CRUD (filterable by projectId) |
| `/api/sessions/[id]/messages` | GET/POST/PATCH/DELETE | Message CRUD, truncate, clear |
| `/api/sessions/[id]/branch` | POST | Fork a conversation at a message (branching) |
| `/api/sessions/export` `/import` | GET/POST | Export/import sessions as JSON |
| `/api/memory` | GET/POST/PATCH/DELETE | Structured key-value memory (category, importance) |
| `/api/knowledge/bases` `/documents` `/search` | GET/POST/DELETE/POST | RAG knowledge bases + FTS5 search |
| `/api/agents/marketplace` `/marketplace/[id]` `/installed` | GET/POST/PATCH/DELETE | Agent presets + installs |
| `/api/mcp/servers` `/tools` | GET/POST/DELETE/GET | MCP server config + connect/disconnect; loaded tools |
| `/api/tts` `/api/stt` | POST | Text-to-speech / speech-to-text via `@lobehub/tts` |
| `/api/search` | GET | Global search across session titles + message content |
| `/api/projects` `/projects/[id]/files` | GET/POST/PATCH/DELETE | File-based project workspaces |
| `/api/obsidian/config` `/sync` | GET/POST/DELETE | Sync sessions to an Obsidian vault as Markdown |
| `/api/upload` `/upload/preview` | GET/POST/DELETE/POST | File upload (`data/uploads/`) + content preview |
| `/api/keys` | GET/POST/DELETE | Encrypted per-user API keys (AES-256-GCM) |
| `/api/config/status` | GET | Which providers have server-side API keys |
| `/api/skills` | GET | List installed SKILL.md files from disk |

### Tools (`packages/core/src/tools/`)

Registered in `tools/registry.ts`; descriptions in `tools/tool-descriptions.ts`. All are
wired into `/api/chat` via the registry. File tools are confined to the project workspace
via `tools/path-security.ts` (override with `TOOL_ALLOWED_BASE`, not recommended).

- **terminal** — Shell execution. `TERMINAL_BACKEND=docker` runs in the sandbox container; `local` uses a blocklist + timeout.
- **read_file** / **write_file** — Text file I/O (5MB read, 1MB write; line ranges; creates parent dirs).
- **list_directory** / **search_files** — Directory listing; glob filename or regex content search.
- **web_search** — DuckDuckGo HTML scraping (no API key), 5-min LRU cache.
- **web_fetch** — Fetch a URL and strip HTML to readable text.
- **execute_code** — Run JS/TS in a Node sandbox (Docker or local; blocks dangerous imports).
- **git** — Wraps the system `git`.
- **db_query** — Read-only SQLite (SELECT/PRAGMA/EXPLAIN only).
- **api_test** — HTTP request testing.
- **knowledge_search** — FTS5 search over the knowledge base (LIKE fallback).
- **image_generate** — Placeholder pending provider configuration.
- **MCP tools** — `tools/mcp/mcp-manager.ts` connects stdio MCP servers from
  `data/mcp-servers.json`, converts JSON Schema → Zod, and exposes tools prefixed
  `mcp__<server>__<tool>`. The config file is created/managed at runtime via the
  `/api/mcp/servers` route (and the MCP manager UI) — no manual setup is required;
  it is created on first server add if absent.

### Database (`packages/db/src/schema.ts`)

SQLite via libsql. Migrations are idempotent phases run on first query
(`ensureMigrated()`): V1–V2 core tables, V3 structured memories, V4 knowledge base +
FTS5, V5 agent marketplace, V6 branching columns. Tables: `users`, `auth_tokens`,
`sessions`, `messages` (with `parentId`/`branchRootId` for branching), `projects`,
`api_keys`, `obsidian_config`, `memories`, `knowledge_bases`, `knowledge_documents`,
`document_chunks`, `chunks_fts` (FTS5 virtual), `agent_presets`, `installed_agents`.

### Skills system

SKILL.md files in `.verdent/skills/<name>/SKILL.md` (and `~/.verdent/skills/`,
`~/.agents/skills/`). Frontmatter `name` + `description`. User-enabled skills have their
descriptions injected into the system prompt.

### Memory system

When `ENABLE_MEMORY=true`: structured rows (`key`, `value`, `category`, `importance`,
`context`) in the `memories` table, injected into the system prompt under "User Context".
`MEMORY_CHAR_LIMIT` caps injected length (default 2200).

### Observability

Optional Langfuse via OpenTelemetry (`lib/observability.ts`). Enabled when
`LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` are set; `streamText` emits
`experimental_telemetry` spans.

## Key Constraints

- **pnpm 9.0.0** enforced via `packageManager`.
- **Next.js 16** — breaking API/convention changes vs older versions. Consult
  `node_modules/next/dist/docs/` before writing Next.js code.
- **`output: "standalone"`** in `next.config.ts` — production Docker copies `.next/standalone`.
- **`transpilePackages`** — `@agent-web/core` and `@agent-web/db` are tsc-built but Next.js transpiles them; build packages before the web app (or run tsc watch).
- **`serverExternalPackages`** — `@libsql/client`, `pdf-parse`, `mammoth`, `xlsx`, `@lobehub/tts` are server-only native/heavy deps.
- **Webpack forced** (not Turbopack) — `next.config.ts` stubs Node built-ins on the client to keep server-only `@agent-web/core` deps out of the browser bundle.
- **Tailwind v3** — configured via `tailwind.config.ts` + `postcss.config.mjs` with the `tailwindcss` PostCSS plugin and `@tailwind` directives in `globals.css`. (Note: this is **v3, not v4** — older docs claiming v4/CSS-first config are wrong.)
- **ESLint v9 flat config** (`eslint.config.mjs`) — `eslint-config-next/core-web-vitals` + `typescript`.
- **shadcn/ui** configured (`components.json`); base UI in `components/ui/`.
- **Design system** in `apps/web/DESIGN_SYSTEM.md` — dark-first, glassmorphism, WCAG 2.1 AA, 8pt grid.
- **Security headers** set in `next.config.ts` (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy); rate limiting in `lib/rate-limit.ts` / middleware.
- **Dockerfile** has `development`, `production`, and `sandbox` targets; the Compose `sandbox` service uses `profiles: [sandbox]` and is not started by default.
- **Tests** use Vitest + happy-dom.

## Environment Variables

Copy `.env.example` to `.env.local`. Key vars:

| Variable | Default | Notes |
|----------|---------|-------|
| `OPENAI_API_KEY` | — | At least one provider key required |
| `OPENROUTER_API_KEY` | — | |
| `DEEPSEEK_API_KEY` | — | |
| `ENCRYPTION_KEY` | dev fallback | Encrypts stored API keys at rest (AES-256-GCM). **The unset fallback is insecure — always set a 32-byte hex key in production** (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `DATABASE_URL` | `file:./data/local.db` | libsql remote: `libsql://...` |
| `DATABASE_AUTH_TOKEN` | — | Required for Turso/libsql remote |
| `TERMINAL_BACKEND` | `local` | `docker` for sandbox isolation |
| `ENABLE_MEMORY` | `false` | Persist memories across sessions |
| `MEMORY_CHAR_LIMIT` | `2200` | Max chars for injected memory |
| `CONTEXT_COMPRESSION_THRESHOLD` | `80000` | Token limit before trimming |
| `OBSIDIAN_VAULT_PATH` | — | Enables session → vault sync |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` | — | Optional observability |

## Adding Features

**New LLM provider:** Add the API key check in the chat route's key resolution, add a
provider branch in the `POST` handler (create client, handle special behaviors like
DeepSeek's fetch wrapper), and update the settings-panel UI.

**New tool:** Create `packages/core/src/tools/<name>.ts` using `tool()` from `ai` +
`zod`, register it in `packages/core/src/tools/registry.ts`, add metadata in
`tools/tool-descriptions.ts`, and re-export from `packages/core/src/index.ts`. Tools are
then automatically available in the chat route.

**New API route:** Add under `app/api/<name>/route.ts`. Server-side DB helpers go in
`lib/db.ts` (or `packages/db` helpers); enforce auth via `lib/auth.ts`; validate input
with zod; return standard JSON errors via `lib/error-handler.ts`. Client calls go through
the Zustand store or direct `fetch`.

**DB schema change:** Edit `packages/db/src/schema.ts` and add an idempotent migration
phase in `packages/db/src/migrate.ts` (follow the V1–V6 pattern). To reset the DB, delete
`data/local.db` and restart.

> Note: `AGENTS.md` is a parallel guidance file (for Verdent). The `.planning/codebase/`
> directory holds generated analysis docs. Some of those and the prior CLAUDE.md drifted
> from the current code (e.g. Tailwind version, tool count) — trust this file and the
> source over them.
