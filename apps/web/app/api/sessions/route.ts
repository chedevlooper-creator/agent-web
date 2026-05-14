import { NextRequest, NextResponse } from "next/server";
import { db, sessions, messages } from "@agent-web/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(sessions).orderBy(desc(sessions.updatedAt));
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = crypto.randomUUID();
    await db.insert(sessions).values({
      id,
      title: body.title ?? "New Chat",
      model: body.model ?? "gpt-4o-mini",
      provider: body.provider ?? "openai",
      systemPrompt: body.systemPrompt ?? null,
    });
    const row = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return NextResponse.json(row[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
