import { NextRequest } from "next/server";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  tools,
  countMessagesTokens,
  trimToTokenLimit,
  getContextThreshold,
} from "@agent-web/core";
import { listMemories } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Embedded DeepSeek API key
const DEEPSEEK_API_KEY = "sk-ab082d9a86c145c9a740cac9121ffc93";

// Model selection: auto-pick based on request complexity
const COMPLEXITY_KEYWORDS = [
  "kod", "code", "terminal", "bash", "shell", "python", "javascript", "typescript",
  "function", "class", "api", "route", "component", "debug", "hata", "fix", "bug",
  "test", "yaz", "oluştur", "create", "build", "implement", "refactor", "optimize",
  "analiz et", "analyse", "analyze", "review", "incele", "dosya", "file", "read",
  "write", "search", "ara", "dizayn", "design", "architect", "mimari",
  "terminal çalıştır", "run", "execute", "komut", "command",
  "sql", "database", "veritabanı", "query", "sorgu",
  "docker", "deploy", "server", "sunucu",
];

function selectModel(
  messages: Array<{ role: string; content: string }>,
  userModel: string | undefined
): string {
  // If user explicitly picked a model, respect it
  if (userModel && userModel !== "auto") return userModel;

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const content = lastUserMsg?.content?.toLowerCase() ?? "";

  // Long or complex conversation → use v4-pro
  if (messages.length > 6) return "deepseek-v4-pro";

  // Total message content length
  const totalChars = messages.reduce((s, m) => s + m.content.length, 0);
  if (totalChars > 2000) return "deepseek-v4-pro";

  // Check for complexity keywords in the last user message
  const hasComplexKeywords = COMPLEXITY_KEYWORDS.some((kw) => content.includes(kw));
  if (hasComplexKeywords) return "deepseek-v4-pro";

  // Short, simple queries → use v4-flash (fast)
  if (content.length < 100) return "deepseek-v4-flash";

  return "deepseek-v4-pro";
}

async function buildSystemPrompt(
  enabledSkills?: string[],
  files?: { name: string; path: string }[]
): Promise<string> {
  const base =
    "You are a helpful AI assistant. You have access to tools: 'terminal' to execute shell commands, 'read_file' to read local files, and 'web_search' to search the web. Use them whenever they help answer the user's request more accurately. Be concise.";

  const parts: string[] = [base];

  // Inject attached files
  if (files && files.length > 0) {
    const fileLines = files.map((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      const hints: string[] = [];
      if (ext === "xls" || ext === "xlsx")
        hints.push("use Python/pandas to read");
      else if (ext === "csv")
        hints.push("use Python/pandas or read_file to read");
      else if (ext === "json")
        hints.push("use read_file or Python to parse");
      else if (
        ext &&
        ["txt", "md", "log", "yaml", "yml", "toml", "ini", "cfg", "env"].includes(
          ext
        )
      )
        hints.push("use read_file to read");
      else hints.push("use Python or appropriate tool to inspect");

      return `- ${f.name} (path: ${f.path}${hints.length ? `, ${hints.join("; ")}` : ""})`;
    });
    parts.push(
      `\n\n## User Attached Files\nThe user has uploaded the following files. Use the full paths below with read_file or terminal tools to access them:\n${fileLines.join("\n")}`
    );
  }

  // Inject enabled skills
  if (enabledSkills && enabledSkills.length > 0) {
    const skillDir = process.env.SKILLS_DIR || ".verdent/skills";
    const fs = await import("node:fs");
    const path = await import("node:path");
    const skillDescs: string[] = [];

    for (const skillName of enabledSkills) {
      try {
        const skillPath = path.join(process.cwd(), skillDir, skillName, "SKILL.md");
        if (fs.existsSync(skillPath)) {
          const content = fs.readFileSync(skillPath, "utf-8");
          // Extract the frontmatter description
          const descMatch = content.match(
            /^---\s*\n[\s\S]*?description:\s*["']?([\s\S]*?)["']?\s*\n[\s\S]*?---/
          );
          if (descMatch) {
            skillDescs.push(`- ${skillName}: ${descMatch[1].trim()}`);
          } else {
            skillDescs.push(`- ${skillName}: enabled`);
          }
        }
      } catch {
        // Skip skills we can't read
      }
    }

    if (skillDescs.length > 0) {
      parts.push(
        `\n\n## Enabled Skills\nYou have the following skills available. Use them when relevant to the user's request:\n${skillDescs.join("\n")}`
      );
    }
  }

  // Inject memories if enabled
  const enableMemory = process.env.ENABLE_MEMORY === "true";
  if (enableMemory) {
    try {
      const memories = await listMemories();
      if (memories.length > 0) {
        const memoryLines = memories.map((m) => `- ${m.key}: ${m.value}`);
        let memoryBlock = `\n\n## User Context (persisted across sessions)\n${memoryLines.join("\n")}`;

        const charLimit = parseInt(process.env.MEMORY_CHAR_LIMIT || "2200", 10);
        if (memoryBlock.length > charLimit) {
          memoryBlock = memoryBlock.slice(0, charLimit - 3) + "...";
        }

        parts.push(memoryBlock);
      }
    } catch {
      // Memory unavailable — skip
    }
  }

  return parts.join("");
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, enabledSkills, files } = await req.json();

    if (!DEEPSEEK_API_KEY) {
      return new Response(
        JSON.stringify({ error: "No API key configured. Set DEEPSEEK_API_KEY." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Auto-select model based on conversation complexity
    const model = selectModel(messages as Array<{ role: string; content: string }>, undefined);

    // Use a fetch wrapper to enable DeepSeek thinking mode with reasoning_effort.
    // DeepSeek v4 Pro supports thinking + tool calls natively.
    const originalFetch = globalThis.fetch;
    const patchedFetch: typeof fetch = async (input, init) => {
      if (init && typeof input === "string" && input.includes("api.deepseek.com")) {
        try {
          const body = JSON.parse(init.body as string);
          body.thinking = { type: "enabled" };
          body.reasoning_effort = "high";
          init = { ...init, body: JSON.stringify(body) };
        } catch {}
      }
      return originalFetch(input, init);
    };

    const client = createOpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
      fetch: patchedFetch,
    })(model);

    const systemContent = await buildSystemPrompt(
      Array.isArray(enabledSkills) ? (enabledSkills as string[]) : undefined,
      Array.isArray(files) ? (files as { name: string; path: string }[]) : undefined
    );
    const systemMsg = { role: "system" as const, content: systemContent };
    const rawConversation = (messages as Array<{ role: string; content: string; reasoning_content?: string; reasoningContent?: string }>).map(
      (m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })
    );

    // rawConversation already strips to role+content only.
    // DeepSeek thinking mode rules:
    // - Messages WITHOUT tool_calls: reasoning_content is auto-ignored by API → safe to omit
    // - Messages WITH tool_calls: reasoning_content MUST be preserved (API returns 400 otherwise)
    // Current message persistence doesn't store tool_calls, so this only affects in-flight
    // multi-step tool call turns, which the AI SDK handles via maxSteps internally.
    const conversation = rawConversation;

    // Apply context trimming when over threshold
    const threshold = getContextThreshold();
    const allMessages = [systemMsg, ...conversation];
    const tokenCount = countMessagesTokens(allMessages);
    const trimmed =
      tokenCount > threshold
        ? trimToTokenLimit(allMessages, threshold)
        : allMessages;

    const result = streamText({
      model: client,
      messages: trimmed as Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }>,
      tools,
      maxSteps: 8,
    });

    return result.toDataStreamResponse({
      getErrorMessage: (e: unknown) =>
        e instanceof Error ? e.message : String(e),
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error(`[api] INTERNAL 500 /api/chat: ${err.message}${process.env.NODE_ENV !== "production" ? `\n${err.stack}` : ""}`);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
