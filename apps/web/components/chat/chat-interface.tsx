"use client";

import {
  useChatStore,
  useActiveMessages,
  type ChatMessage,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  ArrowDown,
  CornerDownLeft,
  Loader2,
  RefreshCw,
  Pencil,
  Check,
  X,
  Copy,
  GitCompare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";

function genId() {
  return (
    Math.random().toString(36).slice(2, 11) +
    Date.now().toString(36).slice(-4)
  );
}

// Persist a single message directly via API (used when we want to insert
// a streaming assistant result after stream completion).
async function persistMessage(
  sessionId: string,
  msg: { id: string; role: "user" | "assistant" | "system"; content: string; model?: string; timestamp: number }
) {
  try {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
  } catch (e) {
    console.error("persistMessage failed:", e);
  }
}

async function updateMessageRemote(
  sessionId: string,
  id: string,
  content: string
) {
  try {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content }),
    });
  } catch (e) {
    console.error("updateMessageRemote failed:", e);
  }
}

// ===== Typing Indicator =====
function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex items-start gap-3 animate-message-in" role="status">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] flex items-center justify-center shrink-0 ai-glow">
        <Bot size={15} className="text-white" />
      </div>
      <div className="px-4 py-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)]">
        <div className="flex gap-1.5 items-center h-5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
          {label && (
            <span className="ml-2 text-xs text-[var(--muted-foreground)]">{label}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Assistant Content Renderer =====
function AssistantContent({ content }: { content: string }) {
  return (
    <div className="chat-prose">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !className?.includes("language-");
            return !isInline && match ? (
              <SyntaxHighlighter
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                style={vscDarkPlus as any}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: "0.5rem 0",
                  borderRadius: "0.5rem",
                  fontSize: "0.8125rem",
                }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ===== Message Bubble =====
function MessageBubble({
  message,
  index,
  onRetry,
  onEdit,
}: {
  message: ChatMessage;
  index: number;
  onRetry?: () => void;
  onEdit?: (newContent: string) => void;
}) {
  const isUser = message.role === "user";
  const isError = !isUser && message.content.startsWith("Error:");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const autoSize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 320) + "px";
  };

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
      autoSize(editRef.current);
    }
  }, [editing]);

  const handleSaveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      setDraft(message.content);
      return;
    }
    onEdit?.(trimmed);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setDraft(message.content);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div
      className={cn(
        "flex gap-3 animate-message-in group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
          isUser
            ? "bg-[var(--primary)]"
            : "bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] ai-glow"
        )}
      >
        {isUser ? (
          <User size={15} className="text-white" />
        ) : (
          <Bot size={15} className="text-white" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1 max-w-[75%]", isUser ? "items-end" : "items-start")}>
        {message.model && !isUser && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] px-1">
            {message.model}
          </span>
        )}
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm w-full",
            isUser
              ? "bg-[var(--primary)] text-white rounded-br-md"
              : "bg-[var(--surface-elevated)] border border-[var(--border)] rounded-bl-md"
          )}
        >
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={editRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  autoSize(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleCancelEdit();
                  } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                }}
                className={cn(
                  "w-full bg-transparent text-sm resize-none focus:outline-none",
                  "min-h-[44px] max-h-[320px]",
                  isUser ? "text-white placeholder:text-white/60" : "text-[var(--foreground)]"
                )}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className={cn(
                    "min-w-[32px] h-7 px-2 rounded-md text-xs inline-flex items-center gap-1",
                    isUser
                      ? "bg-white/10 hover:bg-white/20 text-white"
                      : "bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)]"
                  )}
                  aria-label="Cancel edit"
                >
                  <X size={12} />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className={cn(
                    "min-w-[32px] h-7 px-2 rounded-md text-xs inline-flex items-center gap-1 font-medium",
                    isUser
                      ? "bg-white text-[var(--primary)] hover:bg-white/90"
                      : "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
                  )}
                  aria-label="Save edit"
                >
                  <Check size={12} />
                  Save
                </button>
              </div>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : isError ? (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap leading-relaxed text-[var(--destructive)]">
                {message.content}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--surface-elevated)]
                             border border-[var(--border)] transition-colors"
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              )}
            </div>
          ) : message.content ? (
            <AssistantContent content={message.content} />
          ) : (
            <span className="text-[var(--muted-foreground)] text-xs italic">Waiting...</span>
          )}
        </div>

        {/* Action bar */}
        {!editing && (
          <div
            className={cn(
              "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            {isUser && onEdit && !isError && (
              <button
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
                className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                title="Edit message"
                aria-label="Edit message"
              >
                <Pencil size={12} />
              </button>
            )}
            {!isError && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                title={copied ? "Copied!" : "Copy"}
                aria-label="Copy message"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Empty State =====
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center animate-fade-in">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] flex items-center justify-center mx-auto ai-glow animate-pulse-glow">
          <Sparkles size={28} className="text-white" />
        </div>
        <h1 className="text-lg font-semibold">Agent Web</h1>
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
          AI-powered assistant ready to help. Configure your API key in settings
          and start a conversation.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {["Write code", "Analyze data", "Explain concepts"].map((s) => (
            <span
              key={s}
              className="px-3 py-1.5 rounded-full text-xs bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== Stream Parser =====
async function streamChat(
  payload: { messages: { role: string; content: string }[]; provider: string; model: string; apiKey: string },
  onText: (delta: string) => void
): Promise<{ text: string; error?: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
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
      } else if (trimmed.startsWith("3:")) {
        try {
          const e = JSON.parse(trimmed.slice(2));
          error = typeof e === "string" ? e : JSON.stringify(e);
        } catch {
          error = trimmed.slice(2);
        }
      }
    }
  }
  return { text, error };
}

// ===== Compare Row (renders two assistant messages side by side) =====
function CompareRow({
  left,
  right,
  index,
}: {
  left: ChatMessage;
  right: ChatMessage;
  index: number;
}) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-message-in"
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      <CompareCell message={left} />
      <CompareCell message={right} />
    </div>
  );
}

function CompareCell({ message }: { message: ChatMessage }) {
  const isError = message.content.startsWith("Error:");
  return (
    <div className="flex gap-2 items-start">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] flex items-center justify-center shrink-0 mt-0.5 ai-glow">
        <Bot size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {message.model && (
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            {message.model}
          </div>
        )}
        <div
          className={cn(
            "px-3 py-2.5 rounded-xl text-sm",
            "bg-[var(--surface-elevated)] border border-[var(--border)]"
          )}
        >
          {isError ? (
            <p className="text-[var(--destructive)] whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <AssistantContent content={message.content} />
          ) : (
            <span className="text-[var(--muted-foreground)] text-xs italic">Waiting...</span>
          )}
        </div>
      </div>
    </div>
  );
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScroll = useRef(true);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Track scroll position
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

  // Models to use for this submission
  const effectiveModels = useMemo(() => {
    if (compareMode && selectedModels.length >= 2) {
      return selectedModels.slice(0, 2);
    }
    return [model];
  }, [compareMode, selectedModels, model]);

  // Core: send a list of messages to one model and stream into a placeholder
  const runSingle = useCallback(
    async (
      sessionId: string,
      msgs: { role: string; content: string }[],
      useModel: string,
      placeholderId: string
    ) => {
      const { text, error } = await streamChat(
        {
          messages: msgs,
          provider,
          model: useModel,
          apiKey,
        },
        (delta) => {
          patchLocalMessage(placeholderId, getCurrentText(placeholderId) + delta);
        }
      );

      const finalText = error ? "Error: " + error : text;
      // Persist to DB at the end (placeholder was local-only)
      await persistMessage(sessionId, {
        id: placeholderId,
        role: "assistant",
        content: finalText,
        model: useModel,
        timestamp: Date.now(),
      });
      // Ensure local state matches
      patchLocalMessage(placeholderId, finalText);

      function getCurrentText(id: string): string {
        const ses = useChatStore
          .getState()
          .sessions.find((s) => s.id === sessionId);
        return ses?.messages.find((m) => m.id === id)?.content ?? "";
      }
    },
    [provider, apiKey, patchLocalMessage]
  );

  // Submit chat: handles both single and compare modes
  const submitChat = useCallback(
    async (msgs: { role: string; content: string }[]) => {
      if (isLoading || !apiKey) return;
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
      }
      setLoading(true);

      const placeholders = effectiveModels.map((useModel) => {
        const id = genId();
        const msg: ChatMessage = {
          id,
          role: "assistant",
          content: "",
          model: useModel,
          timestamp: Date.now(),
        };
        appendLocalMessage(msg);
        return { id, model: useModel };
      });

      try {
        await Promise.all(
          placeholders.map((p) =>
            runSingle(sessionId!, msgs, p.model, p.id)
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [
      isLoading,
      apiKey,
      activeSessionId,
      createSession,
      setLoading,
      effectiveModels,
      appendLocalMessage,
      runSingle,
    ]
  );

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !apiKey) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Persist user message to DB
    await addMessage(userMsg);

    const currentMessages = [...useChatStore.getState().sessions.find((s) => s.id === useChatStore.getState().activeSessionId)?.messages ?? []];
    // Build prompt history (skip empty assistant placeholders, drop model meta)
    const msgs = currentMessages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    await submitChat(msgs);
  }, [input, isLoading, apiKey, addMessage, submitChat]);

  // Retry: rebuild prompt from messages up to last user message and resubmit
  const handleRetry = useCallback(
    async (errorMessageId: string) => {
      const idx = messages.findIndex((m) => m.id === errorMessageId);
      if (idx === -1) return;
      const target = messages[idx];
      // Truncate from this message inclusive
      await truncateAfter(target.timestamp, true);
      const remaining = messages.slice(0, idx);
      const msgs = remaining
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }));
      await submitChat(msgs);
    },
    [messages, truncateAfter, submitChat]
  );

  // Edit a user message: update DB, truncate messages after, resubmit
  const handleEdit = useCallback(
    async (messageId: string, newContent: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const target = messages[idx];

      // Update local + DB content
      await updateMessage(messageId, newContent);
      // Drop everything after this message
      await truncateAfter(target.timestamp, false);

      // Build prompt: messages up to and including edited message (with new content)
      const remaining = messages.slice(0, idx + 1).map((m) =>
        m.id === messageId ? { ...m, content: newContent } : m
      );
      const msgs = remaining
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }));

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

  // Group messages for compare-mode rendering. Consecutive assistant messages
  // sharing the same user-prompt timestamp (i.e., dispatched in parallel) are
  // rendered side-by-side as a CompareRow.
  const renderItems = useMemo(() => {
    type Item =
      | { kind: "single"; msg: ChatMessage; index: number }
      | { kind: "compare"; left: ChatMessage; right: ChatMessage; index: number };
    const items: Item[] = [];
    let i = 0;
    while (i < messages.length) {
      const m = messages[i];
      // Look-ahead for compare pair: assistant + assistant with close timestamps and different models
      if (
        m.role === "assistant" &&
        i + 1 < messages.length &&
        messages[i + 1].role === "assistant" &&
        Math.abs(messages[i + 1].timestamp - m.timestamp) < 2000 &&
        m.model &&
        messages[i + 1].model &&
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
        <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      {messages.length === 0 ? (
        <EmptyState />
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
                  onRetry={
                    item.msg.role === "assistant" &&
                    item.msg.content.startsWith("Error:")
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] shadow-lg
                       hover:bg-[var(--muted)] active:scale-95 transition-all animate-slide-up"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {compareMode && effectiveModels.length > 1 && (
            <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30">
              <GitCompare size={11} />
              Compare mode: {effectiveModels.join(" vs ")}
            </div>
          )}
          <div
            className={cn(
              "flex items-end gap-2 p-2 rounded-2xl",
              "bg-[var(--muted)] border border-[var(--border)]",
              "focus-within:ring-2 focus-within:ring-[var(--ring)]/20 focus-within:border-[var(--primary)]/50",
              "transition-all duration-200"
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={
                apiKey
                  ? "Message Agent Web..."
                  : "Configure API key in settings first"
              }
              disabled={!apiKey}
              rows={1}
              className="flex-1 bg-transparent text-base resize-none px-2 py-1.5 min-h-[40px] max-h-[320px]
                         placeholder:text-[var(--muted-foreground)] focus:outline-none
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !apiKey}
              className={cn(
                "min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl shrink-0 transition-all duration-200",
                "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
                input.trim() && apiKey && !isLoading
                  ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:scale-[0.93] shadow-sm"
                  : "text-[var(--muted-foreground)] cursor-not-allowed"
              )}
              aria-label={isLoading ? "Sending..." : "Send message"}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {provider} / {compareMode && effectiveModels.length > 1 ? effectiveModels.join(", ") : model}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1">
              <CornerDownLeft size={10} />
              Enter to send
            </p>
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

// Helper for utility usage of updateMessageRemote when patching from outside the bubble
export { persistMessage, updateMessageRemote };
