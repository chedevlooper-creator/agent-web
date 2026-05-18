import { NextRequest } from "next/server";
import { runMemoryMaintenance } from "@/lib/memory-maintenance";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  try {
    const result = await runMemoryMaintenance();
    return Response.json(result);
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}
