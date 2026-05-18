import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getDb } from "@agent-web/db";
import { scheduledTasks } from "@agent-web/db/schema";
import { eq, and, desc } from "drizzle-orm";

function parseCronNext(_cronExpr: string): number {
  return Date.now() + 60 * 60 * 1000;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();
    const tasks = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.userId, userId))
      .orderBy(desc(scheduledTasks.createdAt));

    return Response.json({ tasks });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { name, agentId, prompt, cronExpr } = await req.json();
    if (!name || !prompt || !cronExpr) {
      return Response.json({ error: "Name, prompt, and cron expression required" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();
    const id = Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);

    const nextRunAt = parseCronNext(cronExpr);

    await db.insert(scheduledTasks).values({
      id,
      userId,
      name,
      agentId: agentId || null,
      prompt,
      cronExpr,
      enabled: 1,
      lastRunAt: null,
      nextRunAt,
      createdAt: now,
      updatedAt: now,
    });

    return Response.json({ success: true, id });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id, name, agentId, prompt, cronExpr, enabled } = await req.json();
    if (!id) return Response.json({ error: "Task ID required" }, { status: 400 });

    const db = getDb();
    const existing = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (name) updates.name = name;
    if (agentId !== undefined) updates.agentId = agentId;
    if (prompt) updates.prompt = prompt;
    if (cronExpr) {
      updates.cronExpr = cronExpr;
      updates.nextRunAt = parseCronNext(cronExpr);
    }
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;

    await db.update(scheduledTasks).set(updates).where(eq(scheduledTasks.id, id));

    return Response.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Task ID required" }, { status: 400 });

    const db = getDb();
    await db
      .delete(scheduledTasks)
      .where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, userId)));

    return Response.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}
