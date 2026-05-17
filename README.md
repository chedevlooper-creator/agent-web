# Agent Web

AI-powered chat assistant with LLM integration, file system tools, web browsing, and code execution capabilities. Built as a pnpm monorepo with Turborepo.

## Architecture

```
agent-web/
├── apps/web/           # Next.js 16 application (frontend + API routes)
├── packages/core/      # Shared LLM client, tool registry, types
├── packages/db/        # Drizzle ORM + SQLite database layer
└── docker/             # Docker Compose (dev, prod, sandbox)
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9 (`npm install -g pnpm@9`)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local and add at least one LLM provider API key
# (OpenAI, OpenRouter, Anthropic, DeepSeek, Gemini, etc.)

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Build all packages and the Next.js app |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run tests with Vitest |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm format` | Run Prettier |
| `pnpm --filter @agent-web/db db:push` | Push Drizzle schema to SQLite |
| `pnpm docker:dev` | Run dev environment in Docker Compose |
| `pnpm docker:prod` | Run production environment in Docker Compose |

## Features

- **Multi-provider LLM chat**: OpenAI, OpenRouter, DeepSeek, OpenCode
- **AI agent tools**: Terminal, file read/write, web search/fetch, code execution, directory listing, file search
- **Session management**: Chat history persisted to SQLite via REST API
- **A/B model comparison**: Compare responses from two models side-by-side
- **File upload**: PDF, DOCX, XLSX, CSV, and code files with text extraction
- **Projects**: Isolated project directories with file browsing
- **Skills**: Loadable instruction files that modify LLM behavior
- **Dark-first UI**: Custom design with glassmorphism accents

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 3, Zustand 5
- **AI**: AI SDK v4, OpenAI-compatible providers
- **Database**: SQLite + libsql + Drizzle ORM
- **Tools**: Zod validation, Lucide icons, react-markdown, react-syntax-highlighter
- **Testing**: Vitest, React Testing Library, happy-dom

## Development

### Adding a new LLM provider

1. Add provider config to `packages/core/src/types.ts`
2. Add provider branch in `packages/core/src/llm/client.ts` using `createOpenAI({ baseURL: ... })`
3. Update the provider list in `apps/web/components/settings-panel.tsx`
4. Update the API route (`apps/web/app/api/chat/route.ts`) to accept the new provider

### Adding a new tool

1. Define the tool in `packages/core/src/tools/` using `tool()` from the `ai` SDK with a Zod parameter schema
2. Register it in `packages/core/src/tools/registry.ts`
3. Tools are automatically wired into the chat route via the registry

### Database

The DB client and schema are in `packages/db/`. Sessions and messages are persisted automatically through the Zustand store's API calls. To reset the database, delete `data/local.db` and restart.

## Security

- File tools are restricted to the project workspace directory
- API keys are encrypted at rest (AES-256-GCM)
- Code execution and terminal tools support isolated Docker sandbox mode
- File uploads are validated for type and size

## License

MIT
