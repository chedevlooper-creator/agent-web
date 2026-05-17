import { NextRequest, NextResponse } from "next/server";
import {
  seedDefaultAgents,
  listAgentPresets,
} from "@/lib/db";

export const dynamic = "force-dynamic";

let seeded = false;

export async function GET(req: NextRequest) {
  try {
    // Seed default agents on first call if empty
    if (!seeded) {
      const count = await seedDefaultAgents();
      if (count > 0) console.log(`Seeded ${count} default agents`);
      seeded = true;
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;

    const presets = await listAgentPresets(category, search);
    return NextResponse.json({ presets });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
