# AGENTS.md

This file provides guidance to Verdent when working with code in this repository.

## Table of Contents
1. Commonly Used Commands
2. High-Level Architecture & Structure
3. Key Rules & Constraints
4. Development Hints

## Commands

- `pnpm dev` — Start the Next.js dev server (with Turbo)
- `pnpm build` — Build all packages and the Next.js app for production
- `pnpm lint` — Run ESLint across the monorepo
- `pnpm format` — Run Prettier on `**/*.{ts,tsx,md}`
- `pnpm docker:dev` — Run the development environment in Docker Compose
- `pnpm docker:prod` — Run the production environment in Docker Compose
- `pnpm --filter @agent-web/core build` — Build the core package
- `pnpm --filter @agent-web/db build` — Build the db package
- `pnpm --filter @agent-web/db db:push` — Push Drizzle schema to SQLite
- `pnpm --filter @agent-web/db db:studio` — Open Drizzle Studio

## Architecture

- **Monorepo layout**: pnpm workspaces (`apps/*`, `packages/*`) orchestrated by Turbo.
- **`apps/web`**: Next.js 16 App Router application. No `src/` folder; pages and API routes live directly under `app/`.
- **`packages/core`**: Shared LLM client, tool registry, and TypeScript types. Built with `tsc` to `dist/`.
- **`packages/db`**: Drizzle ORM schema and libsql client. Built with `tsc` to `dist/`.

### Key Data Flows

1. **Chat Request/Response**:
   - `ChatInterface` (client) -> `useChatStore` (Zustand, persisted to `localStorage`) -> POST `/api/chat` -> `streamText` (AI SDK v4) -> Vercel AI SDK data stream -> client manually parses stream chunks (`0:` text, `3:` error, `d:` done) and updates Zustand state.
   - [inferred] The frontend does **not** use `useChat` from `ai/react`; it uses a custom fetch + `getReader()` loop.

2. **Tool System**:
   - Tools are declared in `packages/core/src/tools/*.ts` and registered in `packages/core/src/tools/registry.ts`.
   - The API route (`app/api/chat/route.ts`) currently injects **stubbed/disabled** tool implementations for security. The real handlers exist in `packages/core` but are not wired into the route.

3. **Database**:
   - SQLite via libsql (`local.db` by default). Schema defines `sessions` and `messages` tables.
   - [inferred] The DB schema and client are set up, but the app currently stores chat history client-side in Zustand/localStorage and does **not** persist to the database.

### External Dependencies

- Next.js 16.2.6, React 19.2.4
- AI SDK v4 (`ai`, `@ai-sdk/openai`)
- Zustand v5 (client state)
- Drizzle ORM v0.36 + `@libsql/client`
- Tailwind CSS v4 + `@tailwindcss/postcss`
- shadcn/ui (base-nova style, `components.json` configured)
- `react-markdown`, `react-syntax-highlighter` for message rendering

### Development Entry Points

- Web app: `apps/web/app/page.tsx`
- API route: `apps/web/app/api/chat/route.ts`
- LLM client: `packages/core/src/llm/client.ts`
- Tool registry: `packages/core/src/tools/registry.ts`
- DB schema: `packages/db/src/schema.ts`
- Zustand store: `apps/web/lib/store.ts`

### Mermaid Diagram

```mermaid
graph TD
    A[Browser: ChatInterface] -->|POST /api/chat| B[Next.js API Route]
    B --> C[packages/core LLM Client]
    C --> D[AI SDK v4 streamText]
    D --> E[OpenAI / OpenRouter / OpenCode]
    E -->|Data Stream| D --> B --> A
    C --> F[Tool Registry]
    F --> G[Terminal Tool]
    F --> H[File Tools]
    F --> I[Web Tools]
    A --> J[Zustand Store]
    J --> K[(localStorage)]
    L[packages/db] --> M[(SQLite / libsql)]
```

## Key Rules & Constraints

- **Package manager**: pnpm@9.0.0 (enforced via `packageManager` field).
- **Next.js 16 breaking changes**: This version has breaking API and convention changes vs. older Next.js versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices. (See also `apps/web/AGENTS.md`.)
- **No `src/` in `apps/web`**: The Next.js app uses the App Router directly under `app/`, `components/`, `lib/`, etc.
- **Packages must be built**: `@agent-web/core` and `@agent-web/db` are transpiled via `tsc` and consumed via `transpilePackages` in `next.config.ts`. Always build packages before the web app builds, or run `tsc --watch` in dev.
- **Standalone output**: `next.config.ts` sets `output: "standalone"`. The production Docker image copies the standalone server bundle.
- **Server externals**: `next.config.ts` marks `child_process` and `@libsql/client` as `serverExternalPackages`.
- **Tailwind v4**: Configured in `postcss.config.mjs` with `@tailwindcss/postcss`. No traditional `tailwind.config.js`.
- **ESLint**: Uses the new ESLint v9 flat config (`eslint.config.mjs`) with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- **Docker targets**: The `Dockerfile` has three targets: `development`, `production`, and `sandbox` (isolated Python environment for code execution).
- **Design system**: Follow `apps/web/DESIGN_SYSTEM.md` for colors, spacing, and animation specs. Dark-first design with glassmorphism accents.

## Development Hints

- **Adding a new LLM provider**:
  1. Add provider config to `packages/core/src/types.ts`.
  2. Add provider branch in `packages/core/src/llm/client.ts` using `createOpenAI({ baseURL: ... })`.
  3. Update the provider list in `apps/web/components/settings-panel.tsx`.
  4. Update the API route (`apps/web/app/api/chat/route.ts`) to accept the new provider.

- **Adding a new tool**:
  1. Define the tool in `packages/core/src/tools/` (e.g., `my-tool.ts`) following the `Tool` interface.
  2. Register it in `packages/core/src/tools/registry.ts`.
  3. [inferred] To actually enable it, wire the handler into `apps/web/app/api/chat/route.ts` (currently tools are stubbed there).

- **Enabling database persistence**:
  - The DB client and schema are ready in `packages/db`. To persist chats, replace or extend the Zustand store in `apps/web/lib/store.ts` to read/write via the DB client, or expose tRPC/API routes for CRUD operations.

- **Running in Docker on Windows/macOS**:
  - The dev compose file sets `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true` so file watching works inside bind mounts.

- **Working with deleted files**:
  - [inferred] A large number of source files were deleted from the working tree but remain in Git history. If you need to reference or restore them, use `git show HEAD:<path>`.
