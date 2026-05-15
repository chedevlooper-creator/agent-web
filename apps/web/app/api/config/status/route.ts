import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers: Record<string, boolean> = {
    openai: !!process.env.OPENAI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
  };

  return NextResponse.json({ providers });
}
