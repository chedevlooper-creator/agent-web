import { NextRequest, NextResponse } from "next/server";
import {
  listSessions,
  createSession,
  deleteSession,
  updateSession,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || undefined;
    const sessions = await listSessions(projectId);
    return NextResponse.json({ sessions });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, projectId, title } = body as { id?: string; projectId?: string | null; title?: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const session = await createSession({ id, projectId, title });
    return NextResponse.json({ session });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title } = body as { id?: string; title?: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await updateSession(id, { title });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
