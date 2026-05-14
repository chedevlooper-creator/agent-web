import { NextRequest, NextResponse } from "next/server";
import { db, subagents } from "@agent-web/db";
import { eq, desc } from "drizzle-orm";
import { subagentManager } from "@agent-web/core";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parentSessionId");
    if (!parentId) {
      return NextResponse.json({ error: "parentSessionId required" }, { status: 400 });
    }
    const rows = await db
      .select()
      .from(subagents)
      .where(eq(subagents.parentSessionId, parentId))
      .orderBy(desc(subagents.createdAt));
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = await subagentManager.spawn({
      parentSessionId: body.parentSessionId,
      goal: body.goal,
      model: body.model,
      provider: body.provider,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      maxSteps: body.maxSteps,
    });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
