import { NextResponse } from "next/server";
import { listSessionsWithMessages } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await listSessionsWithMessages();
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
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
