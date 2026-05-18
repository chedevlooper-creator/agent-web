<!-- generated-by: gsd-doc-writer -->
# `web` — Agent Web Frontend & API Server

The main Next.js 16 application for Agent Web: an AI-powered chat interface with streaming responses, tool execution, session management, project organization, and skills integration. This package serves as both the frontend UI and the API backend.

Part of the [Agent Web](https://github.com/your-org/agent-web) monorepo.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, webpack) |
| UI Library | [React 19](https://react.dev/) |
| State Management | [Zustand 5](https://github.com/pmndrs/zustand) |
| Styling | [Tailwind CSS v3](https://tailwindcss.com/) with custom CSS variable tokens |
| Components | [Base UI React](https://base-ui.com/react/) + custom shadcn/ui-style primitives |
| AI / LLM | [AI SDK v4](https://sdk.vercel.ai/) (`ai`, `@ai-sdk/openai`) |
| Database | [Drizzle ORM](https://orm.drizzle.team/) + [libSQL](https://turso.tech/libsql) (Turso) |
| Auth | `bcryptjs` + session cookie middleware |
| Icons | [Lucide React](https://lucide.dev/) |
| Notifications | [Sonner](https://sonner.emilkowal.ski/) |
| Testing | [Vitest](https://vitest.dev/) + [happy-dom](https://github.com/capricorn86/happy-dom) |
| Validation | [Zod](https://zod.dev/) |

---

## Project Structure

```
apps/web/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Main chat page
│   ├── layout.tsx              # Root layout (Geist fonts, skip-to-content link)
│   ├── login/
│   │   └── page.tsx            # Authentication page
│   ├── globals.css             # Global styles + CSS custom properties
│   └── api/
│       ├── chat/               # POST — streaming chat (AI SDK v4)
│       ├── auth/               # login, register, logout, me, password, users
│       ├── sessions/           # CRUD chat sessions + message management
│       ├── projects/           # CRUD user projects
│       ├── skills/             # List available AI skills (from SKILL.md files)
│       ├── memory/             # Key-value memory store (GET/POST/DELETE)
│       ├── keys/               # Server-side API key management
│       ├── search/             # Search endpoint
│       ├── upload/             # File upload with preview support
│       ├── obsidian/           # Obsidian vault config + sync
│       └── config/status/      # Provider API key availability status
├── components/
│   ├── chat/                   # chat-interface, message-bubble, tool-call-bubble,
│   │                           # typing-indicator, welcome-hero, chat-input,
│   │                           # markdown-renderer, compare-row, file-upload
│   ├── layout/                 # sidebar, context-panel
│   ├── settings/               # sync-settings
│   ├── ui/                     # button, card, badge, textarea, tooltip, skeleton,
│   │                           # scroll-area, separator
│   ├── settings-panel.tsx      # Provider/model selection, API key status, compare mode
│   ├── async-view.tsx          # Async data rendering helper
│   ├── skeleton-loader.tsx     # Loading skeleton
│   └── error-boundary.tsx      # React error boundary
├── lib/
│   ├── store.ts                # Zustand store (sessions, messages, projects, settings)
│   ├── db.ts                   # Drizzle/libSQL database layer
│   ├── auth.ts                 # Authentication helpers
│   ├── crypto.ts               # Encryption utilities
│   ├── hooks.ts                # Custom React hooks
│   ├── utils.ts                # cn() helper, token estimation, error extraction
│   ├── obsidian.ts             # Obsidian vault integration
│   └── rate-limit.ts           # Rate limiting utilities
├── middleware.ts               # Auth guard + API rate limiting (60 req/min)
├── tailwind.config.ts          # Custom theme with CSS variable tokens
└── package.json
```

---

## Key Features

### Streaming Chat
- Multi-provider chat (OpenAI, OpenRouter, DeepSeek) via AI SDK v4
- Real-time streaming with per-token updates, 60-second timeout
- Automatic session creation on first message
- Optimistic local message updates with requestAnimationFrame batching

### Tool Execution
- Built-in tools: `terminal` (shell commands), `read_file` (local file reading), `web_search`
- Tool call cards with expandable results during streaming
- Live status indicators (pending → running → done)

### A/B Compare Mode
- Send the same prompt to two models simultaneously
- Side-by-side rendering of assistant responses
- Slot A/B labeling for clear identification

### File Upload & Preview
- Drag-free file attachment via file picker
- Server-side preview generation for: Excel (`.xlsx`), CSV, JSON, text files, code files, markup
- Collapsible inline preview cards with syntax highlighting and table rendering

### Settings Panel
- Provider selection (OpenAI, OpenRouter, DeepSeek)
- Model selection with optional A/B compare mode
- Server-side API key status checking
- Togglable skill system

### Context Panel
- Session message count and token estimation
- Tool usage breakdown with icons
- Activity summary per session

### Skills Manager
- Discovers SKILL.md files from the filesystem
- Exposes toggle-able skills that are injected into the system prompt
- API endpoint at `/api/skills` for skill listing

### Obsidian Vault Sync
- Configure an Obsidian vault path in the settings panel
- Auto-sync chat sessions as markdown notes
- Manual sync per session

### Authentication
- Session-cookie-based auth with bcryptjs password hashing
- Login/register pages with redirect support
- Auth middleware protecting all non-public routes

---

## Development

```bash
# Start the dev server (webpack)
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

The dev server runs on [http://localhost:3000](http://localhost:3000). The server expects API keys to be set via environment variables (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`) or configured through the settings panel at runtime.

### Testing

```bash
npm test          # Run tests once
npm run test:watch   # Watch mode
npm run test:coverage  # With coverage
```
