# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Run

```bash
pnpm dev                  # Run all packages in dev mode (Next.js + tsc --watch)
pnpm build                # Build all packages
pnpm lint                 # Lint all packages
pnpm format               # Prettier format all ts/tsx/md files

# Single package
pnpm --filter @agent-web/core build
pnpm --filter @agent-web/db build
pnpm --filter web dev

# Database
pnpm --filter @agent-web/db db:push     # Push schema changes to SQLite
pnpm --filter @agent-web/db db:studio   # Drizzle Studio GUI

# Docker
pnpm docker:dev           # Dev container with hot reload on :3000
pnpm docker:dev:down
pnpm docker:prod          # Production container
pnpm docker:prod:down
```

## Architecture

Monorepo: **pnpm workspaces + Turborepo** — `packages/*` (shared libs) and `apps/*` (Next.js).

### `packages/db` — Database layer
- **Drizzle ORM** on top of **libsql** (SQLite-compatible, supports local file or Turso remote).
- Schema defined in [packages/db/src/schema.ts](packages/db/src/schema.ts) — sessions, messages, memory entries, subagents, MCP servers, cron jobs, skills, documents, tool audits, pending approvals.
- FTS5 full-text search over messages via `initFts5()` with triggers.
- Raw SQL fallback in `ensureSchema()` for environments where Drizzle push doesn't run.
- `DATABASE_URL` env var controls SQLite path. Set `DATABASE_AUTH_TOKEN` for Turso.

### `packages/core` — Business logic (shared lib, no UI)
- **`chat/engine.ts`**: Core chat loop. Uses Vercel AI SDK `streamText()`. Builds system prompt from memory context + enabled skills, selects tools from registry, logs tool executions to DB, auto-saves memory entries from exchanges.
- **`tools/registry.ts`**: `ToolRegistry` singleton. Registers all built-in tools categorized by toolset (`terminal`, `file`, `web`, `code_execution`, `browser`, `vision`, `todo`, `memory`, `delegate`, `document`). Supports enable/disable per-tool and per-toolset.
- **`providers/resolver.ts`**: Maps provider names → OpenAI-compatible base URLs. All providers (OpenAI, OpenRouter, Anthropic, DeepSeek, Gemini, Ollama, 9Router, etc.) go through `createOpenAI()` from `@ai-sdk/openai`. Only `apiMode` is tracked for future non-OpenAI-compatible providers.
- **`llm/client.ts`**: Lighter LLM client (generator-based), separate from the main chat engine. Used for simpler streaming scenarios.
- **`memory/manager.ts`**: Memory CRUD with SQL LIKE-based retrieval. Formats MEMORY.md/USER.md blocks for system prompt. Auto-extracts facts from exchanges via regex patterns. Auto-consolidates when over 80% capacity. Supports replace/remove via substring matching.
- **`skills/manager.ts` + `skills/parser.ts`**: Skill management. Supports old format (via `/api/skills`) and new `SKILL.md` format with frontmatter (via `/api/skills-new`).
- **`mcp/`**: MCP client and manager for connecting to external tool servers (stdio/SSE/WebSocket transports).
- **`subagent/manager.ts`**: Delegates tasks to sub-agents. Subagents get their own session-like context and tool access.
- **`tools/`**: Individual tool implementations — terminal, file I/O, web fetch/search, browser automation, vision, todo tracking, memory CRUD, delegate (spawn subagents), document processing.
- **`schemas.ts`**: Zod validation schemas for chat requests, sessions, memory entries, skills, cron jobs.
- **`errors.ts`**: `AppError` class with typed error codes (VALIDATION_ERROR, NOT_FOUND, etc.) and factory functions.

### `apps/web` — Next.js 16 frontend
- **Next.js 16** with `output: "standalone"` mode. React 19, Tailwind CSS 4.
- **API routes** under `app/api/`: `chat/` (main streaming chat + tool approval), `sessions/`, `memory/`, `mcp/`, `skills/`, `skills-new/`, `subagents/`, `cron/`, `tools/`, `provider/`, `config/`, `search/`, `skills-hub/`, `documents/`.
- **`lib/store.ts`**: Zustand store (`useChatStore`) with `persist` middleware. Holds messages, config (provider/model/toolsets), sessions, tools, skills, subagents, cron jobs, streaming state, tool executions, pending approvals. Persisted subset: provider, model, toolsets, context panel state.
- **`lib/api-keys.ts`**: Server-side API key resolution from env vars, mapping provider names to their respective `*_API_KEY` env vars.
- **`lib/rate-limit.ts`** + **`rate-limit-helpers.ts`**: In-memory rate limiting per IP for chat requests.
- **`lib/server-init.ts`**: Runs once at server startup — ensures DB schema, initializes FTS5, starts cron scheduler.
- **`lib/errors.ts`**: API error response formatting (maps `AppError` to JSON responses).
- **`lib/cron.ts`**: Cron scheduler that evaluates DB-stored cron jobs and executes them periodically.

**Component tree**: `layout.tsx` (ThemeProvider + server init) → `page.tsx` renders `<ChatInterface>` with `<SessionSidebar>`, `<ContextPanel>` (tools/skills/memory/context tabs), `<SettingsPanel>`, `<ShortcutsHelp>`. `<ToolCallPanel>` is used within `ChatInterface`. Sub-panels: skill browser, memory viewer, subagent dashboard, cron manager, MCP/toolset managers, document panel.

## Key patterns

- **API keys**: NEVER go through the client. `getApiKeyForProvider()` reads from server env vars. The Zustand store's `apiKey` field is deprecated.
- **Tool approval**: Dangerous commands (shell exec, file deletes, etc.) create `pending_approvals` DB rows. Chat engine polls until approved/rejected. Client approves via `POST /api/chat/approve`.
- **9Router special case**: When provider is `"9router"`, tool calling is disabled (the gateway doesn't support it reliably) and retries are set to 0.
- **Database**: SQLite via libsql. In Docker, DB file lives at `/app/packages/db/data/local.db` (volume-mounted for persistence). `ensureSchema()` uses raw SQL as fallback; `db:push` (drizzle-kit push) pushes schema directly without migration files.
- **New Next.js version**: This project uses Next.js 16.2.6, which has breaking changes from earlier versions. Check `apps/web/node_modules/next/dist/docs/` before writing Next.js-specific code.
