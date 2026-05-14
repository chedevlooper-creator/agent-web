import { Tool } from "../types.js";
import { subagentManager } from "../subagent/manager.js";

export const delegateTools: Tool[] = [
  {
    name: "delegate_task",
    description:
      "Spawn a subagent with a goal and shared tools. Use for parallel or long-running tasks. The subagent runs independently and returns results when complete.",
    parameters: {
      type: "object",
      properties: {
        goal: { type: "string", description: "The goal/task for the subagent to complete" },
        parentSessionId: { type: "string", description: "Parent session ID" },
        model: { type: "string", description: "Model to use for the subagent" },
        provider: { type: "string", description: "Provider for the subagent" },
        maxSteps: { type: "number", description: "Max tool call steps (default 5)" },
      },
      required: ["goal"],
    },
    handler: async (args) => {
      const goal = args.goal as string;
      const parentSessionId = (args.parentSessionId as string) ?? "";
      const model = (args.model as string) ?? "openai/gpt-4o-mini";
      const provider = (args.provider as string) ?? "openrouter";
      const apiKey = process.env.OPENROUTER_API_KEY ?? "";
      const maxSteps = (args.maxSteps as number) ?? 5;

      try {
        const id = await subagentManager.spawn({
          parentSessionId,
          goal,
          model,
          provider,
          apiKey,
          maxSteps,
        });
        return `Subagent spawned [${id}]. Goal: ${goal}. It will run independently.`;
      } catch (e) {
        return `Failed to spawn subagent: ${(e as Error).message}`;
      }
    },
    toolset: "delegate",
  },
  {
    name: "clarify",
    description:
      "Ask the user for clarification before proceeding. Use when instructions are ambiguous or multiple interpretations exist.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The clarification question to ask the user" },
        options: { type: "string", description: "Optional: comma-separated options if applicable" },
      },
      required: ["question"],
    },
    handler: async (args) => {
      const question = args.question as string;
      const options = (args.options as string) || "";
      return `[Clarification needed] ${question}${options ? `\nOptions: ${options}` : ""}`;
    },
    toolset: "delegate",
  },
];
