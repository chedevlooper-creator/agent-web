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

export const tools = {
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
} as const;

export type ToolName = keyof typeof tools;
