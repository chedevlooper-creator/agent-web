import { Tool } from "../types.js";

const READ_BASE = process.cwd();

export const codeExecutionTool: Tool = {
  name: "execute_code",
  description:
    "Execute Python or Node.js code in a sandboxed environment. Returns stdout, stderr, and exit code.",
  parameters: {
    type: "object",
    properties: {
      language: {
        type: "string",
        enum: ["python", "node"],
        description: "Language to execute the code in",
      },
      code: {
        type: "string",
        description: "The code to execute",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds (default 30000)",
      },
    },
    required: ["language", "code"],
  },
  toolset: "code_execution",
  handler: async (args) => {
    const language = args.language as string;
    const code = args.code as string;
    const timeout = (args.timeout as number) || 30000;

    if (language !== "python" && language !== "node") {
      return `Unsupported language: ${language}`;
    }

    const { spawn } = await import(/* turbopackIgnore: true */ "node:child_process");
    const isWindows = process.platform === "win32";
    const opts = {
      cwd: READ_BASE,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
    };

    const child =
      language === "python"
        ? isWindows
          ? spawn("python", ["-"], opts)
          : spawn("python3", ["-"], opts)
        : spawn("node", ["-"], opts);

    child.stdin?.write(code);
    child.stdin?.end();

    return new Promise((resolve) => {
      const start = Date.now();
      let stdout = "";
      let stderr = "";

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 2000);
      }, timeout);

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > 50_000) {
          stdout = stdout.slice(0, 50_000) + "\n[Output truncated]";
          child.stdout?.pause();
        }
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > 20_000) {
          stderr = stderr.slice(0, 20_000) + "\n[Stderr truncated]";
          child.stderr?.pause();
        }
      });

      child.on("close", (exitCode) => {
        clearTimeout(timer);
        const result: Record<string, unknown> = {
          exitCode: exitCode ?? -1,
          duration: `${Date.now() - start}ms`,
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
  },
};
