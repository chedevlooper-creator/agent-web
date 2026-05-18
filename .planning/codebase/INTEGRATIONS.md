# External Integrations

**Analysis Date:** 2026-05-17

## LLM Providers

### OpenAI
- **Purpose:** Primary LLM provider
- **SDK:** `@ai-sdk/openai` ^1.0.0 with `createOpenAI()`
- **Auth:** `OPENAI_API_KEY` env var (`apps/web/app/api/chat/route.ts:17`)
- **Models:** gpt-4o, gpt-4o-mini, o3-mini (`apps/web/components/settings-panel.tsx:14`)
- **API Base:** Default OpenAI endpoint

### OpenRouter
- **Purpose:** Multi-model gateway (primary default provider)
- **SDK:** `@ai-sdk/openai` with custom base URL
- **Auth:** `OPENROUTER_API_KEY` env var (`apps/web/app/api/chat/route.ts:19`)
- **API Base:** `https://openrouter.ai/api/v1` (`apps/web/app/api/chat/route.ts:144`)
- **Models:** claude-sonnet-4, gpt-4o, gpt-4o-mini, gemini-2.5-pro, deepseek-chat, llama-3.3-70b-instruct (`apps/web/components/settings-panel.tsx:19-26`)
- **Default model:** `openai/gpt-4o-mini` (`apps/web/lib/store.ts:183`)

### DeepSeek
- **Purpose:** Alternative LLM provider
- **SDK:** `@ai-sdk/openai` with custom base URL + fetch wrapper
- **Auth:** `DEEPSEEK_API_KEY` env var (`apps/web/app/api/chat/route.ts:22`)
- **API Base:** `https://api.deepseek.com` (`apps/web/app/api/chat/route.ts:162`)
- **Special handling:** Fetch wrapper disables thinking (`thinking: { type: "disabled" }`) to prevent reasoning_content errors in multi-step tool calls (`apps/web/app/api/chat/route.ts:150-158`)
- **History cleaning:** Strips `reasoning_content` / `reasoningContent` from message history (`apps/web/app/api/chat/route.ts:187-194`)
- **Models:** deepseek-v4-flash, deepseek-v4-pro, deepseek-chat, deepseek-reasoner (`apps/web/components/settings-panel.tsx:30`)

### API Key Management
- **Server-side:** Env vars (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`) checked in `apps/web/app/api/config/status/route.ts`
- **User-provided:** Per-user keys in `api_keys` table, managed via `/api/keys` (`apps/web/lib/store.ts:711-731`)
- **Status check:** `/api/config/status` returns provider availability (`apps/web/lib/store.ts:651-661`)
- **Encryption:** `ENCRYPTION_KEY` env var (AES-256-GCM), dev fallback if unset

## Data Storage

### Database
- **Type:** SQLite (local), optional Turso/libsql remote
- **Connection:** `DATABASE_URL` (`file:./data/local.db` default)
- **Client:** `@libsql/client` 0.14.0 (`packages/db/src/client.ts`)
  - Remote auth: `DATABASE_AUTH_TOKEN`
- **ORM:** Drizzle ORM 0.36.4 with `drizzle-orm/libsql`
  - Schema: `packages/db/src/schema.ts` (8 tables)
  - Migrations: `packages/db/src/migrate.ts`
- **Migration guard:** `ensureMigrated()` before every operation via `ready()` (`apps/web/lib/db.ts:41-46`)

### File Storage
- **Type:** Local filesystem only
- **Uploads:** `data/uploads/` (`apps/web/app/api/upload/route.ts:7`)
- **Types:** Any file; special hints for xlsx, csv, json, txt, md, log, yaml, yml, toml, ini, cfg, env in system prompt (`apps/web/app/api/chat/route.ts:42-57`)
- **Background processing:** mammoth (DOCX), pdf-parse (PDF), xlsx (Excel)

### Caching
- **Type:** In-memory LRU for web search
- **Implementation:** `packages/core/src/tools/web-search.ts:56-77`
  - TTL: 5 min, max 50 entries
  - Eviction: oldest at capacity

## Skills System

- **Locations:**
  - Project: `.verdent/skills/<name>/SKILL.md`
  - User home: `~/.verdent/skills/`, `~/.agents/skills/`
- **Discovery:** `/api/skills` scans 3 dirs for SKILL.md, parses frontmatter (`name`, `description`)
- **Injection:** Enabled skill descriptions injected into system prompt (`apps/web/app/api/chat/route.ts:64-96`)
- **Override:** `SKILLS_DIR` env var

## Memory System

- **Purpose:** Persistent key-value memory across sessions
- **Table:** `memories` (key, value, timestamps)
- **API:** `/api/memory` (GET, POST, DELETE) in `apps/web/app/api/memory/route.ts`
- **Injection:** When `ENABLE_MEMORY=true`, memories injected into system prompt under "User Context (persisted across sessions)"
- **Char limit:** `MEMORY_CHAR_LIMIT` (default 2200)

## Obsidian Vault Integration

- **Status:** UI/framework in place, sync is a no-op (`apps/web/lib/store.ts:747-748`)
- **DB config:** `obsidian_config` table (vault path per user)
- **UI:** Vault path + auto-sync toggle in settings
- **Planned:** Write sessions to `{vault}/Agent Web/{title}.md`
- **Env:** `OBSIDIAN_VAULT_PATH`

## Web Search

- **Provider:** DuckDuckGo (no API key)
- **Implementation:** HTML scrape `https://html.duckduckgo.com/html/` in `packages/core/src/tools/web-search.ts`
- **User-Agent:** Chrome 120
- **Cache:** In-memory LRU (5 min TTL, 50 max)
- **Timeout:** 10s
- **Rate limit:** Max 10 results/query

## Web Fetch

- **Purpose:** Fetch + extract text from URLs
- **Implementation:** Raw `fetch()` + HTML stripping in `packages/core/src/tools/web-fetch.ts`
- **Protocols:** HTTP/HTTPS only
- **User-Agent:** Chrome 120
- **Timeout:** Default 15s, max 60s
- **Content limit:** 32K chars
- **Redirects:** Followed automatically

## Terminal Execution

- **Backends:** `local` (default) or `docker` (`TERMINAL_BACKEND` env)
- **Local:** Exec with safety blocklist (`packages/core/src/tools/terminal/local.ts`)
- **Docker:** Isolated sandbox via `docker exec` (`packages/core/src/tools/terminal/docker.ts`)
- **Timeout:** Default 30s, max 120s
- **Fallback:** Docker → local if Docker unavailable

## Code Execution

- **Languages:** JS/TS
- **Docker sandbox:** Python 3, pandas, numpy, requests, beautifulsoup4, tsx
- **Local:** Temp file exec with dangerous import blocking
- **Timeout:** Default 15s, max 120s
- **Container limit:** 256MB mem, 5s CPU (dev); 1GB mem, 2 CPUs (prod)

## Git Operations

- **Purpose:** VCS in LLM tool system
- **Implementation:** `git` CLI via `child_process.exec()` in `packages/core/src/tools/git-tool.ts`
- **Params:** Command (no `git` prefix), working dir, timeout
- **Timeout:** Default 30s, max 120s
- **Output limit:** 10K chars

## Database Query Tool

- **Purpose:** Read-only SQL for LLM
- **Implementation:** `@libsql/client` in `packages/core/src/tools/db-query.ts`
- **Restrictions:** SELECT, PRAGMA, EXPLAIN only
- **Max rows:** 100 (configurable to 500)
- **Output limit:** 10K chars

## API Test Tool

- **Purpose:** HTTP request testing from LLM
- **Implementation:** Raw `fetch()` in `packages/core/src/tools/api-test.ts`
- **Methods:** GET, POST, PUT, PATCH, DELETE
- **Timeout:** Default 15s, max 60s
- **Follows redirects:** Yes

## File Tools

**Tools:** read_file, write_file, list_directory, search_files (`packages/core/src/tools/`)

**Path Security:**
- **Restriction:** File ops restricted to workspace (`packages/core/src/tools/path-security.ts`)
- **Override:** `TOOL_ALLOWED_BASE` env var
- **System dir protection:** Blocks Windows system dirs + Unix `/etc`, `/proc`, `/sys`, etc.
- **Max read size:** 5 MB
- **Max return chars:** 32K (smart truncation, head + tail)
- **Line range support:** Optional offset/limit

## User Authentication

- **Auth:** Custom local (no third-party)
- **Method:** Username + password (bcrypt) in `users` table
- **Tokens:** Session tokens in `auth_tokens` table with expiry
- **Middleware:** `requireUserId()` (`apps/web/lib/db.ts:50-54`)
- **User context:** Attached via `userId` property

## Authentication for LLM Providers

- **Endpoints:** `/api/keys` (POST/DELETE) in store
- **Storage:** `api_keys` table (per-user provider+key pairs)
- **Encryption:** Optional `ENCRYPTION_KEY` for at-rest encryption

## Environment Configuration

**Required (≥1; in `.env.example`):**
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `DEEPSEEK_API_KEY`

**Optional:**
- `ENCRYPTION_KEY` — 32-byte hex
- `DATABASE_URL` — default `file:./data/local.db`
- `DATABASE_AUTH_TOKEN` — Turso/libsql auth
- `TERMINAL_BACKEND` — `local` or `docker`
- `TERMINAL_SANDBOX_CONTAINER`
- `ENABLE_MEMORY` — default false
- `MEMORY_CHAR_LIMIT` — default 2200
- `CONTEXT_COMPRESSION_THRESHOLD` — default 80000
- `OBSIDIAN_VAULT_PATH`
- `NODE_ENV`
- `TOOL_ALLOWED_BASE`
- `SKILLS_DIR`

## CI/CD & Deployment

**CI:** None (no `.github/` or CI config)

**Deployment:** Docker only
- Docker Compose for dev (`docker-compose.yml`) + prod (`docker-compose.prod.yml`)
- Prod container: 4 cores / 4GB (limits), 1 core / 512MB (reservations)
- Sandbox container: 2 cores / 1GB (prod)

## Webhooks & Callbacks

**Incoming:** None
**Outgoing:** None

## Monitoring & Observability

**Error tracking:** None (`console.error` only)
**Logs:** Console only

---

*Integration audit: 2026-05-17*
