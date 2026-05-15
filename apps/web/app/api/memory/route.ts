import { NextRequest, NextResponse } from "next/server";
import { listMemories, upsertMemory, deleteMemory } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const memories = await listMemories();
    return NextResponse.json({ memories });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }
    await deleteMemory(key);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
