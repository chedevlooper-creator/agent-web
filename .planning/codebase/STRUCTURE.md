# Directory Structure

**Date:** 2026-05-17
**Focus:** Directory layout, key locations, naming conventions

## Directory Layout

```
agent-web/
+- apps/
|   +- web/                          # Next.js 16 application
|       +- app/                      # App Router pages & API routes
|       |   +- api/                  # REST API endpoints
|       |   |   +- chat/             #   POST /api/chat (LLM streaming)
|       |   |   +- keys/             #   API key CRUD
|       |   |   +- projects/         #   Project CRUD + file listing
|       |   |   +- sessions/         #   Session CRUD + messages + import/export
|       |   |   +- skills/           #   Available skills listing
|       |   |   +- upload/           #   File upload + text extraction
|       |   +- globals.css           # Global styles, tokens, animations
|       |   +- layout.tsx            # Root layout
|       |   +- page.tsx              # Main cockpit page
|       +- components/               # React components
|       |   +- chat/                 # Chat-related components
|       |   +- layout/               # Layout components
|       +- lib/                      # Client-side utilities & state
|       |   +- __tests__/            # Store tests
|       |   +- store.ts              # Zustand chat store
|       |   +- db.ts                 # Server-side DB access layer
|       |   +- crypto.ts             # AES-256-GCM encryption
|       |   +- hooks.ts              # Custom React hooks
|       |   +- tool-icons.tsx        # Tool icon mapping
|       |   +- utils.ts              # cn(), estimateTokens(), getErrorMessage()
|       +- data/                     # SQLite database files (gitignored)
|       +- public/                   # Static assets
|       +- tailwind.config.ts        # Tailwind CSS v3 config
|       +- vitest.config.ts          # Vitest config
|       +- vitest.setup.ts           # Vitest setup
|       +- next.config.ts            # Next.js config
|       +- package.json              # Dependencies
+- packages/
|   +- core/                         # Shared business logic
|   |   +- src/
|   |       +- tools/                # Tool definitions
|   |       |   +- execute-code/     # Sandboxed code execution tool
|   |       |   +- terminal/         # Shell command execution tool
|   |       |   +- file-read.ts      # Read file tool
|   |       |   +- file-write.ts     # Write file tool
|   |       |   +- list-directory.ts # List directory tool
|   |       |   +- search-files.ts   # Search files tool
|   |       |   +- web-fetch.ts      # Web fetch tool
|   |       |   +- web-search.ts     # Web search tool (DuckDuckGo)
|   |       |   +- path-security.ts  # Workspace path validation
|   |       |   +- registry.ts       # Tool registration hub
|   |       |   +- tool-descriptions.ts # Tool metadata
|   |       +- llm/
|   |       |   +- client.ts         # LLM client factory
|   |       +- index.ts              # Package entry point
|   |       +- types.ts              # Shared TypeScript types
|   +- db/                           # Database layer
|       +- src/
|           +- schema.ts             # Drizzle ORM schema
|           +- client.ts             # libsql client factory
|           +- migrate.ts            # Migration runner
|           +- index.ts              # Package entry point
+- docker/                           # Docker support files
|   +- entrypoint.dev.sh             # Dev container entrypoint
+- sessions/                         # Session export/backup directory
+- assets/                           # Design assets
+- .cursor/                          # Cursor IDE config
+- .vscode/                          # VS Code settings
+- .planning/                        # (newly created) Planning artifacts
|   +- codebase/                     # Codebase analysis documents
+- Dockerfile                        # Multi-stage Docker build
+- docker-compose.yml                # Dev Docker Compose
+- docker-compose.prod.yml           # Production Docker Compose
+- package.json                      # Root monorepo package.json
+- pnpm-workspace.yaml               # pnpm workspace definition
+- turbo.json                        # Turbo build orchestration
+- eslint.config.mjs                 # ESLint flat config
+- .env.example                      # Environment variable template
+- brand-spec.md                     # Brand specification
+- tsconfig.json                     # Root TypeScript config
+- AGENTS.md                         # Agent guidance for AI coding tools
```

---

## Directory Purposes

### apps/web/
The Next.js 16 application. No `src/` folder -- all code is at the root level of the app directory. Follows App Router conventions with file-based routing.

**Key subdirectories:**
- `app/` -- App Router pages (page.tsx), layout (layout.tsx), API routes (api/), and global CSS.
- `components/` -- React components organized by domain: `chat/` for conversation UI, `layout/` for chrome/shell components. Top-level for standalone components (SettingsPanel, SkeletonLoader, AsyncView, ErrorBoundary).
- `lib/` -- Client utilities, the Zustand store, server-only DB access and crypto modules. Tests for store live in `lib/__tests__/`.
- `data/` -- SQLite database file location (gitignored, created at runtime).

### packages/core/
Shared TypeScript package containing the LLM client configuration and all tool definitions. Built with `tsc` to `dist/`.

**Key subdirectories and files:**
- `src/tools/` -- Each tool is a file (or directory for multi-file tools). The registry at `registry.ts` collects all tools into a single exported object.
- `src/llm/client.ts` -- Provider factory using `createOpenAI()` from `@ai-sdk/openai`.
- `src/types.ts` -- `ChatMessageData`, `SessionData`, `ToolResult`, `Role` -- used across both frontend and API.
- `src/index.ts` -- Exports types and tool descriptions. The tools themselves are imported via `@agent-web/core/tools` sub-path export.

### packages/db/
Database package with Drizzle ORM schema, libsql client singleton, and migration runner. Built with `tsc` to `dist/`.

- `src/schema.ts` -- Four tables: projects, sessions, messages, api_keys. Uses Drizzle relations for FK traversal.
- `src/client.ts` -- `getDb()` singleton factory. Reads `DATABASE_URL` env var, defaults to `file:./data/local.db`.
- `src/migrate.ts` -- `runMigrations()` with raw SQL CREATE TABLE statements. `ensureMigrated()` ensures one-time execution.

---

## Key File Locations

### Entry Points
| File | Purpose |
|---|---|
| apps/web/app/page.tsx | Main page (client component) |
| apps/web/app/layout.tsx | Root layout |
| apps/web/app/api/chat/route.ts | Chat streaming API |
| packages/core/src/index.ts | Core package entry |
| packages/db/src/index.ts | Db package entry |

### Configuration
| File | Purpose |
|---|---|
| package.json | Root monorepo scripts |
| pnpm-workspace.yaml | Workspace definition |
| turbo.json | Build task orchestration |
| apps/web/next.config.ts | Next.js configuration |
| apps/web/tailwind.config.ts | Tailwind v3 theme |
| apps/web/vitest.config.ts | Test runner config |
| eslint.config.mjs | ESLint flat config |
| Dockerfile | Multi-stage build |
| docker-compose.yml | Dev environment |
| docker-compose.prod.yml | Production environment |
| .env.example | Environment template |

### Core Logic
| File | Purpose |
|---|---|
| packages/core/src/tools/registry.ts | Tool registration |
| packages/core/src/tools/path-security.ts | Path traversal protection |
| packages/core/src/llm/client.ts | LLM provider factory |
| packages/core/src/types.ts | Shared types |
| apps/web/lib/store.ts | Zustand state management |
| apps/web/lib/db.ts | Server DB access |
| apps/web/lib/crypto.ts | Encryption |
| packages/db/src/schema.ts | Database schema |
| packages/db/src/client.ts | DB client singleton |
| packages/db/src/migrate.ts | Migration runner |

### Testing
| File | Purpose |
|---|---|
| apps/web/vitest.config.ts | Test configuration |
| apps/web/vitest.setup.ts | Test setup (happy-dom, etc.) |
| apps/web/lib/__tests__/store.test.ts | Zustand store tests |
| apps/web/app/api/chat/__tests__/route.test.ts | Chat API route tests |

### Documentation
| File | Purpose |
|---|---|
| AGENTS.md | Agent guidance for AI tools |
| apps/web/DESIGN_SYSTEM.md | (if exists) Design system spec |
| brand-spec.md | Brand identity document |

---

## Naming Conventions

### Files
- **React components**: PascalCase (`ChatInterface.tsx`, `ChatInput.tsx`).
- **Utility modules**: camelCase (`store.ts`, `crypto.ts`, `db.ts`).
- **API routes**: kebab-case for folder names, `route.ts` for handler file (`api/chat/route.ts`, `api/sessions/[id]/messages/route.ts`).
- **Test files**: `*.test.ts` or `*.test.tsx` colocated with source (e.g., `lib/__tests__/store.test.ts`).
- **Tool definitions**: kebab-case for multi-word filenames (`file-read.ts`, `web-search.ts`, `list-directory.ts`).
- **Tool subdirectories**: kebab-case for multi-word (`execute-code/`, `terminal/`).

### Directories
- **Component categories**: lowercase, descriptive (`chat/`, `layout/`).
- **App Router**: follows Next.js conventions (`app/api/` for routes, `[id]/` for dynamic segments).
- **Package names**: `@agent-web/` scope (`@agent-web/core`, `@agent-web/db`).

### Special Patterns
- **Exports**: Named exports for components (`export function ChatInterface()`), not default exports.
- **Server-only modules**: `"server-only"` import guard at top (`apps/web/lib/db.ts`, `apps/web/lib/crypto.ts`).
- **Client components**: `"use client"` directive at top of interactive components.
- **CSS**: Global styles in `globals.css` using CSS variables. Tailwind utility classes in components. Animation classes use `animate-` prefix. Component-specific styles use descriptive class names (`.cockpit-shell`, `.command-rail-shell`, `.mission-canvas`).

---

## Where to Add New Code

### New Feature (chat-related)
Add component to `apps/web/components/chat/`, integrate into `ChatInterface` (`apps/web/components/chat/chat-interface.tsx`). If new state is needed, extend the Zustand store at `apps/web/lib/store.ts`.

### New Component (layout/shell)
Add to `apps/web/components/layout/` and import into `apps/web/app/page.tsx`.

### New Standalone Component
Add to `apps/web/components/` as a top-level file. Register in page if needed.

### New API Route
Create file at `apps/web/app/api/<name>/route.ts` following Next.js App Router conventions.

### New Tool
- Define the tool in `packages/core/src/tools/<name>.ts` using `tool()` from the `ai` SDK with a Zod parameter schema.
- If the tool needs multiple files, create a directory at `packages/core/src/tools/<name>/`.
- Register in `packages/core/src/tools/registry.ts` (add import and add to `tools` object).
- Add metadata in `packages/core/src/tools/tool-descriptions.ts`.
- Add icon mapping in `apps/web/lib/tool-icons.tsx` if it should render in the UI.

### New Database Table
- Add table definition in `packages/db/src/schema.ts` using `sqliteTable()`.
- Add migration SQL in `packages/db/src/migrate.ts`.
- Add CRUD functions in `apps/web/lib/db.ts`.
- Add API routes as needed in `apps/web/app/api/`.

### New Utility
Add to `apps/web/lib/` if client-side, or to the appropriate package (`packages/core/src/` or `packages/db/src/`) if shared.

### New LLM Provider
- Add provider config to `packages/core/src/types.ts`.
- Add provider branch in `packages/core/src/llm/client.ts`.
- Update provider list in `apps/web/components/settings-panel.tsx`.
- Update Zod enum in `apps/web/app/api/chat/route.ts`.

---

## Special Directories

| Directory | Purpose | Git |
|---|---|---|
| .next/ | Next.js build output | Ignored |
| dist/ | TypeScript build output (packages) | Ignored |
| node_modules/ | Dependencies | Ignored |
| apps/web/data/ | SQLite database files | Ignored |
| .turbo/ | Turbo cache | Ignored (staged for deletion) |
| sessions/ | Session backups | Untracked |
| assets/ | Design assets | Untracked |
| .cursor/ | Cursor IDE configuration | Untracked |
| .vscode/ | VS Code settings | Untracked |
| .planning/ | Planning artifacts (GSD workflow) | Untracked |

### Testing
| File | Purpose |
|---|---|
| apps/web/vitest.config.ts | Test configuration |
| apps/web/vitest.setup.ts | Test setup (happy-dom, etc.) |
| apps/web/lib/__tests__/store.test.ts | Zustand store tests |
| apps/web/app/api/chat/__tests__/route.test.ts | Chat API route tests |

### Documentation
| File | Purpose |
|---|---|
| AGENTS.md | Agent guidance for AI tools |
| apps/web/DESIGN_SYSTEM.md | (if exists) Design system spec |
| brand-spec.md | Brand identity document |

---

## Naming Conventions

### Files
- **React components**: PascalCase (`ChatInterface.tsx`, `ChatInput.tsx`).
- **Utility modules**: camelCase (`store.ts`, `crypto.ts`, `db.ts`).
- **API routes**: kebab-case for folder names, `route.ts` for handler file (`api/chat/route.ts`, `api/sessions/[id]/messages/route.ts`).
- **Test files**: `*.test.ts` or `*.test.tsx` colocated with source (e.g., `lib/__tests__/store.test.ts`).
- **Tool definitions**: kebab-case for multi-word filenames (`file-read.ts`, `web-search.ts`, `list-directory.ts`).
- **Tool subdirectories**: kebab-case for multi-word (`execute-code/`, `terminal/`).

### Directories
- **Component categories**: lowercase, descriptive (`chat/`, `layout/`).
- **App Router**: follows Next.js conventions (`app/api/` for routes, `[id]/` for dynamic segments).
- **Package names**: `@agent-web/` scope (`@agent-web/core`, `@agent-web/db`).

### Special Patterns
- **Exports**: Named exports for components (`export function ChatInterface()`), not default exports.
- **Server-only modules**: `"server-only"` import guard at top (`apps/web/lib/db.ts`, `apps/web/lib/crypto.ts`).
- **Client components**: `"use client"` directive at top of interactive components.
- **CSS**: Global styles in `globals.css` using CSS variables. Tailwind utility classes in components. Animation classes use `animate-` prefix. Component-specific styles use descriptive class names (`.cockpit-shell`, `.command-rail-shell`, `.mission-canvas`).

---

## Where to Add New Code

### New Feature (chat-related)
Add component to `apps/web/components/chat/`, integrate into `ChatInterface` (`apps/web/components/chat/chat-interface.tsx`). If new state is needed, extend the Zustand store at `apps/web/lib/store.ts`.

### New Component (layout/shell)
Add to `apps/web/components/layout/` and import into `apps/web/app/page.tsx`.

### New Standalone Component
Add to `apps/web/components/` as a top-level file. Register in page if needed.

### New API Route
Create file at `apps/web/app/api/<name>/route.ts` following Next.js App Router conventions.

### New Tool
- Define the tool in `packages/core/src/tools/<name>.ts` using `tool()` from the `ai` SDK with a Zod parameter schema.
- If the tool needs multiple files, create a directory at `packages/core/src/tools/<name>/`.
- Register in `packages/core/src/tools/registry.ts` (add import and add to `tools` object).
- Add metadata in `packages/core/src/tools/tool-descriptions.ts`.
- Add icon mapping in `apps/web/lib/tool-icons.tsx` if it should render in the UI.

### New Database Table
- Add table definition in `packages/db/src/schema.ts` using `sqliteTable()`.
- Add migration SQL in `packages/db/src/migrate.ts`.
- Add CRUD functions in `apps/web/lib/db.ts`.
- Add API routes as needed in `apps/web/app/api/`.

### New Utility
Add to `apps/web/lib/` if client-side, or to the appropriate package (`packages/core/src/` or `packages/db/src/`) if shared.

### New LLM Provider
- Add provider config to `packages/core/src/types.ts`.
- Add provider branch in `packages/core/src/llm/client.ts`.
- Update provider list in `apps/web/components/settings-panel.tsx`.
- Update Zod enum in `apps/web/app/api/chat/route.ts`.

---

## Special Directories

| Directory | Purpose | Git |
|---|---|---|
| .next/ | Next.js build output | Ignored |
| dist/ | TypeScript build output (packages) | Ignored |
| node_modules/ | Dependencies | Ignored |
| apps/web/data/ | SQLite database files | Ignored |
| .turbo/ | Turbo cache | Ignored (staged for deletion) |
| sessions/ | Session backups | Untracked |
| assets/ | Design assets | Untracked |
| .cursor/ | Cursor IDE configuration | Untracked |
| .vscode/ | VS Code settings | Untracked |
| .planning/ | Planning artifacts (GSD workflow) | Untracked |
