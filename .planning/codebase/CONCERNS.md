# CONCERNS.md — Technical Debt, Issues & Areas of Concern

**Date:** 2026-05-17  
**Scope:** Full codebase analysis of @agent-web monorepo  
**Focus:** Technical debt, known bugs, security, performance, fragile areas

---

## 1. Tech Debt

### 1.1 N+1 Query Pattern — Session Messages Export
- **Area:** apps/web/lib/db.ts — listSessionsWithMessages() (lines 117-148)
- **Issue:** Iterates over all sessions and executes a separate db.select().from(messages).where(...) for each session.
- **Impact:** O(n) queries for n sessions. With 50+ sessions this generates 51 DB round-trips.
- **Fix approach:** Use a single db.select().from(messages).where(inArray(messages.sessionId, sessionIds)) and group client-side.

### 1.2 N+1 Query Pattern — Message Deletion by Timestamp
- **Area:** apps/web/lib/db.ts — deleteMessagesAfter() (lines 264-281)
- **Issue:** Selects all messages for a session, filters in-memory, then deletes one-by-one in a loop.
- **Impact:** 201 queries instead of 1 for 200 messages.
- **Fix approach:** Single db.delete().where(and(eq(...), gte(...))).

### 1.3 N+1 Query Pattern — Session Import
- **Area:** apps/web/lib/db.ts — importSessions() (lines 289-329)
- **Issue:** Checks existence via individual select() for each session and message before insert.
- **Impact:** ~510 SELECTs + ~510 INSERTs for 10 sessions with 50 messages each.
- **Fix approach:** Use INSERT OR IGNORE and ON CONFLICT DO UPDATE (Drizzle upsert).

### 1.4 Unused Rate Limiter
- **Area:** apps/web/lib/rate-limit.ts
- **Issue:** Complete, tested rate limiter exists but is never imported into any API route. /api/chat has no rate limiting.
- **Impact:** Any client can send unlimited requests, causing unbounded LLM API costs.
- **Fix approach:** Wire rateLimit into chat route with IP extraction.

### 1.5 Migration Promise — No Error Recovery
- **Area:** apps/web/lib/db.ts — ready() (lines 38-45)
- **Issue:** Cached migrationPromise on first call. If initial migration fails, the rejected promise is cached permanently — all subsequent DB ops silently fail.
- **Impact:** Transient DB failure on first request kills entire session until server restart.
- **Fix approach:** Reset migrationPromise = null on failure, or add retry with exponential backoff.

### 1.6 Hardcoded Provider Model Lists
- **Area:** apps/web/components/settings-panel.tsx (lines 8-35)
- **Issue:** Model lists per provider hardcoded. New models require rebuild.
- **Impact:** Models drift from reality. Users cannot access newer models without redeploy.
- **Fix approach:** Fetch from /api/models?provider=... or add custom model input.

### 1.7 patchLocalMessage RAF Batching Hack
- **Area:** apps/web/lib/store.ts — patchLocalMessage() (lines 594-621)
- **Issue:** Uses requestAnimationFrame batching with any-typed internal state on Zustand store.
- **Impact:** Fragile typing. RAF throttling in background tabs may never flush patches.
- **Fix approach:** Use React.startTransition or Zustand subscribeWithSelector batching.

### 1.8 genId Uses Math.random (Not Crypto)
- **Area:** apps/web/lib/store.ts — genId() (lines 116-118)
- **Issue:** IDs generated with Math.random().toString(36).slice(2, 11) + Date.now().
- **Impact:** ~5.4x10^13 possible values. Not collision-resistant. Not cryptographically random.
- **Fix approach:** Use crypto.randomUUID() or nanoid.

### 1.9 Stream Parser Duplicates Vercel AI SDK Protocol
- **Area:** apps/web/components/chat/chat-interface.tsx — parseLine() (lines 94-136)
- **Issue:** Manual parser for Vercel AI SDK data stream protocol duplicates useChat from ai/react.
- **Impact:** Any wire format change breaks the parser. Unknown prefixes silently ignored.
- **Fix approach:** Add schema validation for each stream chunk type.

### 1.10 Environment Variable Mismatch
- **Area:** .env.example
- **Issue:** Lists many vars (OPENAI_API_KEY, etc.) never consumed by code. Only ENCRYPTION_KEY, DATABASE_URL, DATABASE_AUTH_TOKEN, TERMINAL_BACKEND, TOOL_ALLOWED_BASE are read.
- **Impact:** Misleading onboarding — setting OPENAI_API_KEY has no effect.
- **Fix approach:** Clean .env.example to document only consumed variables.

---

## 2. Known Bugs

### 2.1 Truncated Message Content on Retry
- **Symptom:** displayContent (file names only) sent to API instead of full file content on retry/edit.
- **Root cause:** chat-interface.tsx:391-398 uses m.content unconditionally; for file-attached messages, content holds display-friendly version.
- **File:** apps/web/components/chat/chat-interface.tsx

### 2.2 Session Title Race Condition
- **Symptom:** Title briefly flickers on first message — optimistic update sets title, then PATCH overwrites.
- **Root cause:** Two concurrent title updates in addMessage (store.ts:424-427 vs 449-453).
- **File:** apps/web/lib/store.ts

### 2.3 API Key Provider Normalization Inconsistency
- **Symptom:** Mixed-case provider names (OpenAI vs openai) cause save/delete mismatch.
- **Root cause:** store.ts:671-674 normalizes inconsistently vs db.ts:367 always lowercases.
- **Files:** apps/web/lib/store.ts, apps/web/lib/db.ts

### 2.4 Deleted Project Disk Leak
- **Symptom:** Deleting project removes DB row but leaves data/projects/<id>/ on disk.
- **Root cause:** DELETE handler only calls deleteProject(id), no fs.rm.
- **File:** apps/web/app/api/projects/route.ts

### 2.5 Uploaded File Accumulation
- **Symptom:** Files in data/uploads/ accumulate indefinitely. No cleanup mechanism.
- **Root cause:** No TTL, retention, or DELETE-all endpoint.
- **File:** apps/web/app/api/upload/route.ts

---

## 3. Security Considerations

### 3.1 Weak Fallback Encryption Key
- **Risk:** Hardcoded fallback key "agent-web-dev-key-do-not-use-in-production" when ENCRYPTION_KEY unset.
- **File:** apps/web/lib/crypto.ts:21-23

### 3.2 No CSRF Protection
- **Risk:** No CSRF tokens, SameSite checks, or origin validation on any API endpoint.
- **Mitigation:** JSON-only bodies reduce form-based CSRF surface.

### 3.3 Terminal Command Blocklist Bypass
- **Risk:** Regex blocklist in local.ts (lines 10-51) can be bypassed via base64, eval, variable expansion.
- **File:** packages/core/src/tools/terminal/local.ts

### 3.4 Code Execution Regex Blocklist Bypass
- **Risk:** Import-blocking regex in local.ts (lines 15-58) bypassable via template literals, hex, indirect require.
- **File:** packages/core/src/tools/execute-code/local.ts

### 3.5 DELETE Endpoint ID Exposure
- **Risk:** IDs exposed in URL search params on DELETE operations appear in server logs.
- **Files:** apps/web/app/api/sessions/route.ts, apps/web/app/api/projects/route.ts

### 3.6 Skill Path Traversal
- **Risk:** skills array from request body used directly in join() for file reading. ../ not blocked.
- **File:** apps/web/app/api/chat/route.ts:89-104

---

## 4. Performance Bottlenecks

### 4.1 Session Export N+1
- **File:** apps/web/lib/db.ts:117-148
- **Problem:** 101 queries for 100 sessions.

### 4.2 Sequential Hydration
- **File:** apps/web/lib/store.ts:178-217
- **Problem:** Three sequential API calls add ~300-600ms before UI interactive.

### 4.3 Streaming Re-renders
- **File:** apps/web/components/chat/chat-interface.tsx
- **Problem:** 60 re-renders/sec on entire ChatInterface during streaming.

### 4.4 Permanent File Storage
- **File:** apps/web/app/api/upload/route.ts
- **Problem:** 25MB max uploads stored permanently with no TTL.

---

## 5. Fragile Areas

### 5.1 Stream Parser — Vercel AI SDK Coupling
- **File:** apps/web/components/chat/chat-interface.tsx:94-136
- **Risk:** Manual protocol parser. SDK upgrade may change wire format.
- **Mitigation:** Pin AI SDK version. Add stream format integration test.

### 5.2 Docker Fallback Silent Degradation
- **Files:** packages/core/src/tools/terminal/index.ts, packages/core/src/tools/execute-code/index.ts
- **Risk:** Docker unavailability silently falls back to less secure local execution.
- **Mitigation:** Hard error when TERMINAL_BACKEND=docker.

### 5.3 No Migration System
- **File:** packages/db/src/migrate.ts
- **Risk:** Raw SQL CREATE TABLE IF NOT EXISTS with no versioning or rollbacks.
- **Mitigation:** Integrate Drizzle Kit migration system.

### 5.4 Optimistic Update Rollback Chain
- **File:** apps/web/lib/store.ts (multiple locations)
- **Risk:** Concurrent mutations can cause stale rollbacks restoring incorrect state.
- **Mitigation:** Serialize mutations through queue with request IDs.

---

## 6. Scaling Limits

### 6.1 SQLite Write Contention
- Single file serializes writes. 10+ concurrent sessions cause latency.

### 6.2 In-Memory Rate Limiter Not Distributed
- Per-process Map. Multiple instances have independent counters. Restart resets windows.

### 6.3 Message Content Size Limits
- 200k chars per message. 100k token budget. Last 4 messages + system messages kept. Old context silently dropped.

---

## 7. Dependencies at Risk

### 7.1 AI SDK v4 (ai, @ai-sdk/openai) — ^4.0.0
- Low community adoption. Stream parser tightly coupled to internal wire format.

### 7.2 @libsql/client — ^0.14.0 (pre-1.0)
- Pre-1.0 breaking changes possible on minor releases.

### 7.3 pdf-parse — ^2.4.5
- New v2 with different API. History of unmaintained forks.

### 7.4 Next.js 16.2.6
- Very new. Already requires webpack workaround (Turbopack incompatible).

### 7.5 mammoth (DOCX)
- Known issues with complex DOCX files. Slow-moving library.

---

## 8. Missing Critical Features

### 8.1 Session Search — Medium complexity. Need server-side search endpoint + UI.

### 8.2 Authentication — High complexity. No user auth. Single SQLite for all data.

### 8.3 Message Content Search — Medium complexity. SQLite FTS5 virtual table needed.

### 8.4 File Cleanup — Low complexity. Add TTL-based cleanup for uploaded files.

---

## 9. Test Coverage Gaps

### 9.1 API Route Tests — HIGH priority. All routes untested except chat schema.
### 9.2 DB Layer Tests — HIGH priority. All db.ts functions untested.
### 9.3 Tool Execution Tests — Medium priority. Only path-security.test.ts exists.
### 9.4 Component Tests — Medium priority. Only MessageBubble tested.
### 9.5 Integration Tests — Medium-High priority. Full chat flow, optimistic updates untested.
### 9.6 Docker Tests — Low priority. CI dependency expensive.
### 9.7 E2E Tests — Low priority. Premature for early-stage project.

---

## Summary

| Category | Count | Top Priorities |
|---|---|---|
| Tech Debt | 10 | N+1 queries, unused rate limiter, migration promise |
| Known Bugs | 5 | Retry truncation, title race, disk leak |
| Security | 6 | Weak encryption key, blocklist bypass x2, path traversal |
| Performance | 4 | N+1 export, sequential hydration, streaming re-renders |
| Fragile Areas | 4 | Stream parser, Docker fallback, migration system, rollback chain |
| Scaling | 3 | SQLite contention, rate limiter, content limits |
| Dependencies | 5 | AI SDK v4, libsql pre-1.0, Next.js 16 |
| Missing Features | 4 | Session search, auth, message search, file cleanup |
| Test Gaps | 7 | API routes, DB layer, integration tests |

## Top 5 Actions

1. Wire up rate limiter — Prevent LLM cost exposure (low effort, high impact)
2. Fix N+1 queries in DB layer — Batch operations (medium effort)
3. Fix retry content truncation — Preserve full file content (low effort)
4. Add API route and DB layer tests — Core data path coverage (medium effort)
5. Replace regex blocklists with Docker enforcement — Remove false security sense (medium effort)

