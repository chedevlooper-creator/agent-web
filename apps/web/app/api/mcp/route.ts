import { NextRequest, NextResponse } from "next/server";
import { db, mcpServers } from "@agent-web/db";
import { eq, desc } from "drizzle-orm";
import { mcpManager } from "@agent-web/core";

export async function GET() {
  try {
    const rows = await db.select().from(mcpServers).orderBy(desc(mcpServers.createdAt));
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = crypto.randomUUID();
    await db.insert(mcpServers).values({
      id,
      name: body.name,
      transport: body.transport ?? "sse",
      url: body.url ?? null,
      command: body.command ?? null,
      args: body.args ? JSON.stringify(body.args) : null,
      env: body.env ? JSON.stringify(body.env) : null,
      enabled: body.enabled ?? true,
    });
    const row = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1);
    return NextResponse.json(row[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
