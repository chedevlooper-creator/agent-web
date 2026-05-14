import { Tool } from "../types.js";
import { spawn } from "child_process";
import * as path from "path";
import { checkCommandApproval } from "./approval.js";

const READ_BASE = process.cwd();
const BACKEND = (process.env.TERMINAL_BACKEND ?? "local") as "local" | "docker" | "ssh";
const DOCKER_IMAGE = process.env.TERMINAL_DOCKER_IMAGE ?? "python:3.11-slim";
const DOCKER_CONTAINER = "agent-web-sandbox";

function safePath(input: string): string {
  const resolved = path.resolve(READ_BASE, input);
  if (!resolved.startsWith(READ_BASE)) {
    throw new Error("Path traversal blocked");
  }
  return resolved;
}

const DANGEROUS_PATTERNS = [
  /rm\s+-rf?\s+[/~.]/i,
  /rmdir\s+\/s\s+\/q/i,
  /del\s+\/q\s+\/s/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-fd/i,
  /eval\s*\(/i,
  /curl\s+.*\s*\|/i,
  /wget\s+.*\s*\|/i,
  /:\s*\(\s*\)\s*{\s*:\s*\|/i,
  /mkfs/i,
  /dd\s+if=/i,
  />\s*\/dev\/sda/i,
  />\s*\/dev\/null\s+&&\s+>/i,
  /powershell\s+(-encodedcommand|-ep\s+bypass|-nop)/i,
  /cmd\.exe\s+\/c/i,
  /sudo\s/i,
  /\bsu\s+-/i,
  /fsutil\s/i,
  /format\s/i,
  /diskpart/i,
  /bash\s+-c\s+['"].*rm\s+-rf/i,
  /sh\s+-c\s+['"].*rm\s+-rf/i,
];

function sanitizeCommand(cmd: string): string {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(cmd)) {
      throw new Error(`Dangerous command blocked: ${cmd}`);
    }
  }
  return cmd;
}

async function execLocal(command: string, timeout: number, cwd: string): Promise<string> {
  return new Promise((resolve) => {
    const start = Date.now();
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd" : "sh";
    const shellFlag = isWindows ? "/c" : "-c";

    const child = spawn(shell, [shellFlag, command], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000);
    }, timeout);

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > 500_000) {
        stdout = stdout.slice(0, 500_000) + "\n[Output truncated]";
        child.stdout?.pause();
      }
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
      if (stderr.length > 200_000) {
        stderr = stderr.slice(0, 200_000) + "\n[Stderr truncated]";
        child.stderr?.pause();
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const result: any = {
        exitCode: code ?? (killed ? -1 : 0),
        backend: "local",
        duration: Date.now() - start + "ms",
      };
      if (stdout) result.stdout = stdout.slice(0, 100_000);
      if (stderr) result.stderr = stderr.slice(0, 50_000);
      resolve(JSON.stringify(result, null, 2));
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(JSON.stringify({ error: err.message }, null, 2));
    });
  });
}

async function execDocker(command: string, timeout: number, cwd: string): Promise<string> {
  // Ensure container is running
  try {
    const check = spawn("docker", ["ps", "--filter", `name=${DOCKER_CONTAINER}`, "--format", "{{.Names}}"]);
    let containerFound = false;
    check.stdout.on("data", (d) => {
      if (d.toString().trim() === DOCKER_CONTAINER) containerFound = true;
    });
    await new Promise<void>((resolve) => check.on("close", () => resolve()));

    if (!containerFound) {
      const run = spawn("docker", [
        "run", "-d", "--name", DOCKER_CONTAINER,
        "--cpus", "1",
        "--memory", "512m",
        "--pids-limit", "256",
        "--read-only",
        "--tmpfs", "/tmp",
        "-v", `${READ_BASE}:/workspace`,
        "-w", "/workspace",
        DOCKER_IMAGE,
        "sleep", "7200"
      ]);
      await new Promise<void>((resolve) => run.on("close", () => resolve()));
    }
  } catch {
    // Docker not available, fallback to local
    return execLocal(command, timeout, cwd);
  }

  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn("docker", [
      "exec", "-w", cwd.replace(READ_BASE, "/workspace") || "/workspace",
      DOCKER_CONTAINER,
      "sh", "-c", command,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > 500_000) {
        stdout = stdout.slice(0, 500_000) + "\n[Output truncated]";
        child.stdout?.pause();
      }
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
      if (stderr.length > 200_000) {
        stderr = stderr.slice(0, 200_000) + "\n[Stderr truncated]";
        child.stderr?.pause();
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const result: any = {
        exitCode: code ?? -1,
        backend: "docker",
        duration: Date.now() - start + "ms",
      };
      if (stdout) result.stdout = stdout.slice(0, 100_000);
      if (stderr) result.stderr = stderr.slice(0, 50_000);
      resolve(JSON.stringify(result, null, 2));
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(JSON.stringify({ error: err.message, backend: "docker" }, null, 2));
    });
  });
}

async function execSsh(command: string, timeout: number, cwd: string): Promise<string> {
  const host = process.env.TERMINAL_SSH_HOST;
  const user = process.env.TERMINAL_SSH_USER;
  const key = process.env.TERMINAL_SSH_KEY ?? "";

  if (!host || !user) {
    return JSON.stringify({ error: "SSH backend not configured. Set TERMINAL_SSH_HOST and TERMINAL_SSH_USER." }, null, 2);
  }

  return new Promise((resolve) => {
    const start = Date.now();
    const sshArgs = ["-o", "StrictHostKeyChecking=no"];
    if (key) sshArgs.push("-i", key);
    sshArgs.push(`${user}@${host}`);
    if (cwd) sshArgs.push(`cd ${cwd} && ${command}`);
    else sshArgs.push(command);

    const child = spawn("ssh", sshArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);

    child.stdout?.on("data", (data) => { stdout += data.toString(); });
    child.stderr?.on("data", (data) => { stderr += data.toString(); });

    child.on("close", (code) => {
      clearTimeout(timer);
      const result: any = {
        exitCode: code ?? -1,
        backend: "ssh",
        duration: Date.now() - start + "ms",
      };
      if (stdout) result.stdout = stdout.slice(0, 100_000);
      if (stderr) result.stderr = stderr.slice(0, 50_000);
      resolve(JSON.stringify(result, null, 2));
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(JSON.stringify({ error: err.message, backend: "ssh" }, null, 2));
    });
  });
}

export const terminalTool: Tool = {
  name: "terminal",
  description:
    "Execute a shell command. Returns stdout, stderr, exit code, and backend used. Use with caution.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to execute" },
      timeout: { type: "number", description: "Timeout in milliseconds (default 30000)" },
      cwd: { type: "string", description: "Working directory (default: project root)" },
    },
    required: ["command"],
  },
  toolset: "terminal",
  handler: async (args) => {
    const command = sanitizeCommand(args.command as string);
    const timeout = (args.timeout as number) || 30000;
    const cwd = args.cwd ? safePath(args.cwd as string) : process.cwd();

    const approval = checkCommandApproval(command);
    if (!approval.approved) {
      return JSON.stringify({ error: approval.reason, blocked: true }, null, 2);
    }

    switch (BACKEND) {
      case "docker":
        return execDocker(command, timeout, cwd);
      case "ssh":
        return execSsh(command, timeout, cwd);
      default:
        return execLocal(command, timeout, cwd);
    }
  },
};
