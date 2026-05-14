import { NextRequest, NextResponse } from "next/server";
import { db, mcpServers } from "@agent-web/db";
import { eq } from "drizzle-orm";
import { mcpManager } from "@agent-web/core";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const server = rows[0];
    if (!server.url) return NextResponse.json({ ...server, tools: [] });
    const tools = await mcpManager.connectSseServer(id, server.url);
    return NextResponse.json({ ...server, tools });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await db
      .update(mcpServers)
      .set({
        name: body.name,
        url: body.url,
        enabled: body.enabled,
        transport: body.transport,
      })
      .where(eq(mcpServers.id, id));
    const rows = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1);
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    mcpManager.disconnectServer(id);
    await db.delete(mcpServers).where(eq(mcpServers.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
