"use client";

import {
  useChatStore,
  useActiveMessages,
  genId,
  type ChatMessage,
  type ToolInvocation,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  Loader2,
  Trash2,
} from "lucide-react";
import { TypingIndicator } from "./typing-indicator";
import { MarkdownRenderer } from "./markdown-renderer";
import { CompareRow } from "./compare-row";
import { ToolCallBubble } from "./tool-call-bubble";
import { WelcomeHero } from "./welcome-hero";
import { formatFileSize } from "./file-upload";
import { useScrollAnchor, useFileUpload } from "@/lib/hooks";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";

// Persist a single message directly via API
async function persistMessage(
  sessionId: string,
  msg: { id: string; role: "user" | "assistant" | "system"; content: string; model?: string; timestamp: number }
) {
  try {
    useChatStore.getState().setSyncing(true);
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
  } catch (e) {
    console.error("persistMessage failed:", e);
  } finally {
    useChatStore.getState().setSyncing(false);
  }
}


// ===== Stream Parser =====
interface StreamCallbacks {
  onText: (delta: string) => void;
  onToolCall: (toolCall: { toolCallId: string; toolName: string; args: Record<string, unknown> }) => void;
  onToolResult: (toolResult: { toolCallId: string; result: string }) => void;
}

async function streamChat(
  payload: { messages: { role: string; content: string }[]; provider: string; model: string; apiKey: string },
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<{ text: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e: unknown) {
    if ((e as Error).name === "AbortError") return { text: "", error: "Cancelled" };
    throw e;
  }
  if (!res.ok || !res.body) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    return { text: "", error: msg };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let error: string | undefined;
  let buffer = "";

  function parseLine(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("0:")) {
      try {
        const t = JSON.parse(trimmed.slice(2));
        if (typeof t === "string") {
          text += t;
          callbacks.onText(t);
        }
      } catch {}
    } else if (trimmed.startsWith("3:")) {
      try {
        const e = JSON.parse(trimmed.slice(2));
        error = typeof e === "string" ? e : JSON.stringify(e);
      } catch {
        error = trimmed.slice(2);
      }
    } else if (trimmed.startsWith("9:")) {
      try {
        const tc = JSON.parse(trimmed.slice(2));
        if (tc.toolCallId && tc.toolName) {
          callbacks.onToolCall({
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args ?? {},
          });
        }
      } catch {}
    } else if (trimmed.startsWith("a:")) {
      try {
        const tr = JSON.parse(trimmed.slice(2));
        if (tr.toolCallId) {
          const result = typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result);
          callbacks.onToolResult({
            toolCallId: tr.toolCallId,
            result,
          });
        }
      } catch {}
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) parseLine(buffer);
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        parseLine(line);
      }
    }
  } catch (e: unknown) {
    if ((e as Error).name === "AbortError") {
      return { text, error: text ? undefined : "Cancelled" };
    }
    throw e;
  }
  return { text, error };
}

// ===== Main Chat Interface =====
export function ChatInterface() {
  const isLoading = useChatStore((s) => s.isLoading);
  const setLoading = useChatStore((s) => s.setLoading);
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const apiKey = useChatStore((s) => s.apiKey);
  const selectedModels = useChatStore((s) => s.selectedModels);
  const compareMode = useChatStore((s) => s.compareMode);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const truncateAfter = useChatStore((s) => s.truncateAfter);
  const appendLocalMessage = useChatStore((s) => s.appendLocalMessage);
  const patchLocalMessage = useChatStore((s) => s.patchLocalMessage);
  const createSession = useChatStore((s) => s.createSession);
  const hydrated = useChatStore((s) => s.hydrated);

  const messages = useActiveMessages();

  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const { messagesEndRef, scrollContainerRef, showScrollBtn, scrollToBottom, handleScroll } = useScrollAnchor([messages.length]);
  const { attachedFiles, isUploading, handleFileUpload, removeAttachedFile, clearAttachedFiles } = useFileUpload();

  const effectiveModels = useMemo(() => {
    if (compareMode && selectedModels.length >= 2) {
      return selectedModels.slice(0, 2);
    }
    return [model];
  }, [compareMode, selectedModels, model]);

  const patchLocalToolInvocations = useCallback(
    (messageId: string, updater: (prev: ToolInvocation[]) => ToolInvocation[]) => {
      useChatStore.setState((s) => ({
        sessions: s.sessions.map((ses) => {
          if (ses.id !== s.activeSessionId) return ses;
          return {
            ...ses,
            messages: ses.messages.map((m) =>
              m.id === messageId
                ? { ...m, toolInvocations: updater(m.toolInvocations ?? []) }
                : m
            ),
          };
        }),
      }));
    },
    []
  );

  const runSingle = useCallback(
    async (
      sessionId: string,
      msgs: { role: string; content: string }[],
      useModel: string,
      placeholderId: string
    ) => {
      const { text, error } = await streamChat(
        { messages: msgs, provider, model: useModel, apiKey },
        {
          onText: (delta) => {
            patchLocalMessage(placeholderId, getCurrentText(placeholderId) + delta);
          },
          onToolCall: (tc) => {
            patchLocalToolInvocations(placeholderId, (prev) => [
              ...prev,
              { toolCallId: tc.toolCallId, toolName: tc.toolName, args: tc.args, state: "pending" as const },
            ]);
          },
          onToolResult: (tr) => {
            patchLocalToolInvocations(placeholderId, (prev) =>
              prev.map((inv) =>
                inv.toolCallId === tr.toolCallId
                  ? { ...inv, result: tr.result, state: "result" as const }
                  : inv
              )
            );
          },
        },
        abortRef.current?.signal
      );

      const finalText = error ? "Error: " + error : text;
      if (error) toast.error(`Error generating response: ${error}`);

      await persistMessage(sessionId, {
        id: placeholderId,
        role: "assistant",
        content: finalText,
        model: useModel,
        timestamp: Date.now(),
      });
      patchLocalMessage(placeholderId, finalText);

      function getCurrentText(id: string): string {
        const ses = useChatStore.getState().sessions.find((s) => s.id === sessionId);
        return ses?.messages.find((m) => m.id === id)?.content ?? "";
      }
    },
    [provider, apiKey, patchLocalMessage, patchLocalToolInvocations]
  );

  const submitChat = useCallback(
    async (msgs: { role: string; content: string }[]) => {
      if (isLoading || !apiKey) return;
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
      }
      setLoading(true);

      const ac = new AbortController();
      abortRef.current = ac;

      const placeholders = effectiveModels.map((useModel) => {
        const id = genId();
        const msg: ChatMessage = { id, role: "assistant", content: "", model: useModel, timestamp: Date.now() };
        appendLocalMessage(msg);
        return { id, model: useModel };
      });

      try {
        const results = await Promise.allSettled(
          placeholders.map((p) => runSingle(sessionId!, msgs, p.model, p.id))
        );
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
            toast.error(`${placeholders[i].model}: ${reason}`);
          }
        });
      } finally {
        abortRef.current = null;
        setLoading(false);
      }
    },
    [isLoading, apiKey, activeSessionId, createSession, setLoading, effectiveModels, appendLocalMessage, runSingle]
  );

  const handleSend = useCallback(async (overrideInput?: string | React.MouseEvent) => {
    const isString = typeof overrideInput === "string";
    const textToUse = (isString ? overrideInput : input).trim();
    if (!textToUse || isLoading || !apiKey) return;

    // Build message content: user text + attached file contents
    let fullContent = textToUse;
    if (attachedFiles.length > 0) {
      const fileContextParts = attachedFiles.map((f) =>
        `\n\n---\n📎 File: ${f.name} (${f.type}, ${formatFileSize(f.size)})\n\n${f.content}`
      );
      fullContent = textToUse + fileContextParts.join("");
    }

    // Show only the user's typed text in the UI bubble
    const displayContent = attachedFiles.length > 0
      ? `${textToUse}\n\n📎 ${attachedFiles.map((f) => f.name).join(", ")}`
      : textToUse;

    const userMsg: ChatMessage = { id: genId(), role: "user", content: displayContent, timestamp: Date.now() };
    
    if (!isString) {
      setInput("");
      clearAttachedFiles();
    }

    await addMessage(userMsg);

    // For the API, use the full content with file data
    const currentMessages = [...useChatStore.getState().sessions.find((s) => s.id === useChatStore.getState().activeSessionId)?.messages ?? []];
    const msgs = currentMessages.filter((m) => m.content).map((m) => {
      // Replace the display content with full content for the last user message
      if (m.id === userMsg.id) {
        return { role: m.role, content: fullContent };
      }
      return { role: m.role, content: m.content };
    });
    await submitChat(msgs);
  }, [input, isLoading, apiKey, addMessage, submitChat, attachedFiles]);

  const handleRetry = useCallback(
    async (errorMessageId: string) => {
      const idx = messages.findIndex((m) => m.id === errorMessageId);
      if (idx === -1) return;
      const target = messages[idx];
      await truncateAfter(target.timestamp, true);
      const freshSession = useChatStore.getState().sessions.find(
        (s) => s.id === useChatStore.getState().activeSessionId
      );
      const remaining = freshSession?.messages ?? [];
      const msgs = remaining.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content }));
      await submitChat(msgs);
    },
    [messages, truncateAfter, submitChat]
  );

  const handleEdit = useCallback(
    async (messageId: string, newContent: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const target = messages[idx];
      await updateMessage(messageId, newContent);
      await truncateAfter(target.timestamp, false);
      const freshSession = useChatStore.getState().sessions.find(
        (s) => s.id === useChatStore.getState().activeSessionId
      );
      const remaining = freshSession?.messages ?? [];
      const msgs = remaining.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content }));
      await submitChat(msgs);
    },
    [messages, updateMessage, truncateAfter, submitChat]
  );

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setLoading(false);
      toast("Generation stopped");
    }
  }, [setLoading]);

  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isLoading) { e.preventDefault(); handleCancel(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); createSession(); }
    }
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [isLoading, handleCancel, createSession]);

  const renderItems = useMemo(() => {
    type Item =
      | { kind: "single"; msg: ChatMessage; index: number }
      | { kind: "compare"; left: ChatMessage; right: ChatMessage; index: number };
    const items: Item[] = [];
    let i = 0;
    while (i < messages.length) {
      const m = messages[i];
      if (
        m.role === "assistant" &&
        i + 1 < messages.length &&
        messages[i + 1].role === "assistant" &&
        Math.abs(messages[i + 1].timestamp - m.timestamp) < 2000 &&
        m.model && messages[i + 1].model &&
        m.model !== messages[i + 1].model
      ) {
        items.push({ kind: "compare", left: m, right: messages[i + 1], index: i });
        i += 2;
        continue;
      }
      items.push({ kind: "single", msg: m, index: i });
      i++;
    }
    return items;
  }, [messages]);

  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages Area */}
      {messages.length === 0 ? (
        <WelcomeHero />
      ) : (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {renderItems.map((item) =>
              item.kind === "single" ? (
                <MessageBubble
                  key={item.msg.id}
                  message={item.msg}
                  index={item.index}
                  isStreaming={isLoading && item.index === messages.length - 1}
                  onRetry={
                    item.msg.role === "assistant" && item.msg.content.startsWith("Error:")
                      ? () => handleRetry(item.msg.id)
                      : undefined
                  }
                  onEdit={
                    item.msg.role === "user"
                      ? (newContent) => handleEdit(item.msg.id, newContent)
                      : undefined
                  }
                />
              ) : (
                <CompareRow
                  key={`${item.left.id}-${item.right.id}`}
                  left={item.left}
                  right={item.right}
                  index={item.index}
                />
              )
            )}
            {isLoading && (
              <TypingIndicator
                label={
                  compareMode && effectiveModels.length > 1
                    ? `Comparing ${effectiveModels.join(" vs ")}`
                    : undefined
                }
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={scrollToBottom}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full
                       gradient-bg-primary text-white
                       shadow-lg shadow-primary/25
                       hover:shadow-xl hover:shadow-primary/35 active:scale-95 transition-all duration-200 animate-bounce-subtle"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        </div>
      )}

      {/* ===== Unified Input Area ===== */}
      <ChatInput
        input={input}
        onInputChange={setInput}
        onSend={() => handleSend()}
        onCancel={handleCancel}
        isLoading={isLoading}
        hasApiKey={!!apiKey}
        provider={provider}
        model={model}
        compareMode={compareMode}
        effectiveModels={effectiveModels}
        attachedFiles={attachedFiles}
        isUploading={isUploading}
        onFileUpload={handleFileUpload}
        onRemoveFile={removeAttachedFile}
      />

      {/* Live region for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {messages.findLast?.((m) => m.role === "assistant")?.content ?? ""}
      </div>
    </div>
  );
}

