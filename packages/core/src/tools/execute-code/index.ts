import { tool } from "ai";
import { z } from "zod";
import { executeCodeLocally } from "./local.js";
import { executeCodeInDocker } from "./docker.js";

const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_TIMEOUT_MS = 15_000;

function getBackend(): "docker" | "local" {
  const env = process.env.TERMINAL_BACKEND;
  if (env === "docker") return "docker";
  return "local";
}

const BACKEND = getBackend();

export const executeCodeTool = tool({
  description:
    "Execute JavaScript, TypeScript, or Python code in a sandboxed environment. " +
    (BACKEND === "docker"
      ? "Runs inside an isolated Docker sandbox container with pandas, numpy, openpyxl, requests, beautifulsoup4 pre-installed."
      : "Writes code to a temp file, runs it, and returns stdout/stderr. Blocks dangerous imports (child_process, fs, net, etc.).") +
    ` Default timeout: ${DEFAULT_TIMEOUT_MS}ms.`,
  parameters: z.object({
    code: z.string().describe("The source code to execute"),
    language: z
      .enum(["javascript", "typescript", "python"])
      .describe(
        "Programming language of the code ('javascript', 'typescript', or 'python')"
      ),
    timeout: z
      .number()
      .min(1000)
      .max(MAX_TIMEOUT_MS)
      .optional()
      .describe(
        `Timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}ms, max ${MAX_TIMEOUT_MS}ms)`
      ),
  }),
  execute: async ({ code, language, timeout }) => {
    if (BACKEND === "docker") {
      try {
        return await executeCodeInDocker({ code, language, timeout });
      } catch {
        // Fallback to local with a warning if Docker is unavailable
        return (
          "[sandbox] Docker sandbox unavailable — falling back to local execution.\n\n" +
          (await executeCodeLocally({ code, language, timeout }))
        );
      }
    }
    return executeCodeLocally({ code, language, timeout });
  },
});
