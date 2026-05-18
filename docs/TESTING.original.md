<!-- generated-by: gsd-doc-writer -->
# Testing

This document describes the testing setup, conventions, and patterns used in the Agent Web monorepo.

## Test Framework and Setup

The project uses [Vitest](https://vitest.dev/) (v4.1.6) as its test runner across all workspaces. Each workspace has its own `vitest.config.ts` tailored to its runtime environment.

### `apps/web` — Frontend (Next.js)

Configuration at `apps/web/vitest.config.ts`:

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
- **Environment**: `happy-dom` (a lightweight browser-like environment) rather than a full jsdom. This is sufficient for component rendering tests.
- **Plugin**: `@vitejs/plugin-react` enables JSX/TSX transformation.
- **Aliases**: `@` maps to the app root, and `@agent-web/core` / `@agent-web/db` resolve to their source directories so tests import live source — no build step required.
- **Setup file**: `vitest.setup.ts` runs before every test file (see below).

### `apps/web` — Setup File

Configuration at `apps/web/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

This imports the custom matchers from `@testing-library/jest-dom` (`.toBeInTheDocument()`, `.toHaveClass()`, etc.) and registers them globally with Vitest's `expect`.

The setup file also provides two polyfills:

1. **localStorage mock** — `happy-dom` does not support localStorage without a localstorage file flag, so the setup creates a minimal in-memory implementation for Zustand's persist middleware.

2. **fetch blocker** — Any `fetch("/api/...")` call made during a unit test is intercepted and rejected with a `TypeError`. This prevents accidental network requests and forces tests to mock API calls explicitly.

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

Configuration at `packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Key details:
- **Environment**: `node` — no DOM simulation needed since this is a library package.
- **Include pattern**: Only `src/**/*.test.ts` files are picked up (no `.tsx`).

### `packages/db` — Database

The `packages/db` workspace does not currently have a `vitest.config.ts` or any test files. Tests would need to be added and follow the `@agent-web/core` pattern.

## Test Organization

Tests are placed in `__tests__` directories co-located with the module under test.

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

This co-location approach keeps tests close to the source they verify, making imports predictable and ensuring tests are not missed when a module is moved or deleted.

## Running Tests

### Monorepo-wide (via Turbo)

```bash
# Run all tests in all workspaces
pnpm test
```

This delegates to `turbo run test`, which runs the `test` script in each workspace. Test execution order follows the dependency graph defined by `turbo.json`.

### Per-workspace

**apps/web:**
```bash
cd apps/web

# Run all tests (single run)
pnpm test              # vitest run

# Watch mode (re-run on changes)
pnpm test:watch        # vitest

# With coverage report
pnpm test:coverage     # vitest run --coverage
```

**packages/core:**
```bash
cd packages/core

# Run all tests
pnpm test              # vitest run
```

### Filtering specific tests

Use Vitest's built-in test filtering:

```bash
# Run by file name pattern
pnpm test -- store          # matches store.test.ts
pnpm test -- utils          # matches utils.test.ts

# Run by `describe` or `it` pattern (Vitest >= 4)
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

Pattern: Import the function, call it with known inputs, assert on the return value. No setup, no mocks.

### Rate Limiter (In-Memory State)

Test timed logic and numeric boundaries. Example from `lib/__tests__/rate-limit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("allows requests up to the limit and blocks the next", () => {
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
    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = rateLimit(ip, { maxRequests: 3, windowMs: 10 });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2); // Fresh window
        resolve();
      }, 20);
    });
  });
});
```

Pattern: Use short `windowMs` values (10ms) with `setTimeout` to test window expiry. Use unique IPs per test case to avoid cross-test interference.

### Zustand Store

Reset state before each test using `useChatStore.setState()`. Example from `lib/__tests__/store.test.ts`:

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

Then test actions by setting state, calling store methods, and reading back the result:

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

Pattern: Reset the store in `beforeEach`, mutate via `setState()` or action methods, assert via `getState()`. For async actions that make API calls, test the error path (the store should not create ghost state when the API fails).

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

Pattern: Replicate the Zod schema (or import it), create a valid payload, then test boundary cases: empty arrays, invalid enums, missing optional fields, max-length arrays. When the route handler makes external API calls, test only the input validation — the API interaction belongs in integration tests.

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

Pattern: `afterEach(cleanup)` to unmount between cases, define test data objects, render the component, and use `screen.getByText()` / `expect().toBeInTheDocument()` for assertions. Due to `happy-dom` limitations, avoid tests that rely on computed styles or complex layout queries.

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

  it("rejects paths outside the workspace", () => {
    expect(() => resolveSafePath("/etc/passwd")).toThrow(
      /resolves outside|system directory/
    );
  });
});
```

Pattern: Test valid paths resolve, test malicious paths throw. Use regex matchers in `toThrow()` for cross-platform error messages.

## Mocking Patterns

### Store State Reset

For Zustand stores, the cleanest mock is calling `useChatStore.setState()` with the full initial state in `beforeEach`. This is preferred over `vi.mock()` because Zustand stores expose their state synchronously.

### Fetch Blocking

The `vitest.setup.ts` file blocks all `fetch("/api/...")` calls automatically. If a test needs to test error handling around API calls, simply call the action and catch the thrown error:

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

To test internal logic without triggering side effects, override a store method directly:

```ts
it("hydrate calls the hydrate function", async () => {
  useChatStore.setState({ hydrated: false });
  let callCount = 0;
  useChatStore.setState({
    hydrate: async () => { callCount++; },
  });
  await useChatStore.getState().hydrate();
  expect(callCount).toBe(1);
});
```

Remember to restore the original method after the test if other tests depend on it.

### Keyboard and DOM Events

For component interaction tests, create DOM elements programmatically and dispatch real events:

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

1. Create a `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

2. Add the test script to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

3. Place tests in `__tests__` directories next to their source files.

4. Turbo detects the new `test` script automatically via `pnpm-workspace.yaml`.

## Coverage

Run coverage with:

```bash
cd apps/web
pnpm test:coverage
```

No coverage threshold is currently configured. To add one, set `coverage.threshold` in `vitest.config.ts`:

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

Tests are included in the monorepo CI pipeline via `turbo run test`. When a CI workflow is added, the test step runs:

```bash
pnpm install
pnpm test
```

This ensures all workspaces are tested before merge, with Turbo's caching skipping workspaces whose inputs have not changed.
