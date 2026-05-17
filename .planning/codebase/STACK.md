# STACK.md — Technology Stack Analysis

**Date:** 2026-05-17
**Author:** Automated codebase mapping
**Scope:** Full monorepo at agent-web workspace

---

## 1. Languages

TypeScript (primary, v5+): All application code across apps/web, packages/core, packages/db
JavaScript: Only tooling configs (postcss.config.mjs, eslint.config.mjs)
CSS: Tailwind v3 + CSS custom properties (dark-first "Signal Cockpit" theme)
SQL: Embedded in Drizzle ORM schema and raw migrations

---

## 2. Runtime

- Node.js: 22 (node:22-slim in Dockerfile)
- Package Manager: pnpm 9.0.0
- Module System: ESM
- TypeScript Compilation: tsc for packages, Next.js built-in for app
- Module Resolution: bundler (app), Bundler (packages)

---

## 3. Frameworks

### Core
- Next.js 16.2.6: App Router, standalone output, Webpack (Turbopack disabled)
- React 19.2.4: UI library
- Vercel AI SDK 4.x + @ai-sdk/openai 1.x: LLM streaming, tool execution

### State & Validation
- Zustand 5.x: Client state store (~840 lines in apps/web/lib/store.ts)
- Zod 3.x: Schema validation (API routes + tool parameters)

### Styling
- Tailwind CSS 3, PostCSS 8.x, Autoprefixer 10.x
- clsx + tailwind-merge: Class management
- lucide-react 1.x: Icons
- sonner 2.x: Toast notifications
- Geist font (Google Fonts)
- Design: Dark-first "Signal Cockpit" theme via CSS custom properties in globals.css

### Rendering
- react-markdown 10.x: Markdown to React
- react-syntax-highlighter 16.x: Code highlighting

### Testing
- Vitest 4.x + @vitejs/plugin-react 6.x
- happy-dom 20.x: DOM environment
- @testing-library/react 16.x + @testing-library/jest-dom 6.x

### Linting/Formatting
- ESLint 9 (flat config) with eslint-config-next 16.2.6
- Prettier 3.x

### Build & Monorepo
- Turbo 2.3.0: Task orchestration (turbo.json with build, dev, lint, test tasks)
- pnpm workspaces: apps/* + packages/*

### Docker
- 4-stage Dockerfile: base, deps, builder, development/production/sandbox
- dev: docker-compose.yml with hot reload, Docker socket, SQLite volume, sandbox
- prod: docker-compose.prod.yml with resource limits

---

## 4. Key Dependencies

### Critical (5 most important)
1. next 16.2.6 - Web framework and API routes
2. react/react-dom 19.2.4 - All UI
3. ai 4.x + @ai-sdk/openai 1.x - LLM streaming pipeline
4. drizzle-orm 0.36.x - Database ORM
5. @libsql/client 0.14.x - SQLite/Turso client

### Infrastructure (5 most important)
- zod 3.x, zustand 5.x, turbo 2.x, tailwindcss 3, typescript 5.x

### File Processing
- pdf-parse 2.x, mammoth 1.x (DOCX), xlsx 0.18.x (Excel/CSV)

---

## 5. Project Structure

```
agent-web/
  apps/web/        — Next.js 16 application
    app/api/        — 6 API routes: chat, keys, projects, sessions, upload, skills
    components/     — Chat & layout components
    lib/            — Zustand store, DB operations, crypto, rate-limit, utils
  packages/core/   — Shared LLM client, 8 tools, types
  packages/db/     — Drizzle schema, libsql client, migrations
  Dockerfile       — Multi-stage Docker build
  docker-compose.yml / docker-compose.prod.yml
  turbo.json       — Task orchestration
```

---

## 6. Configuration

### Environment Variables (from .env.example)
LLM Providers: OPENAI_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, and 7 more
Security: ENCRYPTION_KEY (AES-256-GCM)
Database: DATABASE_URL, DATABASE_AUTH_TOKEN
Terminal: TERMINAL_BACKEND (local/docker/ssh), TERMINAL_SANDBOX_CONTAINER, SSH credentials
Memory: MEMORY_CHAR_LIMIT (2200), USER_CHAR_LIMIT (1375)
Sandbox: SANDBOX_ENABLED, SANDBOX_MAX_CPU_MS (5000), SANDBOX_MAX_MEMORY_MB (256)
Other: TOOL_ALLOWED_BASE, NODE_ENV

### Build Configuration Files
10 config files: turbo.json, pnpm-workspace.yaml, next.config.ts, tailwind.config.ts, postcss.config.mjs, 3x tsconfig.json, vitest.config.ts, eslint.config.mjs

---

## 7. Platform Requirements

Dev: Node.js ^22, pnpm 9.0.0, TypeScript ^5, Docker (optional), SQLite
Prod: Node.js 22 (Docker), SQLite or Turso, Next.js standalone output
Resources: Min 1 CPU / 512MB RAM (dev), 2 CPU / 1GB RAM (prod with sandbox)

---

## 8. Dependency Graph

apps/web -> @agent-web/core (ai + zod) -> @agent-web/db (@libsql/client + drizzle-orm)

---

## 9. Tool System

8 tools registered in packages/core/src/tools/registry.ts:
1. terminal - Shell execution (local/Docker backends)
2. read_file - Read text files with line offset/limit (5MB max)
3. write_file - Create/overwrite files (1MB max)
4. web_search - DuckDuckGo HTML scrape (LRU cache, 10s timeout)
5. list_directory - List directory contents (recursive option)
6. search_files - Search by filename glob or regex content
7. web_fetch - Fetch URL, extract readable text (32K char limit)
8. execute_code - Execute JS/TS in sandboxed process

All file tools enforce path traversal protection via resolveSafePath().
