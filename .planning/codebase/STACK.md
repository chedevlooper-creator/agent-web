# Technology Stack

**Analysis Date:** 2026-05-17

## Languages

**Primary:**
- TypeScript 5.x - All application and package code (apps/web, packages/core, packages/db)

**Other:**
- Python 3 - Available in Docker sandbox container for data processing (pandas, numpy, requests, beautifulsoup4)
- CSS - Tailwind CSS with custom design tokens in `apps/web/app/globals.css`
- SQL - Drizzle ORM schema in `packages/db/src/schema.ts`, raw SQL support via `db_query` tool

## Runtime

**Environment:**
- Node.js 22 (slim) - Docker base image (`FROM node:22-slim` in `Dockerfile`)
- ES Modules - All packages use `"type": "module"`

**Package Manager:**
- pnpm 9.0.0 - Enforced via `packageManager` field in root `package.json`
- Lockfile: `pnpm-lock.yaml` (present)
- Workspace: pnpm workspaces (`apps/*`, `packages/*`) defined in `pnpm-workspace.yaml`

## Frameworks

**Web:**
- Next.js 16.2.6 - App Router, standalone output, webpack bundler
  - Config: `apps/web/next.config.ts` (not found at standard path; `next.config.ts` uses `output: "standalone"`, `transpilePackages`, `serverExternalPackages: ["child_process", "@libsql/client"]`)
- React 19.2.4 - With `react-dom` 19.2.4
  - Client components via `"use client"` directive
  - Next.js plugins for fonts: `Geist` and `Geist_Mono` from `next/font/google`

**State Management:**
- Zustand 5.0.13 - `apps/web/lib/store.ts` with optimistic updates, snapshot rollback pattern

**AI / LLM:**
- Vercel AI SDK 4.x (`ai`, `@ai-sdk/openai`)
  - `streamText()` with tool calling (`maxSteps: 8`)
  - `tool()` from `ai` for all tool definitions
  - `toDataStreamResponse()` for streaming responses
  - Custom `fetch` + `getReader()` loop client-side (no `useChat` from `ai/react`)

**Build/Dev:**
- Turborepo 2.3.0 - `turbo.json` with `build`, `dev`, `lint`, `test` task orchestration
  - Package builds depend on `^build` (dependency-first ordering)
  - `dev` is persistent with cache disabled (watch mode)
- TypeScript 5.x - Three `tsconfig.json` files:
  - `apps/web/tsconfig.json`: target ES2017, bundler module resolution, React JSX, Next.js plugin
  - `packages/core/tsconfig.json`: target ES2022, bundler module resolution, emits to `dist/`
  - `packages/db/tsconfig.json`: target ES2022, bundler module resolution, emits to `dist/`

## Database

**Engine:**
- SQLite - Embedded, zero-config database via libsql
  - Default: `file:./data/local.db`
  - Remote support: libsql/Turso via `DATABASE_URL=libsql://...` + `DATABASE_AUTH_TOKEN`

**ORM:**
- Drizzle ORM 0.36.4 with `drizzle-orm/libsql` driver
  - Schema in `packages/db/src/schema.ts`
  - Client singleton in `packages/db/src/client.ts`
  - Migration runner in `packages/db/src/migrate.ts`

**Client Library:**
- `@libsql/client` 0.14.0 - Hrana protocol over HTTP (remote) or local file (SQLite)

## Tables (schema)

| Table | Purpose |
|-------|---------|
| `users` | Local auth: username + bcrypt password hash |
| `auth_tokens` | Session tokens with expiry |
| `projects` | User projects with root path |
| `sessions` | Chat sessions per user/project |
| `messages` | Individual messages per session (role, content, model) |
| `api_keys` | Per-user LLM provider API keys |
| `memories` | Key-value persistent memory across sessions |
| `obsidian_config` | Per-user Obsidian vault path |

## Key Dependencies

**Critical:**
- `ai` ^4.0.0 - Vercel AI SDK core (streaming, tool calling, data stream protocol)
- `@ai-sdk/openai` ^1.0.0 - OpenAI-compatible provider client (used for OpenAI, OpenRouter, DeepSeek)
- `next` 16.2.6 - Web framework and server
- `@libsql/client` ^0.14.0 - Database connectivity
- `drizzle-orm` ^0.36.4 - Type-safe SQL query builder

**UI / Styling:**
- `tailwindcss` 3.x - Utility-first CSS (configured in `apps/web/tailwind.config.ts`)
- `postcss` ^8.5.14 + `autoprefixer` ^10.5.0 - PostCSS processing
- `@base-ui/react` ^1.4.1 - Radix-based headless UI primitives
- `lucide-react` ^1.14.0 - Icon library
- `class-variance-authority` ^0.7.1 - Variant-based class management
- `clsx` ^2.1.1 + `tailwind-merge` ^3.6.0 - Class merging utilities
- `sonner` ^2.0.7 - Toast notifications
- `react-markdown` ^10.1.0 + `react-syntax-highlighter` ^16.1.1 - Markdown rendering

**File Processing:**
- `mammoth` ^1.12.0 - DOCX to text conversion
- `pdf-parse` ^2.4.5 - PDF text extraction
- `xlsx` ^0.18.5 - Excel file parsing

**Auth:**
- `bcryptjs` ^3.0.3 - Password hashing

**Validation:**
- `zod` ^3.23.8 - Schema validation for tool parameters and API request bodies

## Testing

**Framework:**
- Vitest 4.1.6 - Test runner with `happy-dom` 20.9.0 for DOM emulation
  - `apps/web/vitest.config.ts` - React plugin, happy-dom environment, `@` path alias
  - `packages/core/vitest.config.ts` - Node environment
  - Test pattern: `**/*.test.ts` or `**/*.test.{ts,tsx}`

**Libraries:**
- `@testing-library/react` ^16.3.2 - Component testing
- `@testing-library/jest-dom` ^6.9.1 - Custom DOM matchers
- `@vitejs/plugin-react` ^6.0.2 - Vite React plugin for component testing

## Linting & Formatting

**Linting:**
- ESLint 9.x - Flat config (`eslint.config.mjs`)
  - `eslint-config-next` 16.2.6 (core-web-vitals + typescript presets)

**Formatting:**
- Prettier ^3.3.3 - Code formatting on `**/*.{ts,tsx,md}`
  - No `.prettierrc` config file detected (defaults used)

## Docker

**Base Image:**
- `node:22-slim` - Production and development stages

**Dockerfile Targets (multi-stage):**
| Target | Purpose | Key Features |
|--------|---------|--------------|
| `base` | Core dependencies | pnpm + corepack setup |
| `deps` | Install all dependencies | Python3 + build tools for native modules |
| `builder` | Full production build | `pnpm build` |
| `development` | Dev server with watch | Installs Docker CLI, Docker socket mount |
| `production` | Production server | Standalone Next.js, Docker CLI for sandbox |
| `sandbox` | Isolated code execution | Python3 + pip packages (pandas, numpy, requests, bs4), tsx global |

**Docker Compose:**
- `docker-compose.yml` - Development: app + sandbox service with named volumes, file watching polling
- `docker-compose.prod.yml` - Production: app + sandbox with resource limits

**Volumes:**
- Named volumes for `node_modules`, `dist`, `.next`, `db_data`, `sandbox_workspace`
- Docker socket mounted for sandbox container management (docker exec)

## Infrastructure & CI/CD

**CI/CD:**
- None detected - No `.github/` directory, no CI configuration files

**Cloud Platform:**
- Not deployed to any cloud platform detected
- Turso/libsql remote database support is configured but optional

## Shadcn/ui Configuration

- Configured in `apps/web/components.json`
- Style: `base-nova`, icon library: `lucide`
- Base color: `neutral` with CSS variables
- RSC enabled, TSX enabled

---

*Stack analysis: 2026-05-17*
