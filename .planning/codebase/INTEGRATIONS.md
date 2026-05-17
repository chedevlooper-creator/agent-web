# External Integrations

**Analysis Date:** 2026-05-17

## LLM Providers

### OpenAI
- **Purpose:** Primary LLM provider for chat completions
- **SDK/Client:** `@ai-sdk/openai` ^1.0.0 with `createOpenAI()` 
- **Auth:** `OPENAI_API_KEY` environment variable (`apps/web/app/api/chat/route.ts:17`)
- **Models:** gpt-4o, gpt-4o-mini, o3-mini (configured in `apps/web/components/settings-panel.tsx:14`)
- **API Base:** Default OpenAI API endpoint

### OpenRouter
- **Purpose:** Multi-model gateway (primary default provider)
- **SDK/Client:** `@ai-sdk/openai` with custom base URL
- **Auth:** `OPENROUTER_API_KEY` environment variable (`apps/web/app/api/chat/route.ts:19`)
- **API Base:** `https://openrouter.ai/api/v1` (`apps/web/app/api/chat/route.ts:144`)
- **Models:** claude-sonnet-4, gpt-4o, gpt-4o-mini, gemini-2.5-pro, deepseek-chat, llama-3.3-70b-instruct (`apps/web/components/settings-panel.tsx:19-26`)
- **Default model:** `openai/gpt-4o-mini` (`apps/web/lib/store.ts:183`)

### DeepSeek
- **Purpose:** Alternative LLM provider
- **SDK/Client:** `@ai-sdk/openai` with custom base URL and fetch wrapper
- **Auth:** `DEEPSEEK_API_KEY` environment variable (`apps/web/app/api/chat/route.ts:22`)
- **API Base:** `https://api.deepseek.com` (`apps/web/app/api/chat/route.ts:162`)
- **Special handling:** Fetch wrapper disables thinking mode (`thinking: { type: "disabled" }`) to prevent reasoning_content errors in multi-step tool calls (`apps/web/app/api/chat/route.ts:150-158`)
- **History cleaning:** Strips `reasoning_content` and `reasoningContent` fields from message history before sending (`apps/web/app/api/chat/route.ts:187-194`)
- **Models:** deepseek-v4-flash, deepseek-v4-pro, deepseek-chat, deepseek-reasoner (`apps/web/components/settings-panel.tsx:30`)

### API Key Management
- **Server-side:** Environment variables (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`) checked in `apps/web/app/api/config/status/route.ts`
- **User-provided:** Per-user API keys stored in `api_keys` database table, managed via `/api/keys` endpoints (`apps/web/lib/store.ts:711-731`)
- **Status check:** `/api/config/status` returns provider availability (`apps/web/lib/store.ts:651-661`)
- **Encryption:** Environment variable `ENCRYPTION_KEY` for encrypting API keys at rest (fallback to dev-only insecure mode if unset)

## Data Storage

### Database
- **Type:** SQLite (local), with optional Turso/libsql remote support
- **Connection:** `DATABASE_URL` environment variable (`file:./data/local.db` default)
- **Client:** `@libsql/client` 0.14.0 in `packages/db/src/client.ts`
  - Supports auth token for remote connections: `DATABASE_AUTH_TOKEN`
- **ORM:** Drizzle ORM 0.36.4 with `drizzle-orm/libsql` driver
  - Schema: `packages/db/src/schema.ts` (8 tables: users, auth_tokens, projects, sessions, messages, api_keys, memories, obsidian_config)
  - Migrations in `packages/db/src/migrate.ts`
- **Migration guard:** `ensureMigrated()` called before every operation via `ready()` pattern in `apps/web/lib/db.ts:41-46`

### File Storage
- **Type:** Local filesystem only
- **Uploads directory:** `data/uploads/` within project root (`apps/web/app/api/upload/route.ts:7`)
- **Supported upload types:** Any file type, with special hints for xlsx, csv, json, txt, md, log, yaml, yml, toml, ini, cfg, env files in system prompt (`apps/web/app/api/chat/route.ts:42-57`)
- **Background processing:** mammoth (DOCX), pdf-parse (PDF), xlsx (Excel)

### Caching
- **Type:** In-memory LRU cache for web search results
- **Implementation:** `packages/core/src/tools/web-search.ts:56-77`
  - Cache TTL: 5 minutes, max 50 entries
  - Eviction: oldest entry when at capacity

## Skills System

- **Skill locations:**
  - Project: `.verdent/skills/<name>/SKILL.md`
  - User home: `~/.verdent/skills/`, `~/.agents/skills/`
- **Skill discovery:** `/api/skills` route scans all three directories for SKILL.md files and parses frontmatter (`name`, `description`)
- **Skill injection:** Enabled skill descriptions are injected into the system prompt (`apps/web/app/api/chat/route.ts:64-96`)
- **SKILL_DIR env:** Override via `SKILLS_DIR` environment variable

## Memory System

- **Purpose:** Persistent key-value memory across chat sessions
- **Database table:** `memories` (key, value, timestamps)
- **API endpoints:** `/api/memory` (GET, POST, DELETE) in `apps/web/app/api/memory/route.ts`
- **Injection:** When `ENABLE_MEMORY=true`, memories are injected into system prompt under "User Context (persisted across sessions)"
- **Char limit:** `MEMORY_CHAR_LIMIT` (default 2200) caps injected memory content

## Obsidian Vault Integration

- **Status:** Declared UI/framework in place, actual sync is a no-op (`apps/web/lib/store.ts:747-748`)
- **Database config:** `obsidian_config` table stores vault path per user
- **UI controls:** Vault path and auto-sync toggle in settings panel
- **Planned behavior:** Write sessions to `{vault}/Agent Web/{title}.md`
- **Environment variable:** `OBSIDIAN_VAULT_PATH` for configuring the vault path

## Web Search

- **Provider:** DuckDuckGo (no API key needed)
- **Implementation:** HTML scraping of `https://html.duckduckgo.com/html/` in `packages/core/src/tools/web-search.ts`
- **User-Agent:** Masquerades as Chrome 120 browser
- **Caching:** In-memory LRU cache (5 min TTL, 50 entry max)
- **Timeout:** 10 seconds per request
- **Rate limit:** Max 10 results per query

## Web Fetch

- **Purpose:** Fetch and extract text content from web pages
- **Implementation:** Raw `fetch()` with HTML stripping in `packages/core/src/tools/web-fetch.ts`
- **Supported protocols:** HTTP and HTTPS only
- **User-Agent:** Masquerades as Chrome 120 browser
- **Timeout:** Default 15s, max 60s
- **Content limit:** 32K characters returned
- **Redirects:** Followed automatically

## Terminal Execution

- **Backend options:** `local` (default) or `docker` (controlled by `TERMINAL_BACKEND` env var)
- **Local:** Direct execution with safety blocklist in `packages/core/src/tools/terminal/local.ts`
- **Docker:** Execution in isolated sandbox container via `docker exec` (`packages/core/src/tools/terminal/docker.ts`)
- **Timeout:** Default 30s, max 120s
- **Fallback:** Docker → local if Docker unavailable

## Code Execution

- **Languages:** JavaScript and TypeScript
- **Docker sandbox:** Pre-installed with Python 3, pandas, numpy, requests, beautifulsoup4, tsx (TypeScript execution)
- **Local:** Temp file execution with dangerous import blocking
- **Timeout:** Default 15s, max 120s
- **Container limit:** 256 MB memory, 5s CPU in dev; 1 GB memory, 2 CPUs in production

## Git Operations

- **Purpose:** Version control within the LLM tool system
- **Implementation:** `git` CLI commands via `child_process.exec()` in `packages/core/src/tools/git-tool.ts`
- **Parameters:** Command (without `git` prefix), working directory, timeout
- **Timeout:** Default 30s, max 120s
- **Output limit:** 10,000 characters

## Database Query Tool

- **Purpose:** Read-only SQL access for the LLM
- **Implementation:** `@libsql/client` directly in `packages/core/src/tools/db-query.ts`
- **Restrictions:** Only SELECT, PRAGMA, and EXPLAIN queries allowed
- **Max rows:** 100 (configurable up to 500)
- **Output limit:** 10,000 characters

## API Test Tool

- **Purpose:** HTTP request testing from the LLM
- **Implementation:** Raw `fetch()` in `packages/core/src/tools/api-test.ts`
- **Methods:** GET, POST, PUT, PATCH, DELETE
- **Timeout:** Default 15s, max 60s
- **Follows redirects:** Yes

## File Tools

**Tools:** read_file, write_file, list_directory, search_files (all in `packages/core/src/tools/`)

**Path Security:**
- **Restriction:** All file operations are restricted to the project workspace directory (`packages/core/src/tools/path-security.ts`)
- **Override:** `TOOL_ALLOWED_BASE` environment variable
- **System dir protection:** Blocks access to Windows system directories and Unix `/etc`, `/proc`, `/sys`, etc.
- **Max file read size:** 5 MB
- **Max return chars:** 32,000 (with smart truncation showing head + tail)
- **Line range support:** Optional offset/limit for partial reads

## User Authentication

- **Auth Provider:** Custom local auth (no third-party provider)
- **Method:** Username + password (bcrypt hashed) stored in `users` table
- **Tokens:** Session tokens in `auth_tokens` table with expiry
- **Implementation:** `requireUserId()` middleware pattern in `apps/web/lib/db.ts:50-54`
- **User context:** Attached to requests via `userId` property

## Authentication for LLM Providers

- **Implementation:** Managed API key endpoints `/api/keys` (POST/DELETE) in store
- **Storage:** `api_keys` table with per-user provider+key pairs
- **Encryption:** Optional `ENCRYPTION_KEY` env var for at-rest encryption

## Environment Configuration

**Required env vars (at least one; found in `.env.example`):**
- `OPENAI_API_KEY` - OpenAI API key
- `OPENROUTER_API_KEY` - OpenRouter API key
- `DEEPSEEK_API_KEY` - DeepSeek API key (optional)

**Optional env vars:**
- `ENCRYPTION_KEY` - API key encryption (32-byte hex)
- `DATABASE_URL` - Database connection string (default: `file:./data/local.db`)
- `DATABASE_AUTH_TOKEN` - Turso/libsql auth token
- `TERMINAL_BACKEND` - `local` or `docker`
- `TERMINAL_SANDBOX_CONTAINER` - Docker container name
- `ENABLE_MEMORY` - Toggle persistent memory (default: false)
- `MEMORY_CHAR_LIMIT` - Memory injection char limit (default: 2200)
- `CONTEXT_COMPRESSION_THRESHOLD` - Token trim threshold (default: 80000)
- `OBSIDIAN_VAULT_PATH` - Obsidian vault path
- `NODE_ENV` - Environment mode
- `TOOL_ALLOWED_BASE` - Override file tool workspace restriction
- `SKILLS_DIR` - Override skills directory

## CI/CD & Deployment

**CI Pipeline:** None detected (no `.github/` or CI config files)

**Deployment:** Docker-based only
- Docker Compose for development (`docker-compose.yml`) and production (`docker-compose.prod.yml`)
- Production container: CPU 4 cores / 4 GB memory (limits), 1 core / 512 MB (reservations)
- Sandbox container: CPU 2 cores / 1 GB memory (production)

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

## Monitoring & Observability

**Error Tracking:** None (uses `console.error` throughout)

**Logs:** Console logging only

---

*Integration audit: 2026-05-17*
