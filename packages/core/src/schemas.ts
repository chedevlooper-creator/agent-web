import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(0),
});

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  messages: z.array(MessageSchema).min(1, "at least one message is required"),
  provider: z.string().min(1, "provider is required"),
  model: z.string().min(1, "model is required"),
  apiKey: z.string().optional(),
  systemPrompt: z.string().optional(),
  enableMemory: z.boolean().optional(),
  toolsets: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  baseUrl: z.string().optional(),
});

export const SessionCreateSchema = z.object({
  title: z.string().max(200).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  systemPrompt: z.string().max(10000).optional(),
});

export const ToolExecutionSchema = z.object({
  name: z.string().min(1, "tool name is required"),
  args: z.record(z.unknown()),
});

export const MemoryEntrySchema = z.object({
  key: z.string().min(1, "key is required"),
  value: z.string().min(1, "value is required"),
  category: z.string().optional(),
  importance: z.number().min(0).max(1).optional(),
  target: z.string().optional(),
});

export const SkillSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
  description: z.string().min(1, "description is required").max(500),
  content: z.string().min(1, "content is required"),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  trustLevel: z.enum(["low", "medium", "high"]).optional(),
});

export const CronJobSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
  schedule: z.string().min(1, "schedule is required"),
  prompt: z.string().min(1, "prompt is required").max(5000),
  sessionId: z.string().optional(),
  enabled: z.boolean().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type SessionCreate = z.infer<typeof SessionCreateSchema>;
export type ToolExecution = z.infer<typeof ToolExecutionSchema>;
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type CronJob = z.infer<typeof CronJobSchema>;
