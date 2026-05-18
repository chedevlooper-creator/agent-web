<!-- generated-by: gsd-doc-writer -->

# Architecture

## System Overview

Self-hosted AI terminal agent — web app with chat interface backed by multiple LLM providers, direct shell access, filesystem ops, web search, code execution, DB queries via tool-calling framework. **Server-rendered React** with **streaming SSE** for real-time chat. State: **Zustand** on client + **SQLite persistence** via REST API. **pnpm monorepo** managed by **Turborepo**.

## Monorepo Structure

```
agent-web/
├── apps/
│   └── web/                # Next.js 16 App Router
│       ├── app/
│       │   ├── api/        # REST API routes (chat, sessions, messages, auth, etc.)
│       │   └── page.tsx    # Main entry point
│       ├── components/     # React components (chat, layout, UI, settings)
│       └── lib/            # Client lib (store, auth, DB helpers)
├── packages/
│   ├── core/               # @agent-web/core — LLM client, tool registry, context utils
│   │   └── src/
│   │       ├── llm/        # LLM client abstraction
│   │       ├── tools/      # 11 tool definitions (terminal, file, web, etc.)
│   │       ├── context.ts  # Token counting + context compression
│   │       └── types.ts    # Shared TS types
│   └── db/                 # @agent-web/db — Drizzle ORM schema, SQLite client, migrations
│       └── src/
│           ├── schema.ts   # 10 tables
│           ├── client.ts   # libsql client singleton
│           └── migrate.ts  # Schema migration runner
├── docker-compose.yml      # Dev Docker Compose
├── docker-compose.prod.yml # Prod Docker Compose
└── Dockerfile              # Multi-stage build (3 targets)
```

- **Root**: Orchestrates build/dev/lint/test via `turbo run`
- **`apps/web`**: Next.js 16. No `src/` — pages + API routes under `app/`. Webpack (not Turbopack) to avoid server-only deps in client bundle
- **`packages/core`**: `tsc` → `dist/`. Three entrypoints: `.`, `./tools`, `./types`
- **`packages/db`**: `tsc` → `dist/`. Three entrypoints: `.`, `./schema`, `./client`

Internal packages consumed via Next.js `transpilePackages` in `next.config.ts`.

## Chat Data Flow

Custom streaming (no `useChat`). Client manually parses AI SDK data stream protocol.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (React Client)                                             │
│  ChatInterface (chat-interface.tsx)                                │
│       │ useChatStore (Zustand v5)                                  │
│       │   state: sessions[], activeSessionId, messages[],          │
│       │         provider, model, apiKey, isLoading, syncing       │
│       │ streamChat() — custom fetch + getReader() loop             │
│       │   Parses data stream prefixes:                             │
│       │     0: text chunk  1: tool call started                    │
│       │     2: tool call result (old)  3: error                    │
│       │     9: tool call started (Vercel AI SDK)                   │
│       │     a: tool call result (Vercel AI SDK)   d: done          │
│       │   Updates Zustand via:                                     │
│       │     appendLocalMessage() → patchLocalMessage() (rAF)       │
│       │     addMessage() — persist to DB via /api/sessions POST    │
└───────┼─────────────────────────────────────────────────────────────┘
        │ POST /api/chat { messages, provider, model, enabledSkills, files }
        │ ReadableStream<Uint8Array>
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Next.js API Route (apps/web/app/api/chat/route.ts)                 │
│  1. Extract API key from env for requested provider                 │
│  2. Create LLM client (createOpenAI with provider config)           │
│  3. Build system prompt via buildSystemPrompt():                    │
│     - Tool instructions + file refs + skill descriptions + memories │
│  4. Context compression: countMessagesTokens() → trimToTokenLimit() │
│     - Preserve system + first user + most recent (default 80k limit)│
│  5. streamText({ model, messages, tools, maxSteps: 8 })            │
│  6. Return result.toDataStreamResponse()                            │
└───────┼─────────────────────────────────────────────────────────────┘
        │ AI SDK v4 streamText()
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ LLM Provider Layer                                                  │
│  OpenAI:    createOpenAI({ apiKey })                                │
│  OpenRouter: createOpenAI({ apiKey, baseURL })                      │
│  DeepSeek:   createOpenAI({ apiKey, baseURL, fetch: patched })     │
│              (fetch wrapper disables thinking mode to avoid          │
│               reasoning_content errors in multi-step tool calls)    │
└─────────────────────────────────────────────────────────────────────┘
```

### Key streaming details

- **No `useChat` hook**: Raw `fetch` + `response.body.getReader()` + manual line-by-line Vercel AI SDK protocol parse
- **Coalesced updates**: `patchLocalMessage()` batches via `requestAnimationFrame` — avoids 50+ re-renders/sec
- **Optimistic persistence**: Local Zustand insert first, then POST to `/api/sessions/[id]/messages`. Rollback on failure via snapshot/restore
- **Compare mode**: Simultaneous requests to two models, side-by-side `CompareRow` rendering

### API Routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/chat` | Streaming LLM completion with tool calling |
| GET/POST/PATCH/DELETE | `/api/sessions` | Session CRUD |
| GET/POST/PATCH/DELETE | `/api/sessions/[id]/messages` | Message CRUD, truncate, clear |
| GET | `/api/sessions/export` | Export all sessions as JSON |
| POST | `/api/sessions/import` | Import sessions from JSON |
| GET/POST/PATCH/DELETE | `/api/projects` | Project CRUD |
| GET/POST/DELETE | `/api/memory` | Key-value memory CRUD |
| GET | `/api/config/status` | Check which providers have API keys set |
| GET | `/api/skills` | List installed skills |
| POST | `/api/upload` | File upload to `data/uploads/` |
| POST | `/api/upload/preview` | Preview uploaded files (CSV, JSON, text) |
| POST/DELETE | `/api/keys` | Manage API keys in DB |
| POST | `/api/auth/login` | Username/password login |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/logout` | Session logout |
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/password` | Change password |
| GET | `/api/auth/users` | List all users |

## Tools Architecture

**11 active tools**, all in `packages/core/src/tools/`, registered in `packages/core/src/tools/registry.ts`.

```
packages/core/src/tools/
├── registry.ts          # Tool registration (11 tools)
├── tool-descriptions.ts # User-facing descriptions
├── path-security.ts     # Path traversal protection
├── terminal/
│   ├── index.ts         # Dispatches to local or Docker
│   ├── local.ts         # Local exec with blocklist + timeout
│   └── docker.ts        # Docker sandbox via docker exec
├── execute-code/
│   ├── index.ts         # Code execution tool
│   ├── local.ts         # Local Node.js subprocess
│   └── docker.ts        # Docker sandbox code exec
├── file-read.ts         # 5MB limit, line range, smart truncation
├── file-write.ts        # Create/overwrite files
├── list-directory.ts    # List dir contents
├── search-files.ts      # Search by glob or regex
├── web-search.ts        # DuckDuckGo HTML scrape (no API key, LRU cache)
├── web-fetch.ts         # Fetch URL + extract text
├── git-tool.ts          # Git commands
├── db-query.ts          # Read-only SQL queries
└── api-test.ts          # HTTP request testing
```

### Tool Registration

Each tool uses `tool()` from `ai` SDK v4 with Zod schema:

```9:25:packages/core/src/tools/registry.ts
export const tools = {
  terminal: terminalTool,
  read_file: readFileTool,
  write_file: writeFileTool,
  web_search: webSearchTool,
  list_directory: listDirectoryTool,
  search_files: searchFilesTool,
  web_fetch: webFetchTool,
  execute_code: executeCodeTool,
  git: gitTool,
  db_query: dbQueryTool,
  api_test: apiTestTool,
} as const;
```

`tools` object imported into chat API route and passed to `streamText()`. AI SDK v4 handles tool call extraction, execution, result injection during multi-step loop.

### Terminal Backend

Two backends via `TERMINAL_BACKEND`:

```8:12:packages/core/src/tools/terminal/index.ts
function getBackend(): TerminalBackend {
  const env = process.env.TERMINAL_BACKEND;
  if (env === "docker") return "docker";
  return "local";
}
```

- **`local`**: Host machine exec with blocklist + timeout. Default.
- **`docker`**: Exec inside sandbox container via `docker exec`. Falls back to local if sandbox unavailable.

### Path Security

File tools use `resolveSafePath()` from `packages/core/src/tools/path-security.ts` to block path traversal. Paths resolved relative to workspace, checked against system dir protections.

## Multi-Provider LLM Client

Three providers via common `createOpenAI()` from `@ai-sdk/openai`:

| Provider | Base URL | Special Handling |
|---|---|---|
| OpenAI | Default (api.openai.com) | Standard `createOpenAI` |
| OpenRouter | `https://openrouter.ai/api/v1` | Custom base URL |
| DeepSeek | `https://api.deepseek.com` | Custom base URL + fetch wrapper injects `{ thinking: { type: "disabled" } }` to suppress reasoning tokens |

### Provider selection flow

```147:164:apps/web/app/api/chat/route.ts
    } else if (provider === "deepseek") {
      const originalFetch = globalThis.fetch;
      const patchedFetch: typeof fetch = async (input, init) => {
        if (init && typeof input === "string" && input.includes("api.deepseek.com")) {
          try {
            const body = JSON.parse(init.body as string);
            body.thinking = { type: "disabled" };
            init = { ...init, body: JSON.stringify(body) };
          } catch {}
        }
        return originalFetch(input, init);
      };
```

API keys from env vars (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`) via `getServerApiKey()`. Users can also store per-user keys in DB via `/api/keys`.

## Database Architecture

**SQLite** via **libsql** + **Drizzle ORM**.

### Schema (10 tables)

```
users              — User accounts (id, username, passwordHash, timestamps)
auth_tokens        — Session tokens (id, userId, token, expiresAt, timestamps)
projects           — Project groupings (id, userId, name, rootPath, timestamps)
sessions           — Chat sessions (id, userId, projectId, title, timestamps)
messages           — Messages (id, sessionId, userId, role, content, model, timestamp)
api_keys           — Per-user API keys (provider, userId, key, timestamps)
memories           — Key-value persistent memory (id, key, value, timestamps)
obsidian_config    — Obsidian vault path per user (userId, vaultPath, updatedAt)
```

Relationships:
- `users` 1→N `sessions` 1→N `messages`
- `users` 1→N `projects` 1→N `sessions`
- `users` 1→N `api_keys` (one per provider per user)
- `sessions` 1→N `messages` (cascade delete)

### Drizzle relations

```40:57:packages/db/src/schema.ts
export const projectsRelations = relations(projects, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [sessions.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
}));
```

### Client singleton

`getDb()` in `packages/db/src/client.ts` — lazy init from `DATABASE_URL` (default `file:./data/local.db`). Supports remote libsql/Turso with `DATABASE_AUTH_TOKEN`.

### Migration system

`ensureMigrated()` in `packages/db/src/migrate.ts` — runs on startup via `ready()` in `apps/web/lib/db.ts`. Idempotent SQL (`CREATE TABLE IF NOT EXISTS`, try/catch for schema evolution).

## State Management

### Client-side (Zustand)

`useChatStore` in `apps/web/lib/store.ts`:

- **Sessions + messages**: Fetched from REST API on startup (`hydrate()`), kept in memory. Optimistic mutations — local first, sync to server. Rollback on failure via snapshot/restore.
- **Streaming state**: `appendLocalMessage()` inserts placeholders. `patchLocalMessage()` uses rAF-based coalescing for incremental token updates.
- **UI state**: Sidebar, context panel, provider/model, compare mode, skills toggling.
- **Persistence**: UI prefs in localStorage under `"agent-web-ui-prefs"`. Session/message data persisted to SQLite via API calls.

### Server-side (Database)

`apps/web/lib/db.ts` wraps `@agent-web/db` with auth-scoped queries. All mutating endpoints require valid `session_token` cookie, validated against `auth_tokens` table.

## Key Architectural Patterns

### 1. Monorepo with Turborepo

Turborepo v2.3. `turbo.json` defines task deps:

```4:17:turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      ...
```

`^build` ensures packages built before web app. Internal packages consumed via Next.js `transpilePackages`.

### 2. Streaming with manual protocol parsing

Custom `streamChat()` instead of `useChat`:
1. POST to `/api/chat`
2. Read `ReadableStream<Uint8Array>` via `getReader()`
3. Parse Vercel AI SDK data stream protocol per line
4. Route text deltas to Zustand via `patchLocalMessage()`
5. Track tool calls for `ToolCallCard` rendering

```788:912:apps/web/components/chat/chat-interface.tsx
async function streamChat(
  payload: {
    // ...
```

### 3. Context compression

Sliding-window trim when conversation exceeds threshold (default 80k tokens):

```30:73:packages/core/src/context.ts
export function trimToTokenLimit(
  messages: MessageToken[],
  maxTokens: number
): MessageToken[] {
  // Preserve system prompts
  // Preserve first user message for context anchoring
  // Keep most recent messages (sliding window from end)
```

Token counting: character-based estimation (chars / 4).

### 4. Optimistic updates with snapshot rollback

```
1. snapshotSessions() — save state
2. apply mutation locally (optimistic)
3. call API
4. success: continue
5. failure: rollbackSessions(snapshot)
```

### 5. DeepSeek compatibility shim

Two mitigations for `reasoning_content` errors in multi-step tool calls:
1. **Fetch wrapper** in `route.ts`: injects `thinking: { type: "disabled" }` into DeepSeek request body
2. **Message stripping**: cleans `reasoning_content` / `reasoningContent` from history before sending to DeepSeek

### 6. Docker multi-stage builds

Three targets:
- **`development`**: `pnpm dev` + hot-reload. Source mounted as volumes with polling file watching.
- **`production`**: Standalone Next.js build. Includes Docker CLI for Docker-in-Docker sandbox.
- **`sandbox`**: Isolated code exec container (Python 3, Node.js, common CLI). Non-root `sandbox-user`. Not started by default (`profiles: [sandbox]`).

### 7. Skills system

SKILL.md files in `.verdent/skills/<name>/SKILL.md`. When enabled:
1. Scan skill dirs for SKILL.md
2. Extract frontmatter `name` + `description`
3. Inject into system prompt under "## Enabled Skills"
4. LLM can reference skills during conversation

### 8. Memory system

`ENABLE_MEMORY=true`: key-value pairs from `memories` table injected into system prompt under "## User Context (persisted across sessions)". `MEMORY_CHAR_LIMIT` caps injected context (default 2,200 chars).

## Docker Deployment

### Development

```yaml:docker-compose.yml
services:
  app:
    build:
      target: development
    volumes:
      - .:/app              # Source for hot reload
      - /var/run/docker.sock:/var/run/docker.sock  # Docker-in-Docker
```

Key characteristics:
- Source mounted for hot reload (`CHOKIDAR_USEPOLLING=true`, `WATCHPACK_POLLING=true`)
- `node_modules` isolated via named volumes (avoids host OS binary conflicts)
- `dist/` preserved across restarts via named volumes
- SQLite persisted in named volume

### Production

```yaml:docker-compose.prod.yml
services:
  app:
    build:
      target: production
    deploy:
      resources:
        limits:
          cpus: "4"
          memory: 4G
```

Key characteristics:
- Standalone Next.js server (no dev deps)
- Docker socket mounted read-only for sandbox access
- Resource limits configured (CPU + memory)
- Separate volumes for DB persistence + sandbox workspace
