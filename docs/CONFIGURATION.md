<!-- generated-by: gsd-doc-writer -->

# Configuration

All config options for Agent Web (Next.js 16 monorepo AI agent). Managed via environment variables, framework config files, per-package TS configs, Docker Compose profiles, and code-level tool sandboxing.

---

## Environment Variables

Copy `.env.example` → `.env.local`. Most vars have sensible defaults for local dev.

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes \* | — | OpenAI API key (provider `openai`) |
| `OPENROUTER_API_KEY` | Yes \* | — | OpenRouter API key (provider `openrouter`) |
| `DEEPSEEK_API_KEY` | — | — | DeepSeek API key (provider `deepseek`) |
| `ENCRYPTION_KEY` | Yes (prod) | — | 32-byte hex key for encrypting API keys. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Dev fallback exists (**insecure for prod**) |
| `DATABASE_URL` | — | `file:./data/local.db` | SQLite path or Turso `libsql://` URL |
| `DATABASE_AUTH_TOKEN` | — | — | Auth token for remote libsql/Turso |
| `TERMINAL_BACKEND` | — | `local` | `local` (safety blocklist) or `docker` (sandbox) |
| `TERMINAL_SANDBOX_CONTAINER` | — | `agent-web-sandbox` | Docker sandbox container name when `TERMINAL_BACKEND=docker` |
| `ENABLE_MEMORY` | — | `false` | `true` enables persistent key-value memory across sessions |
| `MEMORY_CHAR_LIMIT` | — | `2200` | Max memory chars injected into system prompt |
| `CONTEXT_COMPRESSION_THRESHOLD` | — | `80000` | Token threshold for context trimming (sliding window, preserve system + first user + most recent) |
| `OBSIDIAN_VAULT_PATH` | — | — | Path to Obsidian vault for chat sync. Empty = no auto-sync |
| `NODE_ENV` | — | `development` | `development`, `production`, or `test` |
| `TOOL_ALLOWED_BASE` | — | `process.cwd()` | Override allowed base dir for file tools (not recommended for prod) |
| `SKILLS_DIR` | — | `.verdent/skills` | Directory for SKILL.md files |
| `USER_CHAR_LIMIT` | — | `1375` | Char limit for user input in system prompt (set in Docker Compose) |

\* At least one LLM provider key (`OPENAI_API_KEY` or `OPENROUTER_API_KEY`) required.

### Provider-specific Env Vars

Chat API route (`apps/web/app/api/chat/route.ts`) reads provider API keys from env:

- **OpenAI**: `createOpenAI({ apiKey })` — default base URL
- **OpenRouter**: `baseURL: "https://openrouter.ai/api/v1"`
- **DeepSeek**: `baseURL: "https://api.deepseek.com"` + fetch wrapper disables thinking mode (prevents `reasoning_content` errors in multi-step tool calls)

No key for requested provider → API returns `401` with which env var to set.

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

- **`output: "standalone"`** — Standalone server bundle for Docker/prod. `.next/standalone/` includes all needed files + `node_modules`
- **`transpilePackages`** — Transpile `tsc`-built workspace packages for browser compatibility
- **`serverExternalPackages`** — Mark native/server-only packages as non-bundled: `@libsql/client`, `pdf-parse`, `mammoth`, `xlsx`
- **Webpack**: `NormalModuleReplacementPlugin` strips `node:` prefixes. Client-side: 20+ Node built-ins (`child_process`, `fs`, `path`, `os`, `crypto`) replaced with empty stubs via `resolve.fallback`

### Runtime

```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

Chat API route forces Node.js runtime (not Edge) + disables static rendering.

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

- `build` depends on upstream packages first (`^build`)
- `dev` persistent, no caching (`tsc --watch` + `next dev`)
- `test` depends on build done, runs independently per package

### Workspaces

**File:** `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Two workspaces: `apps/web` (Next.js) + `packages/core` / `packages/db` (libraries).

---

## TypeScript Configuration

### Root

No root `tsconfig.json`. TypeScript configured per-package.

### apps/web

**File:** `apps/web/tsconfig.json`

- **target:** `ES2017`, **module:** `esnext`, **moduleResolution:** `bundler`
- **strict:** `true`, **jsx:** `react-jsx`
- **paths:** `@/*` → `./*`
- **plugins:** includes `next` TS plugin

### packages/core

**File:** `packages/core/tsconfig.json`

- **target:** `ES2022`, **module:** `ESNext`, **moduleResolution:** `Bundler`
- **outDir:** `./dist`, **rootDir:** `./src`
- **declaration:** `true`, **types:** `["node"]`

### packages/db

**File:** `packages/db/tsconfig.json`

Identical structure to `packages/core`: ES2022, ESNext, declarations, Node types.

---

## ESLint Configuration

**File:** `apps/web/eslint.config.mjs`

ESLint v9 flat config with `eslint-config-next`:

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

- **core-web-vitals** — Next.js recommended rules for perf + correctness
- **typescript** — TS-aware rules
- **Ignores:** `.next/`, `out/`, `build/`, `next-env.d.ts`

Run: `pnpm lint` (root) or `pnpm --filter web lint`.

---

## Prettier Configuration

No `.prettierrc`. Configured via root `package.json`:

```
"format": "prettier --write \"**/*.{ts,tsx,md}\""
```

Prettier v3.3.3, root devDependency. Default settings apply.

---

## Tailwind CSS Configuration

**File:** `apps/web/tailwind.config.ts` (Tailwind v3)

```typescript
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
};
```

- **Content paths** — `app/`, `components/`, `lib/`
- **Dark mode** — `"class"` (toggle via CSS class, not OS preference)
- **Custom color tokens** — Maps CSS custom properties from `globals.css`: `chrome`, `electric`, `cyan`, `lime`, `magenta`, `amber`, `teal`, `surface`, `primary`, `secondary`, `accent`, `muted`, `destructive`, `success`, `warning`, `border`, `input`, `ring`, `card`, `popover`
- **Animations** — 12 custom keyframes: fade-in, slide-up, slide-down, scale-in, message-in, pulse-glow, float-in, float-gentle, glow-breathe, glow-ring, bounce-subtle, shimmer
- **Layout** — `sidebar` + `sidebar-collapsed` width variables
- **Border radius** — CSS `--radius` variable (default `2px`)

### PostCSS

**File:** `apps/web/postcss.config.mjs`

```typescript
const config = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

Standard Tailwind + Autoprefixer. `globals.css` includes `@tailwind base/components/utilities`.

### shadcn/ui

**File:** `apps/web/components.json`

- **style:** `base-nova`, **icon library:** `lucide`
- **CSS variables:** enabled, **base color:** `neutral`
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

- **Environment:** `happy-dom` (lightweight DOM, no browser)
- **Plugins:** `@vitejs/plugin-react` for JSX
- **Aliases:** Maps workspace packages to `src/` for test-time resolution (no build needed)

---

## Docker Configuration

### Multi-stage Dockerfile

**File:** `Dockerfile`

Six targets:

| Target | Base | Purpose |
|---|---|---|
| `base` | `node:22-slim` | Corepack + pnpm 9.0.0 setup |
| `deps` | `base` | Install system deps (python3, make, g++), copy `package.json`, `pnpm install` |
| `builder` | `deps` | Copy all source, `pnpm build` |
| `development` | `deps` | Copy source, build packages, `NODE_ENV=development`, run dev server |
| `production` | `node:22-slim` | Copy `.next/standalone` artifact, include Docker CLI for sandbox Docker-in-Docker |
| `sandbox` | `node:22-slim` | Isolated code exec container (Python 3, `tsx`, restricted `sandbox-user`) |

### Docker Compose — Development

**File:** `docker-compose.yml`

- **app**: `target: development`, source mounted for hot reload, port 3000
- **sandbox**: `target: sandbox`, `profiles: [sandbox]` (not started by default). Resource-limited: 1 CPU, 512MB

Key volumes:
- Source code bind-mount for hot reload
- Docker socket (`/var/run/docker.sock`) for sandbox access
- Named volumes isolate `node_modules`, preserve `dist/`, `.next/`, SQLite

Env overrides:
- `DATABASE_URL=file:./packages/db/data/local.db`
- `CHOKIDAR_USEPOLLING=true`, `WATCHPACK_POLLING=true` for file-watching inside Docker on Windows/macOS
- `TERMINAL_SANDBOX_CONTAINER=agent-web-sandbox`

### Docker Compose — Production

**File:** `docker-compose.prod.yml`

- **app**: `target: production`, port 3000. Resource-limited: 4 CPUs, 4GB (1 CPU / 512MB reservation)
- **sandbox**: Same as dev but 2 CPU / 1GB

### .dockerignore

**File:** `.dockerignore`

Ignores `node_modules`, `.next/`, `dist/`, `*.db`, `.env*` (except `.env.example`), `Dockerfile`, `docker-compose*`, `.git/`, `README.md`, `*.log`.

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

- Local SQLite default (`file:./data/local.db` in `apps/web/data/`)
- Remote Turso via `DATABASE_URL=libsql://...` + `DATABASE_AUTH_TOKEN`
- Drizzle ORM v0.36 with `drizzle-orm/libsql` driver

### Schema (migrations)

**File:** `packages/db/src/migrate.ts`

Auto-run on first DB access via `ensureMigrated()`. Tables:

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

Indexes on `messages(session_id)`, `messages(timestamp)`, `sessions(updated_at)`, `users(username)`, `memories(key)`.

### Database Reset

Delete `apps/web/data/local.db` (or `DATABASE_URL` path) and restart. Migrations auto-run.

---

## Tool Sandboxing Configuration

### Terminal Execution

**File:** `packages/core/src/tools/terminal/`

Two backends via `TERMINAL_BACKEND`:

#### Local Backend (`local`)
- **Blocklist:** Regex blocks destructive commands (fork bombs, `rm -rf /`, `mkfs`, `mount`, `shutdown`, `dd`, `modprobe`, `chmod 777 /`, X11 capture)
- **Allowed whitelist:** `echo`, `cat`, `ls`, `cd`, `cp`, `mv`, `find`, `grep`, `git`, `npm`/`pnpm`, `node`, `python`, `curl`, `ping`, `ps`, `date`, `whoami`, `env`, `printenv`, `npx`, `tsc`
- **Output limit:** 1MB max

#### Docker Backend (`docker`)
- Requires sandbox container running (`docker compose --profile sandbox up -d`)
- Code written to temp file, copied into container, executed
- **Dangerous pattern detection:** Blocks `require('child_process')`, `require('fs')`, `require('net')`, `eval()`, `Function()`, `process.exit()`, dangerous Node.js imports in require + import syntax
- **Timeouts:** Default 15s, max 120s
- **Output limit:** 32,000 chars

### File Tools

**File:** `packages/core/src/tools/path-security.ts`

All file ops (`read_file`, `write_file`, `list_directory`, `search_files`) go through `resolveSafePath()`:
- Resolves input path, checks within allowed base dir (default `process.cwd()`, override via `TOOL_ALLOWED_BASE`)
- Blocks system dirs: Windows (`C:\Windows`, `C:\Program Files`, `C:\Program Files (x86)`), Unix (`/etc`, `/proc`, `/sys`, `/dev`, `/boot`, `/var`, `/usr`)
- Throws error if path outside allowed workspace

---

## Middleware Configuration

**File:** `apps/web/middleware.ts`

- **Rate limiting (in-memory):** 60 req / 60s per IP+path for all `/api/*`. Exceed → `429` with `Retry-After` + `X-RateLimit-*` headers
- **Auth redirect:** Protected page routes redirect to `/login` if `session_token` cookie missing
- **Public routes:** `/login` + `/api/auth` always accessible

Middleware applies to all routes except `_next/static`, `_next/image`, `favicon.ico`.

---

## Sandbox Container

**Dockerfile target:** `sandbox`

Isolated code execution environment (`agent-web-sandbox`):

- **Base:** `node:22-slim` + Python 3, pip, git, jq, `tsx`
- **Python libs:** `requests`, `beautifulsoup4`, `pandas`, `numpy` (pre-installed)
- **User:** `sandbox-user` (non-root), restricted home + temp dirs
- **Resource limits (Docker Compose):**
  - Dev: 1 CPU, 512MB, 5s CPU timeout per exec
  - Production: 2 CPUs, 1GB
- **Health check:** `node -e "process.exit(0)"` every 30s
- **Profile:** `profiles: [sandbox]` — not started by default
