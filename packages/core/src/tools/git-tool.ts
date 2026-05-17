import { tool } from "ai";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execAsync = promisify(exec);
const MAX_OUTPUT = 10_000;
const DEFAULT_TIMEOUT_MS = 30_000;

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT) return s;
  return s.slice(0, MAX_OUTPUT) + `\n\n[... truncated, ${s.length - MAX_OUTPUT} more chars ...]`;
}

export const gitTool = tool({
  description:
    "Execute Git operations in the project workspace. Supports status, log, diff, add, commit, push, pull, branch, checkout, clone, and other common git commands. Use for version control tasks.",
  parameters: z.object({
    command: z.string().describe("Git command and arguments (without 'git' prefix). Example: 'status', 'log --oneline -5', 'diff --stat'"),
    workingDir: z.string().optional().describe("Working directory for the git command. Defaults to project root."),
    timeout: z.number().min(1000).max(120_000).optional().describe(`Timeout in ms (default ${DEFAULT_TIMEOUT_MS})`),
  }),
  execute: async ({ command, workingDir, timeout }) => {
    const cwd = workingDir ? resolve(workingDir) : process.cwd();
    const timeoutMs = Math.min(timeout ?? DEFAULT_TIMEOUT_MS, 120_000);

    try {
      const { stdout, stderr } = await execAsync(`git ${command}`, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      });

      const parts: string[] = [];
      if (stdout.trim()) parts.push(stdout.trim());
      if (stderr.trim()) parts.push(`[stderr]\n${stderr.trim()}`);

      return parts.length > 0 ? truncate(parts.join("\n\n")) : "(no output)";
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string; killed?: boolean };
      if (err.killed) return `[error] Git command timed out after ${timeoutMs}ms`;
      return `[error] Git command failed: ${err.message ?? "unknown error"}` + (err.stderr ? `\n${err.stderr}` : "");
    }
  },
});
