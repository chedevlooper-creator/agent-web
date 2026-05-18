import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getDb } from "@agent-web/db";
import { sharedSessions, sessions, messages } from "@agent-web/db/schema";
import { eq, and } from "drizzle-orm";

function genId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

function genToken(): string {
  return "share_" + crypto.randomUUID();
}

// GET /api/share?token=<shareToken> — get shared session data (public, no auth)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return Response.json({ error: "Share token required" }, { status: 400 });

    const db = getDb();
    const shared = await db
      .select()
      .from(sharedSessions)
      .where(eq(sharedSessions.shareToken, token))
      .limit(1);

    if (shared.length === 0) {
      return Response.json({ error: "Shared session not found" }, { status: 404 });
    }

    const share = shared[0];

    // Check if expired
    if (share.expiresAt && Date.now() > share.expiresAt) {
      return Response.json({ error: "Share link has expired" }, { status: 410 });
    }

    // Fetch session messages
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, share.sessionId))
      .limit(1);

    if (sessionRows.length === 0) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch messages for this session
    const msgRows = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, share.sessionId))
      .orderBy(messages.timestamp);

    return Response.json({
      title: share.title,
      messages: msgRows.map((m) => ({
        role: m.role,
        content: m.content,
        model: m.model,
        timestamp: m.timestamp,
      })),
      sharedAt: share.createdAt,
    });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/share — create a share link for a session
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId, expiresInHours } = await req.json();
    if (!sessionId) return Response.json({ error: "Session ID required" }, { status: 400 });

    const db = getDb();

    // Verify session belongs to user
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1);

    if (sessionRows.length === 0) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if already shared
    const existing = await db
      .select()
      .from(sharedSessions)
      .where(and(eq(sharedSessions.sessionId, sessionId), eq(sharedSessions.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      // Return existing share
      return Response.json({
        shareToken: existing[0].shareToken,
        shareUrl: `${req.nextUrl.origin}/share/${existing[0].shareToken}`,
        createdAt: existing[0].createdAt,
        expiresAt: existing[0].expiresAt,
      });
    }

    const now = Date.now();
    const id = genId();
    const token = genToken();
    const expiresAt = expiresInHours ? now + expiresInHours * 60 * 60 * 1000 : null;

    await db.insert(sharedSessions).values({
      id,
      sessionId,
      userId,
      shareToken: token,
      title: sessionRows[0].title,
      createdAt: now,
      expiresAt,
    });

    return Response.json({
      shareToken: token,
      shareUrl: `${req.nextUrl.origin}/share/${token}`,
      createdAt: now,
      expiresAt,
    });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/share?sessionId=xxx — remove share link
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return Response.json({ error: "Session ID required" }, { status: 400 });

    const db = getDb();
    await db
      .delete(sharedSessions)
      .where(and(eq(sharedSessions.sessionId, sessionId), eq(sharedSessions.userId, userId)));

    return Response.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}
