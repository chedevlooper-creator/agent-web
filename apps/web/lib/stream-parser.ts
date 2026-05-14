/**
 * Stream parser for AI SDK data stream format.
 * Handles text-delta, tool-call, tool-result, error, and finish events.
 */

export interface StreamEvent {
  type: "text-delta" | "tool-call" | "tool-result" | "error" | "finish";
  payload?: unknown;
}

export interface ParsedStream {
  text: string;
  toolCalls: Array<{ id: string; name: string; args: unknown }>;
  toolResults: Array<{ toolCallId: string; result: unknown }>;
  error?: string;
  finished: boolean;
}

export function parseStreamLine(line: string): { event: StreamEvent | null; raw: string } {
  const trimmed = line.trim();
  if (!trimmed) return { event: null, raw: trimmed };

  // Text delta (0:)
  if (trimmed.startsWith("0:")) {
    try {
      const text = JSON.parse(trimmed.slice(2));
      if (typeof text === "string") {
        return {
          event: { type: "text-delta", payload: text },
          raw: trimmed,
        };
      }
    } catch {
      // Try raw text
      const text = trimmed.slice(2);
      return { event: { type: "text-delta", payload: text }, raw: trimmed };
    }
  }

  // Tool call (8:)
  if (trimmed.startsWith("8:")) {
    try {
      const tc = JSON.parse(trimmed.slice(2));
      return {
        event: { type: "tool-call", payload: tc },
        raw: trimmed,
      };
    } catch {
      return { event: { type: "tool-call", payload: trimmed.slice(2) }, raw: trimmed };
    }
  }

  // Tool result (9:)
  if (trimmed.startsWith("9:")) {
    try {
      const tr = JSON.parse(trimmed.slice(2));
      return {
        event: { type: "tool-result", payload: tr },
        raw: trimmed,
      };
    } catch {
      return { event: { type: "tool-result", payload: trimmed.slice(2) }, raw: trimmed };
    }
  }

  // Error (3:)
  if (trimmed.startsWith("3:")) {
    try {
      const err = JSON.parse(trimmed.slice(2));
      return {
        event: { type: "error", payload: err },
        raw: trimmed,
      };
    } catch {
      return { event: { type: "error", payload: trimmed.slice(2) }, raw: trimmed };
    }
  }

  // Finish (d:)
  if (trimmed.startsWith("d:")) {
    return { event: { type: "finish" }, raw: trimmed };
  }

  return { event: null, raw: trimmed };
}

export async function* streamParser(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const { event } = parseStreamLine(line);
      if (event) yield event;
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    const { event } = parseStreamLine(buffer);
    if (event) yield event;
  }
}

export async function collectStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<ParsedStream> {
  const result: ParsedStream = {
    text: "",
    toolCalls: [],
    toolResults: [],
    error: undefined,
    finished: false,
  };

  for await (const event of streamParser(reader)) {
    switch (event.type) {
      case "text-delta":
        if (typeof event.payload === "string") {
          result.text += event.payload;
        }
        break;
      case "tool-call":
        result.toolCalls.push({
          id: crypto.randomUUID(),
          name: typeof event.payload === "object" ? (event.payload as any).name ?? "unknown" : "tool",
          args: event.payload,
        });
        break;
      case "tool-result":
        result.toolResults.push({
          toolCallId: crypto.randomUUID(),
          result: event.payload,
        });
        break;
      case "error":
        result.error = typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload);
        break;
      case "finish":
        result.finished = true;
        break;
    }
  }

  return result;
}
