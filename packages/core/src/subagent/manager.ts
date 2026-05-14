import { db, subagents, messages, sessions } from "@agent-web/db";
import { eq } from "drizzle-orm";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { registry } from "../tools/registry.js";
import { LLMConfig } from "../types.js";

export class SubagentManager {
  async spawn(opts: {
    parentSessionId: string;
    goal: string;
    model: string;
    provider: string;
    apiKey: string;
    baseUrl?: string;
    maxSteps?: number;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await db.insert(subagents).values({
      id,
      parentSessionId: opts.parentSessionId,
      goal: opts.goal,
      status: "running",
      model: opts.model,
      provider: opts.provider,
    });

    // Run async
    this.runSubagent(id, opts).catch(async (e) => {
      console.error("Subagent error:", e);
      await db.update(subagents)
        .set({ status: "failed", result: (e as Error).message, completedAt: new Date() })
        .where(eq(subagents.id, id));
    });

    return id;
  }

  private async runSubagent(
    id: string,
    opts: {
      goal: string;
      model: string;
      provider: string;
      apiKey: string;
      baseUrl?: string;
      maxSteps?: number;
    }
  ) {
    let client;
    if (opts.provider === "openai") {
      client = createOpenAI({ apiKey: opts.apiKey })(opts.model);
    } else if (opts.provider === "openrouter") {
      client = createOpenAI({ apiKey: opts.apiKey, baseURL: "https://openrouter.ai/api/v1" })(opts.model);
    } else if (opts.provider === "opencode") {
      client = createOpenAI({ apiKey: opts.apiKey, baseURL: opts.baseUrl || "https://api.opencode.ai/v1" })(opts.model);
    } else {
      throw new Error("Unknown provider: " + opts.provider);
    }

    const result = streamText({
      model: client,
      messages: [
        { role: "system", content: "You are an autonomous subagent. Complete the given goal efficiently. Use available tools when needed." },
        { role: "user", content: opts.goal },
      ],
      tools: Object.fromEntries(
        registry.list().map((t) => [
          t.name,
          { description: t.description, parameters: t.parameters as any },
        ])
      ),
      maxSteps: opts.maxSteps ?? 5,
    });

    let fullText = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        fullText += part.textDelta;
      }
    }

    await db
      .update(subagents)
      .set({ status: "completed", result: fullText, completedAt: new Date() })
      .where(eq(subagents.id, id));
  }

  async getStatus(id: string) {
    const rows = await db.select().from(subagents).where(eq(subagents.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listForSession(parentSessionId: string) {
    return db.select().from(subagents).where(eq(subagents.parentSessionId, parentSessionId)).orderBy(subagents.createdAt);
  }
}

export const subagentManager = new SubagentManager();
