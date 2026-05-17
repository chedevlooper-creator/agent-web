import { NextRequest, NextResponse } from "next/server";
import { getAgentPreset } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const preset = await getAgentPreset(id);
    if (!preset) {
      return NextResponse.json({ error: "Agent preset not found" }, { status: 404 });
    }
    return NextResponse.json({ preset });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
