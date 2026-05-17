import { tool } from "ai";
import { z } from "zod";
import { executeLocal } from "./local.js";
import { executeDocker } from "./docker.js";

function getBackend(): "docker" | "local" {
  const env = process.env.TERMINAL_BACKEND;
  // explicit opt-out: TERMINAL_BACKEND=local forces local-only
  if (env === "local") return "local";
  // explicit opt-in or "auto": try Docker
  return "docker";
}

export const terminalTool = tool({
  description:
    "Execute a shell command. Runs inside an isolated Docker sandbox container when available, with automatic fallback to local execution.",
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
    if (getBackend() === "docker") {
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
