import { NextRequest, NextResponse } from "next/server";
import { db, cronJobs } from "@agent-web/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(cronJobs).orderBy(desc(cronJobs.createdAt));
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, schedule, prompt, sessionId } = body;

    if (!name || !schedule || !prompt) {
      return NextResponse.json(
        { error: "name, schedule, and prompt are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await db.insert(cronJobs).values({
      id,
      name,
      schedule,
      prompt,
      sessionId: sessionId ?? null,
      enabled: body.enabled !== false,
    });

    const rows = await db.select().from(cronJobs).where(eq(cronJobs.id, id)).limit(1);
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
