import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getDb } from "@agent-web/db";
import { agentGroups } from "@agent-web/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/agent-groups — list all groups for user
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const groups = await db
      .select()
      .from(agentGroups)
      .where(eq(agentGroups.userId, userId))
      .orderBy(desc(agentGroups.createdAt));

    return NextResponse.json({ groups });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/agent-groups — create a new group
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, agentIds, strategy } = await req.json();
    if (!name || !agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json(
        { error: "Name and at least one agent ID required" },
        { status: 400 },
      );
    }

    const db = getDb();
    const now = Date.now();
    const id = Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);

    // Build agents JSON array with order
    const agents = agentIds.map((presetId: string, i: number) => ({
      presetId,
      role: "",
      order: i + 1,
    }));

    await db.insert(agentGroups).values({
      id,
      name,
      description: description || null,
      userId,
      agents: JSON.stringify(agents),
      strategy: strategy || "parallel",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      group: {
        id,
        name,
        description,
        userId,
        agents: JSON.stringify(agents),
        strategy: strategy || "parallel",
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/agent-groups — update group
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, description, agentIds, strategy } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Group ID required" }, { status: 400 });
    }

    const db = getDb();
    const existing = await db
      .select()
      .from(agentGroups)
      .where(and(eq(agentGroups.id, id), eq(agentGroups.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (agentIds && Array.isArray(agentIds)) {
      updates.agents = JSON.stringify(
        agentIds.map((presetId: string, i: number) => ({
          presetId,
          role: "",
          order: i + 1,
        })),
      );
    }
    if (strategy) updates.strategy = strategy;

    await db.update(agentGroups).set(updates).where(eq(agentGroups.id, id));

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/agent-groups?id=xxx — delete group
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Group ID required" }, { status: 400 });
    }

    const db = getDb();
    await db
      .delete(agentGroups)
      .where(and(eq(agentGroups.id, id), eq(agentGroups.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
