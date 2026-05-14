import { NextRequest, NextResponse } from "next/server";
import { importSessions, type DbSessionWithMessages } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = body as {
      version?: number;
      sessions: DbSessionWithMessages[];
    };
    if (!payload || !Array.isArray(payload.sessions)) {
      return NextResponse.json(
        { error: "Invalid payload: expected { sessions: [...] }" },
        { status: 400 }
      );
    }
    const stats = await importSessions(payload.sessions);
    return NextResponse.json({ ok: true, ...stats });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
