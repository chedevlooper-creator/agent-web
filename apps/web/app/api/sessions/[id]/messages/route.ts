import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listMessages,
  addMessage,
  updateMessage,
  deleteMessage,
  deleteMessagesAfter,
  clearMessages,
} from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CreateMessageSchema = z.object({
  id: z.string().min(1).max(100),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(200_000),
  model: z.string().max(200).optional(),
  timestamp: z.number().optional(),
});

const UpdateMessageSchema = z.object({
  id: z.string().min(1).max(100),
  content: z.string().min(1).max(200_000).optional(),
  model: z.string().max(200).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const messages = await listMessages(sessionId);
    return NextResponse.json({ messages });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id: sessionId } = await params;
    const body = await req.json();
    const parsed = CreateMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { id, role, content, model, timestamp } = parsed.data;
    const message = await addMessage({
      id,
      sessionId,
      userId,
      role,
      content,
      model,
      timestamp,
    });
    return NextResponse.json({ message });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    await params;
    const body = await req.json();
    const parsed = UpdateMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { id, content, model } = parsed.data;
    await updateMessage(id, { content, model });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id: sessionId } = await params;
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const afterTs = searchParams.get("afterTimestamp");
    const inclusive = searchParams.get("inclusive") === "true";
    const clear = searchParams.get("clear") === "true";

    if (clear) {
      await clearMessages(sessionId);
      return NextResponse.json({ ok: true });
    }
    if (afterTs) {
      await deleteMessagesAfter(sessionId, Number(afterTs), inclusive);
      return NextResponse.json({ ok: true });
    }
    if (messageId) {
      await deleteMessage(messageId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "messageId, afterTimestamp, or clear=true required" }, { status: 400 });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
