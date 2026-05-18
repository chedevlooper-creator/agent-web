# Codebase Structure

**Analysis Date:** 2026-05-17

## Directory Layout

```
agent-web/
├── apps/
│   └── web/                         # Next.js 16 web application
│       ├── app/                     # App Router pages and API routes
│       │   ├── api/                 # All backend API endpoints
│       │   │   ├── auth/            # Authentication endpoints
│       │   │   ├── chat/            # Streaming LLM chat endpoint
│       │   │   ├── config/status/   # Provider API key check
│       │   │   ├── keys/            # User API key CRUD
│       │   │   ├── memory/          # Persistent key-value memory
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
│       │   ├── chat/                # Chat UI components
│       │   ├── layout/              # Layout components (sidebar, etc.)
│       │   ├── settings/            # Settings sub-components
│       │   ├── ui/                  # Primitive UI components (shadcn/ui)
│       │   └── ...                   # Top-level components
│       ├── lib/                     # Client & server libraries
│       ├── public/                  # Static assets
│       └── data/                    # SQLite DB + uploaded files (gitignored)
├── packages/
│   ├── core/                       # Shared LLM tools, context compression
│   │   └── src/
│   │       ├── tools/               # Tool implementations
│   │       │   ├── terminal/        # Shell execution (local + docker)
│   │       │   ├── execute-code/    # Code sandbox (local + docker)
│   │       │   └── ...
│   │       ├── context.ts           # Token counting, context trimming
│   │       ├── index.ts             # Package entry point (re-exports)
│   │       └── types.ts             # Shared TypeScript types
│   └── db/                          # Database schema, client, migrations
│       └── src/
│           ├── client.ts            # libsql + Drizzle client singleton
│           ├── index.ts             # Package entry point
│           ├── migrate.ts           # Raw SQL migration runner
│           └── schema.ts            # Drizzle ORM schema (all tables)
├── .planning/                       # Project planning artifacts (gitignored?)
│   ├── codebase/                    # Codebase analysis documents
│   └── graphs/                      # Knowledge graph data
├── docker/                          # Docker-related files
├── graphify-out/                    # Graph analysis output
├── package.json                     # Root workspace config
├── turbo.json                       # Turborepo pipeline config
├── pnpm-workspace.yaml              # pnpm workspaces config
├── .gitignore
├── .prettierrc                      # Prettier formatting config
├── eslint.config.mjs                # ESLint v9 flat config
├── tsconfig.json                    # Root TypeScript config (references)
├── CLAUDE.md                        # AI agent guidance
├── AGENTS.md                        # Extended agent guidance
├── DESIGN_SYSTEM.md                 # Design system documentation
├── docker-compose.yml               # Dev Docker Compose
├── docker-compose.prod.yml          # Prod Docker Compose
└── Dockerfile                       # Multi-stage Docker build
```

## Directory Purposes

### `apps/web/` — Next.js 16 Application

**Purpose:** The main web application — a streaming chat interface with LLM agent capabilities.

**Key files:**
- `app/page.tsx`: Shell layout composing Sidebar + header + ChatInterface
- `app/layout.tsx`: Root HTML layout with Geist fonts, skip-to-content link
- `app/login/page.tsx`: Login page with form submission
- `app/globals.css`: CSS custom properties design tokens + Tailwind directives

**Contains:** All page components, API route handlers, UI components, and application logic.

### `apps/web/app/api/` — API Endpoints

**Purpose:** RESTful backend endpoints for the application. Each subdirectory contains a `route.ts` implementing HTTP methods.

| Route | Methods | Purpose |
|-------|---------|---------|
| `api/chat/route.ts` | POST | Streaming LLM completion with tool execution (8 max steps) |
| `api/auth/login/route.ts` | POST | Password verification + session cookie creation |
| `api/auth/logout/route.ts` | POST | Clear session cookie |
| `api/auth/register/route.ts` | POST | Create user account |
| `api/auth/me/route.ts` | GET | Current user info from session cookie |
| `api/auth/password/route.ts` | PATCH | Change password |
| `api/auth/users/route.ts` | GET | List all users |
| `api/sessions/route.ts` | GET/POST/PATCH/DELETE | Session CRUD |
| `api/sessions/[id]/messages/route.ts` | GET/POST/PATCH/DELETE | Message CRUD + truncate + clear |
| `api/sessions/export/route.ts` | GET | Export all sessions as JSON |
| `api/sessions/import/route.ts` | POST | Import sessions from JSON |
| `api/projects/route.ts` | GET/POST/PATCH/DELETE | Project CRUD |
| `api/projects/[id]/files/route.ts` | GET | List project files |
| `api/config/status/route.ts` | GET | Check which provider API keys are set |
| `api/keys/route.ts` | POST/DELETE | User API key management |
| `api/memory/route.ts` | GET/POST/DELETE | Key-value memory CRUD |
| `api/skills/route.ts` | GET | List installed skills from disk |
| `api/upload/route.ts` | POST | File upload to `data/uploads/` |
| `api/upload/preview/route.ts` | POST | Parse file previews (Excel, CSV, JSON, text) |
| `api/obsidian/config/route.ts` | GET/POST/DELETE | Obsidian vault config |
| `api/obsidian/sync/route.ts` | GET/DELETE | Sync sessions to Obsidian |
| `api/search/route.ts` | GET | Text search across sessions |

### `apps/web/components/` — React Components

**Purpose:** All React components organized by domain.

**Key subdirectories:**

**`chat/`:**
- `chat-interface.tsx` (~1617 lines): Main chat orchestrator — message rendering, streaming, file upload, input handling
- `message-bubble.tsx`: Individual message display with edit/copy/retry
- `tool-call-bubble.tsx`: Tool call card with expandable result
- `markdown-renderer.tsx`: Markdown rendering with syntax highlighting
- `chat-input.tsx`: Input textarea with auto-resize
- `compare-row.tsx`: Side-by-side model comparison rendering
- `file-upload.tsx`: File upload handling
- `typing-indicator.tsx`: Streaming animation skeleton
- `welcome-hero.tsx`: Empty state with starter prompts
- `__tests__/message-bubble.test.tsx`: Tests

**`layout/`:**
- `sidebar.tsx` (~936 lines): Multi-tab sidebar — session list (collapsible), tools, activity feed, context/skills panel
- `context-panel.tsx`: Skills toggle, import/export, runtime info

**`settings/`:**
- `sync-settings.tsx`: Obsidian vault path configuration

**`ui/`:**
Primitive components (based on shadcn/ui style):
- `badge.tsx`, `button.tsx`, `card.tsx`, `scroll-area.tsx`, `separator.tsx`, `skeleton.tsx`, `textarea.tsx`, `tooltip.tsx`

**Top-level:**
- `settings-panel.tsx`: Provider/model selection dropdown, API key entry, compare mode toggle
- `error-boundary.tsx`: React error boundary wrapper
- `skeleton-loader.tsx`: Loading skeleton
- `async-view.tsx`: Async data loading pattern

### `apps/web/lib/` — Application Libraries

**Purpose:** Shared utilities, client state, server DB layer, and hooks.

**Key files:**
- `store.ts` (~819 lines): **Zustand store** — all client state (sessions, messages, UI prefs, settings), all API call functions with optimistic updates, selectors (`useActiveSession`, `useActiveMessages`, etc.)
- `db.ts` (~548 lines): **Server-only DB layer** — wraps `packages/db` with domain-specific CRUD functions for projects, sessions, messages, memories, API keys, Obsidian config; uses `ensureMigrated()` lazy init
- `auth.ts` (~149 lines): **Server-only auth** — bcrypt password hashing, user CRUD, session token management, `getUserIdFromRequest()` helper
- `utils.ts`: `cn()` (clsx + tailwind-merge), token estimation, error message extraction
- `hooks.ts`: Custom React hooks — `useScrollAnchor`, `useFileUpload`
- `rate-limit.ts`: In-memory sliding window rate limiter
- `tool-icons.tsx`: Icon mapping for tool names
- `obsidian.ts`: Obsidian vault interaction utilities
- `crypto.ts`: Client-side crypto utilities
- `__tests__/`: Tests for utility functions

### `packages/core/` — Core Package (`@agent-web/core`)

**Purpose:** Shared LLM tools, context compression utilities, and TypeScript types used by the chat API route.

**Entry points (from `package.json` exports):**
- `.`: Re-exports types, context utilities, tool descriptions, and tool registry
- `./tools`: Direct access to tool registry
- `./types`: Shared TypeScript types (`ChatMessageData`, `SessionData`, `ToolResult`, `Role`)

**Source files:**

**`tools/` (implementations):**
- `registry.ts`: Registers all 11 tools into a single `tools` object consumed by `streamText()`
- `terminal/index.ts`: Shell command execution — dispatches to `local.ts` or `docker.ts` based on `TERMINAL_BACKEND` env
- `terminal/local.ts`: Local shell execution with command blocklist, timeout
- `terminal/docker.ts`: Docker sandbox shell execution
- `execute-code/index.ts`: JS/TS code execution — dispatches to `local.ts` or `docker.ts`
- `execute-code/local.ts`: Local code execution with dangerous import blacklist
- `execute-code/docker.ts`: Docker sandbox code execution
- `file-read.ts`: Read text files (5MB limit, line range support)
- `file-write.ts`: Create/overwrite files
- `list-directory.ts`: List directory contents with file metadata
- `search-files.ts`: Glob pattern + regex text search
- `web-search.ts`: DuckDuckGo HTML scraping (no API key)
- `web-fetch.ts`: Fetch URL and extract readable text
- `git-tool.ts`: Git command execution in project workspace
- `db-query.ts`: Read-only SQLite queries
- `api-test.ts`: HTTP request testing tool
- `path-security.ts`: Path traversal protection — restricts file operations to workspace, blocks system directories
- `tool-descriptions.ts`: Human-readable descriptions for all tools
- `__tests__/path-security.test.ts`: Tests for path security

**Other files:**
- `context.ts`: `countTokens()`, `countMessagesTokens()`, `trimToTokenLimit()` (sliding window), `getContextThreshold()`
- `types.ts`: Shared interfaces

### `packages/db/` — Database Package (`@agent-web/db`)

**Purpose:** Database schema definitions, client singleton, and migration runner.

**Entry points (from `package.json` exports):**
- `.`: Re-exports schema, client, and migration utilities
- `./schema`: Drizzle ORM table definitions and types
- `./client`: libsql + Drizzle client singleton factory

**Source files:**
- `schema.ts`: All 8 tables — `users`, `auth_tokens`, `projects`, `sessions`, `messages`, `api_keys`, `obsidian_config`, `memories` — with relations and inferred types
- `client.ts`: Lazy singleton `getDb()` using `createClient()` + `drizzle()`, falls back to `file:./data/local.db`
- `migrate.ts`: Raw SQL migration for all tables with `runMigrations()` and `ensureMigrated()` guard
- `index.ts`: Barrel export

### Root Configuration Files

**Key files:**

| File | Purpose |
|------|---------|
| `package.json` | Root workspace config, scripts (dev/build/lint/test), pnpm@9.0.0 |
| `turbo.json` | Turborepo pipeline — build depends-on `^build`, dev is persistent |
| `pnpm-workspace.yaml` | Defines `apps/*` and `packages/*` as workspace members |
| `tsconfig.json` | Root TS config with `references` to packages |
| `eslint.config.mjs` | ESLint v9 flat config |
| `.prettierrc` | Prettier formatting settings |
| `.gitignore` | Standard ignores + `data/`, `.env.local`, `.next/`, etc. |
| `Dockerfile` | Multi-stage: `development`, `production`, `sandbox` targets |
| `docker-compose.yml` | Dev services (web + sandbox) with CHOKIDAR_USEPOLLING |
| `docker-compose.prod.yml` | Production services (web + sandbox) |

## Naming Conventions

**Files:**
- `kebab-case.ts`: Source files — `chat-interface.tsx`, `message-bubble.tsx`, `file-read.ts`
- Special suffixes: `*.test.ts` for tests, `route.ts` for API handlers, `page.tsx` for pages

**Directories:**
- `kebab-case` for all directories
- API routes use `[param]` for dynamic segments

## Where to Add New Code

**New LLM Provider:**
- Add provider env var check in `apps/web/app/api/config/status/route.ts`
- Add provider branch in `apps/web/app/api/chat/route.ts` (createOpenAI client)
- Add provider config to `apps/web/components/settings-panel.tsx`

**New Tool:**
- Create `packages/core/src/tools/<name>.ts` using `tool()` from the `ai` SDK + Zod
- Register in `packages/core/src/tools/registry.ts`
- Add description in `packages/core/src/tools/tool-descriptions.ts`
- Tool is automatically available in the chat route via the `tools` import

**New API Route:**
- Create `apps/web/app/api/<name>/route.ts`
- Server-side DB helpers in `apps/web/lib/db.ts`
- Client-side calls through Zustand store or direct `fetch`

**New Page:**
- Create `apps/web/app/<name>/page.tsx` for App Router page
- Create `apps/web/components/<name>/` for associated components

**New Database Table:**
- Add table definition in `packages/db/src/schema.ts`
- Add migration SQL in `packages/db/src/migrate.ts`
- Add CRUD functions in `apps/web/lib/db.ts`

## Package Dependencies & Consumption

**Internet-facing consumption:**

| Consumer | Consumes | Via |
|----------|----------|-----|
| `apps/web` | `@agent-web/core` | `import { tools, countMessagesTokens } from "@agent-web/core"` |
| `apps/web` | `@agent-web/db` | `import { getDb, schema, ensureMigrated } from "@agent-web/db"` |
| `apps/web` | `@agent-web/core/tools` | `import { tools } from "@agent-web/core/tools"` |
| `apps/web` | `@agent-web/db/schema` | `import { sessions, messages } from "@agent-web/db/schema"` |
| `apps/web` | `@agent-web/db/client` | `import { getDb } from "@agent-web/db/client"` |

**External dependencies consumed by `apps/web`:**
- `ai` + `@ai-sdk/openai`: LLM streaming (v4 SDK)
- `@libsql/client` + `drizzle-orm`: Database access
- `zustand`: Client state management
- `next`: Framework (16.2.6)
- `react` + `react-dom` (19.2.4)
- `react-markdown` + `react-syntax-highlighter`: Message rendering
- `lucide-react`: Icons
- `zod`: Schema validation
- `sonner`: Toast notifications
- `bcryptjs`: Password hashing (server-only)
- `mammoth`, `pdf-parse`, `xlsx`: File parsing

**Package-level dependencies:**
- `@agent-web/core` depends on `ai` (tool primitives), `zod`, `@libsql/client`
- `@agent-web/db` depends on `@libsql/client`, `drizzle-orm`

## Special Directories

**`data/`:**
- Purpose: SQLite database file (`local.db`) and uploaded files (`uploads/`)
- Generated: Yes
- Committed: No (.gitignored)
- Created automatically by `predev`/`prestart` scripts

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**`.turbo/`:**
- Purpose: Turborepo build cache
- Generated: Yes
- Committed: No

**`dist/` (in packages):**
- Purpose: tsc build output for `@agent-web/core` and `@agent-web/db`
- Generated: Yes
- Committed: No

**`.verdent/skills/`:**
- Purpose: Installed skill SKILL.md files
- Generated: No (user-managed)
- Committed: Potentially

---

*Structure analysis: 2026-05-17*
