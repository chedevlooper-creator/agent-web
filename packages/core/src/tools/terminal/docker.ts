import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const SANDBOX_CONTAINER =
  process.env.TERMINAL_SANDBOX_CONTAINER || "agent-web-sandbox";

const MAX_OUTPUT = 1_000_000;
const CMD_TIMEOUT = 5_000; // timeout for docker exec itself

export interface TerminalArgs {
  command: string;
  timeout?: number;
  cwd?: string;
}

/**
 * Execute a command inside the Docker sandbox container.
 * Falls back to local execution if the container is not running.
 */
export async function executeDocker({
  command,
  timeout,
  cwd,
}: TerminalArgs): Promise<string> {
  const timeoutMs = Math.min(Math.max(timeout ?? 30_000, 1000), 120_000);

  // Escape single quotes in command for shell
  const shellCmd = command.replace(/'/g, "'\\''");

  const workdir = cwd || "/workspace";

  // Check if sandbox container is running
  try {
    await execAsync(
      `docker inspect -f '{{.State.Running}}' ${SANDBOX_CONTAINER}`,
      { timeout: CMD_TIMEOUT }
    );
  } catch {
    throw new Error(
      `Sandbox container '${SANDBOX_CONTAINER}' is not running.`
    );
  }

  try {
    const { stdout, stderr } = await execAsync(
      `docker exec --workdir "${workdir}" ${SANDBOX_CONTAINER} sh -c '${shellCmd}'`,
      {
        timeout: timeoutMs + CMD_TIMEOUT,
        maxBuffer: MAX_OUTPUT,
      }
    );

    const out = (stdout || "").toString();
    const err = (stderr || "").toString();
    const combined = [out && `[stdout]\n${out}`, err && `[stderr]\n${err}`]
      .filter(Boolean)
      .join("\n");

    return combined || "(no output)";
  } catch (e: unknown) {
    const err = e as {
      message?: string;
      stdout?: string;
      stderr?: string;
      code?: number;
      killed?: boolean;
    };
    if (err.killed) {
      return `[timeout] Command exceeded ${timeoutMs}ms and was terminated.`;
    }
    const parts: string[] = [];
    if (err.stdout) parts.push(`[stdout]\n${err.stdout}`);
    if (err.stderr) parts.push(`[stderr]\n${err.stderr}`);
    parts.push(
      `[exit] code=${err.code ?? "unknown"}: ${err.message ?? "unknown error"}`
    );
    return parts.join("\n");
  }
}
