import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the validation schema inline to test it in isolation
const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(200_000),
      })
    )
    .min(1)
    .max(500),
  provider: z.enum(["openai", "openrouter", "opencode", "deepseek"]),
  model: z.string().min(1).max(200),
  apiKey: z.string().optional(),
  projectRootPath: z.string().optional(),
});

describe("Chat API request schema", () => {
  const validBody = {
    messages: [{ role: "user", content: "Hello" }],
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    apiKey: "sk-test",
  };

  it("accepts valid request", () => {
    expect(() => RequestSchema.parse(validBody)).not.toThrow();
  });

  it("rejects empty messages", () => {
    expect(() =>
      RequestSchema.parse({ ...validBody, messages: [] })
    ).toThrow();
  });

  it("rejects invalid role", () => {
    expect(() =>
      RequestSchema.parse({
        ...validBody,
        messages: [{ role: "tool", content: "x" }],
      })
    ).toThrow();
  });

  it("rejects invalid provider", () => {
    expect(() =>
      RequestSchema.parse({ ...validBody, provider: "anthropic" })
    ).toThrow();
  });

  it("accepts missing apiKey (optional — server looks up from DB)", () => {
    const { apiKey: _ignored, ...rest } = validBody;
    void _ignored;
    expect(() => RequestSchema.parse(rest)).not.toThrow();
  });

  it("rejects missing messages field", () => {
    const { messages: _messages, ...rest } = validBody;
    void _messages;
    expect(() => RequestSchema.parse(rest)).toThrow();
  });

  it("accepts optional projectRootPath", () => {
    expect(() =>
      RequestSchema.parse({ ...validBody, projectRootPath: "/home/user/project" })
    ).not.toThrow();
  });

  it("accepts missing projectRootPath", () => {
    expect(() => RequestSchema.parse(validBody)).not.toThrow();
  });

  it("rejects messages over 500", () => {
    const many = Array.from({ length: 501 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
    }));
    expect(() => RequestSchema.parse({ ...validBody, messages: many })).toThrow();
  });
});
