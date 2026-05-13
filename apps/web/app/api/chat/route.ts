import { NextRequest } from "next/server";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const terminalTool = {
  description: "Execute a shell command",
  parameters: z.object({ command: z.string(), timeout: z.number().optional() }),
  execute: async () => "[Terminal disabled]",
};

const readFileTool = {
  description: "Read a file",
  parameters: z.object({ path: z.string() }),
  execute: async () => "[File disabled]",
};

const webSearchTool = {
  description: "Search web",
  parameters: z.object({ query: z.string() }),
  execute: async () => "[Search disabled]",
};

export async function POST(req: NextRequest) {
  try {
    const { messages, provider, model, apiKey } = await req.json();

    let client;
    if (provider === "openai") {
      client = createOpenAI({ apiKey })(model);
    } else if (provider === "openrouter") {
      client = createOpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" })(model);
    } else if (provider === "opencode") {
      client = createOpenAI({ apiKey, baseURL: "https://api.opencode.ai/v1" })(model);
    } else {
      return new Response("Unknown provider", { status: 400 });
    }

    const result = streamText({
      model: client,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      tools: { terminal: terminalTool, read_file: readFileTool, web_search: webSearchTool },
      maxSteps: 5,
    });

    return result.toDataStreamResponse({ getErrorMessage: (e) => e.message });
  } catch (e: any) {
    console.error("API Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
