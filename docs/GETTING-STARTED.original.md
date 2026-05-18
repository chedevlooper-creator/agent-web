<!-- generated-by: gsd-doc-writer -->

# Getting Started

A step-by-step guide to setting up and running Agent Web, the AI-powered terminal agent with streaming chat, tool execution, and skill-based extensions.

---

## Prerequisites

| Dependency      | Required Version | Notes                                                        |
|-----------------|------------------|--------------------------------------------------------------|
| **Node.js**     | `>= 22`          | The Dockerfile and sandbox use `node:22-slim`                |
| **pnpm**        | `9.0.0`          | Enable via Corepack (see below)                              |
| **Docker**      | Any recent       | Only needed for the Docker workflow or sandbox mode          |

Enable pnpm with Corepack:

```bash
corepack enable && corepack prepare pnpm@9.0.0 --activate
```

Verify your environment:

```bash
node --version    # Should be >= 22
pnpm --version   # Should be 9.0.x
```

---

## Installation

1. **Clone the repository**

```bash
git clone <repo-url>
cd agent-web
```

2. **Install dependencies**

```bash
pnpm install
```

This installs all workspace packages (`apps/web`, `packages/core`, `packages/db`) and their dependencies using pnpm workspaces + Turborepo.

3. **(Recommended) Build workspace packages**

The `dev` command builds dependencies automatically, but you can pre-build explicitly:

```bash
pnpm --filter @agent-web/core build
pnpm --filter @agent-web/db build
```

---

## Environment Setup

Copy the example environment file and configure at least one LLM provider:

```bash
cp .env.example .env.local
```

### Required: LLM Provider API Key

Set **at least one** of these in `.env.local`:

| Variable             | Description                            |
|----------------------|----------------------------------------|
| `OPENAI_API_KEY`     | OpenAI or OpenRouter-compatible key    |
| `OPENROUTER_API_KEY` | OpenRouter API key                     |

### Recommended Settings

| Variable                          | Default                  | Description                                     |
|-----------------------------------|--------------------------|-------------------------------------------------|
| `ENCRYPTION_KEY`                  | Dev-only fallback        | Secret for encrypting stored API keys at rest. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENABLE_MEMORY`                   | `false`                  | Set to `true` to enable cross-session persistent memory |
| `DATABASE_URL`                    | `file:./data/local.db`   | SQLite path (defaults to local file)            |
| `TERMINAL_BACKEND`                | `local`                  | `local` or `docker` (sandbox isolation)         |

---

## Running the Dev Server

Start all packages and the Next.js development server:

```bash
pnpm dev
```

Turborepo runs all workspace `dev` scripts in parallel — TypeScript watch for `@agent-web/core` and `@agent-web/db`, plus the Next.js dev server with hot reload.

The app starts at **[http://localhost:3000](http://localhost:3000)**.

### First-Time Setup Flow

1. Open `http://localhost:3000` in your browser.
2. You will see a **login / API key setup** screen (or the settings panel depending on route).
3. Enter your LLM provider API key (OpenAI or OpenRouter).
4. Start a new session from the sidebar and begin chatting.

---

## Running in Docker

Two Docker Compose configurations are provided.

### Development (with hot reload)

```bash
pnpm docker:dev
```

This starts:
- **`agent-web-dev`** — Next.js dev server on port 3000, with source files mounted for live reload, Docker socket mounted for sandbox support, and database persistence.
- **`agent-web-sandbox`** — Optional isolated container for executing untrusted code (controlled by the `sandbox` profile).

To run without the sandbox:

```bash
docker compose up --build
```

### Production

```bash
pnpm docker:prod
```

Starts a production-optimized `agent-web` container on port 3000 with resource limits (4 CPU, 4 GB RAM) and the sandbox container with 1 GB RAM limit.

### Stopping Docker

```bash
pnpm docker:dev:down    # Stop development containers
pnpm docker:prod:down   # Stop production containers
```

---

## Basic Usage

### Creating a Session

1. Open the app at `http://localhost:3000`.
2. Locate the **sidebar** on the left.
3. Click **New Session** (or the "+" button).
4. Type a message in the chat input at the bottom.

### Chatting with Tools

Agent Web comes with **11 built-in tools** that the AI can use autonomously:

| Tool                | What it does                                    |
|---------------------|-------------------------------------------------|
| Terminal            | Execute shell commands (local or Docker sandbox) |
| File Read           | Read file contents from the workspace            |
| File Write          | Write content to files                           |
| List Directory      | Browse directory structure                        |
| Search Files        | Full-text search across files                    |
| Web Search          | Search the web (via configurable backend)        |
| Web Fetch           | Fetch and return a URL's content                 |
| Execute Code        | Run code in the Docker sandbox (Python, Node)   |
| Git Operations      | Run git commands within the workspace            |
| Database Query      | Execute SQL against the local database           |
| API Test            | Make HTTP requests for API testing               |

The agent chooses which tools to use based on your request. Tool calls and their results are displayed inline in the chat as expandable bubbles.

### Managing Skills

Skills extend the agent's capabilities via `SKILL.md` files.

**Adding a skill:**

Place a `SKILL.md` file in one of these locations:

| Location                          | Scope        |
|-----------------------------------|--------------|
| `.verdent/skills/<name>/SKILL.md` | Project-wide |
| `~/.verdent/skills/<name>/SKILL.md` | User-wide  |
| `~/.agents/skills/<name>/SKILL.md` | User-wide  |

Required frontmatter fields:

```markdown
---
name: "My Skill"
description: "What this skill enables the agent to do"
---
```

**Enabling/disabling:**

Open the **Settings** panel (gear icon) and toggle skills on or off. Enabled skills are injected into the system prompt on each request.

---

## Common Setup Issues

### `pnpm: command not found`

Ensure Corepack is enabled and pnpm is prepared:

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

### `Error: Module not found` on first run

Workspace packages need to be built before the Next.js server starts. The `dev` script handles this via Turborepo's `dependsOn: ["^build"]`, but if you see import errors, build manually:

```bash
pnpm --filter @agent-web/core build
pnpm --filter @agent-web/db build
```

### API key not recognized

- Verify the key is set in `.env.local` (not `.env`), as Next.js loads `.env.local` by default.
- Ensure the key has `OPENAI_` or `OPENROUTER_` prefix matching the variable name.
- Run `pnpm dev` again after editing `.env.local` (Next.js picks up changes on restart).

### Docker socket permission denied

On Linux, the Docker daemon socket (`/var/run/docker.sock`) may require `sudo` or group membership. Add your user to the `docker` group:

```bash
sudo usermod -aG docker $USER
```

Then log out and back in.

### Port 3000 already in use

Stop the existing process or change the port:

```bash
# Find and kill the process on port 3000
npx kill-port 3000

# Or set a custom port in .env.local
# PORT=3001
```

---

## Next Steps

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design, data flow, and key abstractions
- **[CONFIGURATION.md](CONFIGURATION.md)** — Full environment variable reference and config file format
- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Build commands, code style, and PR process
- **[TESTING.md](TESTING.md)** — Test framework, running tests, and coverage requirements
