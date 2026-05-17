import { tool } from "ai";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const CONFIG_PATH = join(process.cwd(), "data", "mcp-servers.json");

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  /** Environment variables to pass to the MCP server process */
  env?: Record<string, string>;
  /** Working directory for the server process */
  cwd?: string;
  enabled: boolean;
}

export interface McpToolDefinition {
  serverId: string;
  serverName: string;
  toolName: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ConnectedServer {
  config: McpServerConfig;
  client: Client;
  transport: StdioClientTransport;
  tools: Tool[];
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11);
}

/**
 * Loads MCP server configurations from the JSON file.
 * Creates the file with an empty array if it doesn't exist.
 */
async function loadConfig(): Promise<McpServerConfig[]> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as McpServerConfig[];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist — create directory and file
      await mkdir(dirname(CONFIG_PATH), { recursive: true });
      await writeFile(CONFIG_PATH, "[]", "utf-8");
      return [];
    }
    throw err;
  }
}

/**
 * Saves MCP server configurations to the JSON file.
 */
async function saveConfig(configs: McpServerConfig[]): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(configs, null, 2), "utf-8");
}

/**
 * Converts a JSON Schema properties object to a Zod schema.
 * Handles common patterns: string, number, boolean, integer with optional/required.
 */
function jsonSchemaToZod(
  inputSchema: Tool["inputSchema"]
): z.ZodTypeAny {
  const properties = inputSchema.properties as
    | Record<string, { type?: string; description?: string }>
    | undefined;
  const required = (inputSchema.required as string[]) ?? [];

  if (!properties || Object.keys(properties).length === 0) {
    return z.object({}).describe("No parameters");
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let fieldSchema: z.ZodTypeAny;

    switch (prop.type) {
      case "string":
        fieldSchema = z.string();
        break;
      case "number":
        fieldSchema = z.number();
        break;
      case "integer":
        fieldSchema = z.number().int();
        break;
      case "boolean":
        fieldSchema = z.boolean();
        break;
      case "array":
        fieldSchema = z.array(z.unknown());
        break;
      case "object":
        fieldSchema = z.record(z.unknown());
        break;
      default:
        fieldSchema = z.unknown();
    }

    if (prop.description) {
      fieldSchema = fieldSchema.describe(prop.description);
    }

    if (!required.includes(key)) {
      fieldSchema = fieldSchema.optional();
    }

    shape[key] = fieldSchema;
  }

  return z.object(shape);
}

/**
 * Converts an MCP tool result to a plain text string for the AI SDK.
 */
function mcpResultToText(
  result: Awaited<ReturnType<Client["callTool"]>>
): string {
  const content = Array.isArray((result as { content?: unknown[] }).content)
    ? (result as { content: unknown[] }).content
    : [];

  const parts: string[] = [];
  for (const item of content) {
    const c = item as { type?: string; text?: string; data?: string };
    if (c.type === "text" && typeof c.text === "string") {
      parts.push(c.text);
    } else if (c.type === "resource" && c.text) {
      parts.push(c.text);
    } else if (c.type === "image" && c.data) {
      const itemAny = item as Record<string, unknown>;
      parts.push(`[Image: ${String(itemAny.mimeType ?? "unknown")} (${c.data.length} bytes)]`);
    } else {
      parts.push(JSON.stringify(item));
    }
  }

  return parts.join("\n");
}

/**
 * Singleton manager for MCP server connections.
 */
export class McpManager {
  private connectedServers: Map<string, ConnectedServer> = new Map();
  private configs: McpServerConfig[] = [];
  private loaded = false;

  /**
   * Load server configs from disk (idempotent).
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    this.configs = await loadConfig();
    this.loaded = true;
  }

  /**
   * Reload configs from disk.
   */
  async reload(): Promise<void> {
    this.configs = await loadConfig();
  }

  /**
   * Get all configured servers.
   */
  async listServers(): Promise<McpServerConfig[]> {
    await this.load();
    return [...this.configs];
  }

  /**
   * Add a new server configuration.
   */
  async addServer(
    config: Omit<McpServerConfig, "id" | "enabled">
  ): Promise<McpServerConfig> {
    await this.load();
    const newConfig: McpServerConfig = {
      ...config,
      id: generateId(),
      enabled: true,
    };
    this.configs.push(newConfig);
    await saveConfig(this.configs);
    return newConfig;
  }

  /**
   * Remove a server configuration and disconnect if connected.
   */
  async removeServer(id: string): Promise<boolean> {
    await this.load();
    await this.disconnect(id);
    const idx = this.configs.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.configs.splice(idx, 1);
    await saveConfig(this.configs);
    return true;
  }

  /**
   * Connect to an MCP server and load its tools.
   */
  async connect(id: string): Promise<{ tools: Tool[] }> {
    await this.load();
    const config = this.configs.find((c) => c.id === id);
    if (!config) {
      throw new Error(`MCP server not found: ${id}`);
    }

    // Disconnect existing if reconnecting
    await this.disconnect(id);

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
      cwd: config.cwd,
    });

    const client = new Client(
      {
        name: "agent-web-mcp-client",
        version: "0.1.0",
      },
      {
        capabilities: {},
      }
    );

    try {
      await client.connect(transport);
    } catch (err) {
      throw new Error(
        `Failed to connect to MCP server "${config.name}": ${(err as Error).message}`
      );
    }

    // Get tool definitions
    const toolResult = await client.listTools();
    const tools = toolResult.tools as Tool[];

    this.connectedServers.set(id, {
      config,
      client,
      transport,
      tools,
    });

    return { tools };
  }

  /**
   * Disconnect from an MCP server.
   */
  async disconnect(id: string): Promise<void> {
    const existing = this.connectedServers.get(id);
    if (existing) {
      try {
        await existing.transport.close();
        await existing.client.close();
      } catch {
        // Ignore close errors
      }
      this.connectedServers.delete(id);
    }
  }

  /**
   * Disconnect all servers.
   */
  async disconnectAll(): Promise<void> {
    const ids = [...this.connectedServers.keys()];
    await Promise.all(ids.map((id) => this.disconnect(id)));
  }

  /**
   * Get all connected servers with their tools.
   */
  getConnectedServers(): Map<string, ConnectedServer> {
    return new Map(this.connectedServers);
  }

  /**
   * Connect to all enabled servers and load their tools.
   * Returns a merged Record of AI SDK tool objects.
   * Skips servers that fail with a console warning.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadAllTools(): Promise<Record<string, any>> {
    await this.load();

    const enabled = this.configs.filter((c) => c.enabled);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolMap: Record<string, any> = {};

    for (const config of enabled) {
      // Reuse already connected
      const connected = this.connectedServers.get(config.id);
      let mcpTools: Tool[];

      if (connected) {
        mcpTools = connected.tools;
      } else {
        try {
          const result = await this.connect(config.id);
          mcpTools = result.tools;
        } catch (err) {
          console.warn(
            `[McpManager] Skipping MCP server "${config.name}": ${(err as Error).message}`
          );
          continue;
        }
      }

      for (const mcpTool of mcpTools) {
        const toolKey = `mcp__${config.name}__${mcpTool.name}`;

        // Store reference to the connected server for execute
        const connectedServer = this.connectedServers.get(config.id)!;
        const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mcpToolDef: any = {
          description:
            mcpTool.description ?? `MCP tool from ${config.name}: ${mcpTool.name}`,
          parameters: zodSchema,
          execute: async (args: Record<string, unknown>) => {
            try {
              const client = connectedServer.client;
              const result = await client.callTool({
                name: mcpTool.name,
                arguments: args,
              });
              return mcpResultToText(result);
            } catch (err) {
              return `[MCP Error from ${config.name}/${mcpTool.name}]: ${(err as Error).message}`;
            }
          },
        };

        toolMap[toolKey] = tool(mcpToolDef);
      }
    }

    return toolMap;
  }

  /**
   * Get loaded MCP tool definitions for API display.
   */
  async getLoadedToolDefinitions(): Promise<McpToolDefinition[]> {
    const defs: McpToolDefinition[] = [];

    for (const [serverId, connected] of this.connectedServers) {
      for (const mcpTool of connected.tools) {
        defs.push({
          serverId,
          serverName: connected.config.name,
          toolName: mcpTool.name,
          description: mcpTool.description ?? "",
          parameters: mcpTool.inputSchema as Record<string, unknown>,
        });
      }
    }

    return defs;
  }
}

/** Singleton instance */
export const mcpManager = new McpManager();
