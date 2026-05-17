# Testing Patterns

**Analysis Date:** 2026-05-17

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `apps/web/vitest.config.ts`, `packages/core/vitest.config.ts` (3 configs total)
- DOM environment: happy-dom 20.x via `@testing-library/react`
- Setup: `apps/web/vitest.setup.ts`

**Assertion Library:**
- Vitest built-in `expect`
- `@testing-library/jest-dom/vitest` for DOM matchers (`toBeInTheDocument`, etc.)
- Key matchers: `toBe`, `toEqual`, `toContain`, `toHaveLength`, `toThrow`, `toBeGreaterThan`

**Run Commands:**
```bash
pnpm test                           # Run all tests (via Turbo)
pnpm test:watch                     # Watch mode
pnpm test:coverage                  # Coverage report
cd apps/web && npx vitest run       # Run web app tests only
```

## Test File Organization

**Location:**
- Mixed pattern:
  - `__tests__/` directories for store and utilities: `lib/__tests__/store.test.ts`
  - Colocated with source: `packages/core/src/tools/__tests__/path-security.test.ts`
  - Colocated Next.js convention: `app/api/chat/__tests__/route.test.ts`

**Test files found (5 total):**

| File | Lines | Type |
|------|-------|------|
| `apps/web/lib/__tests__/store.test.ts` | 520 | Store/unit |
| `apps/web/lib/__tests__/utils.test.ts` | — | Utility |
| `apps/web/lib/__tests__/rate-limit.test.ts` | 53 | Utility |
| `apps/web/app/api/chat/__tests__/route.test.ts` | 83 | API schema |
| `packages/core/src/tools/__tests__/path-security.test.ts` | 35 | Unit |

**Naming:**
- `*.test.ts` / `*.test.tsx` — consistent across all tests

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, genId } from "../store";

beforeEach(() => {
  useChatStore.setState({
    // reset state
  });
});

describe("functionName", () => {
  it("should handle success case", () => {
    // arrange
    // act
    // assert
  });
});
```

**Patterns:**
- `beforeEach` for state reset (store tests)
- Implicit arrange/act/assert (not always commented, but structure is clear)
- Bug-numbered test suites: `describe("Bug 1 — scenario", ...)`
- One assertion focus per `it()`, but sometimes multiple expects for related state

## Mocking

**Framework:**
- Vitest built-in (no `vi.mock()` calls found)
- Zustand `useChatStore.setState()` used to set up test state directly
- No module-level mocking (`vi.mock("...")`) in current tests

**Patterns:**
```typescript
// Set Zustand state directly for test setup
useChatStore.setState({
  sessions: [{ id: "s1", title: "Chat", messages: [], createdAt: 1, updatedAt: 1 }],
  activeSessionId: "s1",
});

// Mock function injection
useChatStore.setState({
  hydrate: async () => {
    callCount++;
    useChatStore.setState({ hydrated: true });
  },
});
```

**What to Mock:**
- Zustand store state (via `setState`)
- API calls (blocked by test setup — `/api/*` requests rejected in `vitest.setup.ts`)

**What NOT to Mock:**
- Pure functions
- Zod schema validation (tested with real schemas, not mocks)

**Mock Setup:**
- `vitest.setup.ts` blocks all `/api/` fetch calls in tests (prevents accidental network requests):
```typescript
if (url.startsWith("/api/")) {
  return Promise.reject(new TypeError(`Unit test API request blocked: ${url}`));
}
```

## Fixtures and Factories

**Test Data:**
```typescript
// Inline factory pattern
const msg = {
  id: "m1",
  role: "user" as const,
  content: "full file content",
  displayContent: "display-friendly",
  timestamp: Date.now(),
};

// Repeated test data defined inline (no shared fixtures)
const validBody = {
  messages: [{ role: "user", content: "Hello" }],
  provider: "openrouter",
  model: "openai/gpt-4o-mini",
  apiKey: "sk-test",
};
```

**Location:**
- Test data defined inline within test files
- No separate fixtures directory or factory files
- No shared test utilities across test files

## Coverage

**Requirements:**
- No enforced coverage target
- No coverage configuration in vitest configs
- Run: `pnpm test:coverage` (via Vitest built-in)

**Current State:**
- Low coverage overall (5 test files for a monorepo)
- Store tests cover ~60% of store functions
- No component rendering tests
- No API integration tests (only schema validation)

## Test Types

**Unit Tests:**
- Scope: Single functions (genId, resolveSafePath, rateLimit) or store actions
- No external mocking needed (store state set directly, API calls rejected)
- Examples: `store.test.ts`, `path-security.test.ts`, `rate-limit.test.ts`, `utils.test.ts`

**API Schema Tests:**
- Scope: Zod validation schemas in isolation
- Example: `route.test.ts` tests RequestSchema from chat API route
- Tests: valid/invalid messages, provider, projectRootPath, limits

**Integration Tests:**
- None currently — optimistic update rollback tested via unit tests only
- No full chat flow tests
- No database integration tests

**E2E Tests:**
- None

## Common Patterns

**Async Testing:**
```typescript
it("handles async operation", async () => {
  useChatStore.setState({ hydrated: false });
  await useChatStore.getState().hydrate();
  expect(useChatStore.getState().hydrated).toBe(true);
});
```

**Error Testing:**
```typescript
it("rejects invalid input", () => {
  expect(() => RequestSchema.parse({ ...validBody, messages: [] })).toThrow();
});

it("rejects paths outside workspace", () => {
  expect(() => resolveSafePath("/etc/passwd")).toThrow(/resolves outside|system directory/);
});
```

**Timeout Testing:**
```typescript
it("resets after window expires", () => {
  // ...
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const result = rateLimit(ip, { maxRequests: 3, windowMs: 10 });
      expect(result.remaining).toBe(2);
      resolve();
    }, 20);
  });
});
```

**DOM Event Testing:**
```typescript
it("keyboard Enter/Space trigger onSelect", () => {
  const div = document.createElement("div");
  div.setAttribute("role", "button");
  div.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  });
  div.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  expect(selected).toBe(true);
});
```

**Snapshot Testing:**
- Not used in this codebase
- Prefer explicit assertions

---

*Testing analysis: 2026-05-17*
*Update when test patterns change*
