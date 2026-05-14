import { NextRequest, NextResponse } from "next/server";
import { db, memoryEntries } from "@agent-web/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { memoryManager, MEMORY_CHAR_LIMIT, USER_CHAR_LIMIT } from "@agent-web/core";
import { getMemoryUsage, searchSessions } from "@agent-web/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const sessionId = searchParams.get("sessionId") ?? undefined;
    const target = searchParams.get("target") as "memory" | "user" | undefined;

    const conditions = [];
    if (category) conditions.push(eq(memoryEntries.category, category as any));
    if (sessionId) conditions.push(eq(memoryEntries.sessionId, sessionId));
    if (target) conditions.push(eq(memoryEntries.target, target));
    if (query) {
      conditions.push(
        sql`${memoryEntries.key} || ' ' || ${memoryEntries.value} LIKE ${"%" + query + "%"}`
      );
    }

    const rows = await db
      .select()
      .from(memoryEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt))
      .limit(limit);
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Replace action (substring matching)
    if (action === "replace") {
      const result = await memoryManager.replaceEntry(body.target ?? "memory", body.oldText, body.newContent);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // Remove action
    if (action === "remove") {
      const result = await memoryManager.removeEntry(body.target ?? "memory", body.oldText);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // Session search action
    if (action === "search_sessions") {
      const results = await searchSessions(body.query, { limit: body.limit ?? 10 });
      return NextResponse.json({ results });
    }

    // Auto-extract memory from conversation
    if (action === "auto_extract") {
      const { userMessage, assistantMessage } = body;
      if (!userMessage || !assistantMessage) {
        return NextResponse.json({ error: "userMessage and assistantMessage required" }, { status: 400 });
      }
      const result = await memoryManager.extractMemoriesFromExchange(userMessage, assistantMessage);
      return NextResponse.json(result);
    }

    // Default: create entry
    const id = crypto.randomUUID();
    await db.insert(memoryEntries).values({
      id,
      key: body.key,
      value: body.value,
      category: body.category ?? "fact",
      importance: body.importance ?? 5,
      sessionId: body.sessionId ?? null,
      target: body.target ?? "memory",
    });
    const row = await db.select().from(memoryEntries).where(eq(memoryEntries.id, id)).limit(1);
    return NextResponse.json(row[0]);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
