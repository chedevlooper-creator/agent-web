# Codebase Concerns

**Analysis Date:** 2026-05-17

## Tech Debt

### Dead Code: Duplicate DeepSeek Branch
- **Issue:** The chat route (`apps/web/app/api/chat/route.ts`, lines 165-169) contains a second `if (provider === "deepseek")` branch that never executes because the first branch at line 146 catches it first.
- **Impact:** Confuses future developers. If the main DeepSeek handler changes, this dead branch won't be updated.
- **Fix approach:** Remove the duplicate branch (lines 165-169).

### Obsidian Sync Is a No-op in Store
- **Issue:** `syncSessionToObsidian` in `apps/web/lib/store.ts` (line 747) is implemented as `// no-op until Obsidian plugin is integrated`. Yet the codebase has full API routes for Obsidian config (`/api/obsidian/config`, `/api/obsidian/sync`) and a fully implemented Obsidian sync library (`apps/web/lib/obsidian.ts`). The store calls `syncSessionToObsidian()` after every message add, rename, and delete -- all fire-and-forget no-ops.
- **Impact:** Confusing disconnect between backend capability and frontend wiring. The no-op fires HTTP calls to `/api/obsidian/sync` in `deleteSession` (line 387-390), which will 404 or produce errors if the route isn't active.
- **Fix approach:** Either wire the store's sync function to actually call the API, or remove the Obsidian route and lib entirely.

### Rough Token Counting
- **Issue:** Context compression in `packages/core/src/context.ts` uses `Math.ceil(text.length / 4)` for token estimation (line 8). Code-heavy content averages ~3 chars/token while prose averages ~5. Can be off by 2-3x.
- **Impact:** Context may be over-trimmed (losing useful history) or under-trimmed (exceeding actual model limits).
- **Fix approach:** Add `tiktoken` or use a model-specific tokenizer.

### `xlsx` Package Is Community Edition
- **Issue:** `apps/web/package.json` declares dependency on `xlsx` (^0.18.5). This is the SheetJS Community Edition with known limitations.
- **Impact:** Potential bugs with complex Excel files. No active security patches.
- **Fix approach:** Migrate to `@sheetjs/xlsx` or replace with `exceljs`.

### Migration System Is Fragile
- **Issue:** `packages/db/src/migrate.ts` runs raw SQL strings with `CREATE TABLE IF NOT EXISTS`. The V2 migration uses `ALTER TABLE` wrapped in `try/catch` (line 133). No version tracking, no rollback.
- **Impact:** If migration order changes or columns need type changes, there is no mechanism to handle it.
- **Fix approach:** Use Drizzle Kit migrations instead of raw SQL. Add a `schema_version` table.

### Hardcoded Encryption Key Fallback
- **Issue:** `apps/web/lib/crypto.ts` (lines 22-23) falls back to `"agent-web-dev-key-do-not-use-in-production"` when `ENCRYPTION_KEY` is not set in development mode.
- **Impact:** In production without `ENCRYPTION_KEY`, the fallback silently uses an insecure key. API keys stored in DB would be trivially decryptable.
- **Fix approach:** Remove the fallback entirely. Always require `ENCRYPTION_KEY`.

### Type Assertions Instead of Proper Types
- **Issue:** Heavy use of `as` type assertions throughout, e.g. `apps/web/lib/store.ts` line 612 casts `useChatStore.getState()`. Also in `apps/web/app/api/chat/route.ts` lines 182-194 for message type coercion.
- **Impact:** TypeScript cannot catch runtime errors. If message structures change, these casts fail silently.
- **Fix approach:** Use discriminated unions or zod validation instead of casts.

## Known Bugs

### No Rate Limiting on Auth Endpoints
- **Issue:** A rate limiter exists at `apps/web/lib/rate-limit.ts` but is never imported or used by any auth route (`/api/auth/login`, `/api/auth/register`, `/api/auth/password`).
- **Symptoms:** Brute-force password attacks are unthrottled.
- **Fix approach:** Apply the existing rate limiter to POST endpoints on `/api/auth/*`.

### `git` Tool Bypasses Path Security
- **Issue:** The git tool (`packages/core/src/tools/git-tool.ts`) accepts a `workingDir` parameter but resolves it with plain `resolve()` (line 25) instead of `resolveSafePath()`.
- **Symptoms:** A prompt injection could set workingDir to a system directory and run git operations outside the workspace.
- **Fix approach:** Use `resolveSafePath()` for the workingDir parameter.

### Docker Fallback Degrades Security
- **Issue:** Both terminal (`packages/core/src/tools/terminal/index.ts`, lines 37-43) and execute_code (`packages/core/src/tools/execute-code/index.ts`, lines 44-49) silently fall back to local execution when the Docker sandbox is unavailable.
- **Symptoms:** If Docker is down, sandboxing is silently bypassed.
- **Fix approach:** Add a `TERMINAL_BACKEND=strict-docker` mode that refuses to fall back.

## Security Considerations

### API Keys Stored Unencrypted in SQLite
- **Issue:** `packages/db/src/schema.ts` defines the `apiKeys` table with a `key` column stored as plain text. The `saveApiKey` function in `apps/web/lib/db.ts` (line 497) inserts keys directly without calling `encrypt()` from `apps/web/lib/crypto.ts`.
- **Files:** `packages/db/src/schema.ts:59-69`, `apps/web/lib/db.ts:497-508`
- **Risk:** Any attacker with SQLite file access can read all API keys in plaintext.
- **Recommendations:** Wire `crypto.ts` encrypt/decrypt into `saveApiKey`/`listApiKeys`/`getServerApiKey`.

### Memory API Has No Authentication
- **Issue:** `apps/web/app/api/memory/route.ts` -- all three methods (GET, POST, DELETE) perform no authentication.
- **Files:** `apps/web/app/api/memory/route.ts`
- **Risk:** Any unauthenticated request can read, create, or delete memory key-value pairs.
- **Recommendations:** Add user authentication to all memory endpoints.

### SSRF in `api-test` Tool
- **Issue:** The `api_test` tool (`packages/core/src/tools/api-test.ts`) can make HTTP requests to any URL including internal services (localhost, 127.0.0.1, cloud metadata endpoints). No SSRF protection.
- **Risk:** A prompt injection could probe internal services or cloud metadata endpoints.
- **Recommendations:** Block private IP ranges, loopback addresses, and cloud metadata IPs.

### `db_query` Tool Can Read Sensitive Data
- **Issue:** The `db_query` tool (`packages/core/src/tools/db-query.ts`) allows SELECT queries on any table, including `api_keys` and `users` tables.
- **Risk:** Prompt injection could exfiltrate all API keys and password hashes.
- **Recommendations:** Add a table blocklist for sensitive tables (api_keys, users, auth_tokens).

### Upload Path Bypass
- **Issue:** Upload preview (`apps/web/app/api/upload/preview/route.ts`, line 26) checks `!p.includes("..")` for path traversal. Bypassable with URL-encoded sequences, absolute paths, or symlinks.
- **Files:** `apps/web/app/api/upload/preview/route.ts:24-27`
- **Risk:** Attacker could read arbitrary files on the server.
- **Recommendations:** Use `resolveSafePath()` from the core package instead.

### Terminal Blocklist Can Be Bypassed
- **Issue:** The terminal tool (`packages/core/src/tools/terminal/local.ts`) uses a regex blocklist. Blocklists are inherently incomplete.
- **Risk:** Determined attacker with prompt injection can execute arbitrary commands.
- **Recommendations:** Use the existing `ALLOWED_COMMANDS` whitelist instead of just the blocklist.

### User Agent Spoofing
- **Issue:** `web_search.ts` and `web_fetch.ts` spoof a Chrome 120 User-Agent. May violate DuckDuckGo's ToS.
- **Recommendations:** Use official search APIs with API keys instead of scraping.

## Performance Bottlenecks

### Synchronous File Reads During Request Handling
- **Issue:** `buildSystemPrompt` in `apps/web/app/api/chat/route.ts` (lines 66-95) uses `fs.existsSync()` and `fs.readFileSync()` inside an async function.
- **Problem:** Synchronous I/O blocks the event loop during chat requests (long-running streaming operations).
- **Fix approach:** Use `fs.promises.readFile()` and `fs.promises.access()` instead.

### DB Client Created Per Query in Tool
- **Issue:** The `db_query` tool (`packages/core/src/tools/db-query.ts`, lines 33-38) creates a new libsql client per query, bypassing the singleton `getDb()` pattern.
- **Problem:** Connection exhaustion risk with remote/Turso databases.
- **Fix approach:** Import and use `getDb()` from `@agent-web/db`.

### No Reconnection Logic for DB Client
- **Issue:** `packages/db/src/client.ts` creates a singleton client. No reconnection on dropped connections.
- **Problem:** After transient DB failure, all queries fail until server restart.
- **Fix approach:** Add connection health checks and automatic reconnection.

## Fragile Areas

### DeepSeek Fetch Wrapper Is Fragile
- **Issue:** `apps/web/app/api/chat/route.ts` (lines 149-164) wraps `globalThis.fetch` to inject disabled thinking mode into DeepSeek requests. Parses and re-serializes JSON body of every fetch to `api.deepseek.com`.
- **Why fragile:** JSON parse of stream body may fail. Side-effects on global fetch are dangerous.
- **Test coverage:** No tests for this fetch wrapper.

### Middleware Bypasses `/api/*` Auth
- **Issue:** `apps/web/middleware.ts` (line 21-24) allows all `/api/*` routes without session validation. New API routes added without auth are publicly accessible.
- **Why fragile:** Easy to forget auth checks on new routes. Memory route is a clear example.
- **Recommendations:** Add auth check to `/api/chat` and consider middleware-level API auth.

### `genId()` Uses Math.random()
- **Issue:** `apps/web/lib/store.ts` (line 148) generates IDs with `Math.random().toString(36).slice(2)`. Not cryptographically secure.
- **Fix approach:** Use `crypto.randomUUID()` for all IDs.

## Configuration Issues

### Default DATABASE_URL Points to Relative Path
- **Issue:** `packages/db/src/client.ts` (line 5) defaults to `file:./data/local.db`. The DB file ends up in different places depending on which package's CWD is active.
- **Fix approach:** Make the DB path absolute or derive it from a known project root.

### No Startup Env Validation
- **Issue:** No validation on startup that required env vars are set. Missing vars produce errors only when specific endpoints are called.
- **Fix approach:** Add a startup check that validates required env vars.

## Dependencies at Risk

| Package | Version | Risk | Impact |
|---------|---------|------|--------|
| pnpm | 9.0.0 | Old version (current ~10.x). Lockfile format may change. | Build failures on CI |
| @types/node | ^20 | Not updated for Node 22+ | Inaccurate IDE suggestions |
| eslint-config-next | 16.2.6 | Tied to exact Next.js version | CI lint failures after upgrade |
| xlsx | ^0.18.5 | Community Edition, unmaintained | Excel parsing bugs without fixes |
| happy-dom | ^20.9.0 | Outdated, may lack some DOM APIs | Test failures |

## Missing Critical Features

### No E2E Tests
- **Problem:** The entire chat flow (file upload -> streaming -> tool execution -> DB persistence) has zero end-to-end tests.
- **Blocks:** Confidence in releases.

### No Request Validation on Chat Endpoint
- **Problem:** `apps/web/app/api/chat/route.ts` (line 124) destructures the JSON body without zod validation.
- **Blocks:** Reliable API error reporting.

### No Session Cleanup
- **Problem:** Expired auth tokens are never cleaned from the DB. The `authTokens` table grows unboundedly.
- **Blocks:** Long-term storage efficiency.

## Test Coverage Gaps

| Untested Area | Files | Risk | Priority |
|--------------|-------|------|----------|
| All tools except path-security | packages/core/src/tools/*.ts (9 files) | Tool bugs undetected | High |
| Auth routes (login, register, password, users) | apps/web/app/api/auth/*/route.ts (5 files) | Auth bypasses | High |
| File upload and preview | apps/web/app/api/upload/*/route.ts (2 files) | Path traversal, SSRF | High |
| Obsidian sync | apps/web/lib/obsidian.ts | Sync bugs when wired | Medium |
| DB migration | packages/db/src/migrate.ts | Migration failures | Medium |
| Chat stream parsing | apps/web/components/chat/chat-interface.tsx | Stream parsing errors | Medium |
| Encryption | apps/web/lib/crypto.ts | Encryption failures | High |
| Docker sandbox code execution | packages/core/src/tools/execute-code/docker.ts | Code injection | High |

---

*Concerns audit: 2026-05-17*
