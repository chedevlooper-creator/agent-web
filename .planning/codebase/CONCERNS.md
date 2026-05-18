# Codebase Concerns

**Analysis Date:** 2026-05-17

## Tech Debt

### Dead Code: Duplicate DeepSeek Branch
- **Issue:** Chat route (`apps/web/app/api/chat/route.ts`, lines 165-169) has second `if (provider === "deepseek")` branch that never executes — first branch at line 146 catches it.
- **Impact:** Confuses developers. Dead branch won't update if main DeepSeek handler changes.
- **Fix:** Remove duplicate branch (lines 165-169).

### Obsidian Sync Is No-op in Store
- **Issue:** `syncSessionToObsidian` in `apps/web/lib/store.ts` (line 747) is `// no-op until Obsidian plugin is integrated`. Yet codebase has full API routes for Obsidian config (`/api/obsidian/config`, `/api/obsidian/sync`) and fully implemented sync library (`apps/web/lib/obsidian.ts`). Store calls `syncSessionToObsidian()` after every message add, rename, delete — all fire-and-forget no-ops.
- **Impact:** Confusing disconnect. No-op fires HTTP calls to `/api/obsidian/sync` in `deleteSession` (lines 387-390), which will 404 or produce errors if route not active.
- **Fix:** Wire store's sync function to call API, or remove Obsidian route and lib.

### Rough Token Counting
- **Issue:** Context compression in `packages/core/src/context.ts` uses `Math.ceil(text.length / 4)` for token estimation (line 8). Code-heavy content ~3 chars/token, prose ~5. Off by 2-3x.
- **Impact:** Context over-trimmed (losing useful history) or under-trimmed (exceeding model limits).
- **Fix:** Add `tiktoken` or model-specific tokenizer.

### `xlsx` Package Is Community Edition
- **Issue:** `apps/web/package.json` declares `xlsx` (^0.18.5) — SheetJS Community Edition with known limitations.
- **Impact:** Bugs with complex Excel files. No active security patches.
- **Fix:** Migrate to `@sheetjs/xlsx` or replace with `exceljs`.

### Migration System Is Fragile
- **Issue:** `packages/db/src/migrate.ts` runs raw SQL with `CREATE TABLE IF NOT EXISTS`. V2 migration uses `ALTER TABLE` in `try/catch` (line 133). No version tracking, no rollback.
- **Impact:** If migration order changes or column types need change, no mechanism to handle.
- **Fix:** Use Drizzle Kit migrations instead of raw SQL. Add `schema_version` table.

### Hardcoded Encryption Key Fallback
- **Issue:** `apps/web/lib/crypto.ts` (lines 22-23) falls back to `"agent-web-dev-key-do-not-use-in-production"` when `ENCRYPTION_KEY` not set in dev mode.
- **Impact:** In production without `ENCRYPTION_KEY`, fallback uses insecure key. API keys trivially decryptable.
- **Fix:** Remove fallback. Always require `ENCRYPTION_KEY`.

### Type Assertions Instead of Proper Types
- **Issue:** Heavy `as` type assertions, e.g. `apps/web/lib/store.ts` line 612 casts `useChatStore.getState()`. Also in `apps/web/app/api/chat/route.ts` lines 182-194 for message type coercion.
- **Impact:** TypeScript cannot catch runtime errors. Casts fail silently if message structures change.
- **Fix:** Use discriminated unions or zod validation instead of casts.

## Known Bugs

### No Rate Limiting on Auth Endpoints
- **Issue:** Rate limiter exists at `apps/web/lib/rate-limit.ts` but never imported/used by any auth route (`/api/auth/login`, `/api/auth/register`, `/api/auth/password`).
- **Symptoms:** Brute-force password attacks unthrottled.
- **Fix:** Apply rate limiter to POST endpoints on `/api/auth/*`.

### `git` Tool Bypasses Path Security
- **Issue:** Git tool (`packages/core/src/tools/git-tool.ts`) accepts `workingDir` parameter but resolves with plain `resolve()` (line 25) instead of `resolveSafePath()`.
- **Symptoms:** Prompt injection could set workingDir to system directory and run git outside workspace.
- **Fix:** Use `resolveSafePath()` for workingDir.

### Docker Fallback Degrades Security
- **Issue:** Both terminal (`packages/core/src/tools/terminal/index.ts`, lines 37-43) and execute_code (`packages/core/src/tools/execute-code/index.ts`, lines 44-49) silently fall back to local execution when Docker sandbox unavailable.
- **Symptoms:** If Docker down, sandboxing silently bypassed.
- **Fix:** Add `TERMINAL_BACKEND=strict-docker` mode that refuses to fall back.

## Security Considerations

### API Keys Stored Unencrypted in SQLite
- **Issue:** `packages/db/src/schema.ts` defines `apiKeys` table with `key` column plain text. `saveApiKey` in `apps/web/lib/db.ts` (line 497) inserts keys directly without calling `encrypt()` from `apps/web/lib/crypto.ts`.
- **Files:** `packages/db/src/schema.ts:59-69`, `apps/web/lib/db.ts:497-508`
- **Risk:** Any attacker with SQLite file access can read all API keys in plaintext.
- **Recommendations:** Wire `crypto.ts` encrypt/decrypt into `saveApiKey`/`listApiKeys`/`getServerApiKey`.

### Memory API Has No Authentication
- **Issue:** `apps/web/app/api/memory/route.ts` — all three methods (GET, POST, DELETE) perform no auth.
- **Files:** `apps/web/app/api/memory/route.ts`
- **Risk:** Any unauthenticated request can read, create, delete memory key-value pairs.
- **Recommendations:** Add user auth to all memory endpoints.

### SSRF in `api-test` Tool
- **Issue:** `api_test` tool (`packages/core/src/tools/api-test.ts`) can make HTTP requests to any URL including internal services (localhost, 127.0.0.1, cloud metadata). No SSRF protection.
- **Risk:** Prompt injection could probe internal services or cloud metadata endpoints.
- **Recommendations:** Block private IP ranges, loopback addresses, cloud metadata IPs.

### `db_query` Tool Can Read Sensitive Data
- **Issue:** `db_query` tool (`packages/core/src/tools/db-query.ts`) allows SELECT on any table, including `api_keys` and `users`.
- **Risk:** Prompt injection could exfiltrate all API keys and password hashes.
- **Recommendations:** Add table blocklist for sensitive tables (api_keys, users, auth_tokens).

### Upload Path Bypass
- **Issue:** Upload preview (`apps/web/app/api/upload/preview/route.ts`, line 26) checks `!p.includes("..")` for path traversal. Bypassable with URL-encoded sequences, absolute paths, or symlinks.
- **Files:** `apps/web/app/api/upload/preview/route.ts:24-27`
- **Risk:** Attacker could read arbitrary files on server.
- **Recommendations:** Use `resolveSafePath()` from core package.

### Terminal Blocklist Can Be Bypassed
- **Issue:** Terminal tool (`packages/core/src/tools/terminal/local.ts`) uses regex blocklist. Blocklists inherently incomplete.
- **Risk:** Determined attacker with prompt injection can execute arbitrary commands.
- **Recommendations:** Use existing `ALLOWED_COMMANDS` whitelist instead of just blocklist.

### User Agent Spoofing
- **Issue:** `web_search.ts` and `web_fetch.ts` spoof Chrome 120 User-Agent. May violate DuckDuckGo ToS.
- **Recommendations:** Use official search APIs with API keys instead of scraping.

## Performance Bottlenecks

### Synchronous File Reads During Request Handling
- **Issue:** `buildSystemPrompt` in `apps/web/app/api/chat/route.ts` (lines 66-95) uses `fs.existsSync()` and `fs.readFileSync()` inside async function.
- **Problem:** Sync I/O blocks event loop during chat requests (long-running streaming ops).
- **Fix:** Use `fs.promises.readFile()` and `fs.promises.access()`.

### DB Client Created Per Query in Tool
- **Issue:** `db_query` tool (`packages/core/src/tools/db-query.ts`, lines 33-38) creates new libsql client per query, bypassing `getDb()` singleton.
- **Problem:** Connection exhaustion with remote/Turso databases.
- **Fix:** Import and use `getDb()` from `@agent-web/db`.

### No Reconnection Logic for DB Client
- **Issue:** `packages/db/src/client.ts` creates singleton client. No reconnection on dropped connections.
- **Problem:** After transient DB failure, all queries fail until server restart.
- **Fix:** Add connection health checks and automatic reconnection.

## Fragile Areas

### DeepSeek Fetch Wrapper Is Fragile
- **Issue:** `apps/web/app/api/chat/route.ts` (lines 149-164) wraps `globalThis.fetch` to inject disabled thinking mode into DeepSeek requests. Parses and re-serializes JSON body of every fetch to `api.deepseek.com`.
- **Why fragile:** JSON parse of stream body may fail. Side-effects on global fetch dangerous.
- **Test coverage:** None.

### Middleware Bypasses `/api/*` Auth
- **Issue:** `apps/web/middleware.ts` (lines 21-24) allows all `/api/*` routes without session validation. New API routes added without auth publicly accessible.
- **Why fragile:** Easy to forget auth checks on new routes. Memory route is clear example.
- **Recommendations:** Add auth check to `/api/chat`, consider middleware-level API auth.

### `genId()` Uses Math.random()
- **Issue:** `apps/web/lib/store.ts` (line 148) generates IDs with `Math.random().toString(36).slice(2)`. Not cryptographically secure.
- **Fix:** Use `crypto.randomUUID()`.

## Configuration Issues

### Default DATABASE_URL Points to Relative Path
- **Issue:** `packages/db/src/client.ts` (line 5) defaults to `file:./data/local.db`. DB file ends up in different places depending on which package's CWD is active.
- **Fix:** Make DB path absolute or derive from known project root.

### No Startup Env Validation
- **Issue:** No startup validation that required env vars set. Missing vars produce errors only when specific endpoints called.
- **Fix:** Add startup check validating required env vars.

## Dependencies at Risk

| Package | Version | Risk | Impact |
|---|---|---|---|
| pnpm | 9.0.0 | Old version (current ~10.x). Lockfile format may change. | Build failures on CI |
| @types/node | ^20 | Not updated for Node 22+ | Inaccurate IDE suggestions |
| eslint-config-next | 16.2.6 | Tied to exact Next.js version | CI lint failures after upgrade |
| xlsx | ^0.18.5 | Community Edition, unmaintained | Excel parsing bugs without fixes |
| happy-dom | ^20.9.0 | Outdated, may lack some DOM APIs | Test failures |

## Missing Critical Features

### No E2E Tests
- **Problem:** Entire chat flow (file upload → streaming → tool execution → DB persistence) has zero E2E tests.
- **Blocks:** Confidence in releases.

### No Request Validation on Chat Endpoint
- **Problem:** `apps/web/app/api/chat/route.ts` (line 124) destructures JSON body without zod validation.
- **Blocks:** Reliable API error reporting.

### No Session Cleanup
- **Problem:** Expired auth tokens never cleaned from DB. `authTokens` table grows unboundedly.
- **Blocks:** Long-term storage efficiency.

## Test Coverage Gaps

| Untested Area | Files | Risk | Priority |
|---|---|---|---|
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
