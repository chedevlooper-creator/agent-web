import { Tool } from "../types.js";
import { terminalTool } from "./terminal.js";
import { fileTools } from "./file.js";
import { webTools } from "./web.js";
import { browserTools } from "./browser_tools.js";
import { visionTools } from "./vision_tools.js";
import { todoTools } from "./todo_tools.js";
import { memoryTools } from "./memory_tools.js";
import { delegateTools } from "./delegate_tools.js";
import { documentTools } from "./documents.js";

const TOOLSET_NAMES = ["terminal", "file", "web", "code_execution", "browser", "vision", "todo", "memory", "delegate", "document"] as const;
export type ToolsetName = typeof TOOLSET_NAMES[number];

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private disabledToolsets = new Set<string>();
  private disabledTools = new Set<string>();

  constructor() {
    this.register(terminalTool);
    fileTools.forEach((t) => this.register(t));
    webTools.forEach((t) => this.register(t));
    browserTools.forEach((t) => this.register(t));
    visionTools.forEach((t) => this.register(t));
    todoTools.forEach((t) => this.register(t));
    memoryTools.forEach((t) => this.register(t));
    delegateTools.forEach((t) => this.register(t));
    documentTools.forEach((t) => this.register(t));
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return this.listAvailable();
  }

  listAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  listAvailable(): Tool[] {
    return Array.from(this.tools.values()).filter((t) => {
      if (this.disabledTools.has(t.name)) return false;
      if (t.toolset && this.disabledToolsets.has(t.toolset)) return false;
      if (t.check_fn && !t.check_fn()) return false;
      return true;
    });
  }

  getToolsets(): Record<ToolsetName, boolean> {
    const result: Record<string, boolean> = {};
    for (const name of TOOLSET_NAMES) {
      result[name] = !this.disabledToolsets.has(name);
    }
    return result as Record<ToolsetName, boolean>;
  }

  enableToolset(toolset: string): void {
    this.disabledToolsets.delete(toolset);
  }

  disableToolset(toolset: string): void {
    this.disabledToolsets.add(toolset);
  }

  enableTool(toolName: string): void {
    this.disabledTools.delete(toolName);
  }

  disableTool(toolName: string): void {
    this.disabledTools.add(toolName);
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

  getToolStatus() {
    return this.listAll().map((t) => ({
      name: t.name,
      description: t.description,
      toolset: t.toolset ?? "default",
      enabled: this.listAvailable().some((a) => a.name === t.name),
    }));
  }
}

export const registry = new ToolRegistry();
