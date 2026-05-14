import { tool } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";

const MAX_OUTPUT = 1_000_000; // 1MB
const TRUNCATION_MARKER = "[truncated] output exceeded limit (1MB)";

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

    const result = await new Promise<
      | { kind: "timeout" }
      | { kind: "ok"; stdout: string; stderr: string; truncated: boolean }
      | { kind: "exit"; stdout: string; stderr: string; code: number | null; signal: NodeJS.Signals | null }
      | { kind: "error"; error: unknown }
    >((resolve) => {
      const child = spawn(command, {
        cwd: cwd || process.cwd(),
        shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
        windowsHide: true,
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let capturedBytes = 0;
      let truncated = false;
      let killedForTruncation = false;
      let timedOut = false;

      const terminate = () => {
        try {
          child.kill("SIGTERM");
        } catch {}

        const killTimer = setTimeout(() => {
          try {
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
          } catch {}
        }, 1000);
        killTimer.unref?.();
      };

      const append = (target: Buffer[], chunk: Buffer) => {
        if (truncated) return;

        const remaining = MAX_OUTPUT - capturedBytes;
        if (remaining <= 0) {
          truncated = true;
          killedForTruncation = true;
          terminate();
          return;
        }

        if (chunk.length > remaining) {
          target.push(chunk.subarray(0, remaining));
          capturedBytes += remaining;
          truncated = true;
          killedForTruncation = true;
          terminate();
          return;
        }

        target.push(chunk);
        capturedBytes += chunk.length;
      };

      child.stdout?.on("data", (chunk: Buffer) => append(stdoutChunks, chunk));
      child.stderr?.on("data", (chunk: Buffer) => append(stderrChunks, chunk));

      const timeoutId = setTimeout(() => {
        timedOut = true;
        terminate();
      }, timeoutMs);
      timeoutId.unref?.();

      child.on("error", (error) => {
        clearTimeout(timeoutId);
        resolve({ kind: "error", error });
      });

      child.on("close", (code, signal) => {
        clearTimeout(timeoutId);
        if (timedOut) {
          resolve({ kind: "timeout" });
          return;
        }

        const stdout = Buffer.concat(stdoutChunks).toString();
        const stderr = Buffer.concat(stderrChunks).toString();

        if (killedForTruncation) {
          resolve({ kind: "ok", stdout, stderr, truncated: true });
          return;
        }

        if (code === 0) {
          resolve({ kind: "ok", stdout, stderr, truncated });
          return;
        }

        resolve({ kind: "exit", stdout, stderr, code, signal });
      });
    });

    if (result.kind === "timeout") {
      return `[timeout] Command exceeded ${timeoutMs}ms and was terminated.`;
    }

    if (result.kind === "error") {
      const message =
        result.error instanceof Error ? result.error.message : typeof result.error === "string" ? result.error : "unknown error";
      return `[exit] code=unknown: ${message}`;
    }

    if (result.kind === "ok") {
      const combined = [result.stdout && `[stdout]\n${result.stdout}`, result.stderr && `[stderr]\n${result.stderr}`]
        .filter(Boolean)
        .join("\n");

      const base = combined || "(no output)";
      return result.truncated ? `${base}\n${TRUNCATION_MARKER}` : base;
    }

    const parts: string[] = [];
    if (result.stdout) parts.push(`[stdout]\n${result.stdout}`);
    if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
    parts.push(
      `[exit] code=${result.code ?? "unknown"}: ${result.signal ? `signal ${result.signal}` : `Command failed: ${command}`}`,
    );
    return parts.join("\n");
  },
});
