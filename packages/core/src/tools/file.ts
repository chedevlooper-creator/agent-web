import { Tool } from "../types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { validatePath } from "../utils/path.js";

const READ_BASE = process.cwd();

async function safePath(input: string): Promise<string> {
  return validatePath(input, READ_BASE);
}

const PROTECTED_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "next.config.ts",
  "next.config.js",
  "turbo.json",
  "docker-compose.yml",
  "docker-compose.prod.yml",
  "Dockerfile",
  ".env",
  ".env.local",
  ".env.production",
  "tsconfig.json",
  "drizzle.config.ts",
]);

async function safePathWithProtection(input: string): Promise<string> {
  const resolved = await safePath(input);
  const basename = path.basename(resolved);
  if (PROTECTED_FILES.has(basename)) {
    throw new Error(`Protected file cannot be modified: ${basename}`);
  }
  return resolved;
}

async function searchFilesRecursive(
  dir: string,
  pattern: RegExp,
  results: Array<{ file: string; matches: Array<{ line: number; text: string }> }>,
  maxFiles = 200,
  maxMatchesPerFile = 50
): Promise<void> {
  if (results.length >= maxFiles) return;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= maxFiles) break;
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(READ_BASE, fullPath);

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === ".next"
      )
        continue;
      await searchFilesRecursive(fullPath, pattern, results, maxFiles, maxMatchesPerFile);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const skipExts = new Set([
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg",
        ".mp3", ".mp4", ".wav", ".avi", ".mov",
        ".zip", ".tar", ".gz", ".rar", ".7z",
        ".exe", ".dll", ".so", ".dylib",
        ".db", ".sqlite", ".lock",
      ]);
      if (skipExts.has(ext)) continue;

      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > 2_000_000) continue;
        const content = await fs.readFile(fullPath, "utf-8");
        const lines = content.split("\n");
        const matches: Array<{ line: number; text: string }> = [];
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            matches.push({ line: i + 1, text: lines[i].trim() });
            if (matches.length >= maxMatchesPerFile) break;
          }
          pattern.lastIndex = 0;
        }
        if (matches.length > 0) {
          results.push({ file: relativePath, matches });
        }
      } catch {
        // ignore unreadable files
      }
    }
  }
}

export const fileTools: Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path" },
      },
      required: ["path"],
    },
    handler: async (args) => {
      const p = await safePath(args.path as string);
      const content = await fs.readFile(p, "utf-8");
      return content;
    },
    toolset: "file",
  },
  {
    name: "write_file",
    description: "Write content to a file (creates parent dirs)",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
    handler: async (args) => {
      const p = await safePathWithProtection(args.path as string);
      const dir = await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, args.content as string, "utf-8");
      return `Wrote ${p}`;
    },
    toolset: "file",
  },
  {
    name: "list_files",
    description: "List files and directories in a given path",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative directory path (default: project root)" },
      },
      required: [],
    },
    handler: async (args) => {
      const p = await safePath((args.path as string) || ".");
      const entries = await fs.readdir(p, { withFileTypes: true });
      const lines = entries.map((e) => {
        const prefix = e.isDirectory() ? "[DIR] " : "[FILE] ";
        return prefix + e.name;
      });
      return lines.join("\n") || "(empty directory)";
    },
    toolset: "file",
  },
  {
    name: "search_files",
    description: "Search file contents with regex across the project",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern (case-sensitive by default)" },
        path: { type: "string", description: "Directory to search in (default: project root)" },
      },
      required: ["pattern"],
    },
    handler: async (args) => {
      const searchDir = await safePath((args.path as string) || ".");
      const patternStr = args.pattern as string;
      let regex: RegExp;
      try {
        regex = new RegExp(patternStr);
      } catch (e) {
        return `Invalid regex: ${(e as Error).message}`;
      }
      const results: Array<{ file: string; matches: Array<{ line: number; text: string }> }> = [];
      await searchFilesRecursive(searchDir, regex, results);
      if (results.length === 0) return "No matches found.";
      return JSON.stringify(results.slice(0, 50), null, 2);
    },
    toolset: "file",
  },
];
