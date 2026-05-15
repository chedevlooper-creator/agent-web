import { terminalTool } from "./terminal/index.js";
import { readFileTool } from "./file-read.js";
import { webSearchTool } from "./web-search.js";

export const tools = {
  terminal: terminalTool,
  read_file: readFileTool,
  web_search: webSearchTool,
} as const;

export type ToolName = keyof typeof tools;

export const toolDescriptions: Record<ToolName, { name: string; description: string; status: "active" | "disabled" }> = {
  terminal: {
    name: "Terminal",
    description: "Execute shell commands (sandboxed or local with safety restrictions)",
    status: "active",
  },
  read_file: {
    name: "Read File",
    description: "Read text files from the local filesystem",
    status: "active",
  },
  web_search: {
    name: "Web Search",
    description: "Search the web via DuckDuckGo",
    status: "active",
  },
};

export { terminalTool, readFileTool, webSearchTool };
