import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const MAX_OUTPUT = 1_000_000; // 1MB

// ---- Safety: blocklist for destructive commands ----
const BLOCKLIST = [
  // Fork bombs
  /\b:\(\)\s*\{/,
  // Recursive delete of system dirs
  /\brm\s.*-rf\s+\//,
  /\brm\s.*-rf\s+\/etc\b/,
  /\brm\s.*-rf\s+\/boot\b/,
  /\brm\s.*-rf\s+\/sys\b/,
  /\brm\s.*-rf\s+\/proc\b/,
  /\brm\s.*-rf\s+\/dev\b/,
  // Format/mount attacks
  /\bmkfs\.\w+\s+\/dev\//,
  /\bmount\s+\/dev\//,
  // Shutdown/reboot
  /\b(shutdown|reboot|halt|poweroff)\b/,
  // Dangerous redirects
  />\s*\/dev\/sda/,
  // chmod 777 on system dirs
  /\bchmod\s.*777\s+\//,
  // Write to system files
  />\s*\/etc\//,
  // dd disk writes
  /\bdd\s+if=.*of=\/dev\//,
  // kernel module manipulation
  /\bmodprobe\b/,
  // X11/screen capture
  /\bxinput\b/,
  /\bscreencapture\b/,
];

// ---- Allowed commands (if whitelist mode is enabled) ----
const ALLOWED_COMMANDS = [
  /^(echo|cat|head|tail|less|more)\b/,
  /^(ls|dir|tree)\b/,
  /^(pwd|which|where|whereis)\b/,
  /^(cd|pushd|popd)\b/,
  /^(cp|mv|mkdir|touch)\b/,
  /^(find|grep|rg|awk|sed|sort|uniq|wc)\b/,
  /^(git|hg|svn)\b/,
  /^(npm|pnpm|yarn|npx)\b/,
  /^(node|python|python3|ruby|perl)\b/,
  /^(curl|wget)\b/,
  /^(ping|traceroute|nslookup)\b/,
  /^(ps|top|htop|df|du|free)\b/,
  /^(date|time|uptime)\b/,
  /^(whoami|id|groups)\b/,
  /^(env|printenv|set)\b/,
  /^(npm|npx|tsc|ts-node)\b/,
];

function isBlocked(command: string): string | null {
  const trimmed = command.trim();
  for (const pattern of BLOCKLIST) {
    if (pattern.test(trimmed)) {
      return `Blocked: command matches dangerous pattern: ${pattern}`;
    }
  }
  return null;
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
  const blocked = isBlocked(command);
  if (blocked) return `[blocked] ${blocked}`;

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
