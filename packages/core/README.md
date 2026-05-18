<!-- generated-by: gsd-doc-writer -->
# @agent-web/core

Shared package: LLM tools, type definitions, context management for Agent Web monorepo. Used by agent runners + orchestration layers to interact with filesystem, terminal, web, DB, Git.

## Installation

```bash
# From monorepo root
npm install

# Or build
npm run build -w packages/core
```

Private — internal monorepo consumption only.

## Usage

```typescript
import { countTokens, trimToTokenLimit, type ChatMessageData } from "@agent-web/core";
import { tools, type ToolName } from "@agent-web/core/tools";

// Count tokens
const tokenCount = countTokens("Hello, world!"); // ≈ 4

// Trim conversation to fit context window
const trimmed = trimToTokenLimit(messages, 80_000);

// Access all tool definitions
const terminalTool = tools.terminal;
const result = await terminalTool.execute({ command: "ls -la" });
```

## API

### Entrypoint: `@agent-web/core`

Main entrypoint exports shared types + context utilities.

**Types**

| Export | Description |
|---|---|
| `Role` | `"user" \| "assistant" \| "system"` |
| `ChatMessageData` | Message with `id`, `role`, `content`, `model`, `timestamp` |
| `SessionData` | Session with `id`, `title`, messages array, timestamps |
| `ToolResult` | `{ ok, output, error? }` |
| `ToolName` | Union of all registered tool keys |

**Context Utilities**

| Export | Signature | Description |
|---|---|---|
| `countTokens` | `(text: string) => number` | Character-based rough token estimate (chars / 4) |
| `countMessagesTokens` | `(messages: MessageToken[]) => number` | Total tokens for message array |
| `trimToTokenLimit` | `(messages: MessageToken[], maxTokens: number) => MessageToken[]` | Sliding-window trim, preserve system + first user message |
| `getContextThreshold` | `() => number` | Returns `CONTEXT_COMPRESSION_THRESHOLD` env var or default 80,000 |
| `toolDescriptions` | `Record<ToolName, { name, description, status }>` | Human-readable metadata per registered tool |

### Entrypoint: `@agent-web/core/tools`

Exports `tools` registry + `ToolName` type. Each tool built with Vercel AI SDK `tool()` factory + `zod` schemas.

**Tool Registry**

| Tool Key | Description | Backend |
|---|---|---|
| `terminal` | Execute shell commands | Local or Docker (`TERMINAL_BACKEND`) |
| `read_file` | Read text files with line offset/limit | Local |
| `write_file` | Create/overwrite files (creates parent dirs) | Local |
| `web_search` | Search via DuckDuckGo HTML scrape | Remote (DuckDuckGo) |
| `web_fetch` | Fetch URL + extract readable text | Remote |
| `list_directory` | List dir contents with sizes, types, dates | Local |
| `search_files` | Search by filename glob or regex content | Local |
| `execute_code` | Run JS/TS in sandboxed Node.js | Local or Docker (`TERMINAL_BACKEND`) |
| `git` | Execute Git commands in workspace | Local |
| `db_query` | Read-only SQL queries against local SQLite | Local (`DATABASE_URL`) |
| `api_test` | Send HTTP requests (GET/POST/PUT/PATCH/DELETE) | Remote |

**Security**

- File tools use `resolveSafePath()` — all paths resolve within allowed base dir (`TOOL_ALLOWED_BASE`, default `cwd`). System dirs blocked.
- `db_query` only allows `SELECT`, `PRAGMA`, `EXPLAIN`. Writes rejected.
- `execute_code` blocks dangerous imports (`child_process`, `fs`, `net`, etc.) in local mode.

**Environment Variables**

| Variable | Default | Description |
|---|---|---|
| `TERMINAL_BACKEND` | `"local"` | `"docker"` for sandbox terminal + code execution |
| `DATABASE_URL` | `file:./packages/db/data/local.db` | SQLite URL for `db_query` |
| `DATABASE_AUTH_TOKEN` | — | Auth token for Turso remote DBs |
| `TOOL_ALLOWED_BASE` | `process.cwd()` | Restrict file tool access to specific dir |
| `CONTEXT_COMPRESSION_THRESHOLD` | `80000` | Token limit for context window trimming |

## Development

```bash
# Build TypeScript
npm run build -w packages/core

# Watch mode
npm run dev -w packages/core

# Run tests
npm run test -w packages/core

# Clean build output
npm run clean -w packages/core
```

Written in TypeScript, compiles to `dist/`. Source in `src/`. Tests: Vitest, co-located in `src/tools/__tests__/`.

Part of [Agent Web](https://github.com/.../agent-web) monorepo.
