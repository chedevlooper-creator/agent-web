import { NextRequest, NextResponse } from "next/server";
import {
  installAgent as dbInstallAgent,
  uninstallAgent as dbUninstallAgent,
  listInstalledAgents as dbListInstalledAgents,
  updateInstalledAgent as dbUpdateInstalledAgent,
} from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const agents = await dbListInstalledAgents(userId);
    return NextResponse.json({ agents });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { presetId, customName, customPrompt } = body as {
      presetId?: string;
      customName?: string;
      customPrompt?: string;
    };

    if (!presetId || typeof presetId !== "string") {
      return NextResponse.json({ error: "presetId is required" }, { status: 400 });
    }

    const agent = await dbInstallAgent(userId, presetId, customName, customPrompt);
    return NextResponse.json({ agent });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { id, customName, customPrompt, enabled, customModel, customProvider, customTemperature, customTools } = body as {
      id?: string;
      customName?: string | null;
      customPrompt?: string | null;
      enabled?: boolean;
      customModel?: string | null;
      customProvider?: string | null;
      customTemperature?: number | null;
      customTools?: string | null;
    };

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const agent = await dbUpdateInstalledAgent(id, { customName, customPrompt, enabled, customModel, customProvider, customTemperature, customTools });
    if (!agent) {
      return NextResponse.json({ error: "Installed agent not found" }, { status: 404 });
    }
    return NextResponse.json({ agent });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const removed = await dbUninstallAgent(userId, id);
    if (!removed) {
      return NextResponse.json({ error: "Installed agent not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
