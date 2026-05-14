export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
  toolset?: string; // e.g., "web", "terminal", "file", "browser", "vision"
  check_fn?: () => boolean; // Optional gate to control tool availability
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: string;
}

export interface LLMConfig {
  provider: string; // expanded: openai, openrouter, opencode, anthropic, deepseek, gemini, etc.
  model: string;
  apiKey: string;
  baseUrl?: string;
}
