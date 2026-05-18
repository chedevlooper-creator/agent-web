<!-- generated-by: gsd-doc-writer -->

# Getting Started

Step-by-step guide to running Agent Web — AI-powered terminal agent with streaming chat, tool execution, skill-based extensions.

---

## Prerequisites

| Dependency | Required Version | Notes |
|---|---|---|
| **Node.js** | `>= 22` | Dockerfile + sandbox use `node:22-slim` |
| **pnpm** | `9.0.0` | Enable via Corepack (see below) |
| **Docker** | Any recent | Only for Docker workflow or sandbox mode |

Enable pnpm via Corepack:

```bash
corepack enable && corepack prepare pnpm@9.0.0 --activate
```

Verify:

```bash
node --version    # >= 22
pnpm --version   # 9.0.x
```

---

## Installation

1. **Clone repo**

```bash
git clone <repo-url>
cd agent-web
```

2. **Install deps**

```bash
pnpm install
```

Installs all workspace packages (`apps/web`, `packages/core`, `packages/db`) via pnpm workspaces + Turborepo.

3. **(Recommended) Build workspace packages**

`dev` builds deps automatically, but pre-build explicitly:

```bash
pnpm --filter @agent-web/core build
pnpm --filter @agent-web/db build
```

---

## Environment Setup

Copy example env file and configure at least one LLM provider:

```bash
cp .env.example .env.local
```

### Required: LLM Provider API Key

Set **at least one** in `.env.local`:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI or OpenRouter-compatible key |
| `OPENROUTER_API_KEY` | OpenRouter API key |

### Recommended Settings

| Variable | Default | Description |
|---|---|---|
| `ENCRYPTION_KEY` | Dev-only fallback | Secret for encrypting API keys at rest. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENABLE_MEMORY` | `false` | `true` enables cross-session persistent memory |
| `DATABASE_URL` | `file:./data/local.db` | SQLite path |
| `TERMINAL_BACKEND` | `local` | `local` or `docker` (sandbox isolation) |

---

## Running the Dev Server

```bash
pnpm dev
```

Turborepo runs all workspace `dev` scripts in parallel — TS watch for `@agent-web/core` + `@agent-web/db`, plus Next.js dev server with hot reload.

App at **[http://localhost:3000](http://localhost:3000)**.

### First-Time Setup

1. Open `http://localhost:3000`
2. Login / API key setup screen (or settings panel)
3. Enter LLM provider API key (OpenAI or OpenRouter)
4. Start session from sidebar, begin chatting

---

## Running in Docker

Two Docker Compose configs provided.

### Development (hot reload)

```bash
pnpm docker:dev
```

Starts:
- **`agent-web-dev`** — Next.js dev on port 3000, source mounted for live reload, Docker socket for sandbox, DB persistence
- **`agent-web-sandbox`** — Optional isolated container for untrusted code (`sandbox` profile)

Skip sandbox:

```bash
docker compose up --build
```

### Production

```bash
pnpm docker:prod
```

Production-optimized `agent-web` container on port 3000 with resource limits (4 CPU, 4 GB RAM) + sandbox (1 GB RAM).

### Stop Docker

```bash
pnpm docker:dev:down    # Stop dev containers
pnpm docker:prod:down   # Stop prod containers
```

---

## Basic Usage

### Creating a Session

1. Open `http://localhost:3000`
2. Locate **sidebar** on left
3. Click **New Session** (or "+")
4. Type message in chat input

### Chatting with Tools

Agent Web ships **11 built-in tools** AI uses autonomously:

| Tool | What it does |
|---|---|
| Terminal | Execute shell commands (local or Docker sandbox) |
| File Read | Read file contents from workspace |
| File Write | Write content to files |
| List Directory | Browse directory structure |
| Search Files | Full-text search across files |
| Web Search | Search web (configurable backend) |
| Web Fetch | Fetch and return URL content |
| Execute Code | Run code in Docker sandbox (Python, Node) |
| Git Operations | Run git commands within workspace |
| Database Query | Execute SQL against local DB |
| API Test | Make HTTP requests for API testing |

Agent chooses tools based on request. Tool calls + results displayed inline as expandable bubbles.

### Managing Skills

Skills extend agent capabilities via SKILL.md files.

**Adding a skill:**

Place `SKILL.md` in one of:

| Location | Scope |
|---|---|
| `.verdent/skills/<name>/SKILL.md` | Project-wide |
| `~/.verdent/skills/<name>/SKILL.md` | User-wide |
| `~/.agents/skills/<name>/SKILL.md` | User-wide |

Required frontmatter:

```markdown
---
name: "My Skill"
description: "What this skill enables the agent to do"
---
```

**Enable/disable:**

Open **Settings** (gear icon) and toggle skills. Enabled skills injected into system prompt per request.

---

## Common Setup Issues

### `pnpm: command not found`

Ensure Corepack enabled:

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

### `Error: Module not found` on first run

Workspace packages must build before Next.js starts. `dev` handles via Turborepo `dependsOn: ["^build"]`, but build manually if errors:

```bash
pnpm --filter @agent-web/core build
pnpm --filter @agent-web/db build
```

### API key not recognized

- Key must be in `.env.local` (not `.env`) — Next.js loads `.env.local` by default
- Key prefix must match variable name (`OPENAI_` or `OPENROUTER_`)
- Restart `pnpm dev` after editing `.env.local`

### Docker socket permission denied

On Linux, add user to `docker` group:

```bash
sudo usermod -aG docker $USER
```

Log out and back in.

### Port 3000 already in use

```bash
npx kill-port 3000
# Or set custom port in .env.local: PORT=3001
```

---

## Next Steps

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design, data flow, key abstractions
- **[CONFIGURATION.md](CONFIGURATION.md)** — Full env var reference + config file format
- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Build commands, code style, PR process
- **[TESTING.md](TESTING.md)** — Test framework, running tests, coverage requirements
