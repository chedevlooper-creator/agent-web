import "server-only";
import { getDb } from "@agent-web/db";
import { memories } from "@agent-web/db";
import { and, eq, lt } from "drizzle-orm";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const TTL_CONFIG: Record<number, number> = {
  1: 7 * 24 * 60 * 60 * 1000,    // 7 days for importance 1
  2: 7 * 24 * 60 * 60 * 1000,    // 7 days
  3: 7 * 24 * 60 * 60 * 1000,    // 7 days
  4: 30 * 24 * 60 * 60 * 1000,   // 30 days for importance 4
  5: 30 * 24 * 60 * 60 * 1000,   // 30 days
  6: 30 * 24 * 60 * 60 * 1000,   // 30 days
  7: 30 * 24 * 60 * 60 * 1000,   // 30 days
  // 8-10: permanent (no cleanup)
};

/**
 * Run memory maintenance: delete expired memories based on importance TTL.
 */
export async function runMemoryMaintenance(): Promise<{ deleted: number }> {
  const db = getDb();
  const now = Date.now();
  let totalDeleted = 0;

  for (let i = 1; i <= 7; i++) {
    const ttl = TTL_CONFIG[i];
    if (!ttl) continue;
    const cutoff = now - ttl;
    const result = await db
      .delete(memories)
      .where(
        and(
          eq(memories.importance, i),
          lt(memories.updatedAt, cutoff)
        )
      );
    totalDeleted += (result as { changes?: number })?.changes ?? 0;
  }

  return { deleted: totalDeleted };
}

// Zod schema for memory extraction
const memorySchema = z.object({
  memories: z.array(
    z.object({
      key: z.string().describe("A unique, concise key for this memory (e.g., 'user_name', 'tech_stack', 'project_preference')"),
      value: z.string().describe("The value/content of the memory"),
      category: z.enum(["user_info", "preference", "fact", "task_context", "conversation_summary"]).describe("Category of the memory"),
      importance: z.number().min(1).max(10).describe("Importance score 1-10 (10 = critical, 1 = trivial)"),
      context: z.string().describe("Brief context about when/why this memory was created"),
    })
  ).describe("Array of extracted memories from the conversation"),
});

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction system. Your job is to analyze a conversation and extract important information that should be remembered for future interactions.

Extract memories about:
- User preferences and settings
- User personal information (name, location, job, etc.)
- Technical details about their projects
- Facts and decisions made during the conversation
- Task context and goals

Guidelines:
- Only extract genuinely useful information (importance >= 4)
- Use unique, descriptive keys
- Keep values concise but informative
- Categorize correctly
- If nothing important is found, return an empty array

Return ONLY valid JSON matching the schema.`;

/**
 * Extract structured memories from a conversation using the LLM.
 * Returns an array of memory objects, or empty array if nothing to extract.
 */
export async function extractMemoriesFromConversation(
  conversation: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>,
  responseContent: string
): Promise<Array<{ key: string; value: string; category: string; importance: number; context: string }>> {
  // Don't extract if conversation is too short (< 3 messages)
  if (conversation.length < 3) return [];

  try {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) return [];

    // Build conversation text for extraction
    const conversationText = conversation
      .map((m) => {
        if (typeof m.content === "string") {
          return `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`;
        }
        return `${m.role === "user" ? "User" : "Assistant"}: [${m.content.map(c => c.type === "text" ? c.text : "[image]").filter(Boolean).join(", ")}]`;
      })
      .join("\n\n");

    const fullPrompt = `${conversationText}\n\nLatest response: ${responseContent}`;

    const client = createOpenAI({
      apiKey,
      baseURL: process.env.OPENROUTER_API_KEY
        ? "https://openrouter.ai/api/v1"
        : undefined,
    });

    const result = await generateObject({
      model: client("gpt-4o-mini"),
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: fullPrompt,
      schema: memorySchema,
      temperature: 0.1,
      maxRetries: 1,
    });

    // Filter out low-importance memories
    return (result.object.memories || []).filter((m: { importance: number }) => m.importance >= 4);
  } catch (e) {
    console.error("Memory extraction failed:", e);
    return [];
  }
}
