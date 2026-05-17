import { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tts
 *
 * Converts text to speech using Microsoft Edge's free TTS API via @lobehub/tts.
 * Returns MP3 audio data. No API key required.
 *
 * Body: { text: string, voice?: string }
 * Response: audio/mpeg stream
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

    const { text, voice } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'text' field" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return new Response(JSON.stringify({ error: "'text' must not be empty" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Edge Speech has a 1,000 character limit per request
    if (trimmed.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Text exceeds 1000 character limit for speech synthesis" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Dynamically import @lobehub/tts (ESM-only)
    const { EdgeSpeechTTS } = await import("@lobehub/tts");

    const tts = new EdgeSpeechTTS({ locale: "en-US" });
    const response = await tts.create({
      input: trimmed,
      options: {
        voice: voice || "en-US-AriaNeural",
      },
    });

    if (!response.ok) {
      throw new Error(`Edge TTS API returned status ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("/api/tts error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
