import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { baseIds, query, topK } = body as {
      baseIds?: string[];
      query?: string;
      topK?: number;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const results = await searchKnowledge(
      userId,
      query.trim(),
      topK ?? 5,
      Array.isArray(baseIds) ? baseIds : undefined
    );

    return NextResponse.json({ results });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
