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
};

export type ToolName = keyof typeof toolDescriptions;
