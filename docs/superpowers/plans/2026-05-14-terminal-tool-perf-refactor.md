# Terminal Tool Performance Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `child_process.exec` with a streaming `spawn` implementation in the terminal tool to improve performance and return a deterministic truncation result for outputs > 1MB.

**Architecture:** Keep the public tool contract stable (`{ command, timeout?, cwd? }`) while changing internal process execution to `spawn` with manual timeout and max-output enforcement. Preserve output formatting (`[stdout]`, `[stderr]`, `[exit]`) and add a stable truncation marker.

**Tech Stack:** Node.js (child_process), TypeScript (ESM), Node built-in test runner (`node:test`)

---

## File Structure (What to Touch)

**Modify**
- `/workspace/packages/core/src/tools/terminal.ts` — switch from `exec`+buffering to `spawn`+streaming, add deterministic truncation behavior.
- `/workspace/packages/core/package.json` — add a `test` script that builds and runs node tests.

**Create**
- `/workspace/packages/core/tests/terminal-tool.test.mjs` — node:test coverage for exit handling + deterministic truncation marker.

---

### Task 1: Add a failing test for deterministic truncation

**Files:**
- Create: `/workspace/packages/core/tests/terminal-tool.test.mjs`

- [ ] **Step 1: Create the test file (failing truncation case included)**

```js
import test from "node:test";
import assert from "node:assert/strict";

import { terminalTool } from "../dist/tools/terminal.js";

test("terminalTool: captures stdout", async () => {
  const out = await terminalTool.execute({ command: "echo hi" });
  assert.match(out, /^\[stdout\]\n/);
  assert.match(out, /hi/);
});

test("terminalTool: captures stderr and exit code on failure", async () => {
  const out = await terminalTool.execute({ command: "ls does-not-exist" });
  assert.match(out, /^\[stderr\]\n/);
  assert.match(out, /\[exit\] code=/);
});

test("terminalTool: returns deterministic truncation marker for > 1MB output", async () => {
  const out = await terminalTool.execute({
    command: "yes x | head -n 600000",
    timeout: 120000,
  });

  assert.match(out, /\[truncated\] output exceeded limit \(1MB\)/);
});
```

- [ ] **Step 2: Build core package**

Run:

```bash
pnpm -C packages/core build
```

Expected: TypeScript build succeeds and emits `packages/core/dist/...`.

- [ ] **Step 3: Run tests to confirm failure**

Run:

```bash
node --test packages/core/tests/terminal-tool.test.mjs
```

Expected: FAIL on the truncation test (current implementation returns an exec maxBuffer error-style output, not a `[truncated]...` marker).

---

### Task 2: Add a `test` script for core

**Files:**
- Modify: `/workspace/packages/core/package.json`

- [ ] **Step 1: Add `test` script**

Update `scripts` to include:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "clean": "rimraf dist",
    "test": "pnpm run build && node --test tests/terminal-tool.test.mjs"
  }
}
```

- [ ] **Step 2: Run core tests via pnpm**

Run:

```bash
pnpm -C packages/core test
```

Expected: Still FAIL on truncation test (until Task 3 is implemented).

---

### Task 3: Refactor terminal tool to `spawn` + streaming capture

**Files:**
- Modify: `/workspace/packages/core/src/tools/terminal.ts`
- Test: `/workspace/packages/core/tests/terminal-tool.test.mjs`

- [ ] **Step 1: Replace `exec` imports with `spawn`**

Change:

```ts
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
```

To:

```ts
import { spawn } from "node:child_process";
```

- [ ] **Step 2: Implement streaming execution with output cap + timeout**

Replace the `execute` body with a `spawn`-based implementation that:

- clamps `timeout` to `[1000, 120000]` (same as now)
- runs the command via bash on non-Windows (`shell: "/bin/bash"`)
- collects stdout/stderr in buffers while tracking total bytes
- when output exceeds 1MB, appends marker: `[truncated] output exceeded limit (1MB)` and terminates the child
- on timeout, returns: `[timeout] Command exceeded ${timeoutMs}ms and was terminated.`
- on non-zero exit, includes `[exit] code=...: ...` (keep existing format)

Minimal reference implementation (use as the basis in `terminal.ts`):

```ts
const MAX_OUTPUT = 1_000_000; // 1MB

export const terminalTool = tool({
  description:
    "Execute a shell command on the local machine. Returns combined stdout/stderr. Use for system inspection, file listing, running scripts, etc.",
  parameters: z.object({
    command: z.string().describe("The shell command to execute"),
    timeout: z
      .number()
      .optional()
      .describe("Timeout in milliseconds (default 30000, max 120000)"),
    cwd: z
      .string()
      .optional()
      .describe("Working directory (default: process.cwd())"),
  }),
  execute: async ({ command, timeout, cwd }) => {
    const timeoutMs = Math.min(Math.max(timeout ?? 30_000, 1000), 120_000);

    const shell = process.platform === "win32" ? "powershell.exe" : "/bin/bash";

    const child = spawn(command, {
      cwd: cwd || process.cwd(),
      shell,
      windowsHide: true,
    });

    let timedOut = false;
    let truncated = false;

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalBytes = 0;

    const pushChunk = (chunks: Buffer[], buf: Buffer) => {
      if (truncated) return;
      const remaining = MAX_OUTPUT - totalBytes;
      if (remaining <= 0) {
        truncated = true;
        return;
      }
      if (buf.length <= remaining) {
        chunks.push(buf);
        totalBytes += buf.length;
        return;
      }
      chunks.push(buf.subarray(0, remaining));
      totalBytes += remaining;
      truncated = true;
    };

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (d: Buffer) => {
      pushChunk(stdoutChunks, d);
      if (truncated) child.kill("SIGKILL");
    });

    child.stderr?.on("data", (d: Buffer) => {
      pushChunk(stderrChunks, d);
      if (truncated) child.kill("SIGKILL");
    });

    const { code, signal, spawnError } = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      spawnError: Error | null;
    }>((resolve) => {
      let spawnError: Error | null = null;
      child.on("error", (e) => {
        spawnError = e;
      });
      child.on("close", (code, signal) => {
        resolve({ code, signal, spawnError });
      });
    });

    clearTimeout(timeoutId);

    if (timedOut) {
      return `[timeout] Command exceeded ${timeoutMs}ms and was terminated.`;
    }

    const out = Buffer.concat(stdoutChunks).toString();
    const err = Buffer.concat(stderrChunks).toString();

    const combined = [out && `[stdout]\n${out}`, err && `[stderr]\n${err}`]
      .filter(Boolean)
      .join("\n");

    if (truncated) {
      return [combined, "[truncated] output exceeded limit (1MB)"]
        .filter(Boolean)
        .join("\n");
    }

    if (spawnError) {
      return `[exit] code=unknown: ${spawnError.message}`;
    }

    if (code && code !== 0) {
      const msg = signal ? `signal=${signal}` : "non-zero exit";
      const parts: string[] = [];
      if (combined) parts.push(combined);
      parts.push(`[exit] code=${code}: ${msg}`);
      return parts.join("\n");
    }

    return combined || "(no output)";
  },
});
```

- [ ] **Step 3: Run core build**

Run:

```bash
pnpm -C packages/core build
```

Expected: Build succeeds.

- [ ] **Step 4: Run core tests**

Run:

```bash
pnpm -C packages/core test
```

Expected: PASS, including the truncation marker test.

---

### Task 4: Regression checks (manual)

**Files:**
- None

- [ ] **Step 1: Verify output format stays stable**

Run:

```bash
node - <<'NODE'
import { terminalTool } from "./packages/core/dist/tools/terminal.js";
console.log(await terminalTool.execute({ command: "echo ok" }));
NODE
```

Expected: Starts with `[stdout]` and includes `ok`.

- [ ] **Step 2: Verify stderr + exit formatting**

Run:

```bash
node - <<'NODE'
import { terminalTool } from "./packages/core/dist/tools/terminal.js";
console.log(await terminalTool.execute({ command: "ls does-not-exist" }));
NODE
```

Expected: Contains `[stderr]` and `[exit] code=`.

---

## Optional Follow-ups (Separate Plan)

- Add a shell’siz “structured” mod (`program`, `args[]`) for safer/faster execution.
- Add security hardening (command allowlist, arg validation, path restrictions, audit logging).
