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

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.content !== undefined) updates.content = body.content;
    if (body.frontmatter !== undefined) updates.frontmatter = typeof body.frontmatter === "string" ? body.frontmatter : JSON.stringify(body.frontmatter);
    if (body.category !== undefined) updates.category = body.category;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.source !== undefined) updates.source = body.source;
    if (body.trustLevel !== undefined) updates.trustLevel = body.trustLevel;
    if (body.sourceUrl !== undefined) updates.sourceUrl = body.sourceUrl;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db.update(skills_new).set(updates).where(eq(skills_new.id, id));
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
