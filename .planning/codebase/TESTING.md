# Testing Patterns

**Analysis Date:** 2026-05-17

## Test Framework

**Runner:** Vitest v4.1.6
- Config: `apps/web/vitest.config.ts` (web app), `packages/core/vitest.config.ts` (core package)
- Monorepo orchestration via `turbo run test` (root `turbo.json` defines `test` task with `dependsOn: ["^build"]`)

**Assertion Library:** Built-in Vitest `expect` + `@testing-library/jest-dom/vitest` for DOM matchers.

**DOM Environment:** `happy-dom` v20.9.0 (web app only)

**Run Commands:**
```bash
pnpm test                    # Run all tests via Turbo
pnpm --filter web test       # Web app tests only
pnpm --filter web test:watch # Watch mode
pnpm --filter web test:coverage # With coverage
pnpm --filter core test      # Core package tests only
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
- Custom `localStorage` mock for happy-dom (missing by default)
- API fetch blocker — any `fetch` call to `/api/` URLs is rejected with a `TypeError` to prevent accidental real API calls in tests
- `FormData` is available natively in happy-dom

## Test File Organization

**Location:** `__tests__/` subdirectory co-located with the module under test

**Naming:** `<source-file-name>.test.ts` or `.test.tsx`

**Discovered test files:**
```
apps/web/
  lib/__tests__/
    store.test.ts                # Zustand store (unit)
    utils.test.ts                # Utility functions (unit)
    rate-limit.test.ts           # Rate limiter (unit)
  components/chat/__tests__/
    message-bubble.test.tsx      # React component (component test)
  app/api/chat/__tests__/
    route.test.ts                # Chat API request validation schema (unit)

packages/core/
  src/tools/__tests__/
    path-security.test.ts        # Path security function (unit)
```

**Total:** 6 test files across the monorepo
- 5 in `apps/web/`
- 1 in `packages/core/`

## Test Structure

**Suite Organization:**
All tests use Vitest's BDD-style `describe`/`it`/`expect` pattern with `beforeEach`/`afterEach` hooks:

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

**React Testing Library queries used:** `screen.getByText()` — simple text matching for content verification.

## Mocking

**Framework:** No external mocking library used. The codebase relies on:
1. **Direct Zustand state manipulation** for store tests:
   ```typescript
   useChatStore.setState({ hydrated: false, sessions: [], activeSessionId: null });
   ```
2. **Function replacement** for testing store methods:
   ```typescript
   const originalHydrate = useChatStore.getState().hydrate;
   useChatStore.setState({
     hydrate: async () => {
       callCount++;
       useChatStore.setState({ hydrated: true });
     },
   });
   ```
3. **API call blocking** via global `fetch` override in `vitest.setup.ts`:
   ```typescript
   globalThis.fetch = ((input, init) => {
     if (url.startsWith("/api/")) {
       return Promise.reject(new TypeError(`Unit test API request blocked: ${url}`));
     }
     // ...
   }) as typeof fetch;
   ```
4. **DOM event simulation** for keyboard interaction tests:
   ```typescript
   const div = document.createElement("div");
   div.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
   ```
5. **No mocking for external dependencies** — `path-security.test.ts` relies on real filesystem behavior (process.cwd(), OS-specific paths)

**What is NOT mocked:**
- Filesystem calls (`fs` / `process.cwd()`)
- `requestAnimationFrame` (works in happy-dom)
- `setTimeout` / timers (used directly, no `vi.useFakeTimers`)
- `crypto` (not needed)

## Fixtures and Factories

**Test Data:** Inline in test files — no dedicated fixtures directory.

```typescript
// In store.test.ts — inline session/message data
const sessions = [
  {
    id: "s1", title: "React Setup", messages: [], createdAt: 1, updatedAt: 1,
  },
  // ...
];
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

**Location files:**
- Not applicable — no external fixture files found.

## Coverage

**Requirements:** No coverage target enforced in configuration (no `vitest.config.ts` threshold settings).

**View Coverage:**
```bash
pnpm --filter web test:coverage
```

Coverage is opt-in via the `test:coverage` script — not run by default.

## Test Types

### Unit Tests (6 test files, ~57 test cases)

**`apps/web/lib/__tests__/store.test.ts`** — 20 test cases across 10 `describe` blocks:
- `genId` — uniqueness, non-empty
- `rollbackSessions` — restores original content, restores deleted sessions, restores new messages in existing sessions
- `hydrate` — flag behavior, single call tracking
- `createSession` — no ghost sessions on API failure, syncing flag reset
- File persistence — `displayContent` vs `content` fields, fallback behavior
- Session search — title-only filtering, empty search, message content exclusion
- Settings panel — conditional `aria-modal`
- SessionItem — `div[role="button"]` pattern, keyboard Enter/Space handling
- Sessions — empty initialization, set active, sidebar toggle, compare mode, model cap at 2
- Local messages — append, patch via `requestAnimationFrame`, setConfig

**`apps/web/lib/__tests__/utils.test.ts`** — 12 test cases across 3 `describe` blocks:
- `cn` — class merging, conflict resolution, conditionals, empty input
- `estimateTokens` — empty array, character estimation, multiple messages
- `getErrorMessage` — Error instances, strings, objects, unknown values

**`apps/web/lib/__tests__/rate-limit.test.ts`** — 4 test cases:
- First request allowed, blocking at limit, window expiry reset, separate IP windows

**`apps/web/app/api/chat/__tests__/route.test.ts`** — 9 test cases:
- Zod schema validation: valid body, empty messages, invalid role, invalid provider, optional apiKey, missing messages, optional projectRootPath, max messages

**`packages/core/src/tools/__tests__/path-security.test.ts`** — 5 test cases:
- Relative paths, absolute paths, paths outside workspace, `/proc` rejection, `/sys` rejection

### Component Tests (1 test file, 4 test cases)

**`apps/web/components/chat/__tests__/message-bubble.test.tsx`** — 4 test cases:
- Renders user message, renders assistant message, renders model label, renders error state

### Integration / E2E Tests
- **Not present** in the codebase. No Playwright, Cypress, or any browser-level testing framework configured.

## Common Patterns

**Store reset pattern:**
```typescript
beforeEach(() => {
  useChatStore.setState({
    projects: [],
    activeProjectId: null,
    sessions: [],
    // ...all initial state fields
  });
});
```

**Schema validation test pattern (route.test.ts):**
```typescript
const validBody = { messages: [...], provider: "...", model: "...", apiKey: "..." };

it("accepts valid request", () => {
  expect(() => RequestSchema.parse(validBody)).not.toThrow();
});

it("rejects empty messages", () => {
  expect(() =>
    RequestSchema.parse({ ...validBody, messages: [] })
  ).toThrow();
});
```

**Error state test pattern:**
```typescript
const errorMsg = { ...assistantMsg, content: "Error: API timeout" };
render(<MessageBubble message={errorMsg} index={0} />);
expect(screen.getByText("Error: API timeout")).toBeInTheDocument();
```

**Async test pattern (using real timers):**
```typescript
it("resets after window expires", () => {
  // ...
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const third = rateLimit(ip, { maxRequests: 3, windowMs: 10 });
      expect(third.allowed).toBe(true);
      resolve();
    }, 20);
  });
});
```

**Async test pattern (using requestAnimationFrame):**
```typescript
it("patchLocalMessage updates content via requestAnimationFrame", async () => {
  // ...
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
| **API routes** | 22 route files in `app/api/` | Only chat route schema validation tested | High — most routes have no tests |
| **DB helpers** | `lib/db.ts` | None | High — core data access layer |
| **Sidebar component** | `components/layout/sidebar.tsx` | None | Medium — session list, keyboard nav |
| **Context panel** | `components/layout/context-panel.tsx` | None | Medium |
| **File upload** | `components/chat/file-upload.tsx` | None | Medium |
| **Chat input** | `components/chat/chat-input.tsx` | None | Medium |
| **Settings panel** | `components/settings-panel.tsx` | Minimal (store state only) | Medium |
| **Obsidian sync** | `lib/obsidian.ts` (implied) | None | Low (experimental feature) |
| **Auth routes** | `app/api/auth/*` | None | High — security-critical |
| **Core tools** | `packages/core/src/tools/*.ts` | Only `path-security.test.ts` | High — 10 of 11 tools untested |
| **Context compression** | `packages/core/src/context.ts` | None | Medium |
| **Terminal tool** | `packages/core/src/tools/terminal/` | None | Medium |
| **Execute code tool** | `packages/core/src/tools/execute-code/` | None | Medium |
| **Migration runner** | `packages/db/src/migrate.ts` | None | Low (Drizzle-managed) |
| **E2E flows** | — | None | High — no browser tests |

### Notable Gaps:
1. **No API route integration tests** — Routes like `/api/sessions`, `/api/messages`, `/api/auth/*` are completely untested despite using complex data operations
2. **No tool execution tests** — Only path security is tested; the actual tool implementations (terminal, file-read, file-write, web-search, etc.) have zero test coverage
3. **No component interaction tests** — `MessageBubble` tests verify rendering but not user interactions (edit, copy, retry)
4. **No snapshot tests** — No use of Vitest snapshot testing
5. **No E2E tests** — No Playwright or Cypress setup
6. **No fixture factories** — Test data is duplicated inline across files
7. **No `vi.mock()` usage** — Mocking is done via direct state manipulation rather than Vitest's `vi.mock()`

---

*Testing analysis: 2026-05-17*
