# Codebase Structure

**Analysis Date:** 2026-05-17

## Directory Layout

```
agent-web/
├── apps/
│   └── web/                         # Next.js 16 web app
│       ├── app/                     # App Router pages + API routes
│       │   ├── api/                 # All backend endpoints
│       │   │   ├── auth/            # Auth endpoints
│       │   │   ├── chat/            # Streaming LLM chat
│       │   │   ├── config/status/   # Provider key check
│       │   │   ├── keys/            # User API key CRUD
│       │   │   ├── memory/          # Key-value memory
│       │   │   ├── obsidian/        # Obsidian vault sync
│       │   │   ├── projects/        # Project CRUD
│       │   │   ├── search/          # Full-text search
│       │   │   ├── sessions/        # Session & message CRUD
│       │   │   ├── skills/          # List installed skills
│       │   │   └── upload/          # File uploads & previews
│       │   ├── globals.css          # Design tokens + Tailwind
│       │   ├── layout.tsx           # Root layout (fonts, HTML shell)
│       │   ├── login/              # Login page
│       │   └── page.tsx             # Main chat page (app shell)
│       ├── components/              # React components
│       │   ├── chat/                # Chat UI
│       │   ├── layout/              # Sidebar, context panel
│       │   ├── settings/            # Settings sub-components
│       │   ├── ui/                  # Primitive UI (shadcn/ui)
│       │   └── ...                   # Top-level components
│       ├── lib/                     # Client & server libs
│       ├── public/                  # Static assets
│       └── data/                    # SQLite DB + uploads (gitignored)
├── packages/
│   ├── core/                       # LLM tools, context compression
│   │   └── src/
│   │       ├── tools/               # Tool implementations
│   │       │   ├── terminal/        # Shell exec (local + docker)
│   │       │   ├── execute-code/    # Code sandbox (local + docker)
│   │       │   └── ...
│   │       ├── context.ts           # Token counting, trimming
│   │       ├── index.ts             # Entry point (re-exports)
│   │       └── types.ts             # Shared TS types
│   └── db/                          # DB schema, client, migrations
│       └── src/
│           ├── client.ts            # libsql + Drizzle singleton
│           ├── index.ts             # Entry point
│           ├── migrate.ts           # Raw SQL migration runner
│           └── schema.ts            # Drizzle ORM schema (all tables)
├── .planning/                       # Planning artifacts (gitignored?)
│   ├── codebase/                    # Codebase analysis
│   └── graphs/                      # Knowledge graph data
├── docker/                          # Docker files
├── graphify-out/                    # Graph analysis output
├── package.json                     # Root workspace config
├── turbo.json                       # Turborepo pipeline
├── pnpm-workspace.yaml              # Workspaces config
├── .gitignore
├── .prettierrc                      # Prettier config
├── eslint.config.mjs                # ESLint v9 flat config
├── tsconfig.json                    # Root TS config (references)
├── CLAUDE.md                        # AI agent guidance
├── AGENTS.md                        # Extended agent guidance
├── DESIGN_SYSTEM.md                 # Design system docs
├── docker-compose.yml               # Dev Compose
├── docker-compose.prod.yml          # Prod Compose
└── Dockerfile                       # Multi-stage Docker build
```

## Directory Purposes

### `apps/web/` — Next.js 16 Application

**Purpose:** Main web app — streaming chat interface with LLM agent.

**Key files:**
- `app/page.tsx`: Shell layout (Sidebar + header + ChatInterface)
- `app/layout.tsx`: Root HTML layout (Geist fonts, skip-to-content)
- `app/login/page.tsx`: Login page
- `app/globals.css`: CSS custom properties + Tailwind directives

**Contains:** All pages, API routes, UI components, app logic.

### `apps/web/app/api/` — API Endpoints

| Route | Methods | Purpose |
|-------|---------|---------|
| `api/chat/route.ts` | POST | Streaming LLM with tools (8 max steps) |
| `api/auth/login/route.ts` | POST | Password verify + session cookie |
| `api/auth/logout/route.ts` | POST | Clear session cookie |
| `api/auth/register/route.ts` | POST | Create user |
| `api/auth/me/route.ts` | GET | Current user from cookie |
| `api/auth/password/route.ts` | PATCH | Change password |
| `api/auth/users/route.ts` | GET | List all users |
| `api/sessions/route.ts` | GET/POST/PATCH/DELETE | Session CRUD |
| `api/sessions/[id]/messages/route.ts` | GET/POST/PATCH/DELETE | Message CRUD + truncate + clear |
| `api/sessions/export/route.ts` | GET | Export sessions as JSON |
| `api/sessions/import/route.ts` | POST | Import sessions from JSON |
| `api/projects/route.ts` | GET/POST/PATCH/DELETE | Project CRUD |
| `api/projects/[id]/files/route.ts` | GET | List project files |
| `api/config/status/route.ts` | GET | Check provider API keys |
| `api/keys/route.ts` | POST/DELETE | User API key mgmt |
| `api/memory/route.ts` | GET/POST/DELETE | Memory CRUD |
| `api/skills/route.ts` | GET | List installed skills |
| `api/upload/route.ts` | POST | File upload to `data/uploads/` |
| `api/upload/preview/route.ts` | POST | File previews (Excel, CSV, JSON, text) |
| `api/obsidian/config/route.ts` | GET/POST/DELETE | Obsidian config |
| `api/obsidian/sync/route.ts` | GET/DELETE | Sync to Obsidian |
| `api/search/route.ts` | GET | Text search across sessions |

### `apps/web/components/` — React Components

**`chat/`:**
- `chat-interface.tsx` (~1617 lines): Main orchestrator — rendering, streaming, upload, input
- `message-bubble.tsx`: Message display with edit/copy/retry
- `tool-call-bubble.tsx`: Tool call card with expandable result
- `markdown-renderer.tsx`: Markdown + syntax highlighting
- `chat-input.tsx`: Input textarea with auto-resize
- `compare-row.tsx`: Side-by-side model comparison
- `file-upload.tsx`: File upload handling
- `typing-indicator.tsx`: Streaming skeleton
- `welcome-hero.tsx`: Empty state with starter prompts
- `__tests__/message-bubble.test.tsx`

**`layout/`:**
- `sidebar.tsx` (~936 lines): Multi-tab sidebar — sessions, tools, activity, context/skills
- `context-panel.tsx`: Skills toggle, import/export, runtime info

**`settings/`:**
- `sync-settings.tsx`: Obsidian vault path config

**`ui/`:** shadcn/ui primitives: `badge.tsx`, `button.tsx`, `card.tsx`, `scroll-area.tsx`, `separator.tsx`, `skeleton.tsx`, `textarea.tsx`, `tooltip.tsx`

**Top-level:** `settings-panel.tsx`, `error-boundary.tsx`, `skeleton-loader.tsx`, `async-view.tsx`

### `apps/web/lib/` — Application Libraries

**Key files:**
- `store.ts` (~819 lines): Zustand store — all client state + API calls with optimistic updates, selectors
- `db.ts` (~548 lines): Server-only DB layer — wraps `packages/db`, domain CRUD, `ensureMigrated()` lazy init
- `auth.ts` (~149 lines): Server-only auth — bcrypt, user CRUD, session tokens, `getUserIdFromRequest()`
- `utils.ts`: `cn()`, token estimation, error extraction
- `hooks.ts`: `useScrollAnchor`, `useFileUpload`
- `rate-limit.ts`: In-memory sliding window rate limiter
- `tool-icons.tsx`: Icon mapping for tool names
- `obsidian.ts`: Obsidian vault utils
- `crypto.ts`: Client-side crypto
- `__tests__/`: Utility tests

### `packages/core/` — Core Package (`@agent-web/core`)

**Entry points:**
- `.`: Types, context utils, tool descriptions, registry
- `./tools`: Tool registry
- `./types`: Shared TS types (`ChatMessageData`, `SessionData`, `ToolResult`, `Role`)

**Tools:**
- `registry.ts`: Registers all 11 tools for `streamText()`
- `terminal/index.ts`: Shell exec → `local.ts` or `docker.ts` based on `TERMINAL_BACKEND`
- `terminal/local.ts`: Local exec with blocklist, timeout
- `terminal/docker.ts`: Docker sandbox exec
- `execute-code/index.ts`: JS/TS code exec dispatch
- `execute-code/local.ts`: Local exec with dangerous import blacklist
- `execute-code/docker.ts`: Docker sandbox code exec
- `file-read.ts`: Read files (5MB limit, line range)
- `file-write.ts`: Create/overwrite files
- `list-directory.ts`: List dir contents with metadata
- `search-files.ts`: Glob + regex text search
- `web-search.ts`: DuckDuckGo scrape (no API key)
- `web-fetch.ts`: Fetch URL, extract readable text
- `git-tool.ts`: Git commands in workspace
- `db-query.ts`: Read-only SQLite queries
- `api-test.ts`: HTTP request testing
- `path-security.ts`: Path traversal protection
- `tool-descriptions.ts`: Human-readable tool descriptions
- `__tests__/path-security.test.ts`

**Other:**
- `context.ts`: `countTokens()`, `countMessagesTokens()`, `trimToTokenLimit()`, `getContextThreshold()`
- `types.ts`: Shared interfaces

### `packages/db/` — Database Package (`@agent-web/db`)

**Entry points:**
- `.`: Schema, client, migration utils
- `./schema`: Drizzle table defs + types
- `./client`: libsql + Drizzle singleton factory

**Source:**
- `schema.ts`: All 8 tables with relations and inferred types
- `client.ts`: Lazy singleton `getDb()` → `createClient()` + `drizzle()`, fallback to `file:./data/local.db`
- `migrate.ts`: Raw SQL migration with `runMigrations()` + `ensureMigrated()`
- `index.ts`: Barrel export

### Root Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Root config, scripts, pnpm@9.0.0 |
| `turbo.json` | Turborepo pipeline |
| `pnpm-workspace.yaml` | Workspace members |
| `tsconfig.json` | Root TS with `references` |
| `eslint.config.mjs` | ESLint v9 flat config |
| `.prettierrc` | Prettier settings |
| `.gitignore` | Ignores |
| `Dockerfile` | Multi-stage: `development`, `production`, `sandbox` |
| `docker-compose.yml` | Dev services |
| `docker-compose.prod.yml` | Prod services |

## Naming Conventions

**Files:**
- `kebab-case.ts` for source — `chat-interface.tsx`, `message-bubble.tsx`, `file-read.ts`
- Suffixes: `*.test.ts`, `route.ts`, `page.tsx`

**Directories:**
- `kebab-case`
- API routes use `[param]` for dynamic segments

## Where to Add New Code

**New LLM Provider:**
- Add env var check in `apps/web/app/api/config/status/route.ts`
- Add provider branch in `apps/web/app/api/chat/route.ts` (createOpenAI)
- Add config to `apps/web/components/settings-panel.tsx`

**New Tool:**
- Create `packages/core/src/tools/<name>.ts` using `tool()` + Zod
- Register in `packages/core/src/tools/registry.ts`
- Add description in `tool-descriptions.ts`
- Auto-available via `tools` import

**New API Route:**
- Create `apps/web/app/api/<name>/route.ts`
- Server DB helpers in `apps/web/lib/db.ts`
- Client calls via Zustand store or `fetch`

**New Page:**
- Create `apps/web/app/<name>/page.tsx`
- Create `apps/web/components/<name>/` for components

**New Database Table:**
- Add table in `packages/db/src/schema.ts`
- Add migration SQL in `packages/db/src/migrate.ts`
- Add CRUD in `apps/web/lib/db.ts`

## Package Dependencies & Consumption

**Internal:**
| Consumer | Consumes | Via |
|----------|----------|-----|
| `apps/web` | `@agent-web/core` | `import { tools, countMessagesTokens } from "@agent-web/core"` |
| `apps/web` | `@agent-web/db` | `import { getDb, schema, ensureMigrated } from "@agent-web/db"` |
| `apps/web` | `@agent-web/core/tools` | `import { tools } from "@agent-web/core/tools"` |
| `apps/web` | `@agent-web/db/schema` | `import { sessions, messages } from "@agent-web/db/schema"` |
| `apps/web` | `@agent-web/db/client` | `import { getDb } from "@agent-web/db/client"` |

**External (`apps/web`):**
- `ai` + `@ai-sdk/openai`: LLM streaming (v4)
- `@libsql/client` + `drizzle-orm`: DB
- `zustand`: State
- `next` (16.2.6)
- `react` + `react-dom` (19.2.4)
- `react-markdown` + `react-syntax-highlighter`
- `lucide-react`
- `zod`
- `sonner`
- `bcryptjs` (server)
- `mammoth`, `pdf-parse`, `xlsx`

**Package deps:**
- `@agent-web/core` depends on `ai`, `zod`, `@libsql/client`
- `@agent-web/db` depends on `@libsql/client`, `drizzle-orm`

## Special Directories

| Dir | Purpose | Generated | Committed |
|-----|---------|-----------|-----------|
| `data/` | SQLite DB + uploads | Yes | No |
| `.next/` | Build output | Yes | No |
| `.turbo/` | Build cache | Yes | No |
| `dist/` (packages) | tsc output | Yes | No |
| `.verdent/skills/` | Skill files | No (user) | Possibly |

---

*Structure analysis: 2026-05-17*
