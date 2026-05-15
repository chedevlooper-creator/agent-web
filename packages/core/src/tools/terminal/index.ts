import { tool } from "ai";
import { z } from "zod";
import { executeLocal } from "./local.js";
import { executeDocker } from "./docker.js";

type TerminalBackend = "local" | "docker";

function getBackend(): TerminalBackend {
  const env = process.env.TERMINAL_BACKEND;
  if (env === "docker") return "docker";
  return "local";
}

const BACKEND = getBackend();

export const terminalTool = tool({
  description:
    "Execute a shell command. " +
    (BACKEND === "docker"
      ? "Runs inside an isolated Docker sandbox container."
      : "Runs on the local machine with safety restrictions."),
  parameters: z.object({
    command: z.string().describe("The shell command to execute"),
    timeout: z
      .number()
      .optional()
      .describe("Timeout in milliseconds (default 30000, max 120000)"),
    cwd: z
      .string()
      .optional()
      .describe("Working directory (default: current working directory)"),
  }),
  execute: async ({ command, timeout, cwd }) => {
    if (BACKEND === "docker") {
      try {
        return await executeDocker({ command, timeout, cwd });
      } catch {
        // Fallback to local with a warning if Docker is unavailable
        return (
          "[sandbox] Docker sandbox unavailable — falling back to local execution.\n\n" +
          (await executeLocal({ command, timeout, cwd }))
        );
      }
    }
    return executeLocal({ command, timeout, cwd });
  },
});
