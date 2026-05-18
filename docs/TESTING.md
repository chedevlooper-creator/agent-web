# Testing

Testing setup, conventions, and patterns used in Agent Web monorepo.

## Test Framework and Setup

[Vitest](https://vitest.dev/) (v4.1.6) across all workspaces. Each workspace has own `vitest.config.ts`.

### `apps/web` — Frontend (Next.js)

Config at `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    env: {
      NODE_ENV: "test",
    },
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

Key details:
- **Environment**: `happy-dom` — lightweight browser-like env, sufficient for component rendering.
- **Plugin**: `@vitejs/plugin-react` enables JSX/TSX transform.
- **Aliases**: `@` → app root, `@agent-web/core` / `@agent-web/db` → source dirs so tests import live source — no build step.
- **Setup file**: `vitest.setup.ts` runs before every test file.

### `apps/web` — Setup File

Config at `apps/web/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Imports custom matchers (`toBeInTheDocument()`, `toHaveClass()`, etc.) and registers globally with Vitest's `expect`.

Setup file also provides two polyfills:
1. **localStorage mock** — minimal in-memory implementation for Zustand persist middleware.
2. **fetch blocker** — any `fetch("/api/...")` during unit tests intercepted and rejected with `TypeError`. Prevents accidental network requests, forces explicit API mocks.

```ts
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : /* ... */;
  if (url.startsWith("/api/")) {
    return Promise.reject(
      new TypeError(`Unit test API request blocked: ${url}`)
    );
  }
  // ...
}) as typeof fetch;
```

### `packages/core` — Backend/AI Tools

Config at `packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- **Environment**: `node` — no DOM simulation needed.
- **Include pattern**: Only `src/**/*.test.ts` (no `.tsx`).

### `packages/db` — Database

No `vitest.config.ts` or test files currently. Tests would need to be added following `@agent-web/core` pattern.

## Test Organization

Tests in `__tests__` dirs co-located with module under test.

```
apps/web/
  app/api/chat/__tests__/route.test.ts
  components/chat/__tests__/message-bubble.test.tsx
  lib/__tests__/store.test.ts
  lib/__tests__/rate-limit.test.ts
  lib/__tests__/utils.test.ts

packages/core/
  src/tools/__tests__/path-security.test.ts
```

Co-location keeps tests close to source, imports predictable, tests not missed when module moved/deleted.

## Running Tests

### Monorepo-wide (via Turbo)

```bash
pnpm test
```

Delegates to `turbo run test`, execution order follows dependency graph from `turbo.json`.

### Per-workspace

**apps/web:**
```bash
cd apps/web
pnpm test              # vitest run
pnpm test:watch        # vitest
pnpm test:coverage     # vitest run --coverage
```

**packages/core:**
```bash
cd packages/core
pnpm test              # vitest run
```

### Filtering specific tests

```bash
# By file name pattern
pnpm test -- store          # matches store.test.ts
pnpm test -- utils          # matches utils.test.ts

# By `describe` or `it` pattern (Vitest >= 4)
pnpm test -- -t "genId"
pnpm test -- -t "rateLimit"
```

## Writing Tests

### Utility Functions

Test pure functions directly — no mocking needed. Example from `lib/__tests__/utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cn, estimateTokens, getErrorMessage } from "../utils";

describe("cn", () => {
  it("merges tailwind classes", () => {
    const result = cn("px-4", "py-2");
    expect(result).toBe("px-4 py-2");
  });

  it("resolves conflicts via tailwind-merge", () => {
    const result = cn("px-4", "px-2");
    expect(result).toBe("px-2");
  });

  it("handles conditional classes", () => {
    const result = cn("base", false && "hidden", "extra");
    expect(result).toBe("base extra");
  });
});
```

Pattern: Import function, call with known inputs, assert return value. No setup, no mocks.

### Rate Limiter (In-Memory State)

Test timed logic and numeric boundaries. Example from `lib/__tests__/rate-limit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("allows requests up to limit and blocks next", () => {
    const ip = "test-ip-2";
    for (let i = 0; i < 6; i++) {
      const result = rateLimit(ip, { maxRequests: 5, windowMs: 60000 });
      if (i < 5) {
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      } else {
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      }
    }
  });

  it("resets after window expires", () => {
    const ip = "test-ip-3";
    rateLimit(ip, { maxRequests: 3, windowMs: 10 });
    rateLimit(ip, { maxRequests: 3, windowMs: 10 });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = rateLimit(ip, { maxRequests: 3, windowMs: 10 });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
        resolve();
      }, 20);
    });
  });
});
```

Pattern: Short `windowMs` (10ms) with `setTimeout` for window expiry. Unique IPs per test case to avoid cross-test interference.

### Zustand Store

Reset state before each test with `useChatStore.setState()`. Example from `lib/__tests__/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, genId, snapshotSessions, rollbackSessions } from "../store";

beforeEach(() => {
  useChatStore.setState({
    projects: [],
    activeProjectId: null,
    sessions: [],
    activeSessionId: null,
    hydrated: true,
    syncing: false,
    isLoading: false,
    sidebarOpen: true,
    contextPanelOpen: false,
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    apiKey: "sk-test",
    savedProviders: [],
    selectedModels: [],
    compareMode: false,
  });
});
```

Then test actions by setting state, calling store methods, reading back result:

```ts
it("appendLocalMessage adds message to active session", () => {
  useChatStore.setState({
    sessions: [
      { id: "s1", title: "Chat", messages: [], createdAt: 1, updatedAt: 1 },
    ],
    activeSessionId: "s1",
  });
  const msg = { id: "m1", role: "user" as const, content: "hi", timestamp: Date.now() };
  useChatStore.getState().appendLocalMessage(msg);

  expect(useChatStore.getState().sessions[0].messages).toHaveLength(1);
  expect(useChatStore.getState().sessions[0].messages[0].content).toBe("hi");
});
```

Pattern: Reset store in `beforeEach`, mutate via `setState()` or action methods, assert via `getState()`. For async actions making API calls, test error path (store should not create ghost state on API failure).

### API Route Validation

Test Zod schema validation in isolation. Example from `app/api/chat/__tests__/route.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";

const RequestSchema = z.object({
  messages: z
    .array(z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().max(200_000),
    }))
    .min(1).max(500),
  provider: z.enum(["openai", "openrouter", "opencode", "deepseek"]),
  model: z.string().min(1).max(200),
  apiKey: z.string().optional(),
  projectRootPath: z.string().optional(),
});

describe("Chat API request schema", () => {
  const validBody = {
    messages: [{ role: "user", content: "Hello" }],
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
  };

  it("accepts valid request", () => {
    expect(() => RequestSchema.parse(validBody)).not.toThrow();
  });

  it("rejects empty messages", () => {
    expect(() =>
      RequestSchema.parse({ ...validBody, messages: [] })
    ).toThrow();
  });
});
```

Pattern: Replicate or import Zod schema, create valid payload, test boundary cases: empty arrays, invalid enums, missing optional fields, max-length arrays. When route handler makes external API calls, test only input validation — API interaction belongs in integration tests.

### React Components

Use `@testing-library/react` to render components and assert on DOM output. Example from `components/chat/__tests__/message-bubble.test.tsx`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MessageBubble } from "../message-bubble";

afterEach(cleanup);

const userMsg = {
  id: "1",
  role: "user" as const,
  content: "Hello World",
  timestamp: Date.now(),
};

describe("MessageBubble", () => {
  it("renders user message", () => {
    render(<MessageBubble message={userMsg} index={0} />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders assistant message with model label", () => {
    const assistantMsg = {
      id: "2", role: "assistant" as const,
      content: "Hi there!", model: "gpt-4o-mini", timestamp: Date.now(),
    };
    render(<MessageBubble message={assistantMsg} index={0} />);
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
  });
});
```

Pattern: `afterEach(cleanup)` to unmount between cases, define test data objects, render component, use `screen.getByText()` / `expect().toBeInTheDocument()`. Avoid tests relying on computed styles or complex layout queries (happy-dom limitations).

### Backend Tools (Node)

Test Node.js functions with path resolution and error handling. Example from `packages/core/src/tools/__tests__/path-security.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveSafePath } from "../path-security.js";

describe("resolveSafePath", () => {
  it("resolves relative paths within allowed base", () => {
    const result = resolveSafePath(".");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("rejects paths outside workspace", () => {
    expect(() => resolveSafePath("/etc/passwd")).toThrow(
      /resolves outside|system directory/
    );
  });
});
```

Pattern: Test valid paths resolve, test malicious paths throw. Use regex matchers in `toThrow()` for cross-platform error messages.

## Mocking Patterns

### Store State Reset

For Zustand stores, call `useChatStore.setState()` with full initial state in `beforeEach`. Preferred over `vi.mock()` because Zustand stores expose state synchronously.

### Fetch Blocking

`vitest.setup.ts` blocks all `fetch("/api/...")` calls automatically. To test error handling around API calls, call action and catch thrown error:

```ts
it("does not add session to state when API call fails", async () => {
  useChatStore.setState({ sessions: [], activeSessionId: null });
  try {
    await useChatStore.getState().createSession();
  } catch {
    // Expected — API call fails in test environment
  }
  expect(useChatStore.getState().sessions.length).toBe(0);
});
```

### Overriding Store Methods

To test internal logic without triggering side effects, override store method directly:

```ts
it("hydrate calls hydrate function", async () => {
  useChatStore.setState({ hydrated: false });
  let callCount = 0;
  useChatStore.setState({
    hydrate: async () => { callCount++; },
  });
  await useChatStore.getState().hydrate();
  expect(callCount).toBe(1);
});
```

Restore original method after test if other tests depend on it.

### Keyboard and DOM Events

Create DOM elements programmatically and dispatch real events:

```ts
it("Enter key triggers onSelect", () => {
  let selected = false;
  const onSelect = () => { selected = true; };
  const div = document.createElement("div");
  div.setAttribute("role", "button");
  div.tabIndex = 0;
  div.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); onSelect(); }
  });
  div.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  expect(selected).toBe(true);
});
```

## Adding Tests to a New Workspace

To add tests to `packages/db` or any new package:

1. Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

2. Add test script to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

3. Place tests in `__tests__` dirs next to source files.

4. Turbo detects new `test` script automatically via `pnpm-workspace.yaml`.

## Coverage

Run coverage:

```bash
cd apps/web
pnpm test:coverage
```

No coverage threshold configured. To add one, set `coverage.threshold` in `vitest.config.ts`:

```ts
test: {
  coverage: {
    thresholds: {
      lines: 80,
      branches: 70,
      functions: 80,
      statements: 80,
    },
  },
}
```

## CI Integration

Tests included in monorepo CI via `turbo run test`. CI workflow step:

```bash
pnpm install
pnpm test
```

Ensures all workspaces tested before merge. Turbo caching skips workspaces with unchanged inputs.
