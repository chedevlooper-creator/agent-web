import { terminalTool } from "./terminal.js";
import { readFileTool } from "./file-read.js";
import { writeFileTool } from "./file-write.js";
import { webSearchTool } from "./web-search.js";

export const tools = {
  terminal: terminalTool,
  read_file: readFileTool,
  write_file: writeFileTool,
  web_search: webSearchTool,
} as const;

export type ToolName = keyof typeof tools;

export const toolDescriptions: Record<ToolName, { name: string; description: string; status: "active" | "disabled" }> = {
  terminal: {
    name: "Terminal",
    description: "Execute shell commands on the local machine",
    status: "active",
  },
  read_file: {
    name: "Read File",
    description: "Read text files from the local filesystem",
    status: "active",
  },
  write_file: {
    name: "Write File",
    description: "Create or overwrite files on the local filesystem",
    status: "active",
  },
  web_search: {
    name: "Web Search",
    description: "Search the web via DuckDuckGo",
    status: "active",
  },
};

export { terminalTool, readFileTool, writeFileTool, webSearchTool };
