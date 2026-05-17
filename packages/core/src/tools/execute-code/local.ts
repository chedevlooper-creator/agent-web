import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

const MAX_RETURN_CHARS = 32_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 120_000;

// Dangerous imports/patterns to block
const DANGEROUS_PATTERNS = [
  // Module imports
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
  // ES module imports
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
  // Dynamic imports
  /import\s*\(\s*['"]child_process['"]\s*\)/,
  /import\s*\(\s*['"]fs['"]\s*\)/,
  /import\s*\(\s*['"]net['"]\s*\)/,
  /import\s*\(\s*['"]vm['"]\s*\)/,
  // Process manipulation
  /process\.exit\s*\(/,
  /process\.kill\s*\(/,
  /process\.abort\s*\(/,
  // eval and friends
  /eval\s*\(/,
  /Function\s*\(/,
  // Constructor-based module loading
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
 * Execute code locally by writing to a temp file and running with Node.js.
 * Supports both JavaScript and TypeScript (via tsx or --experimental-strip-types).
 */
export async function executeCodeLocally({
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

  const ext = language === "typescript" ? ".ts" : language === "python" ? ".py" : ".js";
  const runDir = join(tmpdir(), "agent-web-code-exec");
  const filename = join(runDir, `${randomUUID()}${ext}`);

  try {
    // Ensure temp directory exists
    await mkdir(runDir, { recursive: true });

    // Write code to temp file
    await writeFile(filename, code, "utf-8");

    let stdout: string;
    let stderr: string;

    try {
      if (language === "python") {
        const result = await execFileAsync("python3", [filename], {
          timeout: timeoutMs,
          maxBuffer: MAX_RETURN_CHARS * 4,
          cwd: runDir,
        });
        stdout = result.stdout || "";
        stderr = result.stderr || "";
      } else if (language === "typescript") {
        // Try tsx first, fall back to node --experimental-strip-types
        try {
          const result = await execFileAsync("npx", ["tsx", filename], {
            timeout: timeoutMs,
            maxBuffer: MAX_RETURN_CHARS * 4,
            cwd: runDir,
            env: { ...process.env, NODE_ENV: "sandbox" },
          });
          stdout = result.stdout || "";
          stderr = result.stderr || "";
        } catch {
          // Fallback: try node with experimental strip types (Node 22+)
          try {
            const result = await execFileAsync(
              process.execPath,
              ["--experimental-strip-types", filename],
              {
                timeout: timeoutMs,
                maxBuffer: MAX_RETURN_CHARS * 4,
                cwd: runDir,
                env: { ...process.env, NODE_ENV: "sandbox" },
              }
            );
            stdout = result.stdout || "";
            stderr = result.stderr || "";
          } catch (nodeErr: unknown) {
            // Both failed — report
            const e = nodeErr as {
              message?: string;
              stdout?: string;
              stderr?: string;
            };
            stdout = e.stdout || "";
            stderr =
              (e.stderr || "") +
              `\n[error] ${e.message || "Execution failed"}`;
          }
        }
      } else {
        // JavaScript: run with node directly
        const result = await execFileAsync(process.execPath, [filename], {
          timeout: timeoutMs,
          maxBuffer: MAX_RETURN_CHARS * 4,
          cwd: runDir,
          env: { ...process.env, NODE_ENV: "sandbox" },
        });
        stdout = result.stdout || "";
        stderr = result.stderr || "";
      }

      const parts: string[] = [];
      if (stdout.trim()) parts.push(`[stdout]\n${stdout.trim()}`);
      if (stderr.trim()) parts.push(`[stderr]\n${stderr.trim()}`);

      const combined = parts.join("\n");
      return truncateOutput(combined || "(no output)");
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number;
        killed?: boolean;
      };

      if (err.killed) {
        return `[timeout] Code execution exceeded ${timeoutMs}ms and was terminated.`;
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
      err.message || "Failed to execute code"
    }`.trim();
  } finally {
    // Cleanup temp file
    try {
      await unlink(filename);
    } catch {
      // Best effort cleanup
    }
  }
}
