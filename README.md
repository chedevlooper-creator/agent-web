# Agent Web

Open-source AI terminal agent. Streaming chat, tool system, persistent memory, skill-based extensions. pnpm monorepo: Next.js 16 + Turborepo + Drizzle ORM.

## Features

- **Streaming chat** — Real-time markdown response stream. Custom `fetch` + `getReader()` (no `useChat`).
- **11 built-in tools** — Terminal, file r/w/search/list, web search/fetch, code exec (sandboxed), git, DB queries, API testing.
- **Multi-provider LLM** — BYO API key (OpenAI, OpenRouter, DeepSeek).
- **Persistent sessions** — SQLite via Drizzle ORM. Surviv page reloads.
- **Memory system** — Key-value across sessions, injected into system prompt.
- **Skills system** — Extend via SKILL.md files. Toggle from sidebar.
- **Context compression** — Auto sliding-window trim past token threshold.
- **Obsidian vault sync** — Auto-sync sessions as markdown.
- **Docker** — Dev + prod Compose, optional sandbox for code exec.
- **Dark-first design** — Glassmorphism, Tailwind v3, shadcn/ui.

## Architecture

```
Browser ChatInterface → Zustand → POST /api/chat → parse Vercel AI SDK stream
                                ↓
           Next.js 16 Route → LLM client → streamText (AI SDK v4)
           System prompt builder (tools + files + skills + memory)
           Context compression (countTokens → trimToTokenLimit)
                                ↓
           packages/core (tools registry, 11 tools, LLM client)
           packages/db (Drizzle ORM, SQLite: sessions/messages/memories/api_keys)
```

## Quick Start

```bash
# Prerequisites: Node.js >=20, pnpm 9.0.0 (corepack enable)
git clone <repo-url> && cd agent-web && pnpm install
cp .env.example .env.local  # Set at least one LLM API key
pnpm dev                    # → http://localhost:3000
```

### Docker

```bash
pnpm docker:dev   # Dev
pnpm docker:prod  # Prod
```

## Key Commands

| Command | Description |
|---------|------------|
| `pnpm dev` | Dev server (Turborepo) |
| `pnpm build` | Prod build |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm test` | Vitest |

## Tech Stack

Next.js 16.2.6, React 19.2.4, Tailwind v3, Zustand v5, AI SDK v4, Drizzle ORM 0.36, SQLite/libsql, Docker (node:22-slim), Vitest v4, ESLint v9.

## Extending

- **LLM provider**: `types.ts` config + `llm/client.ts` branch + `settings-panel.tsx` selector.
- **New tool**: `packages/core/src/tools/<name>.ts` with `tool()` + Zod. Register in `registry.ts`.
- **Skill**: `SKILL.md` in `.verdent/skills/<name>/` with `name` + `description` frontmatter.
