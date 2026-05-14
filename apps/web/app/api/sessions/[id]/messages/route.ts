import { NextRequest, NextResponse } from "next/server";
import {
  listMessages,
  addMessage,
  updateMessage,
  deleteMessage,
  deleteMessagesAfter,
  clearMessages,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await listMessages(id);
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
    const { id: sessionId } = await params;
    const body = await req.json();
    const { id, role, content, model, timestamp } = body as {
      id: string;
      role: "user" | "assistant" | "system";
      content: string;
      model?: string;
      timestamp?: number;
    };
    if (!id || !role || typeof content !== "string") {
      return NextResponse.json(
        { error: "id, role, content required" },
        { status: 400 }
      );
    }
    const message = await addMessage({
      id,
      sessionId,
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
    await params;
    const body = await req.json();
    const { id, content, model } = body as {
      id: string;
      content?: string;
      model?: string;
    };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
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
