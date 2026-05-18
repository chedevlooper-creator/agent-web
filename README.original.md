<!-- generated-by: gsd-doc-writer -->

# Agent Web

An open-source AI-powered terminal agent with streaming chat, a flexible tool system, persistent memory, and skill-based extensions — built as a pnpm monorepo with Next.js 16, Turborepo, and Drizzle ORM.

## Features

- **Streaming chat interface** — Real-time streaming responses with markdown rendering and syntax highlighting via `react-markdown` and `react-syntax-highlighter`. Custom `fetch` + `getReader()` loop (no `useChat` dependency).
- **11 built-in tools** — Terminal execution, file read/write/search/list, web search/fetch, code execution (sandboxed), git operations, database queries, and API testing.
- **Multi-provider LLM support** — Bring your own API key for OpenAI, OpenRouter, or DeepSeek.
- **Persistent sessions & messages** — All chat data stored in SQLite via Drizzle ORM. Survives page reloads.
- **Memory system** — Key-value memory persisted across sessions, injected into the system prompt (toggle via `ENABLE_MEMORY`).
- **Skills system** — Extend agent capabilities with SKILL.md files. User-enable skills from the sidebar.
- **Context compression** — Automatic sliding-window trimming when conversation exceeds a configurable token threshold.
- **Obsidian vault sync** — Auto-sync chat sessions to an Obsidian vault as markdown files.
- **Docker support** — Development and production Docker Compose setups with optional sandbox isolation for code execution.
- **Dark-first design** — Glassmorphism-inspired UI with Tailwind CSS v3 and Base UI React components.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                       │
│  ChatInterface → Zustand Store → POST /api/chat          │
│  Parses Vercel AI SDK data stream (0:, 1:, 2:, etc.)    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Next.js 16 API Route                        │
│  /api/chat  →  LLM client  →  streamText (AI SDK v4)    │
│  System prompt builder (tools + files + skills + memory) │
│  Context compression (countTokens → trimToTokenLimit)    │
└──────┬──────────────────────────────┬───────────────────┘
       │                              │
┌──────▼───────┐            ┌─────────▼──────────┐
│  packages/   │            │    packages/        │
│  core        │            │    db               │
│  ─────────   │            │  ────────────       │
│  Tool        │            │  Drizzle ORM        │
│  Registry    │            │  Schema (SQLite)    │
│  (11 tools)  │            │  sessions           │
│  LLM client  │            │  messages           │
│  Context     │            │  memories           │
│  compression │            │  api_keys           │
└──────────────┘            └─────────────────────┘
```

## Project Structure

```
agent-web/
├── apps/
│   └── web/                    # Next.js 16 App Router application
│       ├── app/                # Pages and API routes
│       │   ├── api/chat/       # Streaming chat endpoint
│       │   ├── api/sessions/   # Session CRUD
│       │   ├── api/memory/     # Memory CRUD
│       │   ├── api/skills/     # Skills listing
│       │   └── api/upload/     # File upload
│       ├── components/         # React components
│       ├── lib/                # Client utilities (store, db helpers)
│       └── data/               # SQLite database (gitignored)
├── packages/
│   ├── core/                   # Shared LLM tools & types (@agent-web/core)
│   │   └── src/tools/          # Tool implementations (11 tools)
│   └── db/                     # Drizzle ORM schema & client (@agent-web/db)
├── Dockerfile                  # Multi-stage Docker build (dev/prod/sandbox)
├── docker-compose.yml          # Development Compose
├── docker-compose.prod.yml     # Production Compose
├── turbo.json                  # Turborepo task configuration
└── package.json                # Root workspace definition
```

## Tech Stack

| Layer       | Technology                                                     |
|-------------|----------------------------------------------------------------|
| Framework   | Next.js 16.2.6, React 19.2.4, Turborepo 2.3                    |
| Styling     | Tailwind CSS v3, Base UI React, Lucide icons, Sonner toasts    |
| State       | Zustand v5 (client) + REST API (server persistence)            |
| LLM SDK     | AI SDK v4 (`ai`, `@ai-sdk/openai`)                             |
| Database    | SQLite via `@libsql/client` + Drizzle ORM 0.36                 |
| Containers  | Docker multi-stage build (node:22-slim)                        |
| Monorepo    | pnpm workspaces + Turborepo                                    |
| Testing     | Vitest v4 + happy-dom + React Testing Library                  |
| Linting     | ESLint v9 (flat config), Prettier                              |

## Quick Start

### Prerequisites

- **Node.js** >= 20 (see `Dockerfile` — uses `node:22-slim`)
- **pnpm** 9.0.0 (enable via `corepack enable && corepack prepare pnpm@9.0.0 --activate`)

### Install & Run

```bash
# 1. Clone and install
git clone <repo-url>
cd agent-web
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local and set at least one LLM provider API key

# 3. Start development
pnpm dev
```

The app starts at [http://localhost:3000](http://localhost:3000).

### Docker (Alternative)

```bash
# Development
pnpm docker:dev

# Production
pnpm docker:prod
```

## Environment Variables

Key configuration (see `.env.example` for the full list):

| Variable                        | Required | Default             | Description                              |
|---------------------------------|----------|---------------------|------------------------------------------|
| `OPENAI_API_KEY`                | At least one LLM provider | —         | OpenAI API key                           |
| `OPENROUTER_API_KEY`            |          | —                   | OpenRouter API key                       |
| `ENCRYPTION_KEY`                | Recommended | dev-only fallback | Secret for encrypting stored API keys    |
| `DATABASE_URL`                  | Optional | `file:./data/local.db` | SQLite path or libsql remote URL    |
| `TERMINAL_BACKEND`              | Optional | `local`             | `local` or `docker` (sandbox isolation)  |
| `ENABLE_MEMORY`                 | Optional | `false`             | Enable cross-session persistent memory   |
| `CONTEXT_COMPRESSION_THRESHOLD` | Optional | `80000`             | Token limit before context compression   |

## Commands

| Command             | Description                                         |
|---------------------|-----------------------------------------------------|
| `pnpm dev`          | Start all packages + Next.js dev server (Turborepo)  |
| `pnpm build`        | Build all packages + Next.js for production          |
| `pnpm lint`         | Run ESLint across the monorepo                       |
| `pnpm format`       | Format code with Prettier                            |
| `pnpm test`         | Run all tests with Vitest                            |
| `pnpm docker:dev`   | Start development environment in Docker Compose       |
| `pnpm docker:prod`  | Start production environment in Docker Compose        |

## Extending

- **Add an LLM provider** — Add config to `packages/core/src/types.ts`, a branch in `packages/core/src/llm/client.ts`, and update the provider selector in `apps/web/components/settings-panel.tsx`.
- **Add a new tool** — Create `packages/core/src/tools/<name>.ts` using `tool()` from the AI SDK with a Zod parameter schema, then register it in `packages/core/src/tools/registry.ts`.
- **Add a skill** — Place a `SKILL.md` file in `.verdent/skills/<name>/SKILL.md` (or `~/.verdent/skills/`, `~/.agents/skills/`) with `name` and `description` frontmatter fields.

## License

No license has been specified.
