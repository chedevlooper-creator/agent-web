export type Role = "user" | "assistant" | "system";

export interface ChatMessageData {
  id: string;
  role: Role;
  content: string;
  model?: string;
  timestamp: number;
}

export interface SessionData {
  id: string;
  title: string;
  messages: ChatMessageData[];
  createdAt: number;
  updatedAt: number;
}

export interface ToolResult {
  ok: boolean;
  output: string;
  error?: string;
}
