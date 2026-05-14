import { NextRequest } from "next/server";
import { db, messages } from "@agent-web/db";
import { runChatStream, skillManager, memoryManager, ChatRequestSchema, badRequest } from "@agent-web/core";
import { getApiKeyForProvider } from "@/lib/api-keys";
import { checkChatRateLimit } from "@/lib/rate-limit-helpers";
import { errorResponse } from "@/lib/errors";

function formatChatStreamError(e: unknown): string {
  const unwrap = (value: unknown, depth = 0): string | null => {
    if (depth > 6 || value == null) return null;
    if (typeof value === "string") {
      const s = value.trim();
      if (!s || s === "<none>") return null;
      if (s.includes("MODEL_CAPACITY_EXHAUSTED") || s.includes("[503]")) {
        return "Model capacity exhausted. Try a different model.";
      }
      const bracket = s.match(/\[\d{3}\][^"]*|HTTP \d{3}[^"]*/);
      if (bracket) return bracket[0].trim();
      return s;
    }
    if (value instanceof Error) {
      return unwrap(value.message, depth + 1) ?? unwrap((value as Error & { cause?: unknown }).cause, depth + 1);
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return (
        unwrap(obj.message, depth + 1) ??
        unwrap(obj.error, depth + 1) ??
        unwrap(obj.lastError, depth + 1) ??
        unwrap(obj.cause, depth + 1) ??
        unwrap(obj.data, depth + 1)
      );
    }
    return null;
  };

  const msg = unwrap(e);
  if (msg) return msg;
  if (e instanceof Error && e.message.includes("Failed after")) {
    return "Provider request failed. Check API key and model availability.";
  }
  return e instanceof Error ? e.message || "Unknown provider error" : String(e);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validation = ChatRequestSchema.safeParse(body);
    if (!validation.success) {
      throw badRequest("Invalid request body", validation.error.flatten());
    }

    const { sessionId, messages: newMsgs, provider, model, baseUrl, systemPrompt, enableMemory, skillIds, toolsets } = validation.data;

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
    checkChatRateLimit(ip);

    const apiKey = getApiKeyForProvider(provider);

    if (!apiKey) {
      return errorResponse(badRequest("API key not configured for this provider"));
    }

    const latestUser = [...newMsgs].reverse().find((m) => m.role === "user");
    if (latestUser) {
      await db.insert(messages).values({
        id: crypto.randomUUID(),
        sessionId,
        role: "user",
        content: latestUser.content,
      });
    }

    let enhancedSystemPrompt = systemPrompt ?? "";
    if (enableMemory !== false) {
      const memoryContext = await memoryManager.getMemoryContext();
      if (memoryContext) {
        enhancedSystemPrompt = enhancedSystemPrompt
          ? `${enhancedSystemPrompt}\n\n--- Memory Context ---\n${memoryContext}`
          : memoryContext;
      }
    }

    if (skillIds && skillIds.length > 0) {
      const skillContent = await Promise.all(
        skillIds.map(async (sid) => {
          try {
            const content = await skillManager.getSkillContent(sid);
            return content ? `--- Skill: ${sid} ---\n${content.content}` : null;
          } catch {
            return null;
          }
        })
      );
      const skills = skillContent.filter(Boolean).join("\n\n");
      if (skills) {
        enhancedSystemPrompt = enhancedSystemPrompt
          ? `${enhancedSystemPrompt}\n\n--- Active Skills ---\n${skills}`
          : `--- Active Skills ---\n${skills}`;
      }
    }

    const result = await runChatStream({
      config: { provider, model, apiKey, baseUrl },
      sessionId,
      newMessages: newMsgs,
      systemPrompt: enhancedSystemPrompt || undefined,
      enableMemory: enableMemory ?? true,
      enableSkills: true,
      toolsets,
    });

    return result.toDataStreamResponse({
      getErrorMessage: formatChatStreamError,
    });
  } catch (e) {
    console.error("API Error:", e);
    return errorResponse(e);
  }
}
