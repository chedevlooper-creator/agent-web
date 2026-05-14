# Agent Web Proje Mimarisi Spec

## Why

Bu proje, kullanıcıların çeşitli LLM sağlayıcıları (OpenAI, OpenRouter, OpenCode, Anthropic, DeepSeek, Gemini) ile etkileşim kurabilecekleri, araçlar (terminal, dosya, web, tarayıcı, vision, memory, delegation) kullanabilen, skills sistemi ve MCP entegrasyonu ile genişletilebilir bir web tabanlı AI agent arayüzü sunmaktadır.

## What Changes

Bu doküman mevcut projenin genel mimarisini, bileşenlerini ve veri akışlarını detaylı olarak dokümante etmektedir.

## Impact

- **Mimari Katmanlar**: Frontend (Next.js), Backend Core (packages/core), Database (packages/db)
- **Ana Sistemler**: Chat Engine, Tool Registry, Memory Manager, Skills Manager, MCP Manager, Subagent Manager
- **API Yapısı**: Next.js App Router API rotaları

## ADDED Requirements

### Requirement: Proje Mimarisi Dokümantasyonu

Sistem aşağıdaki katmanlı mimari ile yapılandırılmıştır:

#### Senaryo: Genel Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                       │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │ Chat UI     │ │ Session Side │ │ Context/Tools Panel│   │
│  └─────────────┘ └──────────────┘ └────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                     │
│  /api/chat │ /api/sessions │ /api/tools │ /api/memory etc. │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Packages/Core (packages/core)                │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ChatEngine│ │ToolRegistry│ │LLM Client│ │MemoryManager│  │
│  └──────────┘ └───────────┘ └──────────┘ └─────────────┘  │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────┐  │
│  │SkillsMgr │ │MCP Manager│ │Subagent  │ │Provider     │  │
│  │          │ │           │ │Manager   │ │Resolver     │  │
│  └──────────┘ └───────────┘ └──────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Packages/DB (packages/db)                │
│              Drizzle ORM + SQLite/SQLite                    │
│         Messages │ Sessions │ ToolExecutions               │
└─────────────────────────────────────────────────────────────┘
```

#### Senaryo: Araç Sistemi Mimarisi

```
ToolRegistry
├── Terminal Tool (shell commands)
├── File Tools (read/write/list/search)
├── Web Tools (search/fetch)
├── Browser Tools (playwright-based)
├── Vision Tools (image analysis)
├── Todo Tools (task management)
├── Memory Tools (context injection)
├── Delegate Tools (subagent creation)
└── Code Execution Tools
```

#### Senaryo: LLM Sağlayıcı Mimarisi

```
LLM Provider Resolver
├── OpenAI (GPT-4, GPT-4o, GPT-3.5)
├── OpenRouter (aggregated models)
├── OpenCode (CodeGen, StarCoder)
├── Anthropic (Claude)
├── DeepSeek
└── Gemini
```

#### Senaryo: Memory Sistemi

```
MemoryManager
├── Vector Store (embeddings-based)
├── Session Context (short-term)
├── User Memory (long-term preferences)
└── Importance Scoring
```

#### Senaryo: Skills Sistemi

```
SkillManager
├── Bundled Skills
│   ├── Code Review
│   ├── Plan
│   └── Web Research
├── Custom Skills (user-defined)
└── Skill Parser (markdown-based)
```

#### Senaryo: MCP (Model Context Protocol) Sistemi

```
MCP Manager
├── MCP Client ( SSE/HTTP)
├── MCP Registry
└── Dynamic Tool Loading
```

#### Senaryo: Subagent Sistemi

```
SubagentManager
├── Goal Definition
├── Status Tracking (pending/running/completed/failed)
├── Result Aggregation
└── Parallel Execution
```

#### Senaryo: Cron Job Sistemi

```
CronManager
├── Schedule Definition (cron syntax)
├── Prompt Templates
├── Result Storage
└── Next/Last Run Tracking
```

### Requirement: Veritabanı Şeması

**Tablolar:**

1. **messages**: sessionId, role, content, toolCalls, toolResults, createdAt
2. **sessions**: id, title, model, provider, createdAt, updatedAt
3. **tool_executions**: sessionId, toolName, arguments, result, success, duration
4. **memory**: (runtime, embedding-based)

### Requirement: API Endpoint Yapısı

| Endpoint | Yöntem | Açıklama |
|----------|--------|----------|
| /api/chat | POST | Streaming chat completion |
| /api/sessions | GET/POST | List/Create sessions |
| /api/sessions/[id] | GET/PUT/DELETE | Session CRUD |
| /api/tools | GET | List available tools |
| /api/memory | GET/POST/DELETE | Memory operations |
| /api/memory/usage | GET | Memory usage stats |
| /api/skills | GET/POST | List/Create skills |
| /api/skills/[id] | GET/PUT/DELETE | Skill CRUD |
| /api/skills-hub | GET | Browse skills marketplace |
| /api/subagents | GET/POST | List/Create subagents |
| /api/subagents/[id] | GET/DELETE | Subagent status/delete |
| /api/subagents/[id]/messages | GET/POST | Subagent messaging |
| /api/cron | GET/POST | List/Create cron jobs |
| /api/cron/[id] | GET/PUT/DELETE | Cron job CRUD |
| /api/mcp | GET/POST | List/Create MCP servers |
| /api/mcp/[id] | GET/DELETE | MCP server status/delete |
| /api/provider | GET | Provider configuration |
| /api/search | POST | Web search |
| /api/config | GET | App configuration |

### Requirement: Frontend Bileşen Yapısı

```
components/
├── chat/
│   └── chat-interface.tsx (Main chat UI)
├── ui/ (Shadcn/ui components)
│   ├── avatar.tsx
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── dropdown-menu.tsx
│   ├── input.tsx
│   ├── scroll-area.tsx
│   ├── separator.tsx
│   ├── sonner.tsx (toast notifications)
│   ├── textarea.tsx
│   └── tooltip.tsx
├── context-panel.tsx (Tool/Memory/Skills tabs)
├── cron-manager.tsx (Cron job UI)
├── memory-viewer.tsx (Memory inspection)
├── provider-selector.tsx (LLM provider config)
├── session-sidebar.tsx (Session list)
├── settings-panel.tsx (API keys, config)
├── skill-browser.tsx (Skills UI)
├── streaming-display.tsx (Token counter)
├── subagent-dashboard.tsx (Subagent management)
├── theme-toggle.tsx (Dark/light mode)
├── tool-call-panel.tsx (Tool execution display)
└── toolset-manager.tsx (Tool enable/disable)
```

### Requirement: State Management

**Zustand Store** (`lib/store.ts`):

- Messages (chat history)
- Sessions (conversation list)
- Config (provider, model, API key)
- Toolsets (enable/disable tools)
- Memory (context data)
- Skills (available skills)
- Subagents (running tasks)
- CronJobs (scheduled tasks)
- UI State (sidebar, context panel)

### Requirement: Streaming Mimari

```
User Input → API Route → ChatEngine → LLM Stream
                ↓
         Tool Execution (if needed)
                ↓
         DB Storage (onFinish)
                ↓
         Frontend SSE Display
```

## REMOVED Requirements

Yok.

## Implementation Notları

### Teknoloji Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Node.js, Vercel AI SDK, AI SDK OpenAI Provider
- **Database**: Drizzle ORM, SQLite (libsql)
- **State**: Zustand with persist middleware
- **Package Manager**: pnpm (workspace)
- **Build**: Turbo by Vercel

### Güvenlik Notları

- API key'ler yalnızca client tarafında saklanır (localStorage)
- Backend doğrudan API key kullanmaz, frontend'den gelen isteklerde taşınır
- Tool execution'ları loglanır (toolExecutions tablosu)

### Deployment

- Docker: development ve production compose dosyaları
- Environment variables: .env.example referans alınır
