import { streamText, jsonSchema } from "ai";
import { db, messages, toolExecutions, pendingApprovals } from "@agent-web/db";
import { eq, asc } from "drizzle-orm";
import { registry } from "../tools/registry.js";
import { memoryManager } from "../memory/manager.js";
import { skillManager } from "../skills/manager.js";
import { createModelClient, resolveProvider } from "../providers/resolver.js";
import { LLMConfig } from "../types.js";
import { checkCommandApproval, requiresToolApproval } from "../tools/approval.js";

export interface ChatEngineOptions {
  config: LLMConfig;
  sessionId: string;
  newMessages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  enableMemory?: boolean;
  enableSkills?: boolean;
  toolsets?: string[];
  maxSteps?: number;
}

export async function runChatStream(opts: ChatEngineOptions) {
  const { config, sessionId, newMessages, systemPrompt, enableMemory, enableSkills, toolsets, maxSteps } = opts;

  // Build model client via provider resolver (OpenAI-compatible gateways)
  const resolved = await resolveProvider(config.provider, config.model, {
    apiKey: config.apiKey || process.env.NINEROUTER_KEY || "no-key",
    baseUrl: config.baseUrl,
  });
  const client = createModelClient(resolved);

  // Load previous messages from DB (plain text only — avoids invalid tool_call shapes on gateways)
  const dbMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
    .limit(50);

  const history = dbMsgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Memory injection
  let memoryContext = "";
  if (enableMemory) {
    const lastUserMsg = newMessages.filter((m) => m.role === "user").pop();
    memoryContext = await memoryManager.getMemoryContextForPrompt(lastUserMsg?.content, 8);
  }

  let skillsContext = "";
  if (enableSkills && config.provider !== "9router") {
    skillsContext = await skillManager.getSkillsList();
    if (skillsContext) {
      skillsContext = `[Available Skills]\n${skillsContext}\n\nUse skill names when relevant. Request full skill content via the skills API when needed.`;
    }
  }

  // Build system message
  const systemContent = [systemPrompt ?? "You are a helpful autonomous agent.", memoryContext, skillsContext]
    .filter(Boolean)
    .join("\n\n");

  const allMessages = [
    { role: "system" as const, content: systemContent },
    ...history,
    ...newMessages.map((m) => ({ role: m.role as any, content: m.content })),
  ];

  // Build tools with execute hooks for logging
  const activeTools = registry.listAvailable().filter((t) => {
    if (!toolsets || toolsets.length === 0) return true;
    return t.toolset ? toolsets.includes(t.toolset) : true;
  });

    const tools = Object.fromEntries(
    activeTools.map((t) => [
      t.name,
      {
        description: t.description,
        parameters: jsonSchema(t.parameters as Record<string, unknown>),
        execute: async (args: Record<string, unknown>, context: { toolCallId: string }) => {
          const start = Date.now();
          
          let needsApproval = false;
          if (requiresToolApproval(t.name)) {
            const command = typeof args.command === "string" ? args.command : typeof args.code === "string" ? args.code : "";
            const approvalCheck = checkCommandApproval(command);
            if (!approvalCheck.approved) {
              needsApproval = true;
            }
          }

          if (needsApproval) {
            const pendingId = context.toolCallId || crypto.randomUUID();
            await db.insert(pendingApprovals).values({
              id: pendingId,
              sessionId,
              toolName: t.name,
              arguments: JSON.stringify(args),
              status: "pending"
            });

            let status = "pending";
            while (status === "pending") {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const record = await db.select().from(pendingApprovals).where(eq(pendingApprovals.id, pendingId));
              if (record.length > 0) {
                status = record[0].status;
              } else {
                status = "rejected";
              }
            }

            if (status === "rejected") {
              const errorMsg = "Rejected by user";
              await db.insert(toolExecutions).values({
                id: crypto.randomUUID(),
                sessionId,
                toolName: t.name,
                arguments: JSON.stringify(args),
                result: errorMsg,
                success: false,
                duration: Date.now() - start,
              });
              return `[Tool Error: ${errorMsg}]`;
            }
          }

          try {
            const result = await t.handler(args);
            await db.insert(toolExecutions).values({
              id: crypto.randomUUID(),
              sessionId,
              toolName: t.name,
              arguments: JSON.stringify(args),
              result: typeof result === "string" ? result.slice(0, 10000) : JSON.stringify(result).slice(0, 10000),
              success: true,
              duration: Date.now() - start,
            });
            return result;
          } catch (e) {
            const errMsg = (e as Error).message;
            await db.insert(toolExecutions).values({
              id: crypto.randomUUID(),
              sessionId,
              toolName: t.name,
              arguments: JSON.stringify(args),
              result: errMsg,
              success: false,
              duration: Date.now() - start,
            });
            return `[Tool Error: ${errMsg}]`;
          }
        },
      },
    ])
  );

  const isNineRouter = config.provider === "9router";
  const useTools = !isNineRouter && Object.keys(tools).length > 0;

  const result = streamText({
    model: client,
    messages: allMessages,
    ...(useTools ? { tools, maxSteps: maxSteps ?? 8 } : {}),
    maxRetries: isNineRouter ? 0 : useTools ? 2 : 1,
    onFinish: async (event) => {
      try {
        const assistantId = crypto.randomUUID();
        await db.insert(messages).values({
          id: assistantId,
          sessionId,
          role: "assistant",
          content: event.text,
          toolCalls: event.toolCalls && event.toolCalls.length > 0 ? JSON.stringify(event.toolCalls) : null,
          toolResults: event.toolResults && event.toolResults.length > 0 ? JSON.stringify(event.toolResults) : null,
        });

        const lastUser = newMessages.filter((m) => m.role === "user").pop();
        if (lastUser && enableMemory && event.text.length > 20) {
          if (lastUser.content.length > 50) {
            await memoryManager.addEntry({
              key: `Session ${sessionId} exchange`,
              value: `Q: ${lastUser.content.slice(0, 500)}\nA: ${event.text.slice(0, 1000)}`,
              category: "insight",
              importance: 3,
              sessionId,
            });
          }
        }
      } catch (err) {
        console.error("Chat engine onFinish error:", err);
      }
    },
  });

  return result;
}
