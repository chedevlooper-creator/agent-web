# Code Quality & Architecture Improvement

2026-05-16 — Agent Web monorepo

## Goal

Decompose `chat-interface.tsx` (1200+ lines), add test infra, standardize error handling and async state patterns.

## 1. Component Decomposition

`chat-interface.tsx` → 9 files under `components/chat/`:

| File | Lines | Responsibility |
|------|-------|---------------|
| `chat-interface.tsx` | ~250 | Orchestrator: stream lifecycle, scroll, prop distribution |
| `message-bubble.tsx` | ~200 | Single message: render markdown, edit, copy, delete |
| `tool-call-bubble.tsx` | ~80 | Tool invocation: expand/collapse, arg/result display |
| `compare-row.tsx` | ~120 | A/B side-by-side response comparison |
| `chat-input.tsx` | ~150 | Textarea with auto-resize, submit, stop, file attach trigger |
| `file-upload.tsx` | ~100 | Upload preview, file type icon, format info |
| `typing-indicator.tsx` | ~20 | Three-dot bouncing animation |
| `welcome-hero.tsx` | ~80 | Empty-state hero with suggestions |
| `markdown-renderer.tsx` | ~40 | `react-markdown` + `SyntaxHighlighter` wrapper |

**Contract:** Child components receive data via props only. No direct store access. Only `chat-interface.tsx` reads from `useChatStore` and distributes downward.

## 2. Custom Hooks

`lib/hooks.ts`:

- `useStreamChat(sessionId, provider, model, apiKey)` — fetch + SSE parse loop + RAF-batched patch, returns `{ stream, abort, isStreaming, error }`
- `useScrollAnchor(messageCount)` — auto-scroll to bottom, detects manual scroll-up to pause, "scroll to bottom" button
- `useFileUpload(sessionId)` — file upload state management

## 3. Error Boundary & Async Patterns

- `components/error-boundary.tsx` — `ChatErrorBoundary` with fallback UI; wraps main chat area
- `components/async-view.tsx` — `<AsyncView data={x} isLoading error empty />` renders correct state. Children: `<AsyncLoading>`, `<AsyncError>`, `<AsyncEmpty>`

Error handling rules:
- Stream errors → toast + inline error message in bubble
- API errors → toast with actionable message
- Uncaught render errors → error boundary fallback with retry

## 4. Test Infrastructure

- **Vitest** + `@testing-library/react` + `happy-dom`
- Config: `vitest.config.ts` at package root
- Test files:
  - `lib/__tests__/store.test.ts` — Zustand actions (createSession, addMessage, deleteSession, hydrate)
  - `lib/__tests__/utils.test.ts` — `cn()`, `estimateTokens()`
  - `app/api/chat/__tests__/route.test.ts` — Zod validation, provider routing
  - `components/chat/__tests__/message-bubble.test.tsx` — smoke render
- Scripts: `pnpm test`, `pnpm test:watch`, `pnpm test:coverage`

## 5. Final Structure

```
apps/web/
├── components/
│   ├── chat/
│   │   ├── chat-interface.tsx
│   │   ├── message-bubble.tsx
│   │   ├── tool-call-bubble.tsx
│   │   ├── compare-row.tsx
│   │   ├── chat-input.tsx
│   │   ├── file-upload.tsx
│   │   ├── typing-indicator.tsx
│   │   ├── welcome-hero.tsx
│   │   ├── markdown-renderer.tsx
│   │   └── __tests__/
│   │       └── message-bubble.test.tsx
│   ├── error-boundary.tsx
│   └── async-view.tsx
├── lib/
│   ├── hooks.ts
│   └── __tests__/
│       ├── store.test.ts
│       └── utils.test.ts
└── app/
    └── api/chat/__tests__/
        └── route.test.ts
```

## Non-scope

- No DB schema changes
- No provider/tool changes
- No CSS/design token changes
- No Docker changes

## Risks

- Streaming behavior must preserve parity (no dropped tokens, no reorder)
- Zustand selectors must not introduce re-render regressions
- File structure changes must update all imports
