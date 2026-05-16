import { NextRequest } from "next/server";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { tools } from "@agent-web/core/tools";
import { z } from "zod";
import { estimateTokens } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Request validation schema
const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(200_000),
      })
    )
    .min(1)
    .max(500),
  provider: z.enum(["openai", "openrouter", "opencode", "deepseek"]),
  model: z.string().min(1).max(200),
  apiKey: z.string().min(1),
  projectRootPath: z.string().optional(),
});

// Trim messages to fit within a token budget, keeping system + recent messages
function fitContext(
  messages: { role: string; content: string }[],
  maxTokens: number
): { role: string; content: string }[] {
  const total = estimateTokens(messages);
  if (total <= maxTokens) return messages;

  // Always keep system messages and the last 4 messages
  const system = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");
  const keep = nonSystem.slice(-4);
  const rest = nonSystem.slice(0, -4);

  // Trim from the oldest non-system messages until we fit
  let budget = maxTokens - estimateTokens(system) - estimateTokens(keep);
  const trimmed: typeof rest = [];
  for (let i = rest.length - 1; i >= 0 && budget > 0; i--) {
    const cost = Math.ceil(rest[i].content.length / 4);
    if (cost <= budget) {
      trimmed.unshift(rest[i]);
      budget -= cost;
    }
  }

  return [...system, ...trimmed, ...keep];
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { messages, provider, model, apiKey, projectRootPath } = parsed.data;

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
    } else if (provider === "deepseek") {
      client = createOpenAI({
        apiKey,
        baseURL: "https://api.deepseek.com",
      })(model);
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Abort timeout: 120 seconds
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    // Fit messages into a ~100k token budget (safe for most models)
    const fitted = fitContext(
      messages.map((m) => ({ role: m.role, content: m.content })),
      100_000
    );

    const result = streamText({
      model: client,
      messages: fitted.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      tools,
      maxSteps: 8,
      abortSignal: controller.signal,
      system:
        "You are a helpful AI assistant. You have access to tools: 'terminal' to execute shell commands, 'read_file' to read local files, and 'web_search' to search the web. Use them whenever they help answer the user's request more accurately. Be concise." +
        (projectRootPath
          ? `\n\nYou are working inside a project directory at: ${projectRootPath}. Use this as the working directory for terminal commands and file operations. Files created during this conversation should be saved here.`
          : ""),
    });

    // Clean up timeout when stream finishes
    result.text.then(() => clearTimeout(timeout)).catch(() => clearTimeout(timeout));

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
