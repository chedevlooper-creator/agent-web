<!-- generated-by: gsd-doc-writer -->

# Development

This guide covers local development setup, monorepo commands, package workflows, extending the agent with new providers and tools, database management, Docker development, testing, code style, and debugging tips for the Agent Web monorepo.

---

## Local Setup

### Prerequisites

- **Node.js** >= 20 (use `node:22-slim` in production)
- **pnpm** 9.0.0 — enable with:

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

At minimum, set one LLM provider API key in `.env.local`:

```bash
OPENAI_API_KEY=sk-...
# or
OPENROUTER_API_KEY=sk-...
```

### Start Development

```bash
pnpm dev
```

The Next.js dev server starts at [http://localhost:3000](http://localhost:3000). Turborepo runs `tsc --watch` for `packages/core` and `packages/db` in parallel with `next dev`.

---

## Monorepo Commands

All root-level commands are defined in `package.json` and orchestrated via Turborepo:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in dev mode (Turborepo) |
| `pnpm build` | Build all packages + Next.js for production |
| `pnpm lint` | Run ESLint across the monorepo |
| `pnpm format` | Format all TypeScript/Markdown files with Prettier |
| `pnpm test` | Run all tests with Vitest |
| `pnpm docker:dev` | Start development Docker Compose environment |
| `pnpm docker:dev:down` | Tear down development Docker Compose |
| `pnpm docker:prod` | Start production Docker Compose environment |
| `pnpm docker:prod:down` | Tear down production Docker Compose |

### Per-Workspace Filtering

Target a specific workspace with `--filter`:

```bash
# Dev only the web app (no package watchers)
pnpm --filter web dev

# Build only the core package
pnpm --filter @agent-web/core build

# Run tests only in the web app
pnpm --filter web test
```

### Turborepo Task Graph

Defined in `turbo.json` (`5:18:C:\Users\isaha\OneDrive\Desktop\agent-web\turbo.json`):

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

- `build` ensures `packages/core` and `packages/db` are compiled before `apps/web` builds.
- `dev` depends on upstream packages being built first, then runs persistently with caching disabled.
- `test` depends on build completion but runs independently per package.

---

## Package Development

Both internal packages (`@agent-web/core` and `@agent-web/db`) are built with `tsc` and watched with `tsc --watch`.

### @agent-web/core

**Entrypoints** (from `packages/core/package.json` `exports`):

| Import path | Resolves to |
|-------------|-------------|
| `@agent-web/core` | `./dist/index.js` (types, tool registry, context utils) |
| `@agent-web/core/tools` | `./dist/tools/registry.js` (tool definitions) |
| `@agent-web/core/types` | `./dist/types.js` (shared type definitions) |

**Scripts:**

```bash
pnpm --filter @agent-web/core build    # tsc -p tsconfig.json
pnpm --filter @agent-web/core dev      # tsc --watch
pnpm --filter @agent-web/core clean    # rimraf dist
pnpm --filter @agent-web/core test     # vitest run
```

**TypeScript config** (`packages/core/tsconfig.json`): targets `ES2022`, outputs to `dist/`, generates declarations.

### @agent-web/db

**Entrypoints** (from `packages/db/package.json` `exports`):

| Import path | Resolves to |
|-------------|-------------|
| `@agent-web/db` | `./dist/index.js` (schema, client, migrations) |
| `@agent-web/db/schema` | `./dist/schema.js` (table definitions only) |
| `@agent-web/db/client` | `./dist/client.js` (libsql singleton) |

**Scripts:**

```bash
pnpm --filter @agent-web/db build    # tsc -p tsconfig.json
pnpm --filter @agent-web/db dev      # tsc --watch
pnpm --filter @agent-web/db clean    # rimraf dist
```

### How Next.js Consumes Them

`apps/web/next.config.ts` uses `transpilePackages: ["@agent-web/core", "@agent-web/db"]` so the compiled `dist/` output is transpiled by Next.js webpack for browser compatibility.

---

## Adding a New LLM Provider

Adding a new LLM provider requires changes in three places:

### 1. Environment Variable

Add the API key variable to `.env.example`:

```bash
# MyProvider
MYPROVIDER_API_KEY=
```

Also add it to `apps/web/app/api/chat/route.ts` in the `getServerApiKey()` function:

```typescript
if (provider === "myprovider") {
  return process.env.MYPROVIDER_API_KEY || null;
}
```

### 2. Provider Client Initialization

In the `POST` handler of `apps/web/app/api/chat/route.ts`, add a branch for the new provider. Most providers support the OpenAI-compatible API via `@ai-sdk/openai`'s `createOpenAI`:

```typescript
} else if (provider === "myprovider") {
  client = createOpenAI({
    apiKey,
    baseURL: "https://api.myprovider.com/v1",
  })(model);
}
```

If the provider requires custom fetch handling (e.g., DeepSeek's thinking-mode suppression), pass a `fetch` wrapper as the third option.

### 3. UI Provider Selector

Add the provider to the settings panel in `apps/web/components/settings-panel.tsx` so users can select it from the dropdown.

---

## Adding a New Tool

Each tool follows the same three-step process.

### Step 1: Create the Tool File

Create `packages/core/src/tools/<name>.ts`. Use the `tool()` function from the `ai` SDK v4 with a Zod parameter schema:

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

If the tool needs multiple files (e.g., terminal has `index.ts`, `local.ts`, `docker.ts`), create a subdirectory: `packages/core/src/tools/<name>/index.ts`.

### Step 2: Register in the Registry

Open `packages/core/src/tools/registry.ts` and:

1. Import the tool at the top:

```typescript
import { myTool } from "./my-tool.js";
```

2. Add it to the `tools` object:

```typescript
export const tools = {
  // ... existing tools
  my_tool: myTool,
} as const;
```

The key name (`my_tool`) is the snake_case name the LLM will call.

### Step 3: Add Description (Optional but Recommended)

Add a user-facing description to `packages/core/src/tools/tool-descriptions.ts`:

```typescript
my_tool: {
  name: "My Tool",
  description: "A brief description shown in the UI",
  status: "active" as const,
},
```

### Step 4: Re-export (If Needed)

The `tools` object is already exported from `packages/core/src/index.ts` via `export * from "./tools/registry.js"`, so new tools are automatically available to consumers importing from `@agent-web/core`.

---

## Working with the Database

### Schema

All table definitions live in `packages/db/src/schema.ts`. Tables are defined with Drizzle ORM's `sqliteTable()`:

- **projects** — Project groupings with user ownership
- **sessions** — Chat sessions tied to a user and optionally a project
- **messages** — Individual chat messages (cascade-deletes with sessions)
- **users** — User accounts (username + bcrypt password hash)
- **auth_tokens** — Session tokens with expiry
- **api_keys** — Per-user, per-provider API keys (composite PK on provider + user_id)
- **memories** — Key-value persistent memory
- **obsidian_config** — Obsidian vault path per user

### Migrations

Migrations are raw SQL in `packages/db/src/migrate.ts`. They run automatically on first database access via `ensureMigrated()`, which is called from `apps/web/lib/db.ts`:

```typescript
async function ready() {
  if (!migrationPromise) {
    migrationPromise = ensureMigrated();
  }
  await migrationPromise;
}
```

Migrations are **idempotent** — they use `CREATE TABLE IF NOT EXISTS` and try/catch for additive schema changes (e.g., adding columns).

**To add a new migration:**

1. Add a `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE` SQL statement to `packages/db/src/migrate.ts`.
2. For additive changes (new columns), use try/catch to handle the case where the column already exists.
3. Restart the server — migrations run on next DB access.

### Database Reset

Delete the SQLite database file and restart the server. The default location is `apps/web/data/local.db` (or `packages/db/data/local.db` when running in Docker). Migrations run automatically on next startup.

```bash
# Local development
rm apps/web/data/local.db

# Docker (WSL/Linux)
docker compose down -v  # removes the named volume
pnpm docker:dev
```

### Using Drizzle ORM for Queries

Import the schema and client in your API routes:

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

`docker-compose.yml` starts two services:

1. **`app`** — Builds from `Dockerfile` with `target: development`. Mounts source code for hot reload, Docker socket for sandbox access, and named volumes for `node_modules`, `dist/`, `.next/`, and database persistence.
2. **`sandbox`** (profile-gated) — Isolated code execution container with Python 3 and Node.js. Not started by default. Enable with:

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

The Docker Compose environment sets these overrides for local development:

- `DATABASE_URL=file:./packages/db/data/local.db` — SQLite path inside the container
- `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true` — File watching in Docker volumes
- `HOSTNAME=0.0.0.0` — Bind to all interfaces

### Dev Entrypoint

The `docker/entrypoint.dev.sh` script runs on container start:

1. Creates the database directory
2. Runs database migrations
3. Pre-builds workspace packages (`dist/` must exist for workspace links)
4. Starts the dev server

---

## Testing

### Framework

The project uses **Vitest v4** for all testing.

**`apps/web`** (component + unit tests):
- Environment: `happy-dom` (lightweight DOM simulation)
- Plugin: `@vitejs/plugin-react` for JSX transform
- Setup: `vitest.setup.ts` provides a `localStorage` mock for Zustand persist middleware and blocks real `/api/*` fetch calls during tests
- Config: `apps/web/vitest.config.ts` — maps `@` and workspace package aliases directly to `src/` directories (avoiding build step for tests)

**`packages/core`** (unit tests):
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

File naming convention: `*.test.ts` or `*.test.tsx` (configured in Vitest config).

Component tests use React Testing Library:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MyComponent from "./my-component";

describe("MyComponent", () => {
  it("renders the heading", () => {
    render(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

Export test utilities from the `vitest.setup.ts` to share mocks across test files (e.g., the `localStorage` polyfill and API-call blocker).

### What Tests Exist

The core package tests cover the context compression module (`context.ts`), including:

- `countTokens()` — character-based token estimation
- `countMessagesTokens()` — message array token counting
- `trimToTokenLimit()` — sliding-window trimming with system prompt preservation
- `getContextThreshold()` — environment variable parsing

---

## Code Style

### ESLint v9 (Flat Config)

Config file: `apps/web/eslint.config.mjs`

Uses ESLint v9's `defineConfig` with `eslint-config-next`:

- `core-web-vitals` — Next.js recommended rules for performance and correctness
- `typescript` — TypeScript-aware rules

Ignored paths: `.next/`, `out/`, `build/`, `next-env.d.ts`

```bash
# Lint the web app
pnpm --filter web lint

# Lint everything (root task)
pnpm lint
```

### Prettier

No `.prettierrc` file — default Prettier v3.3.3 settings apply.

```bash
# Format all TypeScript, TSX, and Markdown files
pnpm format
```

### TypeScript

- **Strict mode** is enabled in all `tsconfig.json` files.
- `apps/web` targets `ES2017` with `moduleResolution: "bundler"`.
- Packages target `ES2022` with `moduleResolution: "Bundler"` and generate declarations.
- Internal workspace packages use `"@agent-web/*"` import paths resolved via Next.js `transpilePackages`.

### Git Conventions

- Branch naming follows conventional patterns: `feat/`, `fix/`, `chore/`, `docs/`.
- Commit messages should be descriptive of the change.
- Run `pnpm lint` and `pnpm test` before pushing.

### PR Process

1. Create a feature branch from `main`.
2. Make changes, keeping commits focused and well-described.
3. Run `pnpm lint` and `pnpm test` to verify nothing is broken.
4. Push the branch and open a pull request against `main`.
5. Ensure CI passes (lint, build, and test checks).
6. Request review from a maintainer. Address feedback with additional commits.
7. Once approved, squash-merge into `main`.

No formal pull request template or CONTRIBUTING.md exists yet — include a summary of changes, any new configuration steps, and screenshots for UI changes when opening a PR.

---

## Debugging Tips

### Server-Side Debugging

**Enable verbose logging:**

```bash
# Set in .env.local or Docker Compose
NODE_ENV=development
# Already the default — enables detailed error pages
```

**Inspect streaming chat responses:**

Add temporary logging to `apps/web/app/api/chat/route.ts` around the `streamText()` call to inspect the messages being sent to the LLM:

```typescript
console.log("Sending to LLM:", JSON.stringify({ provider, model, messageCount: allMessages.length, tokenCount }));
```

**Database queries logging:**

Temporarily enable libsql logging by adding `{ log: true }` when creating the client in `packages/db/src/client.ts`.

### Client-Side Debugging

**Zustand devtools:**

The Zustand store in `apps/web/lib/store.ts` can be inspected in the browser console:

```javascript
// Access store state (requires attaching to window)
// Add to store file: (window as any).__store = useChatStore
```

**Streaming parsing:**

Add `console.log` inside the `streamChat()` function in `apps/web/components/chat/chat-interface.tsx` to see raw data stream lines and the parsed text/tool-call chunks.

**React re-render debugging:**

The `patchLocalMessage()` function uses `requestAnimationFrame`-based coalescing to batch streaming updates. If experiencing UI jank during streaming, check that coalescing is working by adding a render counter or profiling with React DevTools.

### Common Issues

**"Cannot find module '@agent-web/core'"**
Ensure the package is built: `pnpm --filter @agent-web/core build`. Turborepo's `dev` task should handle this automatically, but a clean build may be needed after switching branches.

**"Module not found: Can't resolve 'fs'" in browser**
This means a server-only module leaked into the client bundle. Check `next.config.ts` — the webpack `resolve.fallback` block should handle this. If adding new dependencies, verify they are marked in `serverExternalPackages` if they contain native modules.

**"Must be passed back" error with DeepSeek**
DeepSeek returns `reasoning_content` fields that cause errors in multi-step tool calls. The fetch wrapper in `apps/web/app/api/chat/route.ts` auto-disables thinking mode and strips these fields from message history.

**"EACCES: permission denied" for Docker socket**
Ensure your user is in the `docker` group or running with appropriate permissions.

**Slow file watching in Docker**
File system events don't propagate reliably inside Docker volumes on Windows/macOS. The Compose file sets `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true` to use polling-based file watching.

**Port 3000 already in use**
Either kill the existing process or change the port:

```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Run on different port
$env:PORT=3001; pnpm dev
```
