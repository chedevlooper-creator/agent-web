import { NextRequest, NextResponse } from "next/server";
import { searchSessions } from "@agent-web/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, limit = 20, sessionId } = body;

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const results = await searchSessions(query, { limit, sessionId });
    return NextResponse.json({ results, count: results.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
