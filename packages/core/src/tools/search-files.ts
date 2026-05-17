import { tool } from "ai";
import { z } from "zod";
import { promises as fs } from "node:fs";
import { join, relative, basename, extname } from "node:path";
import { resolveSafePath } from "./path-security.js";

const MAX_RETURN_CHARS = 32_000;
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", ".next", "__pycache__", ".venv", "venv"]);

// Approximate binary file extensions to skip when reading file content
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".mp3", ".mp4", ".avi", ".mov", ".mkv", ".wav", ".flac",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".db", ".sqlite", ".sqlite3",
  ".wasm",
  ".o", ".obj", ".class", ".pyc",
]);

function globToRegex(pattern: string): RegExp {
  let regexStr = "";
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "*") {
      // Check for ** (globstar)
      if (i + 1 < pattern.length && pattern[i + 1] === "*") {
        // Check for **/ or /**
        if (i + 2 < pattern.length && pattern[i + 2] === "/") {
          regexStr += "(.*/)?";
          i += 3;
          continue;
        }
        if (i + 2 >= pattern.length) {
          regexStr += ".*";
          i += 2;
          continue;
        }
        // ** not followed by / or end, treat as single *
        regexStr += "[^/]*";
        i += 1;
        continue;
      }
      regexStr += "[^/]*";
      i += 1;
      continue;
    }

    if (ch === "?") {
      regexStr += "[^/]";
      i += 1;
      continue;
    }

    if (ch === ".") {
      regexStr += "\\.";
      i += 1;
      continue;
    }

    if (ch === "{") {
      // Simple brace expansion {a,b,c}
      const close = pattern.indexOf("}", i);
      if (close !== -1) {
        const inner = pattern.slice(i + 1, close);
        const options = inner.split(",").map((s) =>
          s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        );
        regexStr += "(" + options.join("|") + ")";
        i = close + 1;
        continue;
      }
    }

    if (ch === "[") {
      // Character class: pass through
      const close = pattern.indexOf("]", i);
      if (close !== -1) {
        regexStr += pattern.slice(i, close + 1);
        i = close + 1;
        continue;
      }
    }

    // Escape regex special chars
    if ("+^$()|\\".includes(ch)) {
      regexStr += "\\" + ch;
    } else {
      regexStr += ch;
    }
    i += 1;
  }

  return new RegExp("^" + regexStr + "$", "i");
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_RETURN_CHARS) return output;
  const half = Math.floor(MAX_RETURN_CHARS / 2) - 50;
  return (
    output.slice(0, half) +
    "\n\n[... truncated ...]\n\n" +
    output.slice(output.length - half)
  );
}

async function collectAllFiles(root: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(join(dir, entry.name));
      } else if (entry.isFile()) {
        results.push(join(dir, entry.name));
      }
    }
  }

  await walk(root);
  return results;
}

export const searchFilesTool = tool({
  description:
    "Search for files by filename pattern or by text content. Two modes: 'filename' matches file names with glob-style patterns (e.g., '*.ts', '**\/*.test.ts'), 'content' searches inside text files with a regex pattern. Excludes node_modules, .git, dist directories.",
  parameters: z.object({
    root: z.string().describe("Root directory to search from (absolute or relative)"),
    mode: z
      .enum(["filename", "content"])
      .describe("Search mode: 'filename' for name matching, 'content' for text search inside files"),
    pattern: z.string().describe("Pattern to match: glob in filename mode (e.g. '*.ts', '**\/*.test.ts'), regex in content mode"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .describe("Max results to return (default 50)"),
  }),
  execute: async ({ root, mode, pattern, limit }) => {
    const maxResults = limit ?? 50;

    try {
      const absRoot = resolveSafePath(root);

      if (mode === "filename") {
        const regex = globToRegex(pattern);
        const allFiles = await collectAllFiles(absRoot);
        const matches = allFiles
          .filter((f) => regex.test(basename(f)) || regex.test(relative(absRoot, f)))
          .slice(0, maxResults);

        if (matches.length === 0) {
          return `No files matching "${pattern}" in ${absRoot}`;
        }

        const lines = matches.map((f) => relative(absRoot, f));
        const header = `Found ${matches.length} file(s) matching "${pattern}" (limit: ${maxResults}):\n`;
        return truncateOutput(header + lines.join("\n"));
      }

      // Content mode
      let contentRegex: RegExp;
      try {
        contentRegex = new RegExp(pattern, "gi");
      } catch {
        return `[error] Invalid regex pattern: "${pattern}"`;
      }

      const allFiles = await collectAllFiles(absRoot);
      const results: { file: string; line: number; text: string }[] = [];

      for (const file of allFiles) {
        if (results.length >= maxResults) break;

        const ext = extname(file).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) continue;

        try {
          const stat = await fs.stat(file);
          if (stat.size > 1024 * 1024) continue; // Skip files > 1MB
        } catch {
          continue;
        }

        let content: string;
        try {
          content = await fs.readFile(file, "utf-8");
        } catch {
          continue; // Skip unreadable files
        }

        contentRegex.lastIndex = 0;
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break;
          contentRegex.lastIndex = 0;
          if (contentRegex.test(lines[i])) {
            results.push({
              file: relative(absRoot, file),
              line: i + 1,
              text: lines[i].trim().slice(0, 200),
            });
          }
        }
      }

      if (results.length === 0) {
        return `No content matches for "${pattern}" in ${absRoot}`;
      }

      const formatted = results
        .map((r) => `${r.file}:${r.line}: ${r.text}`)
        .join("\n");

      const header = `Found ${results.length} match(es) for "${pattern}" (limit: ${maxResults}):\n`;
      return truncateOutput(header + formatted);
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      return `[error] ${err.code || ""} ${err.message || "Search failed"}`.trim();
    }
  },
});
