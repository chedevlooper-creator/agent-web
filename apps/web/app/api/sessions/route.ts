import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listSessions,
  createSession,
  deleteSession,
  updateSession,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const CreateSessionSchema = z.object({
  id: z.string().min(1).max(100),
  projectId: z.string().nullable().optional(),
  title: z.string().max(200).optional(),
});

const UpdateSessionSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().max(200).optional(),
});

const DeleteSessionSchema = z.object({
  id: z.string().min(1).max(100),
});

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
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { id, projectId, title } = parsed.data;
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
    const parsed = UpdateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { id, title } = parsed.data;
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
    const parsed = DeleteSessionSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await deleteSession(id!);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
