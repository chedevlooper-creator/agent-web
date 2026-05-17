import { NextRequest, NextResponse } from "next/server";
import { getDb, sessions, messages } from "@agent-web/db";
import { ensureMigrated } from "@agent-web/db";
import { eq, and, like, desc } from "drizzle-orm";
import { getUserIdFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    if (!q || q.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    await ensureMigrated();
    const db = getDb();
    const term = `%${q.trim()}%`;

    // Search messages by content
    const messageResults = await db
      .select({
        id: messages.id,
        sessionId: messages.sessionId,
        content: messages.content,
        role: messages.role,
        timestamp: messages.timestamp,
      })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          like(messages.content, term)
        )
      )
      .orderBy(desc(messages.timestamp))
      .limit(50);

    // Search sessions by title
    const sessionResults = await db
      .select({ id: sessions.id, title: sessions.title, updatedAt: sessions.updatedAt })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          like(sessions.title, term)
        )
      )
      .orderBy(desc(sessions.updatedAt))
      .limit(20);

    return NextResponse.json({
      results: {
        messages: messageResults.map((m) => ({
          id: m.id,
          sessionId: m.sessionId,
          snippet: m.content.slice(0, 200),
          role: m.role,
          timestamp: m.timestamp,
        })),
        sessions: sessionResults,
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
