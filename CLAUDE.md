# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
pnpm dev              # Start all packages + Next.js dev server (turbo)
pnpm build            # Build all packages + Next.js for production
pnpm lint             # ESLint across monorepo (flat config, eslint v9)
pnpm format           # Prettier on **/*.{ts,tsx,md}

# Package-scoped
pnpm --filter @agent-web/core build      # Build core package (tsc)
pnpm --filter @agent-web/db build        # Build db package (tsc)
pnpm --filter web dev                    # Next.js dev only

# Docker
pnpm docker:dev      # Dev in Docker Compose (CHOKIDAR_USEPOLLING=true)
pnpm docker:dev:down # Tear down dev containers
pnpm docker:prod     # Production Docker Compose
pnpm docker:prod:down

# Type-check web app (no emit)
pnpm --filter web exec tsc --noEmit
```

## Architecture

Monorepo: pnpm workspaces (`apps/*`, `packages/*`) + Turborepo.

### Packages

- **`packages/core`** (`@agent-web/core`) — Shared LLM tools, token counting, context compression. Built via `tsc` to `dist/`. Exports three entrypoints: `.` (types + context utils), `./tools` (tool registry + individual tools).
- **`packages/db`** (`@agent-web/db`) — Drizzle ORM schema (SQLite via libsql), migration runner, client singleton. Built via `tsc` to `dist/`. Tables: `sessions`, `messages`, `memories`.

### App: `apps/web`

Next.js 16 App Router. No `src/` — pages/API routes under `app/`, components under `components/`, lib under `lib/`.

**Chat flow (POST /api/chat):**
1. `ChatInterface` (client) → sends `{ messages, provider, model, enabledSkills?, files? }` to `/api/chat`
2. Route builds system prompt (tools list + attached files + skills SKILL.md + memories from DB if `ENABLE_MEMORY=true`)
3. Creates AI SDK client via `createOpenAI()` — OpenAI native, OpenRouter (custom baseURL), or DeepSeek (baseURL + fetch wrapper that disables thinking mode)
4. Applies context compression: `countMessagesTokens` → `trimToTokenLimit` (sliding window, preserves system msg + first user msg + most recent)
5. Calls `streamText({ model, messages, tools, maxSteps: 8 })` with real tool implementations from `@agent-web/core`
6. Returns `toDataStreamResponse()` — client manually parses the Vercel AI SDK data stream (`0:` text, `1:` tool call, `2:` tool result, `3:` error)
7. Client does NOT use `useChat` from `ai/react`; uses custom `fetch` + `getReader()` loop

**State management:** Zustand store (`lib/store.ts`) with optimistic updates — mutations apply locally first, then persist via API calls to `/api/sessions/...`. Sessions and messages are stored in SQLite (not localStorage).

**Database persistence** is fully active — sessions/messages survive page reloads. `lib/db.ts` wraps `@agent-web/db` with per-function `ensureMigrated()` guard.

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Streaming LLM completion with tools |
| `/api/sessions` | GET/POST/PATCH/DELETE | Session CRUD |
| `/api/sessions/[id]/messages` | GET/POST/PATCH/DELETE | Message CRUD, truncate, clear |
| `/api/sessions/export` | GET | Export all sessions as JSON |
| `/api/sessions/import` | POST | Import sessions from JSON |
| `/api/config/status` | GET | Check which providers have API keys set |
| `/api/memory` | GET/POST/DELETE | Persistent key-value memory CRUD |
| `/api/skills` | GET | List installed skills from disk |
| `/api/upload` | POST | File upload to `data/uploads/` |

### Tools (packages/core/src/tools/)

Three active tools, all wired into `/api/chat`:
- **terminal** — Shell command execution. `TERMINAL_BACKEND=docker` runs in sandbox container; `local` uses blocklist + command whitelist + timeout.
- **read_file** — Read text files. 5MB limit, line range support, absolute path resolution.
- **web_search** — DuckDuckGo HTML scraping (no API key needed).

### Skills system

SKILL.md files in `.verdent/skills/<name>/SKILL.md` (and `~/.verdent/skills/`, `~/.agents/skills/`). Frontmatter `name` + `description` fields. User enables skills in sidebar → descriptions injected into system prompt.

### Memory system

When `ENABLE_MEMORY=true`: key-value pairs stored in `memories` table, injected into system prompt under "User Context (persisted across sessions)". `MEMORY_CHAR_LIMIT` caps injected content length (default 2200).

## Key Constraints

- **pnpm 9.0.0** enforced via `packageManager` field
- **Next.js 16** — breaking API changes from older versions. Read `node_modules/next/dist/docs/` before writing Next.js code.
- **`output: "standalone"`** in `next.config.ts` — production Docker copies `.next/standalone`
- **`transpilePackages`** — `@agent-web/core` and `@agent-web/db` are tsc-built but Next.js must transpile them
- **`serverExternalPackages: ["@libsql/client"]`** — native module, server-only
- **Tailwind v4** via `@tailwindcss/postcss` — no `tailwind.config.js`, CSS-first config in `globals.css`
- **ESLint v9 flat config** (`eslint.config.mjs`) — uses `eslint-config-next/core-web-vitals` + `typescript`
- **shadcn/ui** configured (`components.json`, style `base-nova`, icon `lucide`)
- **Design system** in `apps/web/DESIGN_SYSTEM.md` — dark-first, glassmorphism, WCAG 2.1 AA, 8pt grid
- **Terminal sandbox** — Docker Compose `sandbox` service uses `profiles: [sandbox]`, not started by default

## Environment Variables

Copy `.env.example` to `.env.local`. Key vars:

| Variable | Default | Notes |
|----------|---------|-------|
| `DEEPSEEK_API_KEY` | — | Required for API access |
| `DATABASE_URL` | `file:./data/local.db` | libsql remote: `libsql://...` |
| `DATABASE_AUTH_TOKEN` | — | Required for Turso/libsql remote |
| `TERMINAL_BACKEND` | `local` | `docker` for sandbox isolation |
| `ENABLE_MEMORY` | `false` | Persist memories across sessions |
| `MEMORY_CHAR_LIMIT` | `2200` | Max chars for injected memory |
| `CONTEXT_COMPRESSION_THRESHOLD` | `80000` | Token limit before trimming |

## Adding Features

**New LLM provider:** Add API key env check, update chat route to create the client, update settings-panel UI.

**New tool:** Create `packages/core/src/tools/<name>.ts` using `ai/tool` + `zod`, register in `packages/core/src/tools/registry.ts`, re-export from `packages/core/src/index.ts`. Tools are automatically available in the route via the `tools` import.

**New API route:** Add under `app/api/<name>/route.ts`. Server-side DB helpers go in `lib/db.ts`. Client-side API calls go through the Zustand store or direct `fetch`.
