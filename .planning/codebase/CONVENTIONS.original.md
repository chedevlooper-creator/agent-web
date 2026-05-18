# Coding Conventions

**Analysis Date:** 2026-05-17

## Naming Patterns

**Files:**
- `kebab-case.ts` / `kebab-case.tsx` for all source files (e.g., `message-bubble.tsx`, `settings-panel.tsx`, `path-security.ts`, `rate-limit.ts`)
- Test files mirror source path in `__tests__/<source>.test.ts` or `<source>.test.tsx`
- Config files use dot-notation (`eslint.config.mjs`, `vitest.config.ts`, `tailwind.config.ts`)

**Components:**
- PascalCase for React components: `MessageBubble`, `SettingsPanel`, `ChatInterface`, `FilePreviewCard`, `TooltipIconButton`, `ToolCallCard`
- One component per file (with internal helper components co-located in the same file, e.g., `chat-interface.tsx` contains `MessageBubble`, `ToolCallCard`, `AssistantContent`, `EmptyState`, `TypingIndicator` as private functions)

**Functions:**
- camelCase for all functions: `genId`, `snapshotSessions`, `rollbackSessions`, `resolveSafePath`, `estimateTokens`, `getErrorMessage`
- Event handlers prefixed with `handle`: `handleSend`, `handleSaveEdit`, `handleCancelEdit`, `handleCopy`, `handleInput`, `handleKeyDown`, `handleRetry`, `handleEdit`, `handleStarterPrompt`, `handleFileUpload`, `handleProviderChange`, `handleDeleteKey`

**Variables:**
- camelCase for all variables: `isUser`, `isError`, `editing`, `displayText`, `availableModels`, `apiKey`
- Boolean variables often prefixed with `is`, `has`, `should`: `isLoading`, `isUploading`, `hasApiKey`, `shouldAutoScroll`

**Types/Interfaces:**
- PascalCase: `ChatMessage`, `Session`, `DbProject`, `ToolCallInfo`, `ToolInvocation`, `ToolResult`, `FilePreview`
- Props interfaces named after component or inlined in function signature (e.g., `MessageBubbleProps` in `message-bubble.tsx`, inline `{ message: ChatMessage; index: number }` in `chat-interface.tsx`)
- Store interfaces use the pattern `[Name]Store` for the main interface (e.g., `ChatStore`)

**Constants:**
- UPPER_SNAKE_CASE for module-level constants: `STREAM_TIMEOUT_MS`, `MAX_SIZE`, `MAX_RETURN_CHARS`, `PREVIEWABLE_EXTS`, `SYSTEM_DIRS`, `STARTER_PROMPTS`
- Numeric constants with inline comments explaining their value: `const MAX_SIZE = 5 * 1024 * 1024; // 5MB`

**CSS:**
- Tailwind utility classes inline (primary approach)
- Custom CSS classes use `agent-` prefix: `agent-message-row`, `agent-avatar-cube--assistant`, `agent-tool-card`, `agent-composer`, `agent-chat-stage`
- BEM-like modifier syntax with double dash: `agent-message-card--error`, `agent-avatar-cube--user`
- CSS custom properties use kebab-case: `--surface-elevated`, `--muted-foreground`, `--border-strong`

## File Organization

**Component structure:**
```
components/
  chat/           # Chat-related components
    __tests__/    # Co-located tests
    chat-interface.tsx
    message-bubble.tsx
    chat-input.tsx
    file-upload.tsx
    markdown-renderer.tsx
    tool-call-bubble.tsx
    typing-indicator.tsx
    welcome-hero.tsx
    compare-row.tsx
  layout/         # Layout components
    sidebar.tsx
    context-panel.tsx
  settings/       # Settings sub-components
    sync-settings.tsx
  ui/             # shadcn/ui primitives
    button.tsx
    card.tsx
    badge.tsx
    textarea.tsx
    tooltip.tsx
    separator.tsx
    skeleton.tsx
    scroll-area.tsx
```

**Library code:**
```
lib/
  store.ts        # Zustand store (types + implementation + selectors)
  utils.ts        # Shared utilities
  db.ts           # Database helpers
  rate-limit.ts   # In-memory rate limiter
  __tests__/      # Co-located tests
```

**Test co-location:**
- Tests live in `__tests__/` subdirectories within the component or module folder, not in a separate top-level test directory
- Test files named `<source>.test.ts` or `<source>.test.tsx`

## Import Organization

**Order (within files):**
1. React / Next.js imports
2. Third-party library imports (lucide, ai, zustand, zod, etc.)
3. Internal aliased imports (`@/lib/store`, `@/lib/utils`, `@/components/ui/...`)
4. Package imports (`@agent-web/core`, `@agent-web/db`)
5. Type-only imports with `import type` or `type` keyword

**Pattern examples:**
```typescript
// React and framework
import { useState, useEffect, useRef, useCallback } from "react";
import { NextRequest } from "next/server";

// Third-party
import { create } from "zustand";
import { cn } from "@/lib/utils";
import { Settings, X, GitCompare } from "lucide-react";

// Internal with type keyword
import { cn, type ClassValue } from "clsx";
import type { NextConfig } from "next";
import type { ChatMessage } from "@/lib/store";
import type { Config } from "tailwindcss";

// Package imports (with .js ESM extension in packages/core)
import { tools, countMessagesTokens } from "@agent-web/core";
import { resolveSafePath } from "./path-security.js";
```

**Path aliases:**
- `@/` → `apps/web/` root (configured in `tsconfig.json` and `vitest.config.ts`)
- `@agent-web/core` → `packages/core/src` (via `transpilePackages` in next.config.ts)
- `@agent-web/db` → `packages/db/src` (via `transpilePackages`)

## TypeScript Usage

**Strict mode:** All three `tsconfig.json` files set `"strict": true`.

**Common patterns:**
- `as const` for literal types and const objects:
  ```typescript
  const status = "active" as const;
  const tools = { terminal: terminalTool, ... } as const;
  type ToolName = keyof typeof tools;
  ```
- `unknown` for caught errors with explicit narrowing:
  ```typescript
  catch (e: unknown) {
    const err = e as Error;
    console.error("/api/chat error:", err);
  }
  ```
- `Record<string, unknown>` for dynamic objects: `args: Record<string, unknown>`
- Brand assertions on union literals:
  ```typescript
  role: "user" as const,
  // In arrays:
  { id: "m1", role: "user" as const, content: "hello", timestamp: 100 },
  ```
- Zod for runtime validation (`z.object`, `z.enum`, `z.string().max()`, `z.array().min().max()`)
- Template literal types via `z.enum(["openai", "openrouter", "opencode", "deepseek"])`
- Discriminated unions for complex state:
  ```typescript
  type Item =
    | { kind: "single"; msg: ChatMessage; index: number }
    | { kind: "compare"; left: ChatMessage; right: ChatMessage; index: number };
  ```

**Config summary:**
| Setting | `apps/web` | `packages/core` | `packages/db` |
|---------|-----------|----------------|---------------|
| target  | ES2017    | ES2022         | ES2022        |
| module  | ESNext    | ESNext         | ESNext        |
| moduleResolution | bundler | Bundler | Bundler |
| strict  | true      | true           | true          |
| jsx     | react-jsx | —              | —             |
| declaration | —     | true           | true          |

## React Patterns

**Directives:**
- All interactive components start with `"use client";` — used consistently across all components that use hooks or browser APIs.

**Component definition:**
- Named function exports only — no `export default` anywhere in the codebase:
  ```typescript
  export function MessageBubble({ message, index, onRetry, onEdit, isStreaming }: MessageBubbleProps) { ... }
  export function SettingsPanel() { ... }
  export function ChatInterface() { ... }
  ```
- Props typed via inline interface or separate interface.

**State management:**
- Zustand v5 for global state via `create<ChatStore>()` pattern (`apps/web/lib/store.ts`)
- Component-local state via `useState` for ephemeral UI state (editing, expanded, copied, input value)
- Selectors used to subscribe to specific store slices:
  ```typescript
  const provider = useChatStore((s) => s.provider);
  const messages = useActiveMessages();
  ```
- Custom selectors defined at module level for reusability:
  ```typescript
  export const useActiveSession = () =>
    useChatStore((s) => s.sessions.find((ses) => ses.id === s.activeSessionId));
  ```

**Hooks usage:**
- `useCallback` for all event handlers and async functions passed as props (prevents unnecessary re-renders)
- `useMemo` for derived data (e.g., `renderItems`, `effectiveModels`)
- `useRef` for DOM refs (`textareaRef`, `editRef`, `fileInputRef`, `scrollContainerRef`, `messagesEndRef`, `panelRef`, `triggerRef`)
- `useRef` for mutable values not causing re-renders (`shouldAutoScroll`, `abortRef`, `hadOpenedRef`)
- `useEffect` for side effects (keyboard listeners, focus management, API status checks)
- Effect cleanup via returned function for event listeners

**Optimistic updates pattern (critical pattern):**
```typescript
// 1. Snapshot current state
const snap = snapshotSessions();
// 2. Apply local change
set((s) => ({ sessions: s.sessions.map(...) }));
// 3. Sync to server
try {
  await apiFetch("/api/sessions/...", { method: "POST", body: JSON.stringify(...) });
} catch (e) {
  // 4. Rollback on failure
  rollbackSessions(snap);
} finally {
  set({ syncing: false });
}
```

**Error handling in components:**
- `try/catch` with `console.error` for logging
- `toast.error()` from `sonner` for user-facing errors
- Empty `catch {}` for non-critical operations (e.g., clipboard write, preview fetch)
- Error state rendering for assistant messages starting with `"Error:"`

## CSS/Styling Conventions

**Stack:**
- Tailwind CSS v3 with PostCSS plugin (`postcss.config.mjs` with `tailwindcss` + `autoprefixer`)
- CSS variables in `:root` for theming (dark-first "Signal Terminal" theme in `globals.css`)
- `@theme inline` directive alongside `@tailwind` directives (both present in `globals.css`)
- No separate `tailwind.config.js` — uses `tailwind.config.ts` for extended theme values

**Class merging:**
- Always use `cn()` utility from `@/lib/utils` which wraps `clsx` + `tailwind-merge`:
  ```typescript
  import { cn } from "@/lib/utils";
  className={cn("base-class", condition && "conditional-class", variant && "variant-class")}
  ```

**Design tokens:**
- Dark-first, all colors defined as CSS custom properties in `:root`
- Custom color scales: `chrome`, `electric`, `surface`, `fg` (foreground), semantic colors
- Border radius scale based on `--radius` CSS variable
- Sidebar width as CSS variable (`--sidebar-width`, `--sidebar-collapsed`)
- Rich animation system with 12 custom keyframes (fade-in, slide-up, scale-in, message-in, pulse-glow, float-in, shimmer, etc.)

**Accessibility patterns:**
- `sr-only` labels for icon-only buttons
- `aria-label`, `aria-expanded`, `aria-haspopup`, `aria-checked`, `aria-pressed`, `aria-modal`, `aria-controls`, `aria-labelledby` attributes
- `aria-live="polite"` region for streaming content
- Focus management with `useEffect` on panel open/close (trap focus, return to trigger)
- `role` attributes: `dialog`, `radiogroup`, `radio`, `checkbox`, `button`, `separator`, `status`
- `tabIndex` and keyboard event handling for custom interactive elements
- `min-h-[44px]` minimum touch targets for interactive elements (WCAG 2.2 target size)

## Linting

**Tool:** ESLint v9 with flat config (`eslint.config.mjs`)

**Config:**
```typescript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

**Rules inherited:** `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`

**Run command:** `pnpm lint` (or `pnpm --filter web exec eslint`)

## Formatting

**Tool:** Prettier v3.3.3 (root devDependency, no `.prettierrc` file found — uses Prettier defaults)

**Run command:** `pnpm format` → `prettier --write "**/*.{ts,tsx,md}"`

**Package manager:** pnpm 9.0.0 (enforced via `packageManager` field in root `package.json`)

## Error Handling

**Strategy:** Try/optimistic-commit/rollback for data mutations; try/catch with fallback for reads.

**Server-side:**
- API routes wrap handlers in `try/catch` returning JSON error responses with appropriate HTTP status codes (400, 401, 500)
- Custom error messages with env var names for missing API keys
- Rate limiter returns structured `{ allowed, remaining, resetAt }` object

**Client-side:**
- `getErrorMessage(e)` utility for safe error string extraction from `unknown`:
  ```typescript
  export function getErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (e && typeof e === "object") {
      const withMsg = e as { message?: string };
      if (typeof withMsg.message === "string") return withMsg.message;
    }
    return String(e);
  }
  ```
- `console.error("Failed to X:", e)` consistent logging pattern
- Empty catch for non-critical: `catch {}` or `.catch(() => {})`

## Design System / Component Library

**shadcn/ui primitives** (in `components/ui/`):
- `Button` (with `variant` and `size` props via CVA)
- `Card`, `CardContent`
- `Badge` (with `variant` prop)
- `Textarea`
- `Tooltip`, `TooltipContent`, `TooltipTrigger` (from Base UI / Radix)
- `Separator`
- `Skeleton`
- `ScrollArea`

**Icons:** lucide-react (v1.14.0), used with `size` prop

**Toast notifications:** `sonner` (not shadcn toast)

**Composer pattern:** Custom `TooltipIconButton` wrapper pattern in `chat-interface.tsx`:
```typescript
function TooltipIconButton({ label, children, ...props }: ComponentProps<typeof Button> & { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button {...props} />}>
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent><p>{label}</p></TooltipContent>
    </Tooltip>
  );
}
```

---

*Convention analysis: 2026-05-17*
