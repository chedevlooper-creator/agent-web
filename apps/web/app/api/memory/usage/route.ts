import { NextResponse } from "next/server";
import { getMemoryUsage } from "@agent-web/db";

export async function GET() {
  try {
    const usage = await getMemoryUsage();
    return NextResponse.json(usage);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
