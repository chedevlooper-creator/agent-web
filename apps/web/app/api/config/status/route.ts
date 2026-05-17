import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers: Record<string, boolean> = {
    deepseek: true,
  };

  return NextResponse.json({ providers });
}
