# INTEGRATIONS.md — External Integrations Analysis

**Date:** 2026-05-17
**Author:** Automated codebase mapping
**Scope:** Full monorepo at agent-web workspace

---

## 1. APIs & External Services

### 1.1 LLM Provider APIs

All providers accessed via Vercel AI SDK (@ai-sdk/openai) over HTTPS with OpenAI-compatible REST API. Request flow in apps/web/app/api/chat/route.ts.

| Provider   | Base URL                     | Auth          | Status  |
|------------|------------------------------|---------------|---------|
| OpenAI     | api.openai.com/v1            | Bearer token  | Active  |
| OpenRouter | openrouter.ai/api/v1         | Bearer token  | Active  |
| OpenCode   | api.opencode.ai/v1           | Bearer token  | Active  |
| DeepSeek   | api.deepseek.com             | Bearer token  | Active  |

Configured but not wired: Anthropic, Google Gemini, 9Router, GitHub Copilot, NVIDIA NIM, Alibaba DashScope, Hugging Face. Env vars exist in .env.example but UI does not offer them as selectable options.

Request flow:
1. Client POSTs { messages, provider, model, apiKey?, projectId?, skills? }
2. Zod schema validates request
3. API key resolution: client-provided > server DB encrypted store > 401 error
4. createOpenAI() with provider-specific baseURL
5. streamText() with all 8 tools, 120s timeout, 100k token context budget
6. Returns Vercel AI SDK data stream

### 1.2 Web Search & Fetch

- DuckDuckGo (packages/core/src/tools/web-search.ts): HTM scrape, LRU cache (50 entries, 5-min TTL), 10s timeout
- Generic URL fetch (packages/core/src/tools/web-fetch.ts): HTML-to-text, 32K char return limit, 1-60s timeout, text/html only

### 1.3 Skill Discovery

- GET /api/skills: Scans .verdent/skills/ and user home ~/.verdent/skills/, ~/.agents/skills/ for SKILL.md directories, returns parsed frontmatter

---

## 2. Data Storage

### 2.1 SQLite / Turso Database

- Engine: SQLite via @libsql/client 0.14.x
- ORM: Drizzle ORM 0.36.x
- Default: file:./packages/db/data/local.db
- Remote: Turso via DATABASE_URL + DATABASE_AUTH_TOKEN

Schema (packages/db/src/schema.ts):
- projects (id PK, name, root_path, created_at, updated_at)
- sessions (id PK, project_id FK, title, created_at, updated_at)
- messages (id PK, session_id FK, role, content, model, timestamp)
- api_keys (provider PK, key encrypted, created_at, updated_at)

Migrations: Auto-run on first DB access. Creates tables + indexes on session_id, timestamp, updated_at.

Optimistic concurrency: Zustand store snapshots state before writes, rolls back on DB failure.

### 2.2 File Storage

- Uploads: data/uploads/ (PDF, DOCX, XLSX, code, text files up to 25MB)
- Project files: data/projects/{id}/
- Text extraction: pdf-parse (PDF), mammoth (DOCX), xlsx (Excel/CSV), utf-8 (code/text)
- LLM truncation: 60K characters max

### 2.3 Local Storage

- agent-web-ui-prefs in localStorage: sidebar open, provider, model, selectedModels, compareMode, activeProjectId/SessionId, selectedSkills

### 2.4 In-Memory Caching

- Rate limiter (apps/web/lib/rate-limit.ts): Map-based sliding window, 100 req/60s per IP, cleanup every 60s
- Web search cache: LRU Map, 50 entries, 5-minute TTL

---

## 3. Authentication & Identity

No user accounts, OAuth, or SSO. Authentication is LLM API key management only.

- Keys encrypted at rest with AES-256-GCM (apps/web/lib/crypto.ts)
- ENCRYPTION_KEY env var required in production (64-char hex)
- Dev fallback: SHA-256 hash of hardcoded string (warns in console)
- CRUD API at /api/keys: GET (list masked previews), POST (save encrypted), DELETE (remove)
- Chat route key resolution: client-provided > server DB decrypt > 401 error
- Frontend never receives full key, only first 8 chars + "..."

Rate limiting defined but not wired into any API route handler.

---

## 4. Monitoring & Observability

None. No error tracking (Sentry, etc.), analytics (GA, PostHog), APM, or health endpoint. All errors logged to console.error(). Docker healthcheck exists for sandbox container only.

---

## 5. CI/CD & Deployment

CI: Not configured. No .github/ or CI config files found. Test command: pnpm test. Lint: pnpm lint.

Deployment: Docker Compose only. Two configurations:
- docker-compose.yml (dev): Hot reload, Docker socket mounted, SQLite volume, sandbox container
- docker-compose.prod.yml (prod): Resource-limited, standalone Next.js, sandbox container

Docker Architecture:
- app container: Next.js server (dev: pnpm dev, prod: node apps/web/server.js), Docker socket mounted for DinD
- sandbox container: Isolated code execution (Node 22 + Python3 + tsx), resource-limited (1-2 CPU, 512MB-1GB)

---

## 6. Environment Configuration

Config sources by priority:
1. Environment variables (.env.local or Docker env)
2. localStorage (UI prefs only)
3. SQLite database (all data)
4. Filesystem (SKILL.md skills)

Key differences dev vs prod:
- DATABASE_URL: file:./packages/db/data/local.db in both, required in prod
- ENCRYPTION_KEY: Dev fallback (insecure) in dev, required 64-char hex in prod
- NODE_ENV: development vs production
- TERMINAL_BACKEND: local vs docker
- SANDBOX_ENABLED: false vs true

---

## 7. Webhooks & Callbacks

None. No incoming webhook endpoints exist (no Stripe, GitHub, Slack, etc.). No outgoing webhooks or callbacks are registered.

---

## 8. Integration Summary

| Integration         | Type              | Direction | Auth         | Status                     |
|---------------------|-------------------|-----------|--------------|----------------------------|
| OpenAI API          | LLM Provider      | Outbound  | Bearer token | Active                     |
| OpenRouter API      | LLM Provider      | Outbound  | Bearer token | Active                     |
| OpenCode API        | LLM Provider      | Outbound  | Bearer token | Active                     |
| DeepSeek API        | LLM Provider      | Outbound  | Bearer token | Active                     |
| DuckDuckGo Search   | Web Search        | Outbound  | None         | Active                     |
| Generic URL Fetch   | Web Content       | Outbound  | None         | Active                     |
| SQLite / Turso      | Database          | Local     | Token (Turso)| Active                     |
| Docker Daemon       | Container Runtime | Local     | Docker socket| Active                     |
| Local filesystem    | File I/O          | Local     | OS perms     | Active                     |
| Anthropic / Gemini  | LLM Provider      | Outbound  | API key      | Configured, not wired     |
| 9Router / NVIDIA    | LLM Provider      | Outbound  | API key      | Configured, not wired     |
| Copilot / DashScope | LLM Provider      | Outbound  | API key      | Configured, not wired     |
| Hugging Face        | LLM Provider      | Outbound  | API key      | Configured, not wired     |
