# Testing Patterns

**Analysis Date:** 2026-05-17

## Test Framework

**Runner:** Vitest v4.1.6
- Config: `apps/web/vitest.config.ts` (web), `packages/core/vitest.config.ts` (core)
- Turbo orchestration: `turbo run test` (dependsOn: `["^build"]`)

**Assertion:** Built-in Vitest `expect` + `@testing-library/jest-dom/vitest`

**DOM env:** `happy-dom` v20.9.0 (web only)

**Run commands:**
```bash
pnpm test                    # All via Turbo
pnpm --filter web test       # Web only
pnpm --filter web test:watch # Watch
pnpm --filter web test:coverage # Coverage
pnpm --filter core test      # Core only
```

## Test Configurations

### `apps/web/vitest.config.ts`
```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@agent-web/core": path.resolve(__dirname, "../../packages/core/src"),
      "@agent-web/db": path.resolve(__dirname, "../../packages/db/src"),
    },
  },
});
```

### `packages/core/vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

### Test setup (`apps/web/vitest.setup.ts`)
Provides:
- `@testing-library/jest-dom/vitest` imports
- Custom `localStorage` mock for happy-dom
- API fetch blocker — rejects `/api/` calls with `TypeError`
- `FormData` native in happy-dom

## Test File Organization

**Location:** `__tests__/` subdir co-located with module

**Naming:** `<source>.test.ts` or `.test.tsx`

**Discovered files:**
```
apps/web/
  lib/__tests__/
    store.test.ts                # Zustand store
    utils.test.ts                # Utility functions
    rate-limit.test.ts           # Rate limiter
  components/chat/__tests__/
    message-bubble.test.tsx      # Component test
  app/api/chat/__tests__/
    route.test.ts                # Chat API schema validation

packages/core/
  src/tools/__tests__/
    path-security.test.ts        # Path security
```

**Total:** 6 test files — 5 in `apps/web/`, 1 in `packages/core/`

## Test Structure

All use BDD-style `describe`/`it`/`expect` with `beforeEach`/`afterEach`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, genId, snapshotSessions, rollbackSessions } from "../store";

beforeEach(() => {
  useChatStore.setState({ /* reset state */ });
});

describe("genId", () => {
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => genId()));
    expect(ids.size).toBe(100);
  });
});
```

**Component tests** use `@testing-library/react`:
```typescript
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MessageBubble } from "../message-bubble";

afterEach(cleanup);

describe("MessageBubble", () => {
  it("renders user message", () => {
    render(<MessageBubble message={userMsg} index={0} />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });
});
```

**Queries used:** `screen.getByText()` — simple text matching.

## Mocking

**No external mocking library.** Relies on:
1. **Direct Zustand state manipulation:**
   ```typescript
   useChatStore.setState({ hydrated: false, sessions: [], activeSessionId: null });
   ```
2. **Function replacement** for store methods:
   ```typescript
   const originalHydrate = useChatStore.getState().hydrate;
   useChatStore.setState({
     hydrate: async () => { callCount++; useChatStore.setState({ hydrated: true }); },
   });
   ```
3. **API call blocking** via global `fetch` override in `vitest.setup.ts`
4. **DOM event simulation:**
   ```typescript
   div.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
   ```
5. **No mocking for external deps** — `path-security.test.ts` uses real FS

**Not mocked:** `fs`, `process.cwd()`, `requestAnimationFrame`, `setTimeout`, `crypto`

## Fixtures and Factories

**Test data:** Inline in test files — no dedicated fixtures.

```typescript
// In store.test.ts — inline session data
const sessions = [{ id: "s1", title: "React Setup", messages: [], createdAt: 1, updatedAt: 1 }];
```

```typescript
// In route.test.ts — inline request body
const validBody = {
  messages: [{ role: "user", content: "Hello" }],
  provider: "openrouter",
  model: "openai/gpt-4o-mini",
  apiKey: "sk-test",
};
```

**Location files:** Not applicable — none found.

## Coverage

**Requirements:** No coverage target enforced (no threshold in config).

**View:**
```bash
pnpm --filter web test:coverage
```
Coverage opt-in via `test:coverage` script.

## Test Types

### Unit Tests (6 files, ~57 cases)

**`apps/web/lib/__tests__/store.test.ts`** — 20 cases, 10 describe blocks:
- `genId` — uniqueness, non-empty
- `rollbackSessions` — restore content, restore deleted, restore new messages
- `hydrate` — flag behavior, single call
- `createSession` — no ghost sessions on API failure, syncing flag
- File persistence — `displayContent` vs `content`
- Session search — title only, empty, message content exclusion
- Settings panel — conditional `aria-modal`
- SessionItem — `div[role="button"]`, keyboard Enter/Space
- Sessions — empty init, set active, sidebar toggle, compare mode, model cap at 2
- Local messages — append, patch via RAF, setConfig

**`apps/web/lib/__tests__/utils.test.ts`** — 12 cases, 3 describe blocks:
- `cn` — merging, conflict resolution, conditionals, empty
- `estimateTokens` — empty, character estimation, multiple messages
- `getErrorMessage` — Error instances, strings, objects, unknown

**`apps/web/lib/__tests__/rate-limit.test.ts`** — 4 cases:
- First allowed, blocking at limit, window expiry reset, separate IP windows

**`apps/web/app/api/chat/__tests__/route.test.ts`** — 9 cases:
- Zod: valid body, empty messages, invalid role, invalid provider, optional apiKey, missing messages, optional projectRootPath, max messages

**`packages/core/src/tools/__tests__/path-security.test.ts`** — 5 cases:
- Relative paths, absolute, outside workspace, `/proc` rejection, `/sys` rejection

### Component Tests (1 file, 4 cases)

**`apps/web/components/chat/__tests__/message-bubble.test.tsx`**:
- Renders user message, renders assistant, renders model label, renders error state

### Integration / E2E
- **None** — no Playwright/Cypress/browser-level testing.

## Common Patterns

**Store reset:**
```typescript
beforeEach(() => {
  useChatStore.setState({ projects: [], activeProjectId: null, sessions: [], /* ...all fields */ });
});
```

**Schema validation (route.test.ts):**
```typescript
const validBody = { messages: [...], provider: "...", model: "...", apiKey: "..." };

it("accepts valid request", () => {
  expect(() => RequestSchema.parse(validBody)).not.toThrow();
});

it("rejects empty messages", () => {
  expect(() => RequestSchema.parse({ ...validBody, messages: [] })).toThrow();
});
```

**Error state:**
```typescript
const errorMsg = { ...assistantMsg, content: "Error: API timeout" };
render(<MessageBubble message={errorMsg} index={0} />);
expect(screen.getByText("Error: API timeout")).toBeInTheDocument();
```

**Async with real timers:**
```typescript
it("resets after window expires", () => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const third = rateLimit(ip, { maxRequests: 3, windowMs: 10 });
      expect(third.allowed).toBe(true);
      resolve();
    }, 20);
  });
});
```

**Async with requestAnimationFrame:**
```typescript
it("patchLocalMessage updates content via requestAnimationFrame", async () => {
  useChatStore.getState().patchLocalMessage("m1", "new");
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      expect(session?.messages[0].content).toBe("new");
      resolve();
    });
  });
});
```

## Test Coverage Gaps

| Area | Files | Current Tests | Risk |
|------|-------|---------------|------|
| **API routes** | 22 route files | Only chat schema validated | High |
| **DB helpers** | `lib/db.ts` | None | High |
| **Sidebar** | `components/layout/sidebar.tsx` | None | Medium |
| **Context panel** | `components/layout/context-panel.tsx` | None | Medium |
| **File upload** | `components/chat/file-upload.tsx` | None | Medium |
| **Chat input** | `components/chat/chat-input.tsx` | None | Medium |
| **Settings panel** | `components/settings-panel.tsx` | Minimal | Medium |
| **Obsidian sync** | `lib/obsidian.ts` | None | Low |
| **Auth routes** | `app/api/auth/*` | None | High |
| **Core tools** | `packages/core/src/tools/*.ts` | Only path-security | High |
| **Context compression** | `packages/core/src/context.ts` | None | Medium |
| **Terminal tool** | `packages/core/src/tools/terminal/` | None | Medium |
| **Execute code** | `packages/core/src/tools/execute-code/` | None | Medium |
| **Migration runner** | `packages/db/src/migrate.ts` | None | Low |
| **E2E flows** | — | None | High |

### Notable Gaps:
1. **No API route integration tests** — `/api/sessions`, `/api/messages`, `/api/auth/*` untested
2. **No tool execution tests** — only path-security tested
3. **No component interaction tests** — MessageBubble tests rendering only
4. **No snapshot tests**
5. **No E2E tests** — no Playwright/Cypress
6. **No fixture factories** — data duplicated inline
7. **No `vi.mock()` usage** — direct state manipulation instead

---

*Testing analysis: 2026-05-17*
