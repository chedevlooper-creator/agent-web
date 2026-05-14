import { NextRequest, NextResponse } from "next/server";
import { db, sessions, messages } from "@agent-web/db";
import { eq, asc } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sessionRows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const messageRows = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(asc(messages.createdAt));
    return NextResponse.json({ session: sessionRows[0], messages: messageRows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await db
      .update(sessions)
      .set({ title: body.title, updatedAt: new Date() })
      .where(eq(sessions.id, id));
    const row = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return NextResponse.json(row[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(sessions).where(eq(sessions.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
