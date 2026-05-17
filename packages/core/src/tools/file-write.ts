import { tool } from "ai";
import { z } from "zod";
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { resolveSafePath } from "./path-security.js";

const MAX_SIZE = 1 * 1024 * 1024; // 1MB max write

export const writeFileTool = tool({
  description:
    "Write content to a file on the local filesystem. Creates parent directories if needed. Use for creating or overwriting files. For editing, provide the full new content.",
  parameters: z.object({
    path: z.string().describe("Absolute or relative file path to write to"),
    content: z.string().describe("The full content to write to the file"),
  }),
  execute: async ({ path, content }) => {
    try {
      if (content.length > MAX_SIZE) {
        return `[error] Content too large (${content.length} chars > ${MAX_SIZE} max). Split into smaller writes.`;
      }

      const abs = resolveSafePath(path);

      await fs.mkdir(dirname(abs), { recursive: true });

      // Read existing content if any (for diff reference)
      let existed = false;
      try {
        await fs.stat(abs);
        existed = true;
      } catch {}

      await fs.writeFile(abs, content, "utf-8");

      const lines = content.split("\n").length;
      const chars = content.length;
      return existed
        ? `[ok] Updated ${abs} (${lines} lines, ${chars.toLocaleString()} chars)`
        : `[ok] Created ${abs} (${lines} lines, ${chars.toLocaleString()} chars)`;
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      return `[error] ${err.code || ""} ${err.message || "Failed to write file"}`.trim();
    }
  },
});
