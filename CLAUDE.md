# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
pnpm dev              # All packages + Next.js dev server (turbo; packages run tsc --watch)
pnpm build            # Build packages then Next.js for production (turbo)
pnpm lint             # ESLint across monorepo (flat config, eslint v9)
pnpm format           # Prettier on **/*.{ts,tsx,md}
pnpm test             # Vitest across workspace (turbo)

# Package-scoped
pnpm --filter @agent-web/core build      # Build core package (tsc → dist/)
pnpm --filter @agent-web/db build        # Build db package (tsc → dist/)
pnpm --filter web dev                    # Next.js dev only
pnpm --filter web test                   # Web tests (Vitest + happy-dom)
pnpm --filter web test:watch             # Watch mode
pnpm --filter web test:coverage          # Coverage
pnpm --filter web exec tsc --noEmit      # Type-check web app, no emit
pnpm --filter web exec vitest run path/to/file.test.ts   # Single test file

# Docker
pnpm docker:dev      # Dev in Docker Compose (CHOKIDAR_USEPOLLING / WATCHPACK_POLLING set)
pnpm docker:dev:down
pnpm docker:prod     # Production Docker Compose (docker-compose.prod.yml)
pnpm docker:prod:down
```

There are **no `db:push` / `db:studio` scripts** despite older AGENTS.md
claims — `@agent-web/db` only exposes `build`/`dev`/`clean`. Reset the DB by
deleting `data/local.db` and restarting.

## Architecture

Monorepo: pnpm 9 workspaces (`apps/*`, `packages/*`) orchestrated by Turbo
(`turbo.json`: `build`, `dev` persistent/uncached, `lint`, `test`).

### Packages

- **`packages/core`** (`@agent-web/core`) — LLM tooling, token counting,
  context compression. `tsc` → `dist/`. Exports `.`, `./tools`, `./types`.
- **`packages/db`** (`@agent-web/db`) — Drizzle ORM v0.36 over SQLite via
  libsql (`@libsql/client`). `tsc` → `dist/`. Exports `.`, `./schema`,
  `./client`. **13 tables**: `users`, `authTokens`, `projects`, `sessions`,
  `messages`, `apiKeys`, `obsidianConfig`, `memories`, `knowledgeBases`,
  `knowledgeDocuments`, `documentChunks`, `agentPresets`, `installedAgents`.

`@agent-web/core` and `@agent-web/db` are `tsc`-built and consumed via
`transpilePackages` in `next.config.ts`. They must be built before (or watched
during) a web build — `pnpm dev`/`build` handle this through Turbo ordering.

### App: `apps/web`

Next.js 16 App Router. **No `src/`** — routes/API under `app/`, components
under `components/`, helpers under `lib/`.

**Chat flow (POST `/api/chat`, `app/api/chat/route.ts`):**
1. `ChatInterface` (client) sends `{ messages, provider, model, enabledSkills?, files? }`.
2. `getServerApiKey()` resolves a provider key (`OPENAI_API_KEY`,
   `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`).
3. Client built via `createOpenAI()`: OpenAI native, OpenRouter (custom
   baseURL), or DeepSeek (baseURL + a `fetch` wrapper that disables thinking
   mode).
4. System prompt assembled from the tool list, attached files, enabled skills
   (`SKILL.md` frontmatter), and memories (when `ENABLE_MEMORY=true`).
5. Context compression: `countMessagesTokens` → `trimToTokenLimit` (sliding
   window keeping system + first user + most recent;
   `CONTEXT_COMPRESSION_THRESHOLD`, default 80000).
6. `streamText({ model, messages, tools, maxSteps: 8 })` with real tool
   implementations from `@agent-web/core`.
7. Returns `toDataStreamResponse()`. The client does **not** use `useChat`;
   it runs a custom `fetch` + `getReader()` loop parsing the Vercel AI SDK
   data stream (`0:` text, `1:` tool call, `2:` tool result, `3:` error).
   The chat route is `runtime: "nodejs"` and `dynamic: "force-dynamic"`.

**State:** Zustand v5 store (`lib/store.ts`) with optimistic updates —
mutations apply locally then persist via `/api/sessions/...`. Sessions,
messages, projects, memories, and keys live in SQLite. Only UI prefs (sidebar,
provider, model, selected skills, compare mode, theme) persist to
`localStorage` under `agent-web-ui-prefs`. `lib/db.ts` wraps `@agent-web/db`
with a per-call `ensureMigrated()` guard.

### Tools (`packages/core/src/tools/`)

**13 built-in tools are registered and active** in
`packages/core/src/tools/registry.ts` (older docs saying "3" or "8" are
wrong): `image_generate`, `terminal`, `read_file`, `write_file`,
`web_search`, `list_directory`, `search_files`, `web_fetch`, `execute_code`,
`git`, `db_query`, `api_test`, `knowledge_search`. Additional MCP tools are
merged at request time via `loadMcpTools()` / `getAllTools()`. File tools are
restricted to the workspace via path-traversal protection (override base with
`TOOL_ALLOWED_BASE`, discouraged in prod). `terminal`/`execute_code` honor
`TERMINAL_BACKEND` (`local` blocklist+timeout vs `docker` sandbox).

### API routes (`apps/web/app/api/`)

Beyond `/api/chat`: `sessions/*` (CRUD, export, import, branch),
`sessions/[id]/messages/*`, `agents/*` (preset/installed marketplace),
`auth/*` (login, register, logout, password, me, users), `keys`,
`config/status`, `memory`, `skills`, `knowledge/*`, `mcp/*`, `obsidian/*`,
`upload/*`, `projects/*`, `search`, `stt`, `tts`.

### Skills & memory

Skills: `SKILL.md` files under `.verdent/skills/<name>/` (also
`~/.verdent/skills/`, `~/.agents/skills/`), `name` + `description`
frontmatter, injected into the system prompt when enabled in the sidebar. No
`.verdent/` directory ships in the repo. Memory: with `ENABLE_MEMORY=true`,
the `memories` table is injected under "User Context", capped by
`MEMORY_CHAR_LIMIT` (default 2200).

## Key constraints

- **pnpm 9.0.0** enforced via `packageManager`.
- **Next.js 16** has breaking API changes — consult
  `apps/web/node_modules/next/dist/docs/` before touching routing, server
  components, or config. See also `apps/web/AGENTS.md`.
- `next.config.ts`: `output: "standalone"` (prod Docker copies
  `.next/standalone`); `transpilePackages: ["@agent-web/core",
  "@agent-web/db"]`; `serverExternalPackages: ["@libsql/client", "pdf-parse",
  "mammoth", "xlsx", "@lobehub/tts"]`; custom webpack strips `node:` prefixes
  and stubs Node built-ins client-side.
- **Tailwind v3** (not v4): `tailwind.config.ts` + standard
  `tailwindcss`/`autoprefixer` PostCSS, `@tailwind base/components/utilities`
  in `globals.css`. Do not introduce `@tailwindcss/postcss`.
- **ESLint v9 flat config** (`eslint.config.mjs`):
  `eslint-config-next/core-web-vitals` + `typescript`.
- **shadcn/ui** configured (`components.json`).
- `Dockerfile` (Node 22 base) targets: `development`, `production`,
  `sandbox` (isolated Node + Python executor, unprivileged user; the compose
  `sandbox` service uses `profiles: [sandbox]` and is not started by default).
- `apps/web/DESIGN_SYSTEM.md` has been **deleted from the working tree** but
  remains in git history (dark-first, glassmorphism, WCAG 2.1 AA, 8pt grid).
  Many source files were similarly deleted; recover with
  `git show HEAD:<path>`.

## Environment variables

Copy `.env.example` to `.env.local`. Notable:

| Variable | Default | Notes |
|----------|---------|-------|
| `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `DEEPSEEK_API_KEY` | — | At least one required |
| `DATABASE_URL` | `file:./data/local.db` | libsql remote: `libsql://...` |
| `DATABASE_AUTH_TOKEN` | — | Required for Turso/libsql remote |
| `TERMINAL_BACKEND` | `local` | `docker` for sandbox isolation |
| `ENABLE_MEMORY` | `false` | Persist memories across sessions |
| `MEMORY_CHAR_LIMIT` | `2200` | Max injected memory chars |
| `CONTEXT_COMPRESSION_THRESHOLD` | `80000` | Token limit before trimming |
| `ENCRYPTION_KEY` | — | At-rest API-key encryption |
| `TOOL_ALLOWED_BASE` | workspace | File-tool root override (discouraged) |
| `OBSIDIAN_VAULT_PATH` | — | Obsidian sync |
| `LANGFUSE_*` | — | Optional observability |

## Adding features

- **LLM provider:** add the key check in `getServerApiKey()` and a client
  branch in the `/api/chat` `POST` handler (handle quirks like DeepSeek's
  fetch wrapper); surface it in `components/settings-panel.tsx`.
- **Tool:** add `packages/core/src/tools/<name>.ts` using `tool()` from `ai`
  + `zod`, register in `packages/core/src/tools/registry.ts`, re-export from
  `packages/core/src/index.ts`. It is then automatically available in
  `/api/chat`.
- **API route:** add `app/api/<name>/route.ts`; server DB helpers in
  `lib/db.ts`; client calls go through the Zustand store or direct `fetch`.
