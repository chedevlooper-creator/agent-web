import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getDb } from "@agent-web/db";
import { teams, teamMembers, users } from "@agent-web/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

function genId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

// GET /api/workspace — list teams for current user
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    
    const db = getDb();
    // Get teams where user is a member
    const memberships = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    if (memberships.length === 0) return Response.json({ teams: [] });

    const teamIds = memberships.map(m => m.teamId);
    const userTeams = await db
      .select()
      .from(teams)
      .where(inArray(teams.id, teamIds))
      .orderBy(desc(teams.createdAt));

    // Enrich with member info
    const enriched = await Promise.all(userTeams.map(async (team) => {
      const members = await db
        .select({
          userId: teamMembers.userId,
          role: teamMembers.role,
          username: users.username,
        })
        .from(teamMembers)
        .leftJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, team.id));

      const myRole = memberships.find(m => m.teamId === team.id)?.role || "member";

      return {
        ...team,
        members,
        myRole,
      };
    }));

    return Response.json({ teams: enriched });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/workspace — create team
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { name, description } = await req.json();
    if (!name) return Response.json({ error: "Team name required" }, { status: 400 });

    const db = getDb();
    const now = Date.now();
    const id = genId();

    await db.insert(teams).values({
      id,
      name,
      description: description || null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as owner
    await db.insert(teamMembers).values({
      teamId: id,
      userId,
      role: "owner",
      joinedAt: now,
    });

    return Response.json({ team: { id, name, description, createdBy: userId, createdAt: now, updatedAt: now } });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/workspace — update team
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id, name, description } = await req.json();
    if (!id) return Response.json({ error: "Team ID required" }, { status: 400 });

    const db = getDb();
    // Check membership and role
    const membership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)))
      .limit(1);

    if (membership.length === 0) return Response.json({ error: "Not a member of this team" }, { status: 403 });
    if (membership[0].role === "member") return Response.json({ error: "Insufficient permissions" }, { status: 403 });

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;

    await db.update(teams).set(updates).where(eq(teams.id, id));

    return Response.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/workspace?id=xxx — delete team
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Team ID required" }, { status: 400 });

    const db = getDb();
    // Only owner can delete
    const membership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)))
      .limit(1);

    if (membership.length === 0) return Response.json({ error: "Not a member" }, { status: 403 });
    if (membership[0].role !== "owner") return Response.json({ error: "Only the owner can delete the team" }, { status: 403 });

    // Delete members first, then team
    await db.delete(teamMembers).where(eq(teamMembers.teamId, id));
    await db.delete(teams).where(eq(teams.id, id));

    return Response.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}
