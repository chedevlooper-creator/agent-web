import { NextRequest, NextResponse } from "next/server";
import { db, subagentMessages } from "@agent-web/db";
import { eq, asc } from "drizzle-orm";

// GET /api/subagents/[id]/messages - get all messages for a subagent
// POST /api/subagents/[id]/messages - add a message to a subagent

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await db
      .select()
      .from(subagentMessages)
      .where(eq(subagentMessages.subagentId, id))
      .orderBy(asc(subagentMessages.createdAt));

    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { role, content, toolCalls, toolResults } = body;

    if (!role) {
      return NextResponse.json({ error: "role is required" }, { status: 400 });
    }

    const messageId = crypto.randomUUID();
    await db.insert(subagentMessages).values({
      id: messageId,
      subagentId: id,
      role,
      content: content ?? "",
      toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
      toolResults: toolResults ? JSON.stringify(toolResults) : null,
    });

    return NextResponse.json({ id: messageId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
