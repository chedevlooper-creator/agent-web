"use client";

import { useState, useEffect, useRef } from "react";
import { User, Bot, Pencil, Check, X, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/store";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolCallBubble } from "./tool-call-bubble";

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  onRetry?: () => void;
  onEdit?: (newContent: string) => void;
  isStreaming?: boolean;
}

export function MessageBubble({
  message,
  index,
  onRetry,
  onEdit,
  isStreaming,
}: MessageBubbleProps) {
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
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300",
          isUser
            ? "gradient-bg-primary shadow-md shadow-primary/20"
            : "bg-gradient-to-br from-primary to-accent shadow-md shadow-accent/15 ai-glow-subtle"
        )}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-white" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1 max-w-[75%]", isUser ? "items-end" : "items-start")}>
        {message.model && !isUser && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 px-1 font-medium">
            {message.model}
          </span>
        )}
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm w-full transition-all duration-300",
            isUser
              ? "bg-gradient-to-br from-primary to-primary-hover text-white rounded-br-lg shadow-md shadow-primary/20"
              : "glass-card rounded-bl-lg hover:shadow-md"
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
                  "w-full bg-transparent text-sm resize-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
                  "min-h-[44px] max-h-[320px]",
                  isUser ? "text-white placeholder:text-white/60" : "text-foreground"
                )}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className={cn(
                    "min-w-[32px] h-7 px-2.5 rounded-lg text-xs inline-flex items-center gap-1 font-medium transition-colors",
                    isUser
                      ? "bg-white/10 hover:bg-white/20 text-white"
                      : "bg-muted hover:bg-border text-foreground"
                  )}
                  aria-label="Cancel edit"
                >
                  <X size={11} />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className={cn(
                    "min-w-[32px] h-7 px-2.5 rounded-lg text-xs inline-flex items-center gap-1 font-semibold transition-colors",
                    isUser
                      ? "bg-white text-primary hover:bg-white/90"
                      : "bg-primary text-white hover:bg-primary-hover"
                  )}
                  aria-label="Save edit"
                >
                  <Check size={11} />
                  Save
                </button>
              </div>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : isError ? (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap leading-relaxed text-destructive">
                {message.content}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-muted text-foreground hover:bg-surface-elevated
                             border border-border-muted transition-all duration-200 active:scale-[0.97]"
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              )}
            </div>
          ) : message.content || isStreaming ? (
            <MarkdownRenderer content={message.content} isStreaming={isStreaming} />
          ) : (
            <span className="text-muted-foreground text-xs italic">Waiting…</span>
          )}

          {/* Tool invocations */}
          {!isUser && message.toolInvocations && message.toolInvocations.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {message.toolInvocations.map((inv) => (
                <ToolCallBubble key={inv.toolCallId} invocation={inv} />
              ))}
            </div>
          )}
        </div>

        {/* Action bar */}
        {!editing && (
          <div
            className={cn(
              "flex items-center gap-0.5 transition-opacity duration-200",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            {isUser && onEdit && !isError && (
              <button
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                title="Edit message"
                aria-label="Edit message"
              >
                <Pencil size={11} />
              </button>
            )}
            {!isError && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                title={copied ? "Copied!" : "Copy"}
                aria-label="Copy message"
              >
                {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
