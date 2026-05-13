import { Tool } from "../types.js";

export const terminalTool: Tool = {
  name: "terminal",
  description: "Execute a shell command on the server. Returns stdout, stderr, and exit code.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to execute" },
      timeout: { type: "number", description: "Timeout in seconds (default 30)" },
    },
    required: ["command"],
  },
  handler: async (args) => {
    return "[Terminal tool disabled for security in this demo]";
  },
};
