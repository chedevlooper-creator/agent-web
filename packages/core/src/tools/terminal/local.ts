import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const MAX_OUTPUT = 1_000_000; // 1MB raw buffer
const MAX_RETURN_CHARS = 32_000; // ~8k tokens — keep tool results LLM-friendly

// ---- Safety: blocklist for destructive commands ----
const BLOCKED_PATTERNS = [
  // Fork bombs
  /:\(\)\s*\{/,
  // Recursive delete of system dirs
  /^rm\s+(-\w+\s+)*\//,
  /rm\s+.*-rf\s+\/etc\b/,
  /rm\s+.*-rf\s+\/boot\b/,
  /rm\s+.*-rf\s+\/sys\b/,
  /rm\s+.*-rf\s+\/proc\b/,
  /rm\s+.*-rf\s+\/dev\b/,
  // Format/mount attacks
  /mkfs\.\w+\s+\/dev\//,
  /mount\s+\/dev\//,
  // Shutdown/reboot
  /\b(shutdown|reboot|halt|poweroff)\b/,
  // Dangerous redirects
  />\s*\/dev\/sda/,
  // chmod 777 on system dirs
  /chmod\s.*777\s+\//,
  // Write to system files
  />\s*\/etc\//,
  // dd disk writes
  /dd\s+if=.*of=\/dev\//,
  // kernel module manipulation
  /\bmodprobe\b/,
  // X11/screen capture
  /\bxinput\b/,
  /\bscreencapture\b/,
  // Windows destructive
  /^format\s+/i,
  /^del\s+\/s/i,
  /^rmdir\s+\/s/i,
  /^Remove-Item\s+.*-Recurse.*[A-Z]:\\/i,
  /^shutdown\s/i,
  /^taskkill\s+\/f\s+\/im/i,
  /^reg\s+(delete|add)\s/i,
  /^net\s+user\s/i,
  /^schtasks\s+\/(create|delete)/i,
  /Invoke-(WebRequest|Expression|RestMethod).*\|\s*(iex|Invoke-Expression)/i,
  /^Set-ExecutionPolicy\s/i,
  /^Start-Process\s.*-Verb\s+RunAs/i,
];

function truncateOutput(output: string): string {
  if (output.length <= MAX_RETURN_CHARS) return output;
  const half = Math.floor(MAX_RETURN_CHARS / 2) - 50;
  const truncatedLines = output
    .slice(half, output.length - half)
    .split("\n").length;
  return (
    output.slice(0, half) +
    `\n\n[... truncated ${truncatedLines} lines ...]\n\n` +
    output.slice(output.length - half)
  );
}

export interface TerminalArgs {
  command: string;
  timeout?: number;
  cwd?: string;
}

export async function executeLocal({
  command,
  timeout,
  cwd,
}: TerminalArgs): Promise<string> {
  const trimmed = command.trim();

  // Check for dangerous commands
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return `[blocked] Command rejected for safety: "${command}". This pattern is not allowed.`;
    }
  }

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
      return `[timeout] Command exceeded ${timeoutMs}ms and was terminated.`;
    }

    const parts: string[] = [];
    if (err.stdout) parts.push(`[stdout]\n${err.stdout}`);
    if (err.stderr) parts.push(`[stderr]\n${err.stderr}`);
    parts.push(
      `[exit] code=${err.code ?? "unknown"}: ${err.message ?? "unknown error"}`
    );
    return truncateOutput(parts.join("\n"));
  }
}
