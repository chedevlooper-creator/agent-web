import { NextRequest, NextResponse } from "next/server";
import { listSessionsWithMessages } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const sessions = await listSessionsWithMessages(userId);
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      sessions,
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="agent-web-export-${Date.now()}.json"`,
      },
    });
  } catch (e: unknown) {
    return handleApiError(e, req);
  }
}
