import { NextRequest, NextResponse } from "next/server";
import { db, skillFiles, skills_new } from "@agent-web/db";
import { eq } from "drizzle-orm";

// GET /api/skills-new/[id]/files - list files for a skill
// PUT /api/skills-new/[id]/files - upload/update a supporting file
// DELETE /api/skills-new/[id]/files?fileId=xxx - remove a file

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const files = await db.select().from(skillFiles).where(eq(skillFiles.skillId, id));
    return NextResponse.json(files);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Verify skill exists
    const skillRows = await db.select().from(skills_new).where(eq(skills_new.id, id)).limit(1);
    if (skillRows.length === 0) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const body = await req.json();
    const { path: filePath, content } = body;

    if (!filePath || content === undefined) {
      return NextResponse.json({ error: "path and content are required" }, { status: 400 });
    }

    const fileId = crypto.randomUUID();
    await db.insert(skillFiles).values({
      id: fileId,
      skillId: id,
      path: filePath,
      content,
    });

    const rows = await db.select().from(skillFiles).where(eq(skillFiles.id, fileId)).limit(1);
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: skillId } = await params;
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "fileId query parameter is required" }, { status: 400 });
    }

    await db.delete(skillFiles).where(eq(skillFiles.id, fileId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
