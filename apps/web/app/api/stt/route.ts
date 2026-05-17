import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stt
 *
 * Transcribes audio to text using OpenAI Whisper via @lobehub/tts.
 * Requires an OpenAI API key on the server.
 *
 * Body: FormData with audio file (field name: "audio")
 * Response: { text: string }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check for API key (fall back to OpenAI key for Whisper)
    const apiKey =
      process.env.OPENAI_API_KEY ||
      process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "No API key available for speech transcription. Set OPENAI_API_KEY.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob | null;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "Missing audio file" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Dynamically import @lobehub/tts (ESM-only)
    const { OpenaiSTT } = await import("@lobehub/tts");

    const stt = new OpenaiSTT({
      OPENAI_API_KEY: apiKey,
    });

    const text = await stt.createText({
      speech: audioFile,
      options: {
        model: "whisper-1",
        mineType: { extension: "webm", mineType: "audio/webm" },
      },
    });

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("/api/stt error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
