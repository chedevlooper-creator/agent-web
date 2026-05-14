import { tool } from "ai";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeoutMs,
        cwd: cwd || process.cwd(),
        maxBuffer: MAX_OUTPUT,
        shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
      });

      const out = (stdout || "").toString();
      const err = (stderr || "").toString();
      const combined = [out && `[stdout]\n${out}`, err && `[stderr]\n${err}`]
        .filter(Boolean)
        .join("\n");

      return combined || "(no output)";
    } catch (e: unknown) {
      const err = e as { message?: string; stdout?: string; stderr?: string; code?: number; killed?: boolean };
      if (err.killed) {
        return `[timeout] Command exceeded ${timeoutMs}ms and was terminated.`;
      }
      const parts: string[] = [];
      if (err.stdout) parts.push(`[stdout]\n${err.stdout}`);
      if (err.stderr) parts.push(`[stderr]\n${err.stderr}`);
      parts.push(`[exit] code=${err.code ?? "unknown"}: ${err.message ?? "unknown error"}`);
      return parts.join("\n");
    }
  },
});
