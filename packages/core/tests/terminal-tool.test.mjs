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
