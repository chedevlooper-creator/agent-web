import { Tool } from "../types.js";

export const webTools: Tool[] = [
  {
    name: "web_search",
    description: "Search the web for a query",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
    handler: async (args) => {
      return `[web_search: "${args.query}" — implement with your preferred search API]`;
    },
  },
  {
    name: "web_scrape",
    description: "Fetch and summarize a web page",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
    handler: async (args) => {
      return `[web_scrape: ${args.url} — implement with fetch]`;
    },
  },
];
