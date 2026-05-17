import { NextRequest } from "next/server";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { tools, toolDescriptions } from "@agent-web/core/tools";
import { z } from "zod";
import { estimateTokens } from "@/lib/utils";
import { getApiKey, getProjectById } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { promises as fs } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Request validation schema
// apiKey is optional — if omitted, the server looks it up from the encrypted DB store
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
  apiKey: z.string().optional(),
  projectId: z.string().optional(),
  skills: z.array(z.string()).optional(),
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
    const { messages, provider, model, projectId, skills } = parsed.data;

    // Resolve project root path from DB — never trust client-provided paths
    let projectRootPath: string | undefined;
    if (projectId) {
      try {
        const project = await getProjectById(projectId);
        if (project) {
          projectRootPath = project.rootPath;
        }
      } catch (e) {
        console.error("Failed to resolve project path:", e);
      }
    }
    let { apiKey } = parsed.data;

    // Load selected skills content from filesystem
    let skillsContent = "";
    if (skills && skills.length > 0) {
      const projectRoot = process.cwd();
      const parts: string[] = [];
      for (const skillPath of skills) {
        try {
          const fullPath = join(projectRoot, skillPath, "SKILL.md");
          const content = await fs.readFile(fullPath, "utf-8");
          parts.push(`=== ${skillPath} ===\n${content}`);
        } catch {
          // Skip skills that can't be loaded
        }
      }
      if (parts.length > 0) {
        skillsContent = `\n\nYou have the following skills/abilities loaded. Follow their instructions carefully:\n\n${parts.join("\n\n")}`;
      }
    }

    // If no apiKey in the request, look it up from the encrypted DB store
    if (!apiKey) {
      const userId = await getUserIdFromRequest(req);
      apiKey = userId ? ((await getApiKey(provider, userId)) ?? undefined) : undefined;
      if (!apiKey) {
        return new Response(
          JSON.stringify({
            error: `No API key configured for provider "${provider}". Please add one in Settings.`,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

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
        `You are a helpful AI assistant. You have access to tools: ${Object.entries(toolDescriptions).map(([key, t]) => `'${key}' (${t.description})`).join(", ")}. Use them whenever they help answer the user's request more accurately. Be concise.` +
        (projectRootPath
          ? `\n\nYou are working inside a project directory at: ${projectRootPath}. Use this as the working directory for terminal commands and file operations. Files created during this conversation should be saved here.`
          : "") +
        skillsContent,
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
