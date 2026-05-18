<!-- generated-by: gsd-doc-writer -->

# Configuration

This document describes all configuration options for Agent Web, a Next.js 16 monorepo AI agent. Configuration is managed through environment variables, framework config files, per-package TypeScript configs, Docker Compose profiles, and code-level tool sandboxing.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. Most variables have sensible defaults for local development.

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes \* | — | OpenAI API key. Used when provider is `openai`. |
| `OPENROUTER_API_KEY` | Yes \* | — | OpenRouter API key. Used when provider is `openrouter`. |
| `DEEPSEEK_API_KEY` | — | — | DeepSeek API key. Used when provider is `deepseek`. |
| `ENCRYPTION_KEY` | Yes (prod) | — | 32-byte hex key for encrypting API keys at rest. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. A dev-only fallback is used if not set (**insecure for production**). |
| `DATABASE_URL` | — | `file:./data/local.db` | SQLite database path. For Turso/libsql remote: `libsql://your-db-url.turso.io`. |
| `DATABASE_AUTH_TOKEN` | — | — | Auth token for remote libsql/Turso databases. |
| `TERMINAL_BACKEND` | — | `local` | Terminal execution backend: `local` (direct with safety blocklist) or `docker` (isolated sandbox container). |
| `TERMINAL_SANDBOX_CONTAINER` | — | `agent-web-sandbox` | Docker sandbox container name when `TERMINAL_BACKEND=docker`. |
| `ENABLE_MEMORY` | — | `false` | Set to `true` to enable persistent key-value memory across sessions. |
| `MEMORY_CHAR_LIMIT` | — | `2200` | Maximum characters of memory content injected into the system prompt. |
| `CONTEXT_COMPRESSION_THRESHOLD` | — | `80000` | Token threshold for context trimming. Messages beyond this are trimmed using a sliding window (preserving system prompt + first user message + most recent messages). |
| `OBSIDIAN_VAULT_PATH` | — | — | Path to an Obsidian vault for chat session syncing. Leave empty to disable auto-sync. |
| `NODE_ENV` | — | `development` | Node environment (`development`, `production`, or `test`). |
| `TOOL_ALLOWED_BASE` | — | `process.cwd()` | Override the allowed base directory for file tool operations (not recommended for production). |
| `SKILLS_DIR` | — | `.verdent/skills` | Directory where SKILL.md files are stored for the skills system. |
| `USER_CHAR_LIMIT` | — | `1375` | Character limit for user input in the system prompt (set in Docker Compose). |

\* At least one LLM provider key (`OPENAI_API_KEY` or `OPENROUTER_API_KEY`) is required.

### Provider-specific Environment Variables

The chat API route (`apps/web/app/api/chat/route.ts`) reads provider API keys from environment variables and validates them:

- **OpenAI**: `opensource` — uses `createOpenAI({ apiKey })` with the default base URL.
- **OpenRouter**: uses `baseURL: "https://openrouter.ai/api/v1"`.
- **DeepSeek**: uses `baseURL: "https://api.deepseek.com"` with a fetch wrapper that disables thinking mode to prevent `reasoning_content` errors in multi-step tool calls. <!-- VERIFY: DeepSeek base URL and fetch wrapper remain correct if API changes -->

If no API key is configured for the requested provider, the API returns a `401` response with a message indicating which environment variable to set.

---

## Next.js Configuration

**File:** `apps/web/next.config.ts`

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@agent-web/core", "@agent-web/db"],
  serverExternalPackages: ["@libsql/client", "pdf-parse", "mammoth", "xlsx"],
};
```

Key settings:

- **`output: "standalone"`** — Produces a standalone server bundle for Docker/production. After `next build`, the output in `.next/standalone/` contains all needed files including `node_modules`.
- **`transpilePackages`** — Forces Next.js to transpile the two workspace packages (`@agent-web/core`, `@agent-web/db`) which are built with `tsc`. This ensures browser-compatible output.
- **`serverExternalPackages`** — Marks packages with native modules or server-only APIs as external so they are not bundled by Webpack: `@libsql/client` (native SQLite bindings), `pdf-parse`, `mammoth`, `xlsx` (large parsers).
- **Webpack config** — Uses `NormalModuleReplacementPlugin` to strip `node:` prefixes from imports (needed for Webpack compatibility). On the client side, over 20 Node.js built-in modules (`child_process`, `fs`, `path`, `os`, `crypto`, etc.) are replaced with empty stubs via `resolve.fallback` to prevent server-only deps from leaking into the client bundle.

### Runtime

```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

The chat API route forces Node.js runtime (not Edge) and disables static rendering.

---

## Turborepo Configuration

**File:** `turbo.json`

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "lint": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

- `build` depends on upstream packages being built first (`^build`).
- `dev` runs persistently with caching disabled (used for `tsc --watch` + `next dev`).
- `test` depends on build completion but runs independently per package.

### Workspaces

**File:** `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Two workspaces: `apps/web` (Next.js application) and `packages/core`/`packages/db` (shared libraries).

---

## TypeScript Configuration

### Root (none — no `tsconfig.json` at root)

TypeScript is configured per-package. No root tsconfig exists.

### apps/web

**File:** `apps/web/tsconfig.json`

- **target:** `ES2017`
- **module:** `esnext` with `moduleResolution: "bundler"`
- **strict:** `true`
- **jsx:** `react-jsx`
- **paths:** `@/*` mapped to `./*` (project root within the app)
- **plugins:** includes the `next` TypeScript plugin for Next.js 16

### packages/core

**File:** `packages/core/tsconfig.json`

- **target:** `ES2022`, **module:** `ESNext`, **moduleResolution:** `Bundler`
- **outDir:** `./dist`, **rootDir:** `./src`
- **declaration:** `true` (generates `.d.ts` files)
- **types:** `["node"]`

### packages/db

**File:** `packages/db/tsconfig.json`

Identical structure to `packages/core`: ES2022 target, ESNext module, declaration generation, Node types.

---

## ESLint Configuration

**File:** `apps/web/eslint.config.mjs`

Uses ESLint v9 flat config with `eslint-config-next`:

```typescript
import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

- **core-web-vitals** — Next.js recommended rules for performance and correctness.
- **typescript** — TypeScript-aware rules from `eslint-config-next`.
- **Ignores:** `.next/`, `out/`, `build/`, and `next-env.d.ts`.

Run with: `pnpm lint` (root) or `pnpm --filter web lint`.

---

## Prettier Configuration

No `.prettierrc` file exists at the root. Prettier is configured solely through the root `package.json` script:

```
"format": "prettier --write \"**/*.{ts,tsx,md}\""
```

Prettier v3.3.3 is installed as a root devDependency. Default Prettier settings apply.

---

## Tailwind CSS Configuration

**File:** `apps/web/tailwind.config.ts` (Tailwind CSS v3)

```typescript
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
  // theme.extend.colors — custom design token variables
  // theme.extend.animation — 12 custom animations
};
```

Key aspects:

- **Content paths** — Scans `app/`, `components/`, and `lib/` for class usage.
- **Dark mode** — Set to `"class"` (toggle via a CSS class, not OS preference).
- **Custom color tokens** — Maps CSS custom properties from `globals.css` to Tailwind color names: `chrome`, `electric`, `cyan`, `lime`, `magenta`, `amber`, `teal`, `surface`, `primary`, `secondary`, `accent`, `muted`, `destructive`, `success`, `warning`, `border`, `input`, `ring`, `card`, `popover`.
- **Animations** — 12 custom keyframe animations: fade-in, slide-up, slide-down, scale-in, message-in, pulse-glow, float-in, float-gentle, glow-breathe, glow-ring, bounce-subtle, shimmer.
- **Layout** — `sidebar` and `sidebar-collapsed` width variables.
- **Border radius** — Based on a CSS `--radius` variable (default `2px`).

### PostCSS

**File:** `apps/web/postcss.config.mjs`

```typescript
const config = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

Standard Tailwind + Autoprefixer pipeline. Tailwind classes are processed from `globals.css` which includes `@tailwind base/components/utilities` directives.

### shadcn/ui

**File:** `apps/web/components.json`

- **style:** `base-nova`
- **icon library:** `lucide`
- **CSS variables:** enabled
- **base color:** `neutral`
- **aliases:** `@/components`, `@/lib`, `@/lib/utils`, `@/lib/hooks`

---

## Vitest Configuration

**File:** `apps/web/vitest.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@agent-web/core": path.resolve(__dirname, "../../packages/core/src"),
      "@agent-web/db": path.resolve(__dirname, "../../packages/db/src"),
    },
  },
});
```

- **Environment:** `happy-dom` (lightweight DOM simulation, no browser needed).
- **Plugins:** `@vitejs/plugin-react` for JSX transform.
- **Aliases:** Maps workspace packages directly to `src/` for test-time resolution (avoids needing a build step).

---

## Docker Configuration

### Multi-stage Dockerfile

**File:** `Dockerfile`

Six build targets:

| Target | Base | Purpose |
|---|---|---|
| `base` | `node:22-slim` | Corepack + pnpm 9.0.0 setup |
| `deps` | `base` | Install system deps (python3, make, g++), copy `package.json` files, run `pnpm install` |
| `builder` | `deps` | Copy all source, run `pnpm build` |
| `development` | `deps` | Copy source, build packages, set `NODE_ENV=development`, run dev server |
| `production` | `node:22-slim` | Copy `.next/standalone` artifact, include Docker CLI for sandbox Docker-in-Docker |
| `sandbox` | `node:22-slim` | Isolated code execution container with Python 3, `tsx`, restricted `sandbox-user` |

### Docker Compose — Development

**File:** `docker-compose.yml`

- **app**: Builds `target: development`, mounts source for hot reload, exposes port 3000.
- **sandbox**: Builds `target: sandbox`, runs with `profiles: [sandbox]` (not started by default). Resource-limited: 1 CPU, 512MB memory.

Key volume mounts:
- Source code bind-mount for hot reload.
- Docker socket (`/var/run/docker.sock`) for sandbox container access.
- Named volumes isolate `node_modules` per workspace and preserve `dist/`, `.next/`, and SQLite data across restarts.

Environment overrides:
- `DATABASE_URL=file:./packages/db/data/local.db` (SQLite path relative to `/app`).
- `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true` for file-watching inside Docker volumes on Windows/macOS.
- `TERMINAL_SANDBOX_CONTAINER=agent-web-sandbox`.

### Docker Compose — Production

**File:** `docker-compose.prod.yml`

- **app**: Builds `target: production`, exposes port 3000. Resource-limited: 4 CPUs, 4GB memory (with 1 CPU / 512MB reservation).
- **sandbox**: Same as dev but with 2 CPU / 1GB memory limits.

### .dockerignore

**File:** `.dockerignore`

Ignores `node_modules`, `.next/`, `dist/`, `*.db`, `.env*` (except `.env.example`), `Dockerfile`, `docker-compose*`, `.git/`, `README.md`, and `*.log`.

---

## Database Configuration

### SQLite (libsql)

**File:** `packages/db/src/client.ts`

```typescript
const DEFAULT_URL = "file:./data/local.db";

export function getDb() {
  const url = process.env.DATABASE_URL || DEFAULT_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  return drizzle(client, { schema });
}
```

- Local SQLite by default (`file:./data/local.db` in `apps/web/data/`).
- Remote Turso/libsql supported via `DATABASE_URL=libsql://...` + `DATABASE_AUTH_TOKEN`.
- Uses Drizzle ORM v0.36 with `drizzle-orm/libsql` driver.

### Schema (migrations)

**File:** `packages/db/src/migrate.ts`

Migrations run automatically on first DB access via `ensureMigrated()`. Tables created:

| Table | Key columns |
|---|---|
| `projects` | id, user_id, name, root_path |
| `sessions` | id, user_id, project_id, title |
| `messages` | id, session_id, user_id, role, content, model, timestamp |
| `users` | id, username, password_hash |
| `api_keys` | provider, user_id, key |
| `auth_tokens` | id, user_id, token, expires_at |
| `obsidian_config` | user_id, vault_path |
| `memories` | id, key, value |

Indexes on `messages(session_id)`, `messages(timestamp)`, `sessions(updated_at)`, `users(username)`, and `memories(key)`.

### Database Reset

Delete `apps/web/data/local.db` (or the path specified by `DATABASE_URL`) and restart. Migrations run automatically.

---

## Tool Sandboxing Configuration

### Terminal Execution

**File:** `packages/core/src/tools/terminal/`

Two backends selectable via `TERMINAL_BACKEND`:

#### Local Backend (`local`)

- **Blocklist:** Regex patterns block destructive commands (fork bombs, `rm -rf /`, `mkfs`, `mount`, `shutdown`, `dd`, `modprobe`, `chmod 777 /`, X11 capture).
- **Allowed commands whitelist:** `echo`, `cat`, `ls`, `cd`, `cp`, `mv`, `find`, `grep`, `git`, `npm`/`pnpm`, `node`, `python`, `curl`, `ping`, `ps`, `date`, `whoami`, `env`, `printenv`, `npx`, `tsc`.
- **Output limit:** 1MB maximum output.

#### Docker Backend (`docker`)

- Requires the sandbox container to be running (`docker compose --profile sandbox up -d`).
- Code is written to a temp file, copied into the container, and executed.
- **Dangerous pattern detection:** Blocks `require('child_process')`, `require('fs')`, `require('net')`, `eval()`, `Function()`, `process.exit()`, and other dangerous Node.js imports in both `require` and `import` syntax.
- **Timeouts:** Default 15s, max 120s per execution.
- **Output limit:** 32,000 characters.

### File Tools

**File:** `packages/core/src/tools/path-security.ts`

All file operations (`read_file`, `write_file`, `list_directory`, `search_files`) go through `resolveSafePath()`:

- Resolves the input path and checks it is within the allowed base directory (defaults to `process.cwd()`, overridable via `TOOL_ALLOWED_BASE`).
- Blocks access to system directories: on Windows (`C:\Windows`, `C:\Program Files`, `C:\Program Files (x86)`), on Unix-likes (`/etc`, `/proc`, `/sys`, `/dev`, `/boot`, `/var`, `/usr`).
- Throws an error if the resolved path falls outside the allowed workspace.

---

## Middleware Configuration

**File:** `apps/web/middleware.ts`

The Next.js middleware enforces:

- **Rate limiting (in-memory):** 60 requests per 60-second window per IP+path combination for all `/api/*` routes. Exceeds get a `429` response with `Retry-After` and `X-RateLimit-*` headers.
- **Authentication redirect:** Protected page routes (non-`/api`, non-`/_next`, non-public) redirect to `/login` if the `session_token` cookie is missing.
- **Public routes:** `/login` and `/api/auth` are always accessible without authentication.

Middleware applies to all routes except `_next/static`, `_next/image`, and `favicon.ico`.

---

## Sandbox Container

**Dockerfile target:** `sandbox`

The sandbox container (`agent-web-sandbox`) provides an isolated environment for code execution:

- **Base image:** `node:22-slim` with Python 3, pip, git, jq, and the `tsx` TypeScript runner.
- **Python libraries:** `requests`, `beautifulsoup4`, `pandas`, `numpy` (pre-installed).
- **User:** Runs as `sandbox-user` (non-root) with restricted home and temp directories.
- **Resource limits in Docker Compose:**
  - Dev: 1 CPU, 512MB memory, 5s CPU timeout per execution.
  - Production: 2 CPUs, 1GB memory.
- **Health check:** Runs `node -e "process.exit(0)"` every 30 seconds.
- **Profile:** Gated behind `profiles: [sandbox]` — not started by default.
