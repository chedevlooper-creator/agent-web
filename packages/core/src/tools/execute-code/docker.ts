import { exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const execAsync = promisify(exec);

const SANDBOX_CONTAINER =
  process.env.TERMINAL_SANDBOX_CONTAINER || "agent-web-sandbox";
const MAX_RETURN_CHARS = 32_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 120_000;
const CMD_TIMEOUT = 5_000; // timeout for docker exec/cp itself

// Dangerous imports/patterns (same as local)
const DANGEROUS_PATTERNS = [
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /require\s*\(\s*['"]net['"]\s*\)/,
  /require\s*\(\s*['"]dgram['"]\s*\)/,
  /require\s*\(\s*['"]tls['"]\s*\)/,
  /require\s*\(\s*['"]cluster['"]\s*\)/,
  /require\s*\(\s*['"]worker_threads['"]\s*\)/,
  /require\s*\(\s*['"]vm['"]\s*\)/,
  /require\s*\(\s*['"]repl['"]\s*\)/,
  /require\s*\(\s*['"]os['"]\s*\)/,
  /require\s*\(\s*['"]v8['"]\s*\)/,
  /require\s*\(\s*['"]inspector['"]\s*\)/,
  /import\s+.*\s+from\s+['"]child_process['"]/,
  /import\s+.*\s+from\s+['"]fs['"]/,
  /import\s+.*\s+from\s+['"]net['"]/,
  /import\s+.*\s+from\s+['"]dgram['"]/,
  /import\s+.*\s+from\s+['"]tls['"]/,
  /import\s+.*\s+from\s+['"]cluster['"]/,
  /import\s+.*\s+from\s+['"]worker_threads['"]/,
  /import\s+.*\s+from\s+['"]vm['"]/,
  /import\s+.*\s+from\s+['"]repl['"]/,
  /import\s+.*\s+from\s+['"]os['"]/,
  /import\s+.*\s+from\s+['"]v8['"]/,
  /import\s+.*\s+from\s+['"]inspector['"]/,
  /import\s*\(\s*['"]child_process['"]\s*\)/,
  /import\s*\(\s*['"]fs['"]\s*\)/,
  /import\s*\(\s*['"]net['"]\s*\)/,
  /import\s*\(\s*['"]vm['"]\s*\)/,
  /process\.exit\s*\(/,
  /process\.kill\s*\(/,
  /process\.abort\s*\(/,
  /eval\s*\(/,
  /Function\s*\(/,
  /require\.resolve/,
  /module\._load/,
  /module\.constructor\._load/,
];

function truncateOutput(output: string): string {
  if (output.length <= MAX_RETURN_CHARS) return output;
  const half = Math.floor(MAX_RETURN_CHARS / 2) - 50;
  return (
    output.slice(0, half) +
    "\n\n[... truncated ...]\n\n" +
    output.slice(output.length - half)
  );
}

export interface CodeExecArgs {
  code: string;
  language: "javascript" | "typescript" | "python";
  timeout?: number;
}

/**
 * Execute code inside the Docker sandbox container.
 * Writes code to a temp file, copies it into the container, runs it, and returns output.
 */
export async function executeCodeInDocker({
  code,
  language,
  timeout,
}: CodeExecArgs): Promise<string> {
  const timeoutMs = timeout ?? DEFAULT_TIMEOUT_MS;

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      const match = code.match(pattern);
      return `[blocked] Code rejected for safety: dangerous pattern detected — "${match?.[0]?.slice(0, 60) ?? pattern.source}". This import/pattern is not allowed in sandboxed execution.`;
    }
  }

  // Check if sandbox container is running
  try {
    await execAsync(
      `docker inspect -f '{{.State.Running}}' ${SANDBOX_CONTAINER}`,
      { timeout: CMD_TIMEOUT }
    );
  } catch {
    throw new Error(
      `Sandbox container '${SANDBOX_CONTAINER}' is not running. Start it with: docker compose --profile sandbox up -d`
    );
  }

  const ext = language === "typescript" ? ".ts" : language === "python" ? ".py" : ".js";
  const hostDir = join(tmpdir(), "agent-web-code-exec");
  const hostFilename = join(hostDir, `${randomUUID()}${ext}`);
  const containerFilename = `/tmp/${randomUUID()}${ext}`;

  try {
    await mkdir(hostDir, { recursive: true });
    await writeFile(hostFilename, code, "utf-8");

    // Copy file into container
    await execAsync(
      `docker cp "${hostFilename}" ${SANDBOX_CONTAINER}:${containerFilename}`,
      { timeout: CMD_TIMEOUT }
    );

    const execTimeout = Math.max(timeoutMs - CMD_TIMEOUT, 5_000);

    try {
      let cmd: string;
      if (language === "python") {
        cmd = `python3 "${containerFilename}" 2>/tmp/stderr.txt`;
      } else if (language === "typescript") {
        // Try tsx first, fall back to --experimental-strip-types
        cmd = `npx tsx "${containerFilename}" 2>/tmp/stderr.txt; if [ $? -ne 0 ]; then node --experimental-strip-types "${containerFilename}" 2>/tmp/stderr.txt; fi`;
      } else {
        cmd = `node "${containerFilename}" 2>/tmp/stderr.txt`;
      }

      const { stdout } = await execAsync(
        `docker exec ${SANDBOX_CONTAINER} sh -c '${cmd.replace(/'/g, "'\\''")}'`,
        {
          timeout: execTimeout + CMD_TIMEOUT,
          maxBuffer: MAX_RETURN_CHARS * 4,
        }
      );

      // Get stderr separately
      let stderr = "";
      try {
        const { stdout: errOut } = await execAsync(
          `docker exec ${SANDBOX_CONTAINER} cat /tmp/stderr.txt 2>/dev/null || true`,
          { timeout: CMD_TIMEOUT }
        );
        stderr = (errOut || "").toString().trim();
      } catch {
        // stderr file might not exist
      }

      const out = (stdout || "").toString();
      const parts: string[] = [];
      if (out.trim()) parts.push(`[stdout]\n${out.trim()}`);
      if (stderr) parts.push(`[stderr]\n${stderr}`);

      return truncateOutput(parts.join("\n") || "(no output)");
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: string | number;
        killed?: boolean;
      };

      if (err.killed) {
        return `[timeout] Code execution exceeded ${execTimeout}ms and was terminated.`;
      }

      const parts: string[] = [];
      if (err.stdout) parts.push(`[stdout]\n${err.stdout}`);
      if (err.stderr) parts.push(`[stderr]\n${err.stderr}`);
      parts.push(
        `[exit] code=${err.code ?? "unknown"}: ${err.message ?? "unknown error"}`
      );
      return truncateOutput(parts.join("\n"));
    }
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    return `[error] ${err.code || ""} ${
      err.message || "Failed to execute code in Docker sandbox"
    }`.trim();
  } finally {
    // Cleanup temp files
    try {
      await unlink(hostFilename);
    } catch {
      // Best effort
    }
    try {
      await execAsync(
        `docker exec ${SANDBOX_CONTAINER} rm -f "${containerFilename}" /tmp/stderr.txt 2>/dev/null || true`,
        { timeout: CMD_TIMEOUT }
      );
    } catch {
      // Best effort cleanup inside container
    }
  }
}
