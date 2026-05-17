import { NextRequest, NextResponse } from "next/server";
import { listMemories, upsertMemory, deleteMemory } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const memories = await listMemories();
    return NextResponse.json({ memories });
  } catch (e: unknown) {
    return handleApiError(e, req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json();
    const { key, value } = body as { key?: string; value?: string };
    if (!key || typeof value !== "string") {
      return NextResponse.json(
        { error: "key and value required" },
        { status: 400 }
      );
    }
    const memory = await upsertMemory({ key, value });
    return NextResponse.json({ memory });
  } catch (e: unknown) {
    return handleApiError(e, req);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }
    await deleteMemory(key);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return handleApiError(e, req);
  }
}
