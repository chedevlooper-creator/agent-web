import { NextRequest, NextResponse } from "next/server";
import { db, cronJobs } from "@agent-web/db";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.schedule !== undefined) updates.schedule = body.schedule;
    if (body.prompt !== undefined) updates.prompt = body.prompt;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.sessionId !== undefined) updates.sessionId = body.sessionId;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db.update(cronJobs).set(updates).where(eq(cronJobs.id, id));
    const rows = await db.select().from(cronJobs).where(eq(cronJobs.id, id)).limit(1);
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(cronJobs).where(eq(cronJobs.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
