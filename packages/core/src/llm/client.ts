import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { LLMConfig, Message } from "../types.js";
import { registry } from "../tools/registry.js";

export async function* chatStream(config: LLMConfig, messages: Message[]) {
  let client;
  if (config.provider === "openai") {
    client = createOpenAI({ apiKey: config.apiKey })(config.model);
  } else if (config.provider === "openrouter") {
    client = createOpenAI({
      apiKey: config.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    })(config.model);
  } else if (config.provider === "opencode") {
    client = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || "https://api.opencode.ai/v1",
    })(config.model);
  } else {
    throw new Error("Unknown provider: " + config.provider);
  }

  const modelMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
    ...(m.toolResults ? { tool_call_id: (m.toolResults[0]?.toolCallId) } : {}),
  })) as any;

  const result = streamText({
    model: client,
    messages: modelMessages,
    tools: Object.fromEntries(
      registry.list().map((t) => [
        t.name,
        {
          description: t.description,
          parameters: t.parameters as any,
        },
      ])
    ),
    maxSteps: 5,
  });

  for await (const part of result.fullStream) {
    yield part;
  }
}
