import { NextRequest, NextResponse } from "next/server";
import { importSessions, type DbSessionWithMessages } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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
    return handleApiError(e, req);
  }
}
