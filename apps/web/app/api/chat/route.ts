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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServerApiKey(provider: string): string | null {
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY || null;
  }
  if (provider === "openrouter") {
    return process.env.OPENROUTER_API_KEY || null;
  }
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_API_KEY || null;
  }
  return process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || null;
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
    const { messages, provider, model, enabledSkills, files } = await req.json();

    const apiKey = getServerApiKey(provider);
    if (!apiKey) {
      const envVar =
        provider === "openai" ? "OPENAI_API_KEY" :
        provider === "openrouter" ? "OPENROUTER_API_KEY" :
        "DEEPSEEK_API_KEY";
      return new Response(
        JSON.stringify({ error: `No API key configured for ${provider}. Set ${envVar} on the server.` }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let client;
    if (provider === "openai") {
      client = createOpenAI({ apiKey })(model);
    } else if (provider === "openrouter") {
      client = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      })(model);
    } else if (provider === "deepseek") {
      // Use a fetch wrapper to disable DeepSeek thinking mode.
      // This prevents reasoning_content errors in multi-step tool calls.
      const originalFetch = globalThis.fetch;
      const patchedFetch: typeof fetch = async (input, init) => {
        if (init && typeof input === "string" && input.includes("api.deepseek.com")) {
          try {
            const body = JSON.parse(init.body as string);
            body.thinking = { type: "disabled" };
            init = { ...init, body: JSON.stringify(body) };
          } catch {}
        }
        return originalFetch(input, init);
      };
      client = createOpenAI({
        apiKey,
        baseURL: "https://api.deepseek.com",
        fetch: patchedFetch,
      })(model);
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemContent = await buildSystemPrompt(
      Array.isArray(enabledSkills) ? (enabledSkills as string[]) : undefined,
      Array.isArray(files) ? (files as { name: string; path: string }[]) : undefined
    );
    const systemMsg = { role: "system" as const, content: systemContent };
    const rawConversation = (messages as Array<{ role: string; content: string; reasoning_content?: string; reasoningContent?: string }>).map(
      (m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })
    );

    // DeepSeek: strip reasoning_content from history to avoid "must be passed back" error
    const conversation = provider === "deepseek"
      ? rawConversation.map((m) => {
          const { ...clean } = m as Record<string, unknown>;
          delete clean.reasoning_content;
          delete clean.reasoningContent;
          return clean as { role: "user" | "assistant" | "system"; content: string };
        })
      : rawConversation;

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
    console.error("/api/chat error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
