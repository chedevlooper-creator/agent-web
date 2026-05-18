# CLAUDE.md

Guidance to Claude Code when working in this repo.

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

Monorepo: pnpm workspaces + Turborepo. `build`/`dev`/`test` depend on `^build` — packages compile before web app.

### Packages

- **`packages/core`** (`@agent-web/core`) — LLM tools, token counting, context compression, MCP client. `tsc` → `dist/`. Entrypoints: `.` (types + context utils), `./tools` (tool registry + descriptions), `./types`.
- **`packages/db`** (`@agent-web/db`) — Drizzle ORM (SQLite/libsql), migration runner (V1–V6, idempotent), client singleton, CRUD for memories/knowledge/agents. `tsc` → `dist/`. Exports `.`, `./schema`, `./client`.

### App: `apps/web`

Next.js **16.2.6** App Router, React **19.2.4**. No `src/`. Pages: `/` (chat), `/login` (auth).

**Chat flow (POST /api/chat):**
1. `ChatInterface` (client) → custom `fetch` + `getReader()` loop → sends `{ messages, provider, model, enabledSkills?, files?, ... }` to `/api/chat`
2. Route resolve auth user, build system prompt (tools + files + skills SKILL.md + memories if `ENABLE_MEMORY=true`)
3. Create AI SDK client via `createOpenAI()` — providers: `openai`, `openrouter`, `deepseek`
4. Context compression: `countMessagesTokens` → `trimToTokenLimit` (sliding window; keep system + first user + most recent)
5. `streamText({ model, messages, tools, ... })` with real tools from `@agent-web/core` + optional `experimental_telemetry` (Langfuse)
6. `toDataStreamResponse()` — client parse Vercel AI SDK data stream. Prefixes: `0:` text, `1:`/`9:` tool call, `2:`/`a:` tool result, `3:` error. Client does **not** use `useChat`.

**State:** Zustand store (`lib/store.ts`). Optimistic updates — local first, persist via `/api/sessions/...`. Sessions/messages/projects in SQLite. Only UI prefs in localStorage.

**Auth:** Username/password (bcryptjs). `session_token` HttpOnly cookie (7-day). Validate in middleware + per-route via `lib/auth.ts`. Protected routes return 401.

### API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/chat` | POST | Streaming LLM with tools, skills, files, memory |
| `/api/auth/login` `/register` `/logout` `/me` `/password` `/users` | POST/GET | Auth + user mgmt |
| `/api/sessions` | GET/POST/PATCH/DELETE | Session CRUD (filter by projectId) |
| `/api/sessions/[id]/messages` | GET/POST/PATCH/DELETE | Message CRUD, truncate, clear |
| `/api/sessions/[id]/branch` | POST | Fork conversation at message |
| `/api/sessions/export` `/import` | GET/POST | Export/import JSON |
| `/api/memory` | GET/POST/PATCH/DELETE | Structured key-value memory |
| `/api/knowledge/bases` `/documents` `/search` | GET/POST/DELETE/POST | RAG + FTS5 search |
| `/api/agents/marketplace` `/marketplace/[id]` `/installed` | GET/POST/PATCH/DELETE | Agent presets + installs |
| `/api/mcp/servers` `/tools` | GET/POST/DELETE/GET | MCP server config + tools |
| `/api/tts` `/api/stt` | POST | TTS/STT via `@lobehub/tts` |
| `/api/search` | GET | Global search sessions + messages |
| `/api/projects` `/projects/[id]/files` | GET/POST/PATCH/DELETE | File-based workspaces |
| `/api/obsidian/config` `/sync` | GET/POST/DELETE | Sync sessions to Obsidian vault |
| `/api/upload` `/upload/preview` | GET/POST/DELETE/POST | Upload + preview |
| `/api/keys` | GET/POST/DELETE | Encrypted per-user API keys |
| `/api/config/status` | GET | Which providers have server keys |
| `/api/skills` | GET | List SKILL.md files from disk |

### Tools (`packages/core/src/tools/`)

Register in `tools/registry.ts`, describe in `tools/tool-descriptions.ts`. Wired into `/api/chat`. File tools confined to workspace via `tools/path-security.ts`.

- **terminal** — Shell exec. `TERMINAL_BACKEND=docker` → sandbox; `local` → blocklist + timeout.
- **read_file** / **write_file** — Text file I/O (5MB read, 1MB write; line ranges; create parent dirs).
- **list_directory** / **search_files** — Dir listing; glob/regex content search.
- **web_search** — DuckDuckGo HTML scrape (no API key), 5-min LRU cache.
- **web_fetch** — Fetch URL, strip HTML to text.
- **execute_code** — JS/TS in Node sandbox (Docker/local; block dangerous imports).
- **git** — System `git` wrapper.
- **db_query** — Read-only SQLite (SELECT/PRAGMA/EXPLAIN only).
- **api_test** — HTTP request testing.
- **knowledge_search** — FTS5 search over KB (LIKE fallback).
- **image_generate** — Placeholder.
- **MCP tools** — `tools/mcp/mcp-manager.ts` connects stdio MCP servers from `data/mcp-servers.json`. Converts JSON Schema → Zod, exposes tools prefixed `mcp__<server>__<tool>`. Config created/managed at runtime via `/api/mcp/servers` + MCP UI. Created on first server add if absent.

### Database (`packages/db/src/schema.ts`)

SQLite/libsql. Idempotent migrations on first query (`ensureMigrated()`): V1–V2 core, V3 memories, V4 KB + FTS5, V5 agents, V6 branching. Tables: `users`, `auth_tokens`, `sessions`, `messages` (with `parentId`/`branchRootId`), `projects`, `api_keys`, `obsidian_config`, `memories`, `knowledge_bases`, `knowledge_documents`, `document_chunks`, `chunks_fts` (FTS5), `agent_presets`, `installed_agents`.

### Skills system

SKILL.md in `.verdent/skills/<name>/` (and `~/.verdent/skills/`, `~/.agents/skills/`). Frontmatter `name` + `description`. Enabled skills injected into system prompt.

### Memory system

`ENABLE_MEMORY=true`: structured rows (`key`, `value`, `category`, `importance`, `context`) in `memories` table → injected into system prompt. `MEMORY_CHAR_LIMIT` caps (default 2200).

### Observability

Optional Langfuse via OpenTelemetry (`lib/observability.ts`). Enabled when `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` set. `streamText` emits `experimental_telemetry` spans.

## Key Constraints

- **pnpm 9.0.0** via `packageManager`.
- **Next.js 16** — breaking changes vs older versions. Consult `node_modules/next/dist/docs/`.
- **`output: "standalone"`** in `next.config.ts` — prod Docker copies `.next/standalone`.
- **`transpilePackages`** — `@agent-web/core` + `@agent-web/db` are tsc-built, transpiled by Next.js. Build before web app.
- **`serverExternalPackages`** — `@libsql/client`, `pdf-parse`, `mammoth`, `xlsx`, `@lobehub/tts`.
- **Webpack forced** (not Turbopack) — stub Node built-ins on client to keep server-only deps out of browser bundle.
- **Tailwind v3** — `tailwind.config.ts` + `postcss.config.mjs`. (**Not** v4/CSS-first.)
- **ESLint v9 flat config** — `eslint-config-next/core-web-vitals` + `typescript`.
- **shadcn/ui** configured; base UI in `components/ui/`.
- **Design system** in `apps/web/DESIGN_SYSTEM.md` — dark-first, glassmorphism, WCAG 2.1 AA, 8pt grid.
- **Security headers** in `next.config.ts`; rate limiting in `lib/rate-limit.ts` / middleware.
- **Dockerfile** has `development`, `production`, `sandbox` targets. Compose sandbox uses `profiles: [sandbox]`, not started by default.
- **Tests** use Vitest + happy-dom.

## Environment Variables

Copy `.env.example` → `.env.local`. Key vars:

| Variable | Default | Notes |
|----------|---------|-------|
| `OPENAI_API_KEY` | — | At least one provider key required |
| `OPENROUTER_API_KEY` | — | |
| `DEEPSEEK_API_KEY` | — | |
| `ENCRYPTION_KEY` | dev fallback | Encrypts API keys (AES-256-GCM). **Always set 32-byte hex in prod** (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `DATABASE_URL` | `file:./data/local.db` | libsql remote: `libsql://...` |
| `DATABASE_AUTH_TOKEN` | — | Required for Turso remote |
| `TERMINAL_BACKEND` | `local` | `docker` for sandbox |
| `ENABLE_MEMORY` | `false` | Persist memories |
| `MEMORY_CHAR_LIMIT` | `2200` | Max injected memory chars |
| `CONTEXT_COMPRESSION_THRESHOLD` | `80000` | Token trim limit |
| `OBSIDIAN_VAULT_PATH` | — | Enable vault sync |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` | — | Optional observability |

## Adding Features

**New LLM provider:** Add key check in chat route's key resolution, provider branch in `POST` handler, update settings-panel UI.

**New tool:** Create `packages/core/src/tools/<name>.ts` with `tool()` + `zod`. Register in `packages/core/src/tools/registry.ts`, add metadata in `tools/tool-descriptions.ts`, re-export from `packages/core/src/index.ts`. Auto-available in chat route.

**New API route:** Add under `app/api/<name>/route.ts`. DB helpers in `lib/db.ts` (or `packages/db`). Auth via `lib/auth.ts`. Validate with zod. Standard JSON errors via `lib/error-handler.ts`. Client calls via Zustand store or direct `fetch`.

**DB schema change:** Edit `packages/db/src/schema.ts`, add idempotent migration phase in `packages/db/src/migrate.ts` (follow V1–V6 pattern). Reset: delete `data/local.db` and restart.

> Note: `AGENTS.md` is parallel guidance (for Verdent). `.planning/codebase/` has generated analysis. Some doc drifted from current code (Tailwind version, tool count) — trust this file + source over them.
