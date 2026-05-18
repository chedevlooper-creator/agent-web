import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getDb } from "@agent-web/db";
import { teams, teamMembers, users } from "@agent-web/db/schema";
import { eq, and } from "drizzle-orm";

// POST /api/workspace/members — add member or update role
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { teamId, memberUserId, role, username } = await req.json();
    if (!teamId || (!memberUserId && !username)) {
      return Response.json({ error: "Team ID and member user ID or username required" }, { status: 400 });
    }

    const db = getDb();

    // Check permission: only owner/admin can add members
    const myMembership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);

    if (myMembership.length === 0) return Response.json({ error: "Not a member" }, { status: 403 });
    if (myMembership[0].role === "member") return Response.json({ error: "Insufficient permissions" }, { status: 403 });

    // Resolve user by username if no userId provided
    let targetUserId = memberUserId;
    if (!targetUserId && username) {
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      if (userRows.length === 0) return Response.json({ error: "User not found" }, { status: 404 });
      targetUserId = userRows[0].id;
    }

    // Check if already a member
    const existing = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)))
      .limit(1);

    if (existing.length > 0) {
      // Update role
      await db.update(teamMembers)
        .set({ role: role || "member" })
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)));
    } else {
      await db.insert(teamMembers).values({
        teamId,
        userId: targetUserId,
        role: role || "member",
        joinedAt: Date.now(),
      });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/workspace/members?teamId=xxx&userId=yyy — remove member
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    const memberUserId = searchParams.get("userId");

    if (!teamId || !memberUserId) {
      return Response.json({ error: "Team ID and user ID required" }, { status: 400 });
    }

    const db = getDb();

    // Check permission
    const myMembership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);

    if (myMembership.length === 0) return Response.json({ error: "Not a member" }, { status: 403 });
    if (myMembership[0].role === "member" && userId !== memberUserId) {
      return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Cannot remove owner
    const targetMembership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberUserId)))
      .limit(1);

    if (targetMembership.length === 0) return Response.json({ error: "Member not found" }, { status: 404 });
    if (targetMembership[0].role === "owner") return Response.json({ error: "Cannot remove the owner" }, { status: 400 });

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberUserId)));

    return Response.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}
