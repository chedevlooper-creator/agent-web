import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { gatewayRegistry } from "@agent-web/core";

// GET /api/gateway — list all gateway configs and statuses
export async function GET() {
  try {
    const configs = await gatewayRegistry.getConfigs();
    const statuses = gatewayRegistry.getStatuses();
    return Response.json({ configs, statuses });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/gateway — save/update gateway config
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { platform, enabled, credentials, agentId } = await req.json();
    if (!platform) return Response.json({ error: "Platform required" }, { status: 400 });

    await gatewayRegistry.saveConfig({
      platform,
      enabled: enabled ?? true,
      credentials: credentials || {},
      agentId: agentId || null,
    });

    // Auto-connect if enabled
    if (enabled !== false) {
      try {
        await gatewayRegistry.connect(platform);
      } catch (e) {
        return Response.json({ success: true, connectError: (e as Error).message });
      }
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/gateway?platform=xxx — remove gateway config
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    if (!platform) return Response.json({ error: "Platform required" }, { status: 400 });

    await gatewayRegistry.removeConfig(platform);
    return Response.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}
