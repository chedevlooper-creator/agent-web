import { Tool } from "../types.js";
import * as fs from "fs/promises";
import * as path from "path";

const READ_BASE = process.cwd();

function safePath(input: string): string {
  const resolved = path.resolve(READ_BASE, input);
  if (!resolved.startsWith(READ_BASE)) {
    throw new Error("Path traversal blocked");
  }
  return resolved;
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
      const p = safePath(args.path as string);
      const content = await fs.readFile(p, "utf-8");
      return content;
    },
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
      const p = safePath(args.path as string);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, args.content as string, "utf-8");
      return `Wrote ${p}`;
    },
  },
  {
    name: "search_files",
    description: "Search file contents with regex",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern" },
        path: { type: "string", description: "Directory to search in" },
      },
      required: ["pattern", "path"],
    },
    handler: async (args) => {
      return "[search_files: use server implementation]";
    },
  },
];
