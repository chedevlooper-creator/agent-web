/**
 * Rough token counter using character-based estimation (char / 4).
 * This is sufficient for threshold-based trimming without adding
 * a heavy tokenizer dependency.
 */

export function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface MessageToken {
  role: "user" | "assistant" | "system";
  content: string;
}

export function countMessagesTokens(messages: MessageToken[]): number {
  let total = 0;
  for (const m of messages) {
    total += countTokens(m.role);
    total += countTokens(m.content);
  }
  return total;
}

/**
 * Trim messages to fit within a token limit using a sliding window.
 * Preserves the system prompt (role === "system") and the most recent
 * messages while keeping the first user message for context anchoring.
 */
export function trimToTokenLimit(
  messages: MessageToken[],
  maxTokens: number
): MessageToken[] {
  const currentTokens = countMessagesTokens(messages);
  if (currentTokens <= maxTokens) return messages;

  // Find keepers: system messages and the first user message
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversation = messages.filter((m) => m.role !== "system");

  // Always keep system prompts
  const systemTokens = countMessagesTokens(systemMessages);
  let remaining = maxTokens - systemTokens;

  // Keep first user message for context anchoring
  const firstUserIdx = conversation.findIndex((m) => m.role === "user");
  let anchorTokens = 0;
  if (firstUserIdx >= 0) {
    anchorTokens = countTokens(conversation[firstUserIdx].role) +
      countTokens(conversation[firstUserIdx].content);
  }

  // Build from end (most recent first)
  const result: MessageToken[] = [];
  let usedTokens = 0;

  for (let i = conversation.length - 1; i >= 0; i--) {
    const msg = conversation[i];
    const msgTokens = countTokens(msg.role) + countTokens(msg.content);

    if (usedTokens + msgTokens > remaining - anchorTokens) break;
    result.unshift(msg);
    usedTokens += msgTokens;
  }

  // Prepend anchor if it's not already in the result
  if (firstUserIdx >= 0 && !result.includes(conversation[firstUserIdx])) {
    result.unshift(conversation[firstUserIdx]);
  }

  // Prepend system messages
  return [...systemMessages, ...result];
}

/**
 * Get the context compression threshold from env or default.
 */
export function getContextThreshold(): number {
  const env = process.env.CONTEXT_COMPRESSION_THRESHOLD;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 80_000; // default
}
