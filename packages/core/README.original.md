<!-- generated-by: gsd-doc-writer -->
# @agent-web/core

Shared package providing LLM tools, type definitions, and context management utilities for the Agent Web monorepo. Used by agent runners and orchestration layers to interact with the filesystem, terminal, web, database, and Git.

## Installation

```bash
# From the monorepo root
npm install

# Or build the package
npm run build -w packages/core
```

The package is private and intended for internal monorepo consumption only.

## Usage

```typescript
import { countTokens, trimToTokenLimit, type ChatMessageData } from "@agent-web/core";
import { tools, type ToolName } from "@agent-web/core/tools";

// Count tokens in a message
const tokenCount = countTokens("Hello, world!"); // ≈ 4

// Trim conversation to fit within context window
const trimmed = trimToTokenLimit(messages, 80_000);

// Access all tool definitions
const terminalTool = tools.terminal;
const result = await terminalTool.execute({ command: "ls -la" });
```

## API

### Entrypoint: `@agent-web/core`

The main entrypoint exports shared types and context utilities.

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
| `countMessagesTokens` | `(messages: MessageToken[]) => number` | Total tokens for an array of messages |
| `trimToTokenLimit` | `(messages: MessageToken[], maxTokens: number) => MessageToken[]` | Sliding-window trim preserving system prompts and first user message |
| `getContextThreshold` | `() => number` | Returns `CONTEXT_COMPRESSION_THRESHOLD` env var or default 80,000 |
| `toolDescriptions` | `Record<ToolName, { name, description, status }>` | Human-readable metadata for every registered tool |

### Entrypoint: `@agent-web/core/tools`

Exports the `tools` registry object and the `ToolName` type. Each tool is built with the Vercel AI SDK `tool()` factory and `zod` parameter schemas.

**Tool Registry**

| Tool Key | Description | Backend |
|---|---|---|
| `terminal` | Execute shell commands | Local or Docker (`TERMINAL_BACKEND`) |
| `read_file` | Read text files with line offset/limit support | Local |
| `write_file` | Create or overwrite files (creates parent dirs) | Local |
| `web_search` | Search the web via DuckDuckGo HTML scrape | Remote (DuckDuckGo) |
| `web_fetch` | Fetch a URL and extract readable text | Remote |
| `list_directory` | List directory contents with sizes, types, dates | Local |
| `search_files` | Search by filename glob or regex content | Local |
| `execute_code` | Run JS/TS in sandboxed Node.js process | Local or Docker (`TERMINAL_BACKEND`) |
| `git` | Execute Git commands in the workspace | Local |
| `db_query` | Read-only SQL queries against local SQLite (Turso) | Local (`DATABASE_URL`) |
| `api_test` | Send HTTP requests (GET/POST/PUT/PATCH/DELETE) | Remote |

**Security**

- File tools (`read_file`, `write_file`, `search_files`, `list_directory`) enforce path safety via `resolveSafePath()` — all paths must resolve within the allowed base directory (`TOOL_ALLOWED_BASE` env var, defaults to `cwd`). System directories are blocked.
- `db_query` only allows `SELECT`, `PRAGMA`, and `EXPLAIN` statements. Write operations are rejected.
- `execute_code` blocks dangerous imports (`child_process`, `fs`, `net`, etc.) in local mode.

**Environment Variables**

| Variable | Default | Description |
|---|---|---|
| `TERMINAL_BACKEND` | `"local"` | Set to `"docker"` to sandbox terminal and code execution |
| `DATABASE_URL` | `file:./packages/db/data/local.db` | SQLite database URL for `db_query` |
| `DATABASE_AUTH_TOKEN` | — | Auth token for Turso remote databases |
| `TOOL_ALLOWED_BASE` | `process.cwd()` | Restrict file tool access to a specific directory |
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

The package is written in TypeScript and compiles to `dist/`. All source lives in `src/`. Tests use Vitest and are co-located in `src/tools/__tests__/`.

Part of the [Agent Web](https://github.com/.../agent-web) monorepo.
