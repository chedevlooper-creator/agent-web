# Coding Conventions

**Analysis Date:** 2026-05-17

## Naming Patterns

**Files:**
- kebab-case for all files (`store.ts`, `web-search.ts`, `chat-interface.tsx`)
- PascalCase.tsx for React components (`ChatInterface.tsx`, `MessageBubble.tsx`)
- camelCase for utility/lib modules (`db.ts`, `crypto.ts`, `utils.ts`)
- `route.ts` for Next.js App Router API handlers (under `app/api/<name>/route.ts`)
- `*.test.ts` / `*.test.tsx` — some colocated in `__tests__/` dirs, some alongside source
- kebab-case for multi-word tool filenames (`file-read.ts`, `list-directory.ts`)

**Functions:**
- camelCase for all functions, async or sync
- Named exports for all functions (`export function genId()`)
- React hooks: `use` prefix consistently (`useChatStore`, not as custom hooks but Zustand store)
- Event handlers: `handleSend`, `handleKeyDown`, `handleFileSelect`

**Variables:**
- camelCase for regular variables
- `UPPER_SNAKE_CASE` for constants: `ENCRYPTION_KEY`, `DATABASE_URL`, `MAX_TOOL_CALLS`
- `as const` assertions for literal types

**Types:**
- PascalCase for interfaces (`ChatMessage`, `Session`, `ToolInvocation`, `DbProject`)
- PascalCase for type aliases (`Role`) 
- No `I` prefix for interfaces
- `Props` suffix for component props types (inferred from filenames)
- `Data` suffix for API-facing types (`ChatMessageData`, `SessionData` from `@agent-web/core`)
- `type` keyword preferred over `interface` for unions and utility types

## Code Style

**Formatting:**
- Prettier 3.x with defaults (no `.prettierrc` file — defaults: double quotes, semicolons, 80 char width — but codebase uses varied patterns)
- Actual observed style: **double quotes**, **semicolons**, 2-space indentation

**Linting:**
- ESLint 9 (flat config at `eslint.config.mjs`)
- Extends: `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`
- No custom rules observed beyond Next.js presets
- Run: `pnpm lint`

**TypeScript:**
- Strict mode enabled in all `tsconfig.json` files
- `"type": "module"` in all `package.json` files (ESM)
- NodeNext or Bundler module resolution

## Import Organization

**Order** (observed pattern in most files):
1. External packages (`"zustand"`, `"next/navigation"`, `"ai"`)
2. Internal workspace packages (`"@agent-web/core"`, `"@agent-web/db"`)
3. Node.js built-ins (`"node:path"`, `"node:crypto"`)
4. Relative imports (`"../store"`, `"./utils"`)
5. CSS imports last (`"./globals.css"`)

**Grouping:**
- Blank line between external, internal, and relative groups
- No strict alphabetical sorting within groups

**Path Aliases:**
- `@/` maps to `apps/web/` root (in vitest.config.ts and tsconfig)
- `@agent-web/core` — workspace package
- `@agent-web/db` — workspace package

**Type Imports:**
- `import type { X }` syntax used consistently for type-only imports
- Mixed inline in some files

## Error Handling

**Patterns:**

| Pattern | Where Used | Example Files |
|---------|-----------|---------------|
| Try/catch at boundaries | API route handlers, DB operations | `chat/route.ts`, `lib/db.ts` |
| Snapshot + rollback | Optimistic state updates | `lib/store.ts` — `snapshotSessions()`, `rollbackSessions()` |
| `[error]` prefix on tool results | Tools return error strings, not throw | `packages/core/src/tools/*.ts` |
| Zod `safeParse` | Schema validation in API routes | `chat/route.ts`, API validation |
| React ErrorBoundary | Class component at root layout | `components/error-boundary.tsx`, `ChatErrorBoundary` in `layout.tsx` |

**Error Types:**
- Standard `Error` class with descriptive messages
- No custom error classes observed
- DB operations: return `{ error }` objects with HTTP status codes

**Async:**
- `try/catch` in async functions
- No `.catch()` chains
- Retry logic in `streamChat()` — up to 2 retries on network/5xx/429

## Logging

- `console.error()` for errors — no structured logging framework
- No `console.log()` in production code (lint rule from Next.js)
- No logging abstraction or levels

## Comments

**When to Comment:**
- Sparse — code is mostly self-documenting with descriptive names
- Section headers with `// ===== Section Title =====` pattern in `store.ts` and test files
- JSDoc on public API functions like `resolveSafePath()`
- Bug-numbered test titles: `describe("Bug 1 — ...")`, `describe("Bug 2 — ...")`

**JSDoc/TSDoc:**
- Minimal. Used on exported utility functions (`resolveSafePath` has full JSDoc with description, params, returns)
- No `@param` / `@returns` on most functions

**TODO Comments:**
- Not found in the codebase — no TODO/FIXME/HACK comments detected

## Function Design

**Size:**
- Wide range: 2-line utilities (`cn()`) to ~430-line store (`lib/store.ts`)
- Most tool functions 20-60 lines
- Complex handlers up to ~100 lines (`handleSend` in `chat-interface.tsx`)

**Parameters:**
- 1-3 parameters typical
- Options objects for complex config (Zustand `setState` callbacks, API payloads)
- Destructuring in parameter lists

**Return Values:**
- Explicit `return` statements
- Early returns for guard clauses
- `undefined` for unhandled branches

## Module Design

**Exports:**
- Named exports for all functions and components (`export function ChatInterface`, `export function genId`)
- Default exports not used
- Barrel files via `index.ts` in packages (`packages/core/src/index.ts`, `packages/db/src/index.ts`)
- Subpath exports via `package.json` exports field

**Monorepo-specific:**
- pnpm workspaces with `apps/` and `packages/` directories
- Each package has its own `tsconfig.json` and builds independently
- `turbo.json` orchestrates build/dev/lint/test tasks

**Client vs Server:**
- `"use client"` required at top of interactive components (all chat/layout components)
- `"server-only"` import in server-side modules (`lib/db.ts`, `lib/crypto.ts`)

---

*Convention analysis: 2026-05-17*
*Update when patterns change*
