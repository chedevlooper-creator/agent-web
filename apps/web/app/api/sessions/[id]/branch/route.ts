import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getSession,
  listMessages,
  addMessage,
  createSession,
  updateSession,
} from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

const BranchSchema = z.object({
  messageId: z.string().min(1),
  content: z.string().min(1).max(200_000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const url = new URL(req.url);
    const messageId = url.searchParams.get("messageId");
    const body = await req.json();

    const parsed = BranchSchema.safeParse({ messageId, ...body });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { messageId: msgId, content } = parsed.data;

    // Get the original session and verify ownership
    const originalSession = await getSession(sessionId);
    if (!originalSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (originalSession.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all messages up to and including the branch point
    const allMessages = await listMessages(sessionId);
    const branchPointIndex = allMessages.findIndex((m) => m.id === msgId);
    if (branchPointIndex === -1) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const messagesToCopy = allMessages.slice(0, branchPointIndex + 1);

    // Generate IDs for new session and messages
    const newSessionId = genIdLocal();
    const branchId = originalSession.id; // use original session ID as the branch group ID

    // Create the new session
    await createSession({
      id: newSessionId,
      userId,
      projectId: originalSession.projectId,
      title: `${originalSession.title} (branch)`,
      branchId,
    });

    // Copy messages with new IDs, preserving parentId references
    const idMap = new Map<string, string>(); // old ID -> new ID
    for (const msg of messagesToCopy) {
      const newId = genIdLocal();
      idMap.set(msg.id, newId);

      const mappedParentId = msg.parentId ? (idMap.get(msg.parentId) ?? null) : null;
      const mappedBranchRootId = msg.branchRootId ? (idMap.get(msg.branchRootId) ?? null) : null;

      await addMessage({
        id: newId,
        sessionId: newSessionId,
        userId,
        role: msg.role,
        content: msg.content,
        model: msg.model ?? undefined,
        timestamp: msg.timestamp,
        parentId: mappedParentId ?? undefined,
        branchRootId: msg.id === msgId ? msgId : (mappedBranchRootId ?? undefined),
      });
    }

    // Add the new user message that continues from the branch point
    const userMsgId = genIdLocal();
    await addMessage({
      id: userMsgId,
      sessionId: newSessionId,
      userId,
      role: "user",
      content,
      timestamp: Date.now(),
      parentId: idMap.get(msgId) ?? msgId,
      branchRootId: msgId,
    });

    // Update the new session title with first few chars of the branch message
    const branchTitle = content.slice(0, 40) + (content.length > 40 ? "..." : "");
    await updateSession(newSessionId, { title: branchTitle });

    return NextResponse.json({
      session: {
        id: newSessionId,
        title: branchTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        branchId,
        projectId: originalSession.projectId,
      },
    });
  } catch (e: unknown) {
    return handleApiError(e, req);
  }
}

function genIdLocal() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}
