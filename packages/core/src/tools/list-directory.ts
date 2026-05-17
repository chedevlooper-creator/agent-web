import { tool } from "ai";
import { z } from "zod";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { resolveSafePath } from "./path-security.js";

const MAX_RESULTS = 200;

interface DirEntry {
  name: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modified: string; // ISO 8601
}

async function listDirectoryRecursive(
  dirPath: string,
  includeHidden: boolean,
  results: DirEntry[]
): Promise<void> {
  if (results.length >= MAX_RESULTS) return;

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return; // Skip directories we can't read
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) break;
    if (!includeHidden && entry.name.startsWith(".")) continue;

    const fullPath = join(dirPath, entry.name);
    try {
      const stat = await fs.stat(fullPath);
      results.push({
        name: entry.name + (entry.isDirectory() ? "/" : ""),
        type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    } catch {
      results.push({
        name: entry.name + (entry.isDirectory() ? "/" : ""),
        type: entry.isDirectory() ? "directory" : "file",
        size: 0,
        modified: "unknown",
      });
    }

    if (entry.isDirectory()) {
      await listDirectoryRecursive(fullPath, includeHidden, results);
    }
  }
}

function formatResults(results: DirEntry[], path: string): string {
  if (results.length === 0) return `Directory is empty: ${path}`;

  const header = results.length >= MAX_RESULTS
    ? `[truncated: showing first ${MAX_RESULTS} of more items]\n\n`
    : "";

  const lines = results.map((r) => {
    const sizeStr = r.type === "directory" ? "-" : formatSize(r.size);
    return `${r.type === "directory" ? "📁" : "📄"} ${r.name.padEnd(40)} ${sizeStr.padStart(10)}  ${r.modified}`;
  });

  const summary = `\n\n${results.filter((r) => r.type === "directory").length} directories, ${results.filter((r) => r.type === "file").length} files`;

  return header + lines.join("\n") + summary;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const listDirectoryTool = tool({
  description:
    "List the contents of a directory. Returns file names, types, sizes, and modification dates. Use for exploring project structure, finding files, or understanding directory layouts.",
  parameters: z.object({
    path: z.string().describe("Absolute or relative path to the directory to list"),
    recursive: z
      .boolean()
      .optional()
      .describe("If true, recursively list all subdirectories (default: false)"),
    includeHidden: z
      .boolean()
      .optional()
      .describe("If true, include hidden files/directories starting with '.' (default: false)"),
  }),
  execute: async ({ path, recursive, includeHidden }) => {
    try {
      const abs = resolveSafePath(path);
      let stat;
      try {
        stat = await fs.stat(abs);
      } catch {
        return `[error] Path not found: ${abs}`;
      }

      if (!stat.isDirectory()) {
        return `[error] Not a directory: ${abs}. Use read_file to read files.`;
      }

      const results: DirEntry[] = [];

      if (recursive) {
        await listDirectoryRecursive(abs, includeHidden ?? false, results);
      } else {
        const entries = await fs.readdir(abs, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= MAX_RESULTS) break;
          if (!(includeHidden ?? false) && entry.name.startsWith(".")) continue;

          const fullPath = join(abs, entry.name);
          try {
            const entryStat = await fs.stat(fullPath);
            results.push({
              name: entry.name + (entry.isDirectory() ? "/" : ""),
              type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
              size: entryStat.size,
              modified: entryStat.mtime.toISOString(),
            });
          } catch {
            results.push({
              name: entry.name + (entry.isDirectory() ? "/" : ""),
              type: entry.isDirectory() ? "directory" : "file",
              size: 0,
              modified: "unknown",
            });
          }
        }

        // Sort: directories first, then alphabetical
        results.sort((a, b) => {
          if (a.type === "directory" && b.type !== "directory") return -1;
          if (a.type !== "directory" && b.type === "directory") return 1;
          return a.name.localeCompare(b.name);
        });
      }

      return formatResults(results, abs);
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      return `[error] ${err.code || ""} ${err.message || "Failed to list directory"}`.trim();
    }
  },
});
