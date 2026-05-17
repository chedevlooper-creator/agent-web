import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";
import { mcpManager } from "@agent-web/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mcp/tools
 * Lists all loaded MCP tools from all connected servers.
 * Returns: { tools: [{serverId, serverName, toolName, description, parameters}] }
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const tools = await mcpManager.getLoadedToolDefinitions();
    return Response.json({ tools });
  } catch (e: unknown) {
    console.error("GET /api/mcp/tools error:", e);
    return handleApiError(e, req);
  }
}
