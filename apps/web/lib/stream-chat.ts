export const STREAM_TIMEOUT_MS = 60_000;

export interface ToolCallEvent {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
}

export interface StreamResult {
  text: string;
  error?: string;
  toolCalls: ToolCallEvent[];
}

export async function streamChat(
  payload: {
    messages: { role: string; content: string }[];
    model?: string;
    enabledSkills?: string[];
    files?: { name: string; path: string }[];
  },
  onText: (delta: string) => void,
  onToolCall?: (tc: ToolCallEvent) => void,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const controller = new AbortController();
  const linkedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  let lastChunkTime = Date.now();
  const timeoutId = setInterval(() => {
    if (Date.now() - lastChunkTime > STREAM_TIMEOUT_MS) {
      controller.abort();
    }
  }, 5_000);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: linkedSignal,
    });
    if (!res.ok || !res.body) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}
      return { text: "", error: msg, toolCalls: [] };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let error: string | undefined;
    const toolCalls: ToolCallEvent[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lastChunkTime = Date.now();
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("0:")) {
          try {
            const t = JSON.parse(trimmed.slice(2));
            if (typeof t === "string") {
              text += t;
              onText(t);
            }
          } catch {}
        } else if (trimmed.startsWith("9:")) {
          try {
            const tc = JSON.parse(trimmed.slice(2));
            if (tc.toolCallId && tc.toolName) {
              const event: ToolCallEvent = {
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args ?? {},
              };
              toolCalls.push(event);
              onToolCall?.(event);
            }
          } catch {}
        } else if (trimmed.startsWith("a:")) {
          try {
            const tr = JSON.parse(trimmed.slice(2));
            if (tr.toolCallId) {
              const result =
                typeof tr.result === "string"
                  ? tr.result
                  : JSON.stringify(tr.result);
              const existing = toolCalls.find(
                (t) => t.toolCallId === tr.toolCallId,
              );
              if (existing) {
                existing.result = result;
              } else {
                toolCalls.push({
                  toolCallId: tr.toolCallId,
                  toolName: "",
                  args: {},
                  result,
                });
              }
              onToolCall?.({
                toolCallId: tr.toolCallId,
                toolName: "",
                args: {},
                result,
              });
            }
          } catch {}
        } else if (trimmed.startsWith("3:")) {
          try {
            const e = JSON.parse(trimmed.slice(2));
            error =
              typeof e === "string" ? e : JSON.stringify(e);
          } catch {
            error = trimmed.slice(2);
          }
        }
      }
    }
    return { text, error, toolCalls };
  } catch (e: unknown) {
    if (controller.signal.aborted) {
      return {
        text: "",
        error: `Stream timed out after ${STREAM_TIMEOUT_MS / 1000}s.`,
        toolCalls: [],
      };
    }
    const err = e as Error;
    if (err.name === "AbortError") {
      return { text: "", error: "Request cancelled.", toolCalls: [] };
    }
    return { text: "", error: err.message, toolCalls: [] };
  } finally {
    clearInterval(timeoutId);
  }
}
