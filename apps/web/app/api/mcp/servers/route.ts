import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";
import { mcpManager } from "@agent-web/core";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AddServerSchema = z.object({
  name: z.string().min(1).max(200),
  command: z.string().min(1).max(2000),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
});

const ConnectSchema = z.object({
  id: z.string().min(1),
});

/**
 * GET /api/mcp/servers
 * Lists all configured MCP servers.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const servers = await mcpManager.listServers();
    return Response.json({ servers });
  } catch (e: unknown) {
    console.error("GET /api/mcp/servers error:", e);
    return handleApiError(e, req);
  }
}

/**
 * POST /api/mcp/servers
 * Add a new MCP server configuration.
 * Body: { name, command, args, env?, cwd? }
 *
 * Or connect to an existing server:
 * Body: { id, action: "connect" }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const raw = await req.json();

    // Check if this is a connect action
    if (raw.action === "connect") {
      const parsed = ConnectSchema.safeParse(raw);
      if (!parsed.success) {
        return Response.json(
          {
            error: "Invalid request",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const result = await mcpManager.connect(parsed.data.id);
      return Response.json({
        success: true,
        server: { id: parsed.data.id },
        tools: result.tools.map((t: { name: string; description?: string }) => ({
          name: t.name,
          description: t.description ?? "",
        })),
      });
    }

    // Otherwise, add a new server
    const parsed = AddServerSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const server = await mcpManager.addServer(parsed.data);
    return Response.json({ success: true, server }, { status: 201 });
  } catch (e: unknown) {
    console.error("POST /api/mcp/servers error:", e);
    return handleApiError(e, req);
  }
}

/**
 * DELETE /api/mcp/servers?id=xxx
 * Removes an MCP server configuration and disconnects it.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "Missing 'id' query parameter" }, { status: 400 });
    }

    const removed = await mcpManager.removeServer(id);
    if (!removed) {
      return Response.json({ error: "Server not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    console.error("DELETE /api/mcp/servers error:", e);
    return handleApiError(e, req);
  }
}
