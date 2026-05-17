import { terminalTool } from "./terminal/index.js";
import { readFileTool } from "./file-read.js";
import { writeFileTool } from "./file-write.js";
import { webSearchTool } from "./web-search.js";
import { listDirectoryTool } from "./list-directory.js";
import { searchFilesTool } from "./search-files.js";
import { webFetchTool } from "./web-fetch.js";
import { executeCodeTool } from "./execute-code/index.js";
import { gitTool } from "./git-tool.js";
import { dbQueryTool } from "./db-query.js";
import { apiTestTool } from "./api-test.js";
import { knowledgeSearchTool } from "./knowledge-search.js";
import { imageGenerateTool } from "./image-generate.js";
import { mcpManager } from "./mcp/index.js";

export const tools = {
  image_generate: imageGenerateTool,
  terminal: terminalTool,
  read_file: readFileTool,
  write_file: writeFileTool,
  web_search: webSearchTool,
  list_directory: listDirectoryTool,
  search_files: searchFilesTool,
  web_fetch: webFetchTool,
  execute_code: executeCodeTool,
  git: gitTool,
  db_query: dbQueryTool,
  api_test: apiTestTool,
  knowledge_search: knowledgeSearchTool,
} as const;

export type ToolName = keyof typeof tools;

export { mcpManager };

/**
 * Loads all built-in tools merged with MCP tools from connected servers.
 * Returns a flat Record of AI SDK tool objects.
 * MCP tool keys are prefixed with `mcp__<serverName>__<toolName>` to avoid conflicts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMcpTools(): Promise<Record<string, any>> {
  return mcpManager.loadAllTools();
}

/**
 * Returns the merged set of built-in tools + MCP tools.
 * The MCP tools are loaded on each call (they are cached by the manager).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAllTools(): Promise<Record<string, any>> {
  const mcpTools = await loadMcpTools();
  return { ...tools, ...mcpTools };
}
