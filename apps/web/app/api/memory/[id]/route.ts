import { NextRequest, NextResponse } from "next/server";
import { db, memoryEntries } from "@agent-web/db";
import { eq } from "drizzle-orm";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(memoryEntries).where(eq(memoryEntries.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
