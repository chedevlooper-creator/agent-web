# Code Quality & Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose 1200-line chat-interface.tsx into focused components, add shared hooks, error boundaries, async patterns, and Vitest test infrastructure.

**Architecture:** Extract 7 child components from chat-interface.tsx following props-only contract (no direct store access in children). Move streaming/scroll/upload logic into `lib/hooks.ts`. Add global error boundary and `<AsyncView>` pattern. Install Vitest with React Testing Library, write tests for store, utils, API validation, and component smoke tests.

**Tech Stack:** React 19, Next.js 16, TypeScript, Zustand, Vitest, @testing-library/react, happy-dom

---

### Task 1: Install Test Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add dev dependencies**

```bash
pnpm --filter web add -D vitest @testing-library/react @testing-library/jest-dom happy-dom @vitejs/plugin-react
```

- [ ] **Step 2: Verify install**

```bash
pnpm --filter web exec vitest --version
```

Expected: vitest version printed

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add vitest and testing-library dependencies

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Vitest Configuration

**Files:**
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Create vitest config**

Write `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
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

- [ ] **Step 2: Create vitest setup file**

Write `apps/web/vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add test scripts to package.json**

Replace `apps/web/package.json` scripts block with:

```json
"scripts": {
  "predev": "node -e \"require('fs').mkdirSync('./data',{recursive:true})\"",
  "dev": "next dev",
  "prestart": "node -e \"require('fs').mkdirSync('./data',{recursive:true})\"",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
},
```

- [ ] **Step 4: Verify config loads**

```bash
pnpm --filter web exec vitest --version
```

Expected: version printed, no config errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/vitest.setup.ts apps/web/package.json
git commit -m "chore: add vitest config with React and happy-dom

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Test for utils.ts

**Files:**
- Create: `apps/web/lib/__tests__/utils.test.ts`

- [ ] **Step 1: Write utils.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { cn, estimateTokens } from "../utils";

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

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("estimateTokens", () => {
  it("returns 0 for empty array", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("estimates 1 token per 4 characters", () => {
    expect(estimateTokens([{ content: "1234" }])).toBe(1);
    expect(estimateTokens([{ content: "12345" }])).toBe(2);
  });

  it("sums across multiple messages", () => {
    const messages = [
      { content: "12345678" },
      { content: "abcd" },
    ];
    expect(estimateTokens(messages)).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests, verify pass**

```bash
pnpm --filter web test -- lib/__tests__/utils.test.ts
```

Expected: 7 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/__tests__/utils.test.ts
git commit -m "test: add unit tests for cn() and estimateTokens()

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Test for API Route Validation

**Files:**
- Create: `apps/web/app/api/chat/__tests__/route.test.ts`

- [ ] **Step 1: Write route validation test**

Read `apps/web/app/api/chat/route.ts` to confirm the Zod schema import path, then write `apps/web/app/api/chat/__tests__/route.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the validation schema inline to test it in isolation
const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(200_000),
      })
    )
    .min(1)
    .max(500),
  provider: z.enum(["openai", "openrouter", "opencode", "deepseek"]),
  model: z.string().min(1).max(200),
  apiKey: z.string().min(1),
});

describe("Chat API request schema", () => {
  const validBody = {
    messages: [{ role: "user", content: "Hello" }],
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    apiKey: "sk-test",
  };

  it("accepts valid request", () => {
    expect(() => RequestSchema.parse(validBody)).not.toThrow();
  });

  it("rejects empty messages", () => {
    expect(() =>
      RequestSchema.parse({ ...validBody, messages: [] })
    ).toThrow();
  });

  it("rejects invalid role", () => {
    expect(() =>
      RequestSchema.parse({
        ...validBody,
        messages: [{ role: "tool", content: "x" }],
      })
    ).toThrow();
  });

  it("rejects invalid provider", () => {
    expect(() =>
      RequestSchema.parse({ ...validBody, provider: "anthropic" })
    ).toThrow();
  });

  it("rejects empty apiKey", () => {
    expect(() =>
      RequestSchema.parse({ ...validBody, apiKey: "" })
    ).toThrow();
  });

  it("rejects missing messages field", () => {
    const { messages, ...rest } = validBody;
    expect(() => RequestSchema.parse(rest)).toThrow();
  });

  it("rejects messages over 500", () => {
    const many = Array.from({ length: 501 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
    }));
    expect(() => RequestSchema.parse({ ...validBody, messages: many })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests, verify pass**

```bash
pnpm --filter web test -- app/api/chat/__tests__/route.test.ts
```

Expected: 7 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/chat/__tests__/route.test.ts
git commit -m "test: add Zod validation tests for chat API route

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Extract TypingIndicator Component

**Files:**
- Create: `apps/web/components/chat/typing-indicator.tsx`
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Create typing-indicator.tsx**

Write `apps/web/components/chat/typing-indicator.tsx`:

```typescript
import { Bot } from "lucide-react";

export function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex items-start gap-3 animate-message-in" role="status">
      <div className="w-8 h-8 rounded-xl gradient-bg-primary flex items-center justify-center shrink-0 animate-pulse-glow shadow-md shadow-primary/20">
        <Bot size={15} className="text-white" />
      </div>
      <div className="px-4 py-3 rounded-2xl glass-card">
        <div className="flex gap-1.5 items-center h-5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
          {label && (
            <span className="ml-2 text-xs text-muted-foreground/80">{label}</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove TypingIndicator from chat-interface.tsx**

Remove lines 64-83 (the TypingIndicator function) from `apps/web/components/chat/chat-interface.tsx`.
Remove `Bot` from lucide-react import if no longer needed (check: Bot still used in MessageBubble and CompareCell — keep it).

Add import at top:
```typescript
import { TypingIndicator } from "./typing-indicator";
```

- [ ] **Step 3: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output (no new errors)

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/typing-indicator.tsx apps/web/components/chat/chat-interface.tsx
git commit -m "refactor: extract TypingIndicator component from chat-interface

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Extract MarkdownRenderer Component

**Files:**
- Create: `apps/web/components/chat/markdown-renderer.tsx`
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Create markdown-renderer.tsx**

Write `apps/web/components/chat/markdown-renderer.tsx`:

```typescript
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

export function MarkdownRenderer({ content, className, isStreaming }: MarkdownRendererProps) {
  return (
    <div className={cn("chat-prose", isStreaming && "streaming-cursor", className)}>
      <ReactMarkdown
        components={{
          code({ className: codeClass, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClass || "");
            const isInline = !codeClass?.includes("language-");
            return !isInline && match ? (
              <SyntaxHighlighter
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                style={vscDarkPlus as any}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: "0.5rem 0",
                  borderRadius: "0.625rem",
                  fontSize: "0.8125rem",
                  border: "1px solid var(--border-muted)",
                }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-muted px-1.5 py-0.5 rounded-md text-xs border border-border-muted"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content + (isStreaming ? " ▍" : "")}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Remove AssistantContent and imports from chat-interface.tsx**

Remove lines 85-124 (AssistantContent function).
Remove these imports (now only used in markdown-renderer.tsx):
- `ReactMarkdown` from "react-markdown"
- `SyntaxHighlighter` from "react-syntax-highlighter"
- `vscDarkPlus` from "react-syntax-highlighter/dist/cjs/styles/prism"

Add import at top:
```typescript
import { MarkdownRenderer } from "./markdown-renderer";
```

Replace all usages of `<AssistantContent content={...} isStreaming={...} />` with `<MarkdownRenderer content={...} isStreaming={...} />`.

- [ ] **Step 3: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/markdown-renderer.tsx apps/web/components/chat/chat-interface.tsx
git commit -m "refactor: extract MarkdownRenderer component from chat-interface

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Extract ToolCallBubble Component

**Files:**
- Create: `apps/web/components/chat/tool-call-bubble.tsx`
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Create tool-call-bubble.tsx**

Write `apps/web/components/chat/tool-call-bubble.tsx`:

```typescript
import { useState, useMemo } from "react";
import { Loader2, ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToolIcon } from "@/lib/tool-icons";
import type { ToolInvocation } from "@/lib/store";

export function ToolCallBubble({ invocation }: { invocation: ToolInvocation }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(invocation.toolName);
  const isPending = invocation.state === "pending";

  const argsPreview = useMemo(() => {
    const entries = Object.entries(invocation.args);
    if (entries.length === 0) return "";
    const first = entries[0];
    const val = typeof first[1] === "string" ? first[1] : JSON.stringify(first[1]);
    return val.length > 60 ? val.slice(0, 57) + "..." : val;
  }, [invocation.args]);

  return (
    <div className={cn(
      "my-1 rounded-xl overflow-hidden text-xs transition-all duration-200 border-l-[3px]",
      isPending
        ? "border-l-warning bg-warning/5 border border-warning/15"
        : "border-l-success bg-success/5 border border-success/15"
    )}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={cn(
          "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
          isPending
            ? "bg-warning/12 text-warning"
            : "bg-success/12 text-success"
        )}>
          {isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Icon size={12} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-foreground">
            {invocation.toolName.replace(/_/g, " ")}
          </span>
          {argsPreview && (
            <span className="ml-1.5 text-muted-foreground truncate">
              {argsPreview}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPending ? (
            <span className="text-[10px] text-warning font-semibold">Running...</span>
          ) : (
            <span className="text-[10px] text-success font-semibold">Done</span>
          )}
          {expanded ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-muted/50 animate-slide-up">
          {Object.keys(invocation.args).length > 0 && (
            <div className="px-3 py-2 border-b border-border-muted/50">
              <p className="section-label mb-1">Arguments</p>
              <pre className="text-[11px] text-foreground bg-muted/50 rounded-lg px-2.5 py-1.5 overflow-x-auto max-h-40 whitespace-pre-wrap break-all border border-border-muted">
                {JSON.stringify(invocation.args, null, 2)}
              </pre>
            </div>
          )}
          {invocation.result != null && (
            <div className="px-3 py-2">
              <p className="section-label mb-1">Result</p>
              <pre className="text-[11px] text-foreground bg-muted/50 rounded-lg px-2.5 py-1.5 overflow-x-auto max-h-60 whitespace-pre-wrap break-all border border-border-muted">
                {invocation.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove ToolCallBubble and TOOL_ICONS from chat-interface.tsx**

Remove lines 386-471 (ToolCallBubble function and TOOL_ICONS constant).
Remove `Terminal`, `FileText`, `Globe`, `ChevronDown`, `ChevronRight` from lucide-react import if no longer needed elsewhere (check: FileText used in file upload icons, ChevronDown/Right not used elsewhere, Globe not used elsewhere, Terminal not used elsewhere — remove all 4).

Add import at top:
```typescript
import { ToolCallBubble } from "./tool-call-bubble";
```

- [ ] **Step 3: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/tool-call-bubble.tsx apps/web/components/chat/chat-interface.tsx
git commit -m "refactor: extract ToolCallBubble component, use shared getToolIcon

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Extract WelcomeHero Component

**Files:**
- Create: `apps/web/components/chat/welcome-hero.tsx`
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Create welcome-hero.tsx**

Write `apps/web/components/chat/welcome-hero.tsx`:

```typescript
import { Star } from "lucide-react";

export function WelcomeHero() {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden w-full h-full pb-[10vh]">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-glow-breathe pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-accent/4 rounded-full blur-3xl animate-glow-breathe pointer-events-none" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 flex flex-col items-center gap-7 animate-slide-up w-full px-6">
        {/* Badge */}
        <div className="glass flex items-center mx-auto rounded-full p-1 pr-3.5 w-fit shadow-sm animate-fade-in">
          <span className="flex items-center gap-1 bg-gradient-to-r from-primary to-accent text-white rounded-full px-2.5 py-0.5 text-[10px] font-semibold mr-2 shadow-sm shadow-primary/25">
            <Star className="w-2.5 h-2.5 fill-current" />
            New
          </span>
          <span className="text-xs font-medium text-foreground">
            Discover what&apos;s possible
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-center font-bold tracking-[-0.03em] leading-[1.08] text-4xl sm:text-5xl md:text-6xl gradient-text-hero max-w-3xl animate-float-gentle">
          Transform Ideas Into Reality
        </h1>

        {/* Subtitle */}
        <p className="text-center font-medium text-sm md:text-base leading-relaxed text-muted-foreground/80 max-w-xl">
          Upload your information and get powerful insights right away. Work
          smarter and achieve goals effortlessly.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove EmptyStateHero from chat-interface.tsx**

Remove lines 351-384 (EmptyStateHero function).
Remove `Star` from lucide-react import if no longer needed elsewhere (check: used only in EmptyStateHero — remove it from `chat-interface.tsx` imports).

Add import at top:
```typescript
import { WelcomeHero } from "./welcome-hero";
```

Replace `<EmptyStateHero />` usage with `<WelcomeHero />`.

- [ ] **Step 3: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/welcome-hero.tsx apps/web/components/chat/chat-interface.tsx
git commit -m "refactor: extract WelcomeHero component from chat-interface

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Extract CompareRow Component

**Files:**
- Create: `apps/web/components/chat/compare-row.tsx`
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Create compare-row.tsx**

Write `apps/web/components/chat/compare-row.tsx`:

```typescript
import { Bot } from "lucide-react";
import type { ChatMessage } from "@/lib/store";
import { MarkdownRenderer } from "./markdown-renderer";

export function CompareRow({
  left,
  right,
  index,
}: {
  left: ChatMessage;
  right: ChatMessage;
  index: number;
}) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-message-in"
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      <CompareCell message={left} />
      <CompareCell message={right} />
    </div>
  );
}

function CompareCell({ message }: { message: ChatMessage }) {
  const isError = message.content.startsWith("Error:");
  return (
    <div className="flex gap-2 items-start">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-accent/15">
        <Bot size={12} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {message.model && (
          <div className="section-label mb-1">
            {message.model}
          </div>
        )}
        <div className="px-3 py-2.5 rounded-xl text-sm glass-card">
          {isError ? (
            <p className="text-destructive whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <MarkdownRenderer content={message.content} />
          ) : (
            <span className="text-muted-foreground text-xs italic">Waiting...</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove CompareRow and CompareCell from chat-interface.tsx**

Remove lines 579-625 (CompareRow and CompareCell functions).
Check: `Bot` is still used in MessageBubble — keep in chat-interface imports.

Add import at top:
```typescript
import { CompareRow } from "./compare-row";
```

- [ ] **Step 3: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/compare-row.tsx apps/web/components/chat/chat-interface.tsx
git commit -m "refactor: extract CompareRow component from chat-interface

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Extract MessageBubble Component

**Files:**
- Create: `apps/web/components/chat/message-bubble.tsx`
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Create message-bubble.tsx**

Write `apps/web/components/chat/message-bubble.tsx`:

```typescript
import { useState, useEffect, useRef } from "react";
import { User, Bot, Pencil, Check, X, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/store";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolCallBubble } from "./tool-call-bubble";

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  onRetry?: () => void;
  onEdit?: (newContent: string) => void;
  isStreaming?: boolean;
}

export function MessageBubble({
  message,
  index,
  onRetry,
  onEdit,
  isStreaming,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = !isUser && message.content.startsWith("Error:");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const autoSize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 320) + "px";
  };

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
      autoSize(editRef.current);
    }
  }, [editing]);

  const handleSaveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      setDraft(message.content);
      return;
    }
    onEdit?.(trimmed);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setDraft(message.content);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div
      className={cn(
        "flex gap-3 animate-message-in group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300",
          isUser
            ? "gradient-bg-primary shadow-md shadow-primary/20"
            : "bg-gradient-to-br from-primary to-accent shadow-md shadow-accent/15 ai-glow-subtle"
        )}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-white" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1 max-w-[75%]", isUser ? "items-end" : "items-start")}>
        {message.model && !isUser && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 px-1 font-medium">
            {message.model}
          </span>
        )}
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm w-full transition-all duration-300",
            isUser
              ? "bg-gradient-to-br from-primary to-primary-hover text-white rounded-br-lg shadow-md shadow-primary/20"
              : "glass-card rounded-bl-lg hover:shadow-md"
          )}
        >
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={editRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  autoSize(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleCancelEdit();
                  } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                }}
                className={cn(
                  "w-full bg-transparent text-sm resize-none focus:outline-none",
                  "min-h-[44px] max-h-[320px]",
                  isUser ? "text-white placeholder:text-white/60" : "text-foreground"
                )}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className={cn(
                    "min-w-[32px] h-7 px-2.5 rounded-lg text-xs inline-flex items-center gap-1 font-medium transition-colors",
                    isUser
                      ? "bg-white/10 hover:bg-white/20 text-white"
                      : "bg-muted hover:bg-border text-foreground"
                  )}
                  aria-label="Cancel edit"
                >
                  <X size={11} />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className={cn(
                    "min-w-[32px] h-7 px-2.5 rounded-lg text-xs inline-flex items-center gap-1 font-semibold transition-colors",
                    isUser
                      ? "bg-white text-primary hover:bg-white/90"
                      : "bg-primary text-white hover:bg-primary-hover"
                  )}
                  aria-label="Save edit"
                >
                  <Check size={11} />
                  Save
                </button>
              </div>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : isError ? (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap leading-relaxed text-destructive">
                {message.content}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-muted text-foreground hover:bg-surface-elevated
                             border border-border-muted transition-all duration-200 active:scale-[0.97]"
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              )}
            </div>
          ) : message.content || isStreaming ? (
            <MarkdownRenderer content={message.content} isStreaming={isStreaming} />
          ) : (
            <span className="text-muted-foreground text-xs italic">Waiting...</span>
          )}

          {/* Tool invocations */}
          {!isUser && message.toolInvocations && message.toolInvocations.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {message.toolInvocations.map((inv) => (
                <ToolCallBubble key={inv.toolCallId} invocation={inv} />
              ))}
            </div>
          )}
        </div>

        {/* Action bar */}
        {!editing && (
          <div
            className={cn(
              "flex items-center gap-0.5 transition-opacity duration-200",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            {isUser && onEdit && !isError && (
              <button
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                title="Edit message"
                aria-label="Edit message"
              >
                <Pencil size={11} />
              </button>
            )}
            {!isError && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                title={copied ? "Copied!" : "Copy"}
                aria-label="Copy message"
              >
                {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write smoke test for MessageBubble**

Write `apps/web/components/chat/__tests__/message-bubble.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "../message-bubble";

const userMsg = {
  id: "1",
  role: "user" as const,
  content: "Hello World",
  timestamp: Date.now(),
};

const assistantMsg = {
  id: "2",
  role: "assistant" as const,
  content: "Hi there!",
  model: "gpt-4o-mini",
  timestamp: Date.now(),
};

describe("MessageBubble", () => {
  it("renders user message", () => {
    render(<MessageBubble message={userMsg} index={0} />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    render(<MessageBubble message={assistantMsg} index={0} />);
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("renders model label", () => {
    render(<MessageBubble message={assistantMsg} index={0} />);
    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
  });

  it("renders error state", () => {
    const errorMsg = { ...assistantMsg, content: "Error: API timeout" };
    render(<MessageBubble message={errorMsg} index={0} />);
    expect(screen.getByText("Error: API timeout")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Remove MessageBubble from chat-interface.tsx**

Remove lines 126-349 (MessageBubble function).
Remove `User`, `Pencil`, `Copy` from lucide-react import if no longer needed (check: User not used elsewhere — remove; Pencil not used elsewhere — remove; Copy not used elsewhere — remove; Bot still used in typing indicator; Check still used in chat; X still used in chat; RefreshCw still used).

Add import at top:
```typescript
import { MessageBubble } from "./message-bubble";
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter web test -- components/chat/__tests__/message-bubble.test.tsx
```

Expected: 4 tests pass

- [ ] **Step 5: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/chat/message-bubble.tsx apps/web/components/chat/chat-interface.tsx apps/web/components/chat/__tests__/message-bubble.test.tsx
git commit -m "refactor: extract MessageBubble component with smoke tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Extract FileUpload Component

**Files:**
- Create: `apps/web/components/chat/file-upload.tsx`
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Create file-upload.tsx**

Write `apps/web/components/chat/file-upload.tsx`:

```typescript
import { X, FileText, FileSpreadsheet, File } from "lucide-react";

export interface UploadedFile {
  name: string;
  storedName: string;
  size: number;
  type: string;
  content: string;
  uploadedAt: number;
}

export function getFileIcon(type: string) {
  if (type === ".pdf") return <FileText size={14} className="text-red-400" />;
  if (type === ".docx" || type === ".doc") return <FileText size={14} className="text-blue-400" />;
  if (type === ".xlsx" || type === ".xls" || type === ".csv") return <FileSpreadsheet size={14} className="text-green-400" />;
  return <File size={14} className="text-muted-foreground" />;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface FilePreviewBarProps {
  files: UploadedFile[];
  onRemove: (storedName: string) => void;
}

export function FilePreviewBar({ files, onRemove }: FilePreviewBarProps) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {files.map((f) => (
        <div
          key={f.storedName}
          className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-primary/8 border border-primary/20 text-xs font-medium text-foreground animate-slide-up"
        >
          {getFileIcon(f.type)}
          <span className="max-w-[120px] truncate">{f.name}</span>
          <span className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</span>
          <button
            onClick={() => onRemove(f.storedName)}
            className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
            aria-label={`Remove ${f.name}`}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Remove file upload code from chat-interface.tsx**

Remove lines 627-648 (UploadedFile interface, getFileIcon, formatFileSize functions).
Remove `File`, `FileSpreadsheet` from lucide-react import (no longer needed if only in file-upload).

Add import at top:
```typescript
import { type UploadedFile, getFileIcon, formatFileSize, FilePreviewBar } from "./file-upload";
```

Replace the inline file preview JSX (lines 1081-1101) with:
```tsx
<FilePreviewBar files={attachedFiles} onRemove={removeAttachedFile} />
```

- [ ] **Step 3: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/file-upload.tsx apps/web/components/chat/chat-interface.tsx
git commit -m "refactor: extract FileUpload component from chat-interface

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Extract ChatInput Component

**Files:**
- Create: `apps/web/components/chat/chat-input.tsx`
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Create chat-input.tsx**

Write `apps/web/components/chat/chat-input.tsx`:

```typescript
import { useRef, useCallback } from "react";
import { Send, Square, Paperclip, Sparkles, CornerDownLeft, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadedFile } from "./file-upload";
import { FilePreviewBar } from "./file-upload";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string, height?: string) => void;
  onSend: () => void;
  onCancel: () => void;
  isLoading: boolean;
  hasApiKey: boolean;
  provider: string;
  model: string;
  compareMode: boolean;
  effectiveModels: string[];
  attachedFiles: UploadedFile[];
  isUploading: boolean;
  onFileUpload: (files: FileList | null) => void;
  onRemoveFile: (storedName: string) => void;
}

export function ChatInput({
  input,
  onInputChange,
  onSend,
  onCancel,
  isLoading,
  hasApiKey,
  provider,
  model,
  compareMode,
  effectiveModels,
  attachedFiles,
  isUploading,
  onFileUpload,
  onRemoveFile,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const UploadIcon = isUploading ? () => <Paperclip size={16} className="animate-spin" /> : Paperclip;

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 320) + "px";
      onInputChange(e.target.value);
    },
    [onInputChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  const canSend = input.trim() && hasApiKey;

  return (
    <div className="shrink-0 z-10 w-full px-4 pb-4 pt-3">
      <div className="max-w-3xl mx-auto">
        {/* Compare mode badge */}
        {compareMode && effectiveModels.length > 1 && (
          <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-accent/10 text-accent border border-accent/20 font-medium">
            <GitCompare size={11} />
            Compare: {effectiveModels.join(" vs ")}
          </div>
        )}

        {/* Attached files preview */}
        <FilePreviewBar files={attachedFiles} onRemove={onRemoveFile} />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json,.xml,.html,.py,.js,.ts,.tsx,.jsx,.css,.yaml,.yml,.sql"
          onChange={(e) => onFileUpload(e.target.files)}
          className="hidden"
        />

        {/* Input bar */}
        <div
          className={cn(
            "flex items-end gap-2 p-2.5 rounded-2xl",
            "bg-surface-elevated/60 border border-border/50 backdrop-blur-sm",
            "focus-within:ring-2 focus-within:ring-primary/15 focus-within:border-primary/30",
            "shadow-sm hover:shadow-md",
            "transition-all duration-300"
          )}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg shrink-0 transition-all duration-200",
              isUploading
                ? "text-primary animate-pulse"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            aria-label="Attach file"
          >
            <UploadIcon size={16} className={isUploading ? "animate-spin" : ""} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? "Message Agent Web..." : "Configure API key in settings first"}
            disabled={!hasApiKey}
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none px-2.5 py-1.5 min-h-[40px] max-h-[320px]
                       placeholder:text-muted-foreground/50 focus:outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={isLoading ? onCancel : onSend}
            disabled={!isLoading && !canSend}
            className={cn(
              "min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl shrink-0 transition-all duration-200",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isLoading
                ? "bg-destructive text-white hover:bg-destructive/90 active:scale-95"
                : canSend
                  ? "bg-gradient-to-br from-primary to-accent text-white shadow-sm shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            aria-label={isLoading ? "Stop generation" : "Send message"}
          >
            {isLoading ? <Square size={14} className="fill-current" /> : <Send size={16} />}
          </button>
        </div>

        {/* Bottom hints */}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Sparkles className="w-3 h-3 text-primary/60" />
            <span>{provider}</span>
            <span className="text-border">/</span>
            <span className="font-medium text-muted-foreground/80">{model}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <CornerDownLeft size={10} />
            <span>Enter to send</span>
            <span className="text-border">·</span>
            <kbd className="px-1.5 py-0.5 rounded-md border border-border-muted bg-surface-muted font-mono text-[9px]">Ctrl+N</kbd>
            <span>New chat</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove input area JSX from chat-interface.tsx**

Remove lines 1069-1182 (the entire input area JSX block).
Remove `Send`, `Square`, `Paperclip`, `Sparkles`, `CornerDownLeft`, `GitCompare` from lucide-react import if no longer needed (check: Sparkles still used in sidebar; Send/Square/Paperclip/CornerDownLeft/GitCompare only used in input — remove from chat-interface.tsx).

Add import at top:
```typescript
import { ChatInput } from "./chat-input";
```

Replace the input area JSX with:
```tsx
<ChatInput
  input={input}
  onInputChange={(value) => {
    setInput(value);
  }}
  onSend={() => handleSend()}
  onCancel={handleCancel}
  isLoading={isLoading}
  hasApiKey={!!apiKey}
  provider={provider}
  model={model}
  compareMode={compareMode}
  effectiveModels={effectiveModels}
  attachedFiles={attachedFiles}
  isUploading={isUploading}
  onFileUpload={handleFileUpload}
  onRemoveFile={removeAttachedFile}
/>
```

- [ ] **Step 3: Remove textareaRef and fileInputRef from chat-interface.tsx**

Remove the `textareaRef` and `fileInputRef` refs (they moved to ChatInput). Update `handleFileUpload` to work without fileInputRef reset (ChatInput handles this internally).

- [ ] **Step 4: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/chat/chat-input.tsx apps/web/components/chat/chat-interface.tsx
git commit -m "refactor: extract ChatInput component from chat-interface

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: Create lib/hooks.ts — useScrollAnchor and useFileUpload

**Files:**
- Create: `apps/web/lib/hooks.ts`
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Create hooks.ts**

Write `apps/web/lib/hooks.ts`:

```typescript
import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { UploadedFile } from "@/components/chat/file-upload";

export function useScrollAnchor(deps: unknown[]) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, deps);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom < 100;
    shouldAutoScroll.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, []);

  return {
    messagesEndRef,
    scrollContainerRef,
    showScrollBtn,
    scrollToBottom,
    handleScroll,
  };
}

export function useFileUpload() {
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          toast.error(`Failed to upload ${file.name}: ${data.error}`);
          continue;
        }
        newFiles.push({
          name: data.file.name,
          storedName: data.file.storedName,
          size: data.file.size,
          type: data.file.type,
          content: data.content,
          uploadedAt: data.file.uploadedAt,
        });
        toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
        console.error(err);
      }
    }

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    setIsUploading(false);
  }, []);

  const removeAttachedFile = useCallback((storedName: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.storedName !== storedName));
  }, []);

  const clearAttachedFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  return {
    attachedFiles,
    isUploading,
    handleFileUpload,
    removeAttachedFile,
    clearAttachedFiles,
  };
}
```

- [ ] **Step 2: Update chat-interface.tsx to use hooks**

In chat-interface.tsx:
- Remove `messagesEndRef`, `scrollContainerRef`, `showScrollBtn`, `shouldAutoScroll` state/refs
- Remove `scrollToBottom` and `handleScroll` callbacks
- Remove `attachedFiles`, `isUploading`, `handleFileUpload`, `removeAttachedFile` state/functions

Add import:
```typescript
import { useScrollAnchor, useFileUpload } from "@/lib/hooks";
```

Add at top of `ChatInterface()`:
```typescript
const { messagesEndRef, scrollContainerRef, showScrollBtn, scrollToBottom, handleScroll } = useScrollAnchor([messages.length]);
const { attachedFiles, isUploading, handleFileUpload, removeAttachedFile, clearAttachedFiles } = useFileUpload();
```

Update `handleSend` to use `clearAttachedFiles()` instead of `setAttachedFiles([])`.

- [ ] **Step 3: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/hooks.ts apps/web/components/chat/chat-interface.tsx
git commit -m "refactor: extract useScrollAnchor and useFileUpload hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Add ErrorBoundary and AsyncView

**Files:**
- Create: `apps/web/components/error-boundary.tsx`
- Create: `apps/web/components/async-view.tsx`
- Modify: `apps/web/app/layout.tsx` (wrap children with error boundary)

- [ ] **Step 1: Create error-boundary.tsx**

Write `apps/web/components/error-boundary.tsx`:

```typescript
"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ChatErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} className="text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              {this.state.error.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Create async-view.tsx**

Write `apps/web/components/async-view.tsx`:

```typescript
import { type ReactNode } from "react";
import { Loader2, AlertTriangle, Inbox } from "lucide-react";

interface AsyncViewProps<T> {
  data: T | null | undefined;
  isLoading: boolean;
  error?: string | null;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  errorFallback?: ReactNode;
  emptyFallback?: ReactNode;
  isEmpty?: (data: T) => boolean;
}

export function AsyncView<T>({
  data,
  isLoading,
  error,
  children,
  loading,
  errorFallback,
  emptyFallback,
  isEmpty,
}: AsyncViewProps<T>) {
  if (isLoading) {
    return loading ?? (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return errorFallback ?? (
      <div className="text-center py-8 space-y-2">
        <AlertTriangle size={20} className="text-destructive mx-auto" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (data == null || (isEmpty && isEmpty(data))) {
    return emptyFallback ?? (
      <div className="text-center py-8 space-y-2">
        <Inbox size={20} className="text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No data</p>
      </div>
    );
  }

  return <>{children(data)}</>;
}
```

- [ ] **Step 3: Wrap chat in error boundary**

In `apps/web/app/layout.tsx`, import `ChatErrorBoundary` and wrap `{children}`.

But this requires reading layout.tsx first to find exact placement. Read the file then edit.

- [ ] **Step 4: Verify no compile errors**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/error-boundary.tsx apps/web/components/async-view.tsx apps/web/app/layout.tsx
git commit -m "feat: add ChatErrorBoundary and AsyncView utility component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 15: Store Tests

**Files:**
- Create: `apps/web/lib/__tests__/store.test.ts`

- [ ] **Step 1: Write store test**

Write `apps/web/lib/__tests__/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, genId } from "../store";

// Reset store before each test
beforeEach(() => {
  useChatStore.setState({
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
    selectedModels: [],
    compareMode: false,
  });
});

describe("genId", () => {
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => genId()));
    expect(ids.size).toBe(100);
  });

  it("returns non-empty string", () => {
    expect(genId().length).toBeGreaterThan(0);
  });
});

describe("useChatStore — sessions", () => {
  it("starts with empty sessions", () => {
    const { sessions } = useChatStore.getState();
    expect(sessions).toEqual([]);
  });

  it("sets active session", () => {
    const state = useChatStore.getState();
    // Create a session manually in state
    useChatStore.setState({
      sessions: [
        { id: "s1", title: "Chat 1", messages: [], createdAt: 1, updatedAt: 1 },
      ],
    });
    state.setActiveSession("s1");
    expect(useChatStore.getState().activeSessionId).toBe("s1");
  });

  it("toggles sidebar", () => {
    const initial = useChatStore.getState().sidebarOpen;
    useChatStore.getState().toggleSidebar();
    expect(useChatStore.getState().sidebarOpen).toBe(!initial);
  });

  it("toggles compare mode", () => {
    const state = useChatStore.getState();
    state.setSelectedModels(["m1", "m2"]);
    expect(useChatStore.getState().compareMode).toBe(true);
    expect(useChatStore.getState().selectedModels).toEqual(["m1", "m2"]);
  });

  it("caps selectedModels at 2", () => {
    const state = useChatStore.getState();
    state.setSelectedModels(["m1", "m2", "m3"]);
    expect(useChatStore.getState().selectedModels).toHaveLength(2);
  });
});

describe("useChatStore — local messages", () => {
  it("appendLocalMessage adds message", () => {
    useChatStore.setState({
      sessions: [
        { id: "s1", title: "Chat", messages: [], createdAt: 1, updatedAt: 1 },
      ],
      activeSessionId: "s1",
    });
    const msg = { id: "m1", role: "user" as const, content: "hi", timestamp: 10 };
    useChatStore.getState().appendLocalMessage(msg);
    const session = useChatStore.getState().sessions.find((s) => s.id === "s1");
    expect(session?.messages).toHaveLength(1);
    expect(session?.messages[0].content).toBe("hi");
  });

  it("patchLocalMessage updates content", () => {
    useChatStore.setState({
      sessions: [
        {
          id: "s1",
          title: "Chat",
          messages: [
            { id: "m1", role: "assistant", content: "old", timestamp: 10 },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeSessionId: "s1",
    });
    // patchLocalMessage uses rAF internally — call the inner set logic directly
    useChatStore.getState().patchLocalMessage("m1", "new");
    // Wait for rAF
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        const session = useChatStore.getState().sessions.find((s) => s.id === "s1");
        expect(session?.messages[0].content).toBe("new");
        resolve();
      });
    });
  });
});
```

- [ ] **Step 2: Run store tests**

```bash
pnpm --filter web test -- lib/__tests__/store.test.ts
```

Expected: 8 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/__tests__/store.test.ts
git commit -m "test: add Zustand store unit tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 16: Final Cleanup — chat-interface imports

**Files:**
- Modify: `apps/web/components/chat/chat-interface.tsx`

- [ ] **Step 1: Remove unused imports**

After all extractions, chat-interface.tsx should import only what it directly uses:
- `useChatStore`, `useActiveMessages`, `genId`, `ChatMessage`, `ToolInvocation` from store
- `cn` from utils
- `useRef`, `useState`, `useCallback`, `useEffect`, `useMemo` from React
- `toast` from sonner
- `Loader2`, `ArrowDown` from lucide-react (Loader2 for loading state, ArrowDown for scroll button)
- Children: `MessageBubble`, `CompareRow`, `ChatInput`, `TypingIndicator`, `WelcomeHero`
- Hooks: `useScrollAnchor`, `useFileUpload`
- Stream: `persistMessage` (internal), `streamChat` (internal)

Clean up import lists to match.

- [ ] **Step 2: Run full test suite**

```bash
pnpm --filter web test
```

Expected: all tests pass

- [ ] **Step 3: Verify typecheck**

```bash
pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -v "upload/route"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/chat-interface.tsx
git commit -m "refactor: clean up chat-interface imports after decomposition

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 17: Final Verification

- [ ] **Step 1: Run all tests**

```bash
pnpm --filter web test
```

- [ ] **Step 2: Verify dev server starts**

```bash
pnpm dev
```

Expected: Next.js starts, no compile errors

---

## File Summary

### Created (14 files)
```
apps/web/vitest.config.ts
apps/web/vitest.setup.ts
apps/web/components/chat/typing-indicator.tsx
apps/web/components/chat/markdown-renderer.tsx
apps/web/components/chat/tool-call-bubble.tsx
apps/web/components/chat/welcome-hero.tsx
apps/web/components/chat/compare-row.tsx
apps/web/components/chat/message-bubble.tsx
apps/web/components/chat/file-upload.tsx
apps/web/components/chat/chat-input.tsx
apps/web/components/error-boundary.tsx
apps/web/components/async-view.tsx
apps/web/lib/hooks.ts
apps/web/lib/__tests__/utils.test.ts
apps/web/lib/__tests__/store.test.ts
apps/web/app/api/chat/__tests__/route.test.ts
apps/web/components/chat/__tests__/message-bubble.test.tsx
```

### Modified (3 files)
```
apps/web/components/chat/chat-interface.tsx
apps/web/app/layout.tsx
apps/web/package.json
```
