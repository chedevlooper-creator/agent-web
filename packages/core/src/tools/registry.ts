import { Tool } from "../types.js";
import { terminalTool } from "./terminal.js";
import { fileTools } from "./file.js";
import { webTools } from "./web.js";

class ToolRegistry {
  private tools = new Map<string, Tool>();

  constructor() {
    this.register(terminalTool);
    fileTools.forEach((t) => this.register(t));
    webTools.forEach((t) => this.register(t));
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  toOpenAIFormat() {
    return this.list().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}

export const registry = new ToolRegistry();
