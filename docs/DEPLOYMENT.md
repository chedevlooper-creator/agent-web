# Deployment

Deployment guide for Agent Web, a self-hosted AI terminal agent organized as a pnpm monorepo. Deploys exclusively through Docker — no bare-metal or serverless path.

---

## Deployment Targets

### Docker (primary)

Multi-stage `Dockerfile` + 2 Compose files. All container-based.

| Config File | Target | Purpose |
|---|---|---|
| `Dockerfile` | `development` | Hot-reload dev server |
| `Dockerfile` | `production` | Optimized prod server |
| `Dockerfile` | `sandbox` | Isolated code-exec container |
| `docker-compose.yml` | — | Local dev (2 services) |
| `docker-compose.prod.yml` | — | Prod deployment (2 services) |

No deployment configs for Vercel, Netlify, Fly.io, Railway, or other PaaS. Self-hosted Docker only.

---

## Build Pipeline

### Production build command

```bash
pnpm docker:prod
```

Runs `docker compose -f docker-compose.prod.yml up --build -d`:

1. Builds `production` target of `Dockerfile` (multi-stage: `base` → `deps` → `builder` → `production`).
2. Builds `sandbox` target in parallel.
3. Starts both containers detached.

### Multi-stage Dockerfile breakdown

| Stage | Base Image | What Happens |
|---|---|---|
| `base` | `node:22-slim` | Enables Corepack, activates pnpm 9.0.0 |
| `deps` | `base` | Installs system build deps (python3, make, g++, ca-certificates, curl), copies `package.json` for all workspaces, runs `pnpm install` |
| `builder` | `deps` | Copies all source, runs `pnpm build` (Turborepo orchestrates dependency-ordered build) |
| `production` | `node:22-slim` | Copies `.next/standalone` output, `.next/static`, `public/` from builder; installs Docker CE CLI for sandbox Docker-in-Docker; creates `packages/db/data/` dir; sets `NODE_ENV=production` |
| `development` | `deps` | Copies source, builds workspace packages (`@agent-web/core`, `@agent-web/db`), sets `NODE_ENV=development`, runs dev entrypoint script |
| `sandbox` | `node:22-slim` | Installs Python 3 + pip + git + jq + tsx + common Python packages; creates non-root `sandbox-user`; idles until invoked |

### Build output

`production` target runs `node apps/web/server.js` — Next.js standalone server from `output: "standalone"` in `apps/web/next.config.ts`. Bundles all deps, no additional install steps.

---

## Environment Setup (Production)

Copy `.env.example` to a location accessible to container. Supply required vars:

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes \* | OpenAI or OpenRouter API key for LLM |
| `OPENROUTER_API_KEY` | Yes \* | Alternative if using OpenRouter |
| `ENCRYPTION_KEY` | **Yes** | 32-byte hex for encrypting stored API keys. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Without this, dev-only fallback used — **insecure for production**. |
| `DATABASE_URL` | — | Defaults to `file:./packages/db/data/local.db`. For Turso, use `libsql://your-db-url.turso.io`. |
| `DATABASE_AUTH_TOKEN` | — | Required only for remote Turso/libsql. |
| `NODE_ENV` | — | Set to `production` by Compose file. |

\* At least one LLM provider key required.

Set via `environment` block in `docker-compose.prod.yml`, `.env` file loaded by Docker Compose (`env_file:`), or your orchestrator's secret manager.

---

## Database Setup

### Local SQLite (default)

Prod Compose mounts named volume for persistence:

```yaml
volumes:
  - db_data:/app/packages/db/data
```

DB file created automatically on first startup by `ensureMigrated()` in `@agent-web/db`. No manual migration step.

### Remote Turso / libsql

1. Uncomment Turso URL and auth token:
   ```
   DATABASE_URL=libsql://your-db-url.turso.io
   DATABASE_AUTH_TOKEN=your-auth-token
   ```
2. Remove or comment out `db_data` volume mount — not needed for remote DB.
3. `@libsql/client` handles network connection automatically.

### Database reset

Delete `db_data` Docker volume and restart:

```bash
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
```

Migrations idempotent — recreate schema on next startup.

---

## Production Docker Compose Configuration

**File:** `docker-compose.prod.yml`

### `app` service

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: agent-web
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:./packages/db/data/local.db
      - NODE_ENV=production
      - HOSTNAME=0.0.0.0
      - PORT=3000
    volumes:
      - db_data:/app/packages/db/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "4"
          memory: 4G
        reservations:
          cpus: "1"
          memory: 512M
```

Key aspects:
- **Port**: 3000 (exposed to host).
- **Docker socket**: Mounted read-only (`ro`) for spawning sandbox containers via Docker-in-Docker.
- **Database volume**: Named volume `db_data` for SQLite persistence outside container lifecycle.
- **Resource limits**: 4 CPUs / 4 GB memory limit, 1 CPU / 512 MB reservation.
- **Restart policy**: `unless-stopped`.

### `sandbox` service

```yaml
  sandbox:
    build:
      context: .
      dockerfile: Dockerfile
      target: sandbox
    container_name: agent-web-sandbox
    volumes:
      - sandbox_workspace:/workspace
    environment:
      - SANDBOX_ENABLED=true
      - SANDBOX_MAX_CPU_MS=5000
      - SANDBOX_MAX_MEMORY_MB=256
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 1G
```

- Runs as non-root `sandbox-user`.
- Pre-installed: Python 3, pip, git, jq, tsx.
- Resource-limited to 2 CPUs / 1 GB.
- Used for isolated code execution (when `TERMINAL_BACKEND=docker`).

### Volumes

```yaml
volumes:
  db_data:
  sandbox_workspace:
```

---

## Standalone Next.js Output

Next.js app configured for standalone deployment in `apps/web/next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@agent-web/core", "@agent-web/db"],
  serverExternalPackages: ["@libsql/client", "pdf-parse", "mammoth", "xlsx"],
};
```

- **`output: "standalone"`**: Self-contained server in `.next/standalone/` with all necessary `node_modules`. Docker prod stage copies only this directory + static assets + public files.
- **`transpilePackages`**: Forces Next.js to transpile `@agent-web/core`, `@agent-web/db`.
- **`serverExternalPackages`**: Marks packages with native modules or large parsers as external to Webpack bundle.

Inspect standalone server locally:

```bash
cd apps/web && pnpm build
ls .next/standalone/
```

---

## Sandbox Container (Code Execution)

Isolated environment for running untrusted code. Started automatically by `docker compose -f docker-compose.prod.yml up --build -d` (no separate profile in production).

### Capabilities
- **Node.js** execution via `tsx` (pre-installed globally)
- **Python 3** with `requests`, `beautifulsoup4`, `pandas`, `numpy`
- **Shell commands** (git, jq, curl, standard Unix utils)

### Resource constraints

| Metric | Limit |
|---|---|
| CPU | 2 cores |
| Memory | 1 GB |
| Execution timeout | 5,000 ms (configurable via `SANDBOX_MAX_CPU_MS`) |
| Max memory per execution | 256 MB (configurable via `SANDBOX_MAX_MEMORY_MB`) |

### Security
- Runs as `sandbox-user` (non-root) with restricted home and temp dirs.
- Commands dispatched via `docker exec` from main app container (requires Docker socket mount).
- App-side code blocks dangerous Node.js patterns (`child_process`, `fs`, `net`, `eval`, `Function()`, `process.exit()`).

---

## Production Considerations

### Rate Limiting

Next.js middleware (`apps/web/middleware.ts`) implements **in-memory sliding-window rate limiter** for all `/api/*` routes:

- **Limit**: 60 requests per 60-second window per IP+path.
- **Response**: HTTP `429` with `Retry-After` and `X-RateLimit-*` headers.
- **Limitation**: In-memory only — resets on container restart. For multi-replica or production-critical deployments, replace with external rate limiter (e.g., Redis-based).

### Authentication
- **Session-based auth**: Middleware checks `session_token` cookie on protected page routes. Missing cookies redirect to `/login`.
- **Public routes**: `/login` and `/api/auth` (login, register) always accessible.
- **API auth**: Mutating API endpoints validate session token against `auth_tokens` table.
- **Static assets**: `_next/static`, `_next/image`, `favicon.ico` unrestricted.

### API Keys
- **Server-side keys**: Chat API reads provider API keys from env vars (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`).
- **Per-user keys**: Users can store per-provider API keys in DB via `/api/keys` endpoints.
- **Encryption at rest**: API keys encrypted using `ENCRYPTION_KEY`. Without it, dev-only fallback used — **do not deploy to production without setting this**.

### Security Headers and TLS

No built-in TLS termination or security headers. Deploy behind reverse proxy (nginx, Caddy, Traefik) for:
- TLS/SSL termination
- HTTP security headers (HSTS, CSP, X-Frame-Options)
- Connection buffering and timeout management

### Monitoring

No monitoring libraries (Sentry, Datadog, New Relic, OpenTelemetry) detected. Consider adding APM before production deployment.

### Resource Requirements

Minimum recommended host resources for single production instance (app + sandbox):

| Resource | Recommended |
|---|---|
| CPU | 2+ cores |
| Memory | 6+ GB (4 GB app + 1 GB sandbox + overhead) |
| Disk | 10+ GB (Docker images, SQLite DB, logs) |
| Docker socket | Must be available for sandbox Docker-in-Docker |

---

## Rollback Procedure

No automated rollback pipeline configured.

### Option 1: Previous Docker image (recommended)

```bash
# Rebuild from specific git tag or commit
git checkout <previous-stable-tag>
pnpm docker:prod

# Or, if previous image still in local cache:
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d  # uses cached layers
```

### Option 2: Database rollback

```bash
# Stop containers
docker compose -f docker-compose.prod.yml down

# Restore from database backup
# (replace with your backup restoration command)
# docker volume inspect agent-web_db_data  # find volume path

# Restart
docker compose -f docker-compose.prod.yml up -d
```

### Before rolling back
1. Stop incoming traffic (reverse proxy level).
2. Take database snapshot (copy `db_data` volume contents).
3. Deploy previous version.
4. Run health checks before re-enabling traffic.

---

## Environment Variable Reference (Production)

Full list at [CONFIGURATION.md](./CONFIGURATION.md#environment-variables). Production-specific notes:

| Variable | Production Required | Production Note |
|---|---|---|
| `NODE_ENV` | Yes | Must be `production` |
| `ENCRYPTION_KEY` | **Yes** | No dev-only fallback accepted |
| `OPENAI_API_KEY` | Yes \* | Set at least one LLM key |
| `DATABASE_URL` | — | Defaults to local SQLite; change for Turso |
| `TERMINAL_BACKEND` | — | Default `local`; set to `docker` for sandbox isolation |
| `HOSTNAME` | — | Set to `0.0.0.0` in Compose |
| `PORT` | — | Set to `3000` in Compose |
