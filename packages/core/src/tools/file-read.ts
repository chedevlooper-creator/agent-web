import { tool } from "ai";
import { z } from "zod";
import { promises as fs } from "node:fs";
import { resolveSafePath } from "./path-security.js";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_RETURN_CHARS = 32_000; // ~8k tokens — keep LLM-friendly

function truncateContent(content: string): string {
  if (content.length <= MAX_RETURN_CHARS) return content;
  const lines = content.split("\n");
  const half = Math.floor(MAX_RETURN_CHARS / 2) - 50;
  const head = content.slice(0, half);
  const tail = content.slice(content.length - half);
  const headLines = head.split("\n").length;
  const tailStartLine = lines.length - tail.split("\n").length + 1;
  const skippedLines = tailStartLine - headLines;
  return (
    head +
    `\n\n[... truncated ${skippedLines} lines (use offset/limit to read specific sections) ...]\n\n` +
    tail
  );
}

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
      const abs = resolveSafePath(path);
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

      // Smart truncation for large file reads
      return truncateContent(data);
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      return `[error] ${err.code || ""} ${err.message || "Failed to read file"}`.trim();
    }
  },
});
