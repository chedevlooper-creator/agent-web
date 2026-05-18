<!-- generated-by: gsd-doc-writer -->

# Architecture

## System Overview

Agent Web is a self-hosted AI terminal agent — a web application that provides a chat interface backed by multiple large language model (LLM) providers, with direct access to shell commands, filesystem operations, web search, code execution, and database queries via a tool-calling framework. The application follows a **server-rendered React** architecture with **streaming server-sent events** for real-time chat responses. State management uses **Zustand** on the client with **SQLite persistence** through a REST API layer. It is organized as a **pnpm monorepo** managed by **Turborepo**.

## Monorepo Structure

```
agent-web/
├── apps/
│   └── web/                # Next.js 16 App Router application
│       ├── app/
│       │   ├── api/        # REST API routes (chat, sessions, messages, auth, etc.)
│       │   └── page.tsx    # Main application entry point
│       ├── components/     # React components (chat, layout, UI, settings)
│       └── lib/            # Client-side library code (store, auth, db helpers)
├── packages/
│   ├── core/               # @agent-web/core — LLM client, tool registry, context utils
│   │   └── src/
│   │       ├── llm/        # LLM client abstraction
│   │       ├── tools/      # 11 tool definitions (terminal, file, web, etc.)
│   │       ├── context.ts  # Token counting and context compression
│   │       └── types.ts    # Shared TypeScript types
│   └── db/                 # @agent-web/db — Drizzle ORM schema, SQLite client, migrations
│       └── src/
│           ├── schema.ts   # Table definitions (10 tables)
│           ├── client.ts   # libsql client singleton
│           └── migrate.ts  # Schema migration runner
├── docker-compose.yml      # Development Docker Compose
├── docker-compose.prod.yml # Production Docker Compose
└── Dockerfile              # Multi-stage Docker build (3 targets)
```

- **Root** (`package.json`): Orchestrates `build`, `dev`, `lint`, `test` across all workspaces via `turbo run`.
- **`apps/web`**: The Next.js 16 application. No `src/` directory — pages and API routes live directly under `app/`. Uses webpack (not Turbopack) to avoid client-side tracing that pulls in server-only Node.js dependencies.
- **`packages/core`** (`@agent-web/core`): Built with `tsc` to `dist/`. Provides LLM client creation, tool definitions, context compression utilities, and shared TypeScript types. Three entrypoints: `.`, `./tools`, `./types`.
- **`packages/db`** (`@agent-web/db`): Built with `tsc` to `dist/`. Provides Drizzle ORM schema, a libsql client singleton, and a migration runner. Three entrypoints: `.`, `./schema`, `./client`.

Internal packages are consumed by the web app via Next.js `transpilePackages` in `next.config.ts`.

## Chat Data Flow

The chat system uses a **custom streaming implementation** rather than Vercel's `useChat` hook. The client manually parses the AI SDK data stream protocol.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (React Client)                                             │
│                                                                    │
│  ChatInterface (chat-interface.tsx)                                │
│       │                                                            │
│       │ useChatStore (Zustand v5)                                  │
│       │   ┌───────────────────────────────────────┐                │
│       │   │ state:                                │                │
│       │   │  sessions[]                           │                │
│       │   │  activeSessionId                      │                │
│       │   │  messages[]                           │                │
│       │   │  provider, model, apiKey              │                │
│       │   │  isLoading, syncing                   │                │
│       │   └───────────────────────────────────────┘                │
│       │                                                            │
│       │ streamChat() — custom fetch + getReader() loop             │
│       │   Parses data stream prefixes:                             │
│       │     0: text chunk                                          │
│       │     1: tool call started                                   │
│       │     2: tool call result             (old format)           │
│       │     3: error                                                │
│       │     9: tool call started           (Vercel AI SDK format)  │
│       │     a: tool call result            (Vercel AI SDK format)  │
│       │   d: done (implicit on stream end)                         │
│       │                                                            │
│       │ Updates Zustand via:                                       │
│       │   - appendLocalMessage() — insert streaming placeholder    │
│       │   - patchLocalMessage() — coalesced via requestAnimationFrame│
│       │   - addMessage() — persist to DB via /api/sessions POST    │
└───────┼─────────────────────────────────────────────────────────────┘
        │ POST /api/chat  { messages, provider, model, enabledSkills, files }
        │ ReadableStream<Uint8Array>
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Next.js API Route (apps/web/app/api/chat/route.ts)                 │
│                                                                     │
│  1. Extract API key from env for requested provider                 │
│  2. Create LLM client (createOpenAI with provider-specific config)  │
│  3. Build system prompt via buildSystemPrompt():                    │
│     - Base tool instructions                                        │
│     - Attached file references with type-specific reading hints     │
│     - Skill descriptions (from .verdent/skills/ SKILL.md files)     │
│     - Persistent memories (if ENABLE_MEMORY=true)                   │
│  4. Apply context compression:                                      │
│     - countMessagesTokens() → trimToTokenLimit() → sliding window   │
│     - Preserves system prompt + first user message + most recent    │
│     - Default threshold: 80,000 tokens                              │
│  5. Call streamText({ model, messages, tools, maxSteps: 8 })        │
│  6. Return result.toDataStreamResponse()                            │
└───────┼─────────────────────────────────────────────────────────────┘
        │ AI SDK v4 streamText()
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ LLM Provider Layer                                                  │
│                                                                     │
│  OpenAI:    createOpenAI({ apiKey })                                │
│  OpenRouter: createOpenAI({ apiKey, baseURL })                      │
│  DeepSeek:   createOpenAI({ apiKey, baseURL, fetch: patched })     │
│              (fetch wrapper disables thinking mode to avoid         │
│               reasoning_content errors in multi-step tool calls)    │
└─────────────────────────────────────────────────────────────────────┘
```

### Key streaming details

- **No `useChat` hook**: The client uses raw `fetch` with `response.body.getReader()` and manually parses the Vercel AI SDK data stream protocol line by line.
- **Coalesced updates**: `patchLocalMessage()` batches streaming token updates using `requestAnimationFrame` to avoid 50+ React re-renders per second during streaming.
- **Optimistic persistence**: Messages are inserted into local Zustand state immediately, then persisted to the database via `/api/sessions/[id]/messages` POST. On failure, state is rolled back using snapshot/restore.
- **Model comparison**: When `compareMode` is enabled, the chat interface sends simultaneous requests to two models, rendering their responses side by side as `CompareRow` components.

### API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/chat` | Streaming LLM completion with tool calling |
| GET/POST/PATCH/DELETE | `/api/sessions` | Session CRUD |
| GET/POST/PATCH/DELETE | `/api/sessions/[id]/messages` | Message CRUD, truncate, clear |
| GET | `/api/sessions/export` | Export all sessions as JSON |
| POST | `/api/sessions/import` | Import sessions from JSON |
| GET/POST/PATCH/DELETE | `/api/projects` | Project CRUD |
| GET/POST/DELETE | `/api/memory` | Persistent key-value memory CRUD |
| GET | `/api/config/status` | Check which providers have API keys set |
| GET | `/api/skills` | List installed skills from disk |
| POST | `/api/upload` | File upload to `data/uploads/` |
| POST | `/api/upload/preview` | Preview uploaded files (CSV, JSON, text) |
| POST/DELETE | `/api/keys` | Manage API keys in database |
| POST | `/api/auth/login` | Username/password login |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/logout` | Session logout |
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/password` | Change password |
| GET | `/api/auth/users` | List all users |

## Tools Architecture

The agent has **11 active tools**, all defined in `packages/core/src/tools/` and registered in `packages/core/src/tools/registry.ts`.

```
packages/core/src/tools/
├── registry.ts          # Tool registration (11 tools)
├── tool-descriptions.ts # User-facing descriptions for each tool
├── path-security.ts     # Path traversal protection
├── terminal/
│   ├── index.ts         # Terminal tool — dispatches to local or Docker backend
│   ├── local.ts         # Local execution with command blocklist + timeout
│   └── docker.ts        # Docker sandbox execution via docker exec
├── execute-code/
│   ├── index.ts         # Code execution tool
│   ├── local.ts         # Local Node.js subprocess execution
│   └── docker.ts        # Docker sandbox code execution
├── file-read.ts         # Read files (5MB limit, line range, smart truncation)
├── file-write.ts        # Create/overwrite files
├── list-directory.ts    # List directory contents
├── search-files.ts      # Search by glob or regex
├── web-search.ts        # DuckDuckGo HTML scraping (no API key, LRU cache)
├── web-fetch.ts         # Fetch URL and extract text content
├── git-tool.ts          # Git commands in workspace
├── db-query.ts          # Read-only SQL queries against local SQLite
└── api-test.ts          # HTTP request testing
```

### Tool Registration

Each tool is defined using `tool()` from the `ai` SDK v4 with a Zod parameter schema:

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

The `tools` object is imported directly into the chat API route (`apps/web/app/api/chat/route.ts`) and passed to `streamText()` via the `tools` option. The AI SDK v4 handles tool call extraction, execution, and result injection automatically during the multi-step loop.

### Terminal Backend

The terminal tool supports two backends selected via `TERMINAL_BACKEND`:

```8:12:packages/core/src/tools/terminal/index.ts
function getBackend(): TerminalBackend {
  const env = process.env.TERMINAL_BACKEND;
  if (env === "docker") return "docker";
  return "local";
}
```

- **`local`**: Executes commands on the host machine with a command blocklist and timeout safeguard. Default for non-Docker deployments.
- **`docker`**: Executes commands inside a sandbox Docker container via `docker exec`. Falls back to local execution if the sandbox is unavailable.

### Path Security

File tools (`read_file`, `write_file`, `list_directory`, `search_files`) use `resolveSafePath()` from `packages/core/src/tools/path-security.ts` to prevent path traversal attacks. Paths are resolved relative to the project workspace and checked against system directory protection rules.

## Multi-Provider LLM Client

The application supports **three LLM providers** through a common `createOpenAI()` interface from `@ai-sdk/openai`:

| Provider | Base URL | Special Handling |
|----------|----------|-----------------|
| OpenAI | Default (api.openai.com) | Standard `createOpenAI` |
| OpenRouter | `https://openrouter.ai/api/v1` | Custom base URL only |
| DeepSeek | `https://api.deepseek.com` | Custom base URL + fetch wrapper that injects `{ thinking: { type: "disabled" } }` to suppress reasoning tokens |

### Provider selection flow

```147:164:apps/web/app/api/chat/route.ts
    } else if (provider === "deepseek") {
      // Use a fetch wrapper to disable DeepSeek thinking mode.
      // This prevents reasoning_content errors in multi-step tool calls.
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

API keys are read from environment variables (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`) on the server side via the `getServerApiKey()` function. Users can also store per-user API keys in the database through the `/api/keys` endpoints.

## Database Architecture

The application uses **SQLite** via **libsql** with **Drizzle ORM** for type-safe queries.

### Schema (10 tables)

```
users              — User accounts (id, username, passwordHash, timestamps)
auth_tokens        — Session tokens (id, userId, token, expiresAt, timestamps)
projects           — Project groupings (id, userId, name, rootPath, timestamps)
sessions           — Chat sessions (id, userId, projectId, title, timestamps)
messages           — Individual messages (id, sessionId, userId, role, content, model, timestamp)
api_keys           — Per-user API keys (provider, userId, key, timestamps)
memories           — Key-value persistent memory (id, key, value, timestamps)
obsidian_config    — Obsidian vault path per user (userId, vaultPath, updatedAt)
```

Relationships:
- `users` 1→N `sessions` 1→N `messages`
- `users` 1→N `projects` 1→N `sessions`
- `users` 1→N `api_keys` (one key per provider per user)
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

The database client is a singleton (`getDb()` in `packages/db/src/client.ts`) that lazily initializes from `DATABASE_URL` env var (default: `file:./data/local.db`). Supports remote libsql/Turso connections with `DATABASE_AUTH_TOKEN`.

### Migration system

Migrations are run on application startup via `ensureMigrated()` in `packages/db/src/migrate.ts`. The `ready()` function in `apps/web/lib/db.ts` ensures migrations complete before any database operation. Migrations are idempotent SQL statements using `CREATE TABLE IF NOT EXISTS` and try/catch for schema evolution (e.g., adding `user_id` columns to existing tables).

## State Management

### Client-side (Zustand)

`useChatStore` in `apps/web/lib/store.ts` manages all client-side state:

- **Sessions and messages**: Fetched from the REST API on startup (`hydrate()`), then kept in memory. Mutations are optimistic — applied locally first, then synced to the server. Failed mutations trigger rollback via snapshot/restore.
- **Streaming state**: `appendLocalMessage()` inserts placeholder messages for in-flight streaming responses. `patchLocalMessage()` uses a `requestAnimationFrame`-based coalescing pattern to batch incremental token updates.
- **UI state**: Sidebar, context panel, provider/model selection, compare mode, skills toggling.
- **Persistence**: UI preferences (sidebar state, provider selection, theme) are stored in `localStorage` under `"agent-web-ui-prefs"`. Session and message data is persisted to SQLite via API calls. On page load, the store hydrates session metadata from the API and lazily loads messages for the active session.

### Server-side (Database)

`apps/web/lib/db.ts` wraps `@agent-web/db` with authentication-scoped queries. All mutating endpoints require a valid session token obtained from the `session_token` cookie, validated against the `auth_tokens` table.

## Key Architectural Patterns

### 1. Monorepo with Turborepo

The project uses Turborepo (v2.3) for task orchestration. The `turbo.json` config defines task dependencies:

```4:17:turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      ...
```

The `^build` dependency ensures that `packages/core` and `packages/db` are built before `apps/web` can build. Internal packages are consumed via Next.js `transpilePackages` in `next.config.ts`.

### 2. Streaming with manual protocol parsing

Instead of Vercel's `useChat` hook, the client implements a custom `streamChat()` function that:
1. Sends a POST request to `/api/chat`
2. Reads the response as a `ReadableStream<Uint8Array>` via `getReader()`
3. Parses each line of the Vercel AI SDK data stream protocol
4. Routes text deltas to the Zustand store via `patchLocalMessage()`
5. Tracks tool calls and their results for rendering in `ToolCallCard` components

```788:912:apps/web/components/chat/chat-interface.tsx
async function streamChat(
  payload: {
    // ...
```

### 3. Context compression

To stay within LLM context windows, the application applies a sliding-window trim when the conversation exceeds a configurable threshold (default: 80,000 tokens):

```30:73:packages/core/src/context.ts
export function trimToTokenLimit(
  messages: MessageToken[],
  maxTokens: number
): MessageToken[] {
  // Preserve system prompts
  // Preserve first user message for context anchoring
  // Keep most recent messages (sliding window from end)
```

Token counting uses a character-based estimation (chars / 4) to avoid adding a tokenizer dependency.

### 4. Optimistic updates with snapshot rollback

All mutating store operations follow this pattern:

```
1. snapshotSessions() — save current state
2. apply mutation locally (optimistic)
3. call API
4. on success: continue
5. on failure: rollbackSessions(snapshot)
```

### 5. DeepSeek compatibility shim

DeepSeek models return `reasoning_content` fields that cause errors when passed back to the API in multi-step tool calls. Two mitigations are applied:
1. **Fetch wrapper** (`route.ts`): Injects `thinking: { type: "disabled" }` into the request body for DeepSeek API calls.
2. **Message stripping** (`route.ts`): Cleans `reasoning_content` and `reasoningContent` fields from message history before sending to DeepSeek.

### 6. Docker multi-stage builds

The `Dockerfile` defines three build targets:

- **`development`**: Runs `pnpm dev` with hot-reload, used by `docker-compose.yml` for local development. Mounts source code as volumes with polling-based file watching.
- **`production`**: Copies the standalone Next.js build from the builder stage. Runs `node apps/web/server.js`. Includes Docker CLI for Docker-in-Docker sandbox support.
- **`sandbox`**: Isolated container for code execution with Python 3, Node.js, and common CLI tools. Runs as a non-root user (`sandbox-user`). Not started by default (uses Docker Compose profiles: `[sandbox]`).

### 7. Skills system

Skills are SKILL.md files located in `.verdent/skills/<name>/SKILL.md`. When a user enables a skill in the sidebar, the system:
1. Scans skill directories for SKILL.md files
2. Extracts the frontmatter `name` and `description` fields
3. Injects the descriptions into the system prompt under "## Enabled Skills"
4. The LLM can then reference these skills during the conversation

### 8. Memory system

When `ENABLE_MEMORY=true`, key-value pairs stored in the `memories` table are injected into the system prompt under "## User Context (persisted across sessions)". The `MEMORY_CHAR_LIMIT` env var caps the length of injected context (default: 2,200 characters).

## Docker Deployment

### Development

```yaml:docker-compose.yml
services:
  app:
    build:
      target: development
    volumes:
      - .:/app              # Source code for hot reload
      - /var/run/docker.sock:/var/run/docker.sock  # Docker-in-Docker
```

Key characteristics:
- Source code mounted for hot reload (CHOKIDAR_USEPOLLING=true, WATCHPACK_POLLING=true)
- `node_modules` isolated via named Docker volumes to prevent host OS binary conflicts
- TypeScript build artifacts (`dist/`) preserved across restarts via named volumes
- SQLite database persisted in a named volume

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
- Standalone Next.js server (no dev dependencies)
- Docker socket mounted read-only for sandbox container access
- Resource limits configured (CPU and memory)
- Separate volumes for database persistence and sandbox workspace
