# Development

Local dev setup, monorepo commands, package workflows, extending agent with new providers and tools, DB management, Docker dev, testing, code style, debugging.

---

## Local Setup

### Prerequisites
- **Node.js** >= 20 (use `node:22-slim` in production)
- **pnpm** 9.0.0 — enable:

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

### Clone and Install

```bash
git clone <repo-url>
cd agent-web
pnpm install
```

### Configure Environment

```bash
cp .env.example .env.local
```

Set at least one LLM provider API key in `.env.local`:

```bash
OPENAI_API_KEY=sk-...
# or
OPENROUTER_API_KEY=sk-...
```

### Start Development

```bash
pnpm dev
```

Next.js dev server at [http://localhost:3000](http://localhost:3000). Turborepo runs `tsc --watch` for `packages/core` and `packages/db` in parallel with `next dev`.

---

## Monorepo Commands

Root-level commands in `package.json`, orchestrated via Turborepo:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in dev mode (Turborepo) |
| `pnpm build` | Build all packages + Next.js for production |
| `pnpm lint` | ESLint across monorepo |
| `pnpm format` | Prettier `**/*.{ts,tsx,md}` |
| `pnpm test` | All tests with Vitest |
| `pnpm docker:dev` | Start dev Docker Compose |
| `pnpm docker:dev:down` | Tear down dev Docker Compose |
| `pnpm docker:prod` | Start prod Docker Compose |
| `pnpm docker:prod:down` | Tear down prod Docker Compose |

### Per-Workspace Filtering

```bash
# Dev only web app (no package watchers)
pnpm --filter web dev

# Build only core package
pnpm --filter @agent-web/core build

# Run tests only in web app
pnpm --filter web test
```

### Turborepo Task Graph

Defined in `turbo.json`:

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "lint": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

- `build` ensures `packages/core` and `packages/db` compile before `apps/web` builds.
- `dev` depends on upstream packages built first, runs persistently with caching disabled.
- `test` depends on build completion, runs independently per package.

---

## Package Development

Both internal packages (`@agent-web/core`, `@agent-web/db`) built with `tsc`, watched with `tsc --watch`.

### @agent-web/core

**Entrypoints** (from `packages/core/package.json` `exports`):

| Import path | Resolves to |
|---|---|
| `@agent-web/core` | `./dist/index.js` (types, tool registry, context utils) |
| `@agent-web/core/tools` | `./dist/tools/registry.js` (tool definitions) |
| `@agent-web/core/types` | `./dist/types.js` (shared types) |

**Scripts:**

```bash
pnpm --filter @agent-web/core build    # tsc -p tsconfig.json
pnpm --filter @agent-web/core dev      # tsc --watch
pnpm --filter @agent-web/core clean    # rimraf dist
pnpm --filter @agent-web/core test     # vitest run
```

**TypeScript config** (`packages/core/tsconfig.json`): targets `ES2022`, outputs `dist/`, generates declarations.

### @agent-web/db

**Entrypoints** (from `packages/db/package.json` `exports`):

| Import path | Resolves to |
|---|---|
| `@agent-web/db` | `./dist/index.js` (schema, client, migrations) |
| `@agent-web/db/schema` | `./dist/schema.js` (table defs only) |
| `@agent-web/db/client` | `./dist/client.js` (libsql singleton) |

**Scripts:**

```bash
pnpm --filter @agent-web/db build    # tsc -p tsconfig.json
pnpm --filter @agent-web/db dev      # tsc --watch
pnpm --filter @agent-web/db clean    # rimraf dist
```

### How Next.js Consumes Them

`apps/web/next.config.ts` uses `transpilePackages: ["@agent-web/core", "@agent-web/db"]` so compiled `dist/` output is transpiled by Next.js webpack for browser compat.

---

## Adding a New LLM Provider

Requires changes in three places:

### 1. Environment Variable

Add API key var to `.env.example`:

```bash
# MyProvider
MYPROVIDER_API_KEY=
```

Add to `apps/web/app/api/chat/route.ts` in `getServerApiKey()`:

```typescript
if (provider === "myprovider") {
  return process.env.MYPROVIDER_API_KEY || null;
}
```

### 2. Provider Client Initialization

In `POST` handler of `apps/web/app/api/chat/route.ts`, add branch:

```typescript
} else if (provider === "myprovider") {
  client = createOpenAI({
    apiKey,
    baseURL: "https://api.myprovider.com/v1",
  })(model);
}
```

If provider needs custom fetch handling (e.g., DeepSeek thinking-mode suppression), pass `fetch` wrapper.

### 3. UI Provider Selector

Add provider to settings panel in `apps/web/components/settings-panel.tsx`.

---

## Adding a New Tool

Three-step process.

### Step 1: Create Tool File

Create `packages/core/src/tools/<name>.ts`. Use `tool()` from `ai` SDK v4 with Zod param schema:

```typescript
import { tool } from "ai";
import { z } from "zod";

export const myTool = tool({
  description: "What this tool does in natural language.",
  parameters: z.object({
    input: z.string().describe("Description of this parameter"),
  }),
  execute: async ({ input }) => {
    // Implementation here
    return `Result: ${input}`;
  },
});
```

For multi-file tools (e.g., terminal: `index.ts`, `local.ts`, `docker.ts`), create subdirectory: `packages/core/src/tools/<name>/index.ts`.

### Step 2: Register in Registry

Open `packages/core/src/tools/registry.ts`:

1. Import tool:
```typescript
import { myTool } from "./my-tool.js";
```

2. Add to `tools` object:
```typescript
export const tools = {
  // ... existing tools
  my_tool: myTool,
} as const;
```

Key name (`my_tool`) is snake_case name LLM will call.

### Step 3: Add Description (Optional)

Add to `packages/core/src/tools/tool-descriptions.ts`:

```typescript
my_tool: {
  name: "My Tool",
  description: "Brief description shown in UI",
  status: "active" as const,
},
```

### Step 4: Re-export

`tools` object already exported from `packages/core/src/index.ts` via `export * from "./tools/registry.js"`. New tools auto-available to consumers importing from `@agent-web/core`.

---

## Working with Database

### Schema

All table defs in `packages/db/src/schema.ts`. Tables defined with Drizzle ORM's `sqliteTable()`:

- **projects** — Project groupings with user ownership
- **sessions** — Chat sessions tied to user, optionally project
- **messages** — Chat messages (cascade-deletes with sessions)
- **users** — User accounts (username + bcrypt password hash)
- **auth_tokens** — Session tokens with expiry
- **api_keys** — Per-user, per-provider API keys (composite PK on provider + user_id)
- **memories** — Key-value persistent memory
- **obsidian_config** — Obsidian vault path per user

### Migrations

Raw SQL in `packages/db/src/migrate.ts`. Run automatically on first DB access via `ensureMigrated()`, called from `apps/web/lib/db.ts`:

```typescript
async function ready() {
  if (!migrationPromise) {
    migrationPromise = ensureMigrated();
  }
  await migrationPromise;
}
```

Migrations **idempotent** — use `CREATE TABLE IF NOT EXISTS` and try/catch for additive schema changes.

**Add new migration:**
1. Add `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE` SQL to `packages/db/src/migrate.ts`.
2. For additive changes (new columns), use try/catch.
3. Restart server — migrations run on next DB access.

### Database Reset

Delete SQLite DB file and restart. Default: `apps/web/data/local.db` (or `packages/db/data/local.db` in Docker). Migrations run on next startup.

```bash
# Local dev
rm apps/web/data/local.db

# Docker (WSL/Linux)
docker compose down -v  # removes named volume
pnpm docker:dev
```

### Using Drizzle ORM for Queries

```typescript
import { getDb, sessions, messages } from "@agent-web/db";
import { eq, desc } from "drizzle-orm";

const db = getDb();
const rows = await db
  .select()
  .from(sessions)
  .where(eq(sessions.userId, userId))
  .orderBy(desc(sessions.updatedAt));
```

---

## Docker Development Workflow

### Development Compose

`docker-compose.yml` starts 2 services:

1. **`app`** — Builds from `Dockerfile` with `target: development`. Mounts source for hot reload, Docker socket for sandbox, named volumes for `node_modules`, `dist/`, `.next/`, DB persistence.
2. **`sandbox`** (profile-gated) — Isolated code execution with Python 3 + Node.js. Enable:

```bash
docker compose --profile sandbox up -d
```

### Key Commands

```bash
# Start full dev environment
pnpm docker:dev

# Start with sandbox
docker compose --profile sandbox up -d

# View logs
docker compose logs -f app

# Rebuild without cache
docker compose build --no-cache app

# Tear down (preserves volumes)
pnpm docker:dev:down

# Tear down and delete volumes (full reset)
docker compose down -v
```

### Development Environment Overrides

- `DATABASE_URL=file:./packages/db/data/local.db` — SQLite path inside container
- `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true` — File watching in Docker volumes
- `HOSTNAME=0.0.0.0` — Bind all interfaces

### Dev Entrypoint

`docker/entrypoint.dev.sh` runs on container start:
1. Creates DB directory
2. Runs DB migrations
3. Pre-builds workspace packages (`dist/` must exist for workspace links)
4. Starts dev server

---

## Testing

### Framework

**Vitest v4** for all testing.

**`apps/web`** (component + unit):
- Environment: `happy-dom`
- Plugin: `@vitejs/plugin-react` for JSX transform
- Setup: `vitest.setup.ts` — localStorage mock for Zustand persist middleware, blocks `/api/*` fetch calls during tests
- Config: `apps/web/vitest.config.ts` — maps `@` and workspace package aliases to `src/` dirs (avoiding build step)

**`packages/core`** (unit):
- Environment: `node`
- Pattern: `src/**/*.test.ts`
- Config: `packages/core/vitest.config.ts`

### Running Tests

```bash
# All tests (monorepo)
pnpm test

# Web app tests only
pnpm --filter web test

# Core package tests
pnpm --filter @agent-web/core test

# Watch mode
pnpm --filter web test:watch

# Coverage report
pnpm --filter web test:coverage
```

### Writing Tests

File naming: `*.test.ts` or `*.test.tsx`.

Component tests use React Testing Library:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MyComponent from "./my-component";

describe("MyComponent", () => {
  it("renders heading", () => {
    render(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

Export test utilities from `vitest.setup.ts` to share mocks (localStorage polyfill, API-call blocker).

### What Tests Exist

Core package tests cover context compression module (`context.ts`):
- `countTokens()` — char-based token estimation
- `countMessagesTokens()` — message array token counting
- `trimToTokenLimit()` — sliding-window trimming with system prompt preservation
- `getContextThreshold()` — env var parsing

---

## Code Style

### ESLint v9 (Flat Config)

Config: `apps/web/eslint.config.mjs`

Uses `defineConfig` with `eslint-config-next`:
- `core-web-vitals` — Next.js recommended rules
- `typescript` — TypeScript-aware rules

Ignored: `.next/`, `out/`, `build/`, `next-env.d.ts`

```bash
# Lint web app
pnpm --filter web lint

# Lint everything (root task)
pnpm lint
```

### Prettier

No `.prettierrc` — default Prettier v3.3.3 settings.

```bash
pnpm format
```

### TypeScript
- **Strict mode** in all `tsconfig.json`.
- `apps/web` targets `ES2017` with `moduleResolution: "bundler"`.
- Packages target `ES2022` with `moduleResolution: "Bundler"`, generate declarations.
- Internal workspace packages use `"@agent-web/*"` import paths resolved via Next.js `transpilePackages`.

### Git Conventions
- Branch naming: `feat/`, `fix/`, `chore/`, `docs/`.
- Commits descriptive of change.
- Run `pnpm lint` and `pnpm test` before pushing.

### PR Process
1. Create feature branch from `main`.
2. Make changes, keep commits focused.
3. Run `pnpm lint` and `pnpm test`.
4. Push branch, open PR against `main`.
5. Ensure CI passes (lint, build, test).
6. Request review from maintainer. Address feedback with additional commits.
7. Squash-merge into `main`.

No formal PR template or CONTRIBUTING.md yet — include summary of changes, new config steps, UI screenshots.

---

## Debugging Tips

### Server-Side Debugging

**Verbose logging:**

```bash
# Set in .env.local or Docker Compose
NODE_ENV=development
# Default — enables detailed error pages
```

**Inspect streaming chat responses:**

Add temporary logging to `apps/web/app/api/chat/route.ts` around `streamText()`:

```typescript
console.log("Sending to LLM:", JSON.stringify({ provider, model, messageCount: allMessages.length, tokenCount }));
```

**DB query logging:**

Enable libsql logging by adding `{ log: true }` when creating client in `packages/db/src/client.ts`.

### Client-Side Debugging

**Zustand devtools:**

Store in `apps/web/lib/store.ts` inspectable in browser console:

```javascript
// Access store state (requires attaching to window)
// Add to store file: (window as any).__store = useChatStore
```

**Stream parsing:**

Add `console.log` inside `streamChat()` in `apps/web/components/chat/chat-interface.tsx` to see raw data stream lines and parsed text/tool-call chunks.

**React re-render debugging:**

`patchLocalMessage()` uses `requestAnimationFrame`-based coalescing for streaming updates. If UI jank occurs during streaming, check coalescing with render counter or React DevTools.

### Common Issues

**"Cannot find module '@agent-web/core'"**
Build package: `pnpm --filter @agent-web/core build`. Turborepo `dev` task handles this automatically, but clean build may be needed after switching branches.

**"Module not found: Can't resolve 'fs'" in browser**
Server-only module leaked into client bundle. Check `next.config.ts` webpack `resolve.fallback` block. If adding new deps, verify marked in `serverExternalPackages` if containing native modules.

**"Must be passed back" error with DeepSeek**
DeepSeek returns `reasoning_content` fields causing errors in multi-step tool calls. Fetch wrapper in `apps/web/app/api/chat/route.ts` auto-disables thinking mode and strips these fields from message history.

**"EACCES: permission denied" for Docker socket**
Ensure user in `docker` group or running with appropriate permissions.

**Slow file watching in Docker**
File events don't propagate reliably inside Docker volumes on Windows/macOS. Compose sets `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true` for polling-based watching.

**Port 3000 already in use**
Kill existing process or change port:

```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Run on different port
$env:PORT=3001; pnpm dev
```
