import { db, mcpServers } from "@agent-web/db";
import { eq } from "drizzle-orm";
import { mcpManager, McpTool } from "./client.js";
import { ToolRegistry } from "../tools/registry.js";

export async function loadMcpToolsIntoRegistry(registry: ToolRegistry) {
  const servers = await db.select().from(mcpServers).where(eq(mcpServers.enabled, true));

  for (const server of servers) {
    try {
      let tools: McpTool[] = [];

      if (server.transport === "stdio" && server.command) {
        const args = server.args ? JSON.parse(server.args) : [];
        const env = server.env ? JSON.parse(server.env) : undefined;
        tools = await mcpManager.connectStdioServer(server.id, server.command, args, env);
      } else if (server.url) {
        tools = await mcpManager.connectSseServer(server.id, server.url);
      }

      if (!tools || tools.length === 0) continue;

      // Parse include/exclude filters
      const includeList = server.toolsInclude ? JSON.parse(server.toolsInclude) as string[] : null;
      const excludeList = server.toolsExclude ? JSON.parse(server.toolsExclude) as string[] : null;

      for (const tool of tools) {
        // Apply whitelist
        if (includeList && !includeList.includes(tool.name)) continue;
        // Apply blacklist
        if (excludeList && excludeList.includes(tool.name)) continue;

        registry.register({
          name: `mcp_${server.name}_${tool.name}`,
          description: tool.description ?? `MCP tool: ${tool.name}`,
          parameters: (tool.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
          handler: async (args: Record<string, unknown>) => {
            const client = mcpManager.getClient(server.id);
            if (!client) return `MCP server ${server.name} is not connected`;
            const result = await client.callTool(tool.name, args);
            return typeof result === "string" ? result : JSON.stringify(result, null, 2);
          },
        });
      }
    } catch (e) {
      console.error(`MCP server ${server.name} connection failed:`, (e as Error).message);
    }
  }
}
