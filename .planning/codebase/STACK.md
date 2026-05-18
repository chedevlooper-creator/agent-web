# Technology Stack

**Analysis Date:** 2026-05-17

## Languages

**Primary:**
- TypeScript 5.x — all app + package code

**Other:**
- Python 3 — Docker sandbox (pandas, numpy, requests, beautifulsoup4)
- CSS — Tailwind CSS + custom tokens in `apps/web/app/globals.css`
- SQL — Drizzle ORM schema + raw SQL via `db_query` tool

## Runtime

**Environment:**
- Node.js 22 (slim) — Docker base (`FROM node:22-slim`)
- ES Modules — all packages use `"type": "module"`

**Package Manager:**
- pnpm 9.0.0 via `packageManager` in root `package.json`
- Lockfile: `pnpm-lock.yaml`
- Workspace: `apps/*`, `packages/*` in `pnpm-workspace.yaml`

## Frameworks

**Web:**
- Next.js 16.2.6 — App Router, standalone output, webpack
  - Config: `apps/web/next.config.ts` with `output: "standalone"`, `transpilePackages`, `serverExternalPackages: ["child_process", "@libsql/client"]`
- React 19.2.4 + `react-dom` 19.2.4
  - Client components via `"use client"` directive
  - Fonts: `Geist` + `Geist_Mono` from `next/font/google`

**State Management:**
- Zustand 5.0.13 — `apps/web/lib/store.ts` with optimistic updates, snapshot rollback

**AI / LLM:**
- Vercel AI SDK 4.x (`ai`, `@ai-sdk/openai`)
  - `streamText()` with tool calling (`maxSteps: 8`)
  - `tool()` from `ai` for all tool defs
  - `toDataStreamResponse()` for streaming responses
  - Custom `fetch` + `getReader()` loop client-side (no `useChat`)

**Build/Dev:**
- Turborepo 2.3.0 — `turbo.json` with `build`, `dev`, `lint`, `test` tasks
  - Package builds depend on `^build`
  - `dev` persistent with cache disabled
- TypeScript 5.x — 3 tsconfig files:
  - `apps/web`: target ES2017, bundler, React JSX, Next.js plugin
  - `packages/core`: target ES2022, bundler, emits to `dist/`
  - `packages/db`: target ES2022, bundler, emits to `dist/`

## Database

**Engine:**
- SQLite via libsql
  - Default: `file:./data/local.db`
  - Remote: libsql/Turso via `DATABASE_URL=libsql://...` + `DATABASE_AUTH_TOKEN`

**ORM:**
- Drizzle ORM 0.36.4 with `drizzle-orm/libsql`
  - Schema: `packages/db/src/schema.ts`
  - Client singleton: `packages/db/src/client.ts`
  - Migrations: `packages/db/src/migrate.ts`

**Client Library:**
- `@libsql/client` 0.14.0 — Hrana over HTTP (remote) or local file (SQLite)

## Tables (schema)

| Table | Purpose |
|-------|---------|
| `users` | Local auth: username + bcrypt hash |
| `auth_tokens` | Session tokens with expiry |
| `projects` | User projects with root path |
| `sessions` | Chat sessions per user/project |
| `messages` | Messages per session (role, content, model) |
| `api_keys` | Per-user LLM provider API keys |
| `memories` | Key-value persistent memory |
| `obsidian_config` | Per-user Obsidian vault path |

## Key Dependencies

**Critical:**
- `ai` ^4.0.0 — AI SDK core (streaming, tool calling, data stream)
- `@ai-sdk/openai` ^1.0.0 — OpenAI-compatible client (OpenAI, OpenRouter, DeepSeek)
- `next` 16.2.6 — Web framework
- `@libsql/client` ^0.14.0 — DB connectivity
- `drizzle-orm` ^0.36.4 — Type-safe SQL

**UI / Styling:**
- `tailwindcss` 3.x — Utility-first CSS
- `postcss` ^8.5.14 + `autoprefixer` ^10.5.0
- `@base-ui/react` ^1.4.1 — Radix-based headless UI
- `lucide-react` ^1.14.0 — Icons
- `class-variance-authority` ^0.7.1 — Variant class management
- `clsx` ^2.1.1 + `tailwind-merge` ^3.6.0 — Class merging
- `sonner` ^2.0.7 — Toast notifications
- `react-markdown` ^10.1.0 + `react-syntax-highlighter` ^16.1.1 — Markdown rendering

**File Processing:**
- `mammoth` ^1.12.0 — DOCX to text
- `pdf-parse` ^2.4.5 — PDF text extraction
- `xlsx` ^0.18.5 — Excel parsing

**Auth:**
- `bcryptjs` ^3.0.3 — Password hashing

**Validation:**
- `zod` ^3.23.8 — Schema validation

## Testing

**Framework:**
- Vitest 4.1.6 + `happy-dom` 20.9.0
  - `apps/web/vitest.config.ts`: React plugin, happy-dom, `@` path alias
  - `packages/core/vitest.config.ts`: Node environment
  - Pattern: `**/*.test.ts` or `**/*.test.{ts,tsx}`

**Libraries:**
- `@testing-library/react` ^16.3.2
- `@testing-library/jest-dom` ^6.9.1
- `@vitejs/plugin-react` ^6.0.2

## Linting & Formatting

**Linting:**
- ESLint 9.x — Flat config (`eslint.config.mjs`)
  - `eslint-config-next` 16.2.6 (core-web-vitals + typescript)

**Formatting:**
- Prettier ^3.3.3 — `**/*.{ts,tsx,md}`
  - No `.prettierrc` (defaults)

## Docker

**Base Image:**
- `node:22-slim`

**Dockerfile Targets (multi-stage):**
| Target | Purpose | Key Features |
|--------|---------|--------------|
| `base` | Core deps | pnpm + corepack |
| `deps` | Install all deps | Python3 + build tools |
| `builder` | Prod build | `pnpm build` |
| `development` | Dev server with watch | Docker CLI, socket mount |
| `production` | Prod server | Standalone Next.js, Docker CLI |
| `sandbox` | Isolated code exec | Python3 + pip (pandas, numpy, requests, bs4), tsx |

**Docker Compose:**
- `docker-compose.yml` — Dev: app + sandbox, named volumes, polling
- `docker-compose.prod.yml` — Prod: app + sandbox with resource limits

**Volumes:**
- Named: `node_modules`, `dist`, `.next`, `db_data`, `sandbox_workspace`
- Docker socket mounted for sandbox mgmt

## Infrastructure & CI/CD

**CI/CD:** None (no `.github/`, no CI config)
**Cloud:** Not deployed; Turso remote DB configured but optional

## Shadcn/ui Configuration

- `apps/web/components.json`
- Style: `base-nova`, icons: `lucide`
- Base color: `neutral` with CSS vars
- RSC enabled, TSX enabled

---

*Stack analysis: 2026-05-17*
