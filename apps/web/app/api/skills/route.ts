import { NextRequest, NextResponse } from "next/server";
import { db, skills_new } from "@agent-web/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(skills_new).orderBy(desc(skills_new.createdAt));
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = crypto.randomUUID();
    const content = body.content ?? body.code ?? "";
    await db.insert(skills_new).values({
      id,
      name: body.name,
      description: body.description,
      content,
      category: body.category ?? "general",
      source: "local",
    });
    const row = await db.select().from(skills_new).where(eq(skills_new.id, id)).limit(1);
    return NextResponse.json(row[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
