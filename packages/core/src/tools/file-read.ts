import { tool } from "ai";
import { z } from "zod";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const readFileTool = tool({
  description:
    "Read the contents of a text file from the local filesystem. Returns the file content as a string. Use for inspecting code, configs, logs, etc.",
  parameters: z.object({
    path: z.string().describe("Absolute or relative file path"),
    encoding: z
      .enum(["utf-8", "utf8", "ascii", "latin1", "base64"])
      .optional()
      .describe("File encoding (default utf-8)"),
    offset: z
      .number()
      .optional()
      .describe("Line offset (1-based, optional)"),
    limit: z
      .number()
      .optional()
      .describe("Max lines to read (optional, default: full file)"),
  }),
  execute: async ({ path, encoding, offset, limit }) => {
    try {
      const abs = resolve(path);
      const stat = await fs.stat(abs);
      if (!stat.isFile()) {
        return `[error] Not a file: ${abs}`;
      }
      if (stat.size > MAX_SIZE) {
        return `[error] File too large (${stat.size} bytes > ${MAX_SIZE}). Read a smaller file or use 'limit'.`;
      }

      const enc = (encoding || "utf-8") as BufferEncoding;
      const data = await fs.readFile(abs, enc);

      if (typeof offset === "number" || typeof limit === "number") {
        const lines = data.split(/\r?\n/);
        const start = Math.max(0, (offset ?? 1) - 1);
        const end = typeof limit === "number" ? start + limit : lines.length;
        const slice = lines.slice(start, end);
        return slice
          .map((l, i) => `${start + i + 1}\t${l}`)
          .join("\n");
      }

      return data;
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      return `[error] ${err.code || ""} ${err.message || "Failed to read file"}`.trim();
    }
  },
});
