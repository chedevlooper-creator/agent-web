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
  Send,
  Sparkles,
  ArrowDown,
  CornerDownLeft,
  Loader2,
  GitCompare,
  Square,
  Paperclip,
  Trash2,
  Loader2 as UploadSpinner,
} from "lucide-react";
import { TypingIndicator } from "./typing-indicator";
import { MarkdownRenderer } from "./markdown-renderer";
import { CompareRow } from "./compare-row";
import { ToolCallBubble } from "./tool-call-bubble";
import { WelcomeHero } from "./welcome-hero";
import { type UploadedFile, getFileIcon, formatFileSize, FilePreviewBar } from "./file-upload";
import { MessageBubble } from "./message-bubble";

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
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScroll = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  // File upload handler
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          toast.error(`Failed to upload ${file.name}: ${data.error}`);
          continue;
        }
        newFiles.push({
          name: data.file.name,
          storedName: data.file.storedName,
          size: data.file.size,
          type: data.file.type,
          content: data.content,
          uploadedAt: data.file.uploadedAt,
        });
        toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
        console.error(err);
      }
    }

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    setIsUploading(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeAttachedFile = useCallback((storedName: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.storedName !== storedName));
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom < 100;
    shouldAutoScroll.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 320) + "px";
  }, []);

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
      setAttachedFiles([]);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
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
      if ((e.ctrlKey || e.metaKey) && e.key === "/") { e.preventDefault(); textareaRef.current?.focus(); }
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
      <div className="shrink-0 z-10 w-full px-4 pb-4 pt-3">
        <div className="max-w-3xl mx-auto">
          {/* Compare mode badge */}
          {compareMode && effectiveModels.length > 1 && (
            <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-accent/10 text-accent border border-accent/20 font-medium">
              <GitCompare size={11} />
              Compare: {effectiveModels.join(" vs ")}
            </div>
          )}

          <FilePreviewBar files={attachedFiles} onRemove={removeAttachedFile} />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json,.xml,.html,.py,.js,.ts,.tsx,.jsx,.css,.yaml,.yml,.sql"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          {/* Input bar — same design for both empty and chat modes */}
          <div
            className={cn(
              "flex items-end gap-2 p-2.5 rounded-2xl",
              "bg-surface-elevated/60 border border-border/50 backdrop-blur-sm",
              "focus-within:ring-2 focus-within:ring-primary/15 focus-within:border-primary/30",
              "shadow-sm hover:shadow-md",
              "transition-all duration-300"
            )}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                "min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg shrink-0 transition-all duration-200",
                isUploading
                  ? "text-primary animate-pulse"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              aria-label="Attach file"
            >
              {isUploading ? <UploadSpinner size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={apiKey ? "Message Agent Web..." : "Configure API key in settings first"}
              disabled={!apiKey}
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none px-2.5 py-1.5 min-h-[40px] max-h-[320px]
                         placeholder:text-muted-foreground/50 focus:outline-none
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={isLoading ? handleCancel : handleSend}
              disabled={!isLoading && (!input.trim() || !apiKey)}
              className={cn(
                "min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl shrink-0 transition-all duration-200",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isLoading
                  ? "bg-destructive text-white hover:bg-destructive/90 active:scale-95"
                  : input.trim() && apiKey
                    ? "bg-gradient-to-br from-primary to-accent text-white shadow-sm shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              aria-label={isLoading ? "Stop generation" : "Send message"}
            >
              {isLoading ? <Square size={14} className="fill-current" /> : <Send size={16} />}
            </button>
          </div>

          {/* Bottom hints — always visible */}
          <div className="flex items-center justify-between mt-1.5 px-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
              <Sparkles className="w-3 h-3 text-primary/60" />
              <span>{provider}</span>
              <span className="text-border">/</span>
              <span className="font-medium text-muted-foreground/80">{model}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
              <CornerDownLeft size={10} />
              <span>Enter to send</span>
              <span className="text-border">·</span>
              <kbd className="px-1.5 py-0.5 rounded-md border border-border-muted bg-surface-muted font-mono text-[9px]">Ctrl+N</kbd>
              <span>New chat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live region for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {messages.findLast?.((m) => m.role === "assistant")?.content ?? ""}
      </div>
    </div>
  );
}

