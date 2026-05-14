import { NextRequest, NextResponse } from "next/server";
import { db, skills_new } from "@agent-web/db";
import { eq, like, desc } from "drizzle-orm";

// New SKILL.md format skills API

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const source = searchParams.get("source");
    const enabled = searchParams.get("enabled");

    let skills = await db.select().from(skills_new).orderBy(desc(skills_new.createdAt));

    if (category) {
      skills = skills.filter((s) => s.category === category);
    }
    if (source) {
      skills = skills.filter((s) => s.source === source);
    }
    if (enabled !== null && enabled !== undefined) {
      skills = skills.filter((s) => String(s.enabled) === enabled);
    }

    return NextResponse.json(skills);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, content, frontmatter, category } = body;

    if (!name || !description || !content) {
      return NextResponse.json(
        { error: "name, description, and content are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await db.insert(skills_new).values({
      id,
      name,
      description,
      content,
      frontmatter: frontmatter ? JSON.stringify(frontmatter) : null,
      category: category ?? "general",
      source: body.source ?? "local",
      trustLevel: body.trustLevel ?? "community",
    });

    const rows = await db.select().from(skills_new).where(eq(skills_new.id, id)).limit(1);
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
