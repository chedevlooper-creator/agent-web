import { NextRequest, NextResponse } from "next/server";
import { db, skills_new } from "@agent-web/db";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await db.select().from(skills_new).where(eq(skills_new.id, id)).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await db
      .update(skills_new)
      .set({
        name: body.name,
        description: body.description,
        content: body.content ?? body.code,
        enabled: body.enabled,
        updatedAt: new Date(),
      })
      .where(eq(skills_new.id, id));
    const rows = await db.select().from(skills_new).where(eq(skills_new.id, id)).limit(1);
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(skills_new).where(eq(skills_new.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
