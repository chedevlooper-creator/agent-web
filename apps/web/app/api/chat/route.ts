import { NextRequest } from "next/server";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { tools } from "@agent-web/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { messages, provider, model, apiKey } = await req.json();

    let client;
    if (provider === "openai") {
      client = createOpenAI({ apiKey })(model);
    } else if (provider === "openrouter") {
      client = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      })(model);
    } else if (provider === "opencode") {
      client = createOpenAI({
        apiKey,
        baseURL: "https://api.opencode.ai/v1",
      })(model);
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = streamText({
      model: client,
      messages: (messages as Array<{ role: string; content: string }>).map(
        (m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })
      ),
      tools,
      maxSteps: 8,
      system:
        "You are a helpful AI assistant. You have access to tools: 'terminal' to execute shell commands, 'read_file' to read local files, and 'web_search' to search the web. Use them whenever they help answer the user's request more accurately. Be concise.",
    });

    return result.toDataStreamResponse({
      getErrorMessage: (e: unknown) =>
        e instanceof Error ? e.message : String(e),
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("/api/chat error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
