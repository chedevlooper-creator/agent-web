import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";
import { pluginManager } from "@agent-web/core";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InstallSchema = z.object({
  manifest: z.object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    description: z.string().default(""),
    version: z.string().min(1).max(50),
    entrypoint: z.string().min(1).max(2000),
    tools: z.array(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().default(""),
        parameters: z.record(z.unknown()).default({}),
      })
    ).default([]),
    settings: z.record(
      z.object({
        type: z.string(),
        required: z.boolean().default(false),
        default: z.unknown().optional(),
      })
    ).optional(),
  }),
});

/**
 * GET /api/plugins
 * Lists all installed plugins with their manifests.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const plugins = await pluginManager.listPlugins();
    return Response.json({ plugins });
  } catch (e: unknown) {
    console.error("GET /api/plugins error:", e);
    return handleApiError(e, req);
  }
}

/**
 * POST /api/plugins
 * Install a new plugin.
 * Body: { manifest: PluginManifest }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const raw = await req.json();

    const parsed = InstallSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const config = await pluginManager.installPlugin(parsed.data.manifest);
    return Response.json({ success: true, plugin: config }, { status: 201 });
  } catch (e: unknown) {
    console.error("POST /api/plugins error:", e);
    return handleApiError(e, req);
  }
}

/**
 * DELETE /api/plugins?id=xxx
 * Uninstall a plugin.
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

    const removed = await pluginManager.uninstallPlugin(id);
    if (!removed) {
      return Response.json({ error: "Plugin not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    console.error("DELETE /api/plugins error:", e);
    return handleApiError(e, req);
  }
}

/**
 * PATCH /api/plugins
 * Update plugin settings (toggle enabled).
 * Body: { id, enabled }
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const raw = await req.json();
    const { id, enabled } = raw as { id?: string; enabled?: boolean };

    if (!id || typeof enabled !== "boolean") {
      return Response.json(
        { error: "Request must include 'id' (string) and 'enabled' (boolean)" },
        { status: 400 }
      );
    }

    const result = await pluginManager.setEnabled(id, enabled);
    if (!result) {
      return Response.json({ error: "Plugin not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    console.error("PATCH /api/plugins error:", e);
    return handleApiError(e, req);
  }
}
