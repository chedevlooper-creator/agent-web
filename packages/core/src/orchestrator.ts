import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getAllTools } from "./tools/registry.js";

export interface AgentConfig {
  presetId: string;
  systemPrompt: string;
  tools: string;
  model: string | null;
  provider: string | null;
  temperature: number | null;
}

export interface OrchestratorResult {
  agentResults: Array<{
    agentId: string;
    output: string;
  }>;
  combined: string;
}

/**
 * Read the full text from a streamText result cleanly.
 * Uses result.text (available in AI SDK v4) to get full output.
 */
async function readFullText(
  result: Awaited<ReturnType<typeof streamText>>,
): Promise<string> {
  try {
    return await result.text;
  } catch {
    // Fallback: read the data stream manually
    const stream = result.toDataStream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
    }
    // Strip Vercel data stream protocol prefixes (0: text, 1:/9: tool call, etc.)
    return fullText
      .split("\n")
      .filter((line) => line.startsWith("0:"))
      .map((line) => line.slice(2))
      .join("");
  }
}

/**
 * Create an AI SDK model client from provider + apiKey.
 */
function createModelClient(provider: string | null, modelName: string, apiKey: string) {
  const baseURL =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : provider === "deepseek"
        ? "https://api.deepseek.com/v1"
        : undefined;

  return createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })(modelName);
}

/**
 * Run multiple agents in parallel and combine results.
 */
export async function runParallelAgents(
  agents: AgentConfig[],
  userMessage: string,
  apiKey: string,
): Promise<OrchestratorResult> {
  const allTools = await getAllTools();

  const results = await Promise.allSettled(
    agents.map(async (agent) => {
      const provider = agent.provider || "openai";
      const modelName = agent.model || "gpt-4o-mini";
      const temp = agent.temperature ?? 0.7;

      const model = createModelClient(provider, modelName, apiKey);

      const result = await streamText({
        model,
        messages: [
          { role: "system" as const, content: agent.systemPrompt },
          { role: "user" as const, content: userMessage },
        ],
        tools: allTools,
        maxSteps: 5,
        temperature: temp,
      });

      const output = await readFullText(result);
      return { agentId: agent.presetId, output };
    }),
  );

  const agentResults = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { agentId: agents[i].presetId, output: `[Error: ${r.reason}]` };
  });

  const combined = agentResults
    .map((r) => `## Agent: ${r.agentId}\n${r.output}`)
    .join("\n\n---\n\n");

  return { agentResults, combined };
}

/**
 * Run multiple agents sequentially, passing output as input to the next.
 */
export async function runSequentialAgents(
  agents: AgentConfig[],
  userMessage: string,
  apiKey: string,
): Promise<OrchestratorResult> {
  const allTools = await getAllTools();
  const agentResults: Array<{ agentId: string; output: string }> = [];
  let currentInput = userMessage;

  for (const agent of agents) {
    const provider = agent.provider || "openai";
    const modelName = agent.model || "gpt-4o-mini";
    const temp = agent.temperature ?? 0.7;

    const model = createModelClient(provider, modelName, apiKey);

    try {
      const result = await streamText({
        model,
        messages: [
          { role: "system" as const, content: agent.systemPrompt },
          { role: "user" as const, content: currentInput },
        ],
        tools: allTools,
        maxSteps: 5,
        temperature: temp,
      });

      const output = await readFullText(result);
      agentResults.push({ agentId: agent.presetId, output });
      currentInput = `Previous agent (${agent.presetId}) output:\n${output}\n\nContinue with the task.`;
    } catch (err) {
      agentResults.push({ agentId: agent.presetId, output: `[Error: ${err}]` });
      break;
    }
  }

  const combined = agentResults
    .map((r) => `## Agent: ${r.agentId}\n${r.output}`)
    .join("\n\n---\n\n");

  return { agentResults, combined };
}
