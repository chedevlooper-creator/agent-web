export const toolDescriptions = {
  terminal: {
    name: "Terminal",
    description: "Execute shell commands on the local machine",
    status: "active" as const,
  },
  read_file: {
    name: "Read File",
    description: "Read text files from the local filesystem",
    status: "active" as const,
  },
  write_file: {
    name: "Write File",
    description: "Create or overwrite files on the local filesystem",
    status: "active" as const,
  },
  web_search: {
    name: "Web Search",
    description: "Search the web via DuckDuckGo",
    status: "active" as const,
  },
  list_directory: {
    name: "List Directory",
    description: "List directory contents with file types and sizes",
    status: "active" as const,
  },
  search_files: {
    name: "Search Files",
    description: "Search files by glob name pattern or regex text content",
    status: "active" as const,
  },
  web_fetch: {
    name: "Web Fetch",
    description: "Fetch a URL and extract readable text content from pages",
    status: "active" as const,
  },
  execute_code: {
    name: "Execute Code",
    description: "Execute JavaScript or TypeScript in a sandboxed Node.js process",
    status: "active" as const,
  },
};

export type ToolName = keyof typeof toolDescriptions;
