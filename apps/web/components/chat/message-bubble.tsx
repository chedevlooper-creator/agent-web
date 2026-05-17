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
  // Use displayContent if available (file attachments UI), else full content
  const displayText = message.displayContent ?? message.content;
  const isError = !isUser && message.content.startsWith("Error:");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayText);
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
        "flex gap-3 group",
        isUser ? "animate-message-in-user" : "animate-message-in-assistant",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 border flex items-center justify-center shrink-0 mt-0.5 transition-[box-shadow,background-color,border-color] duration-300",
          isUser
            ? "border-electric/45 bg-electric-muted text-electric shadow-[0_0_20px_rgba(176,226,39,0.16)]"
            : "border-cyan/35 bg-cyan-muted text-cyan ai-glow-subtle"
        )}
      >
        {isUser ? (
          <User size={14} />
        ) : (
          <Bot size={14} />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1",
          isUser ? "max-w-[86%] sm:max-w-[75%] items-end" : "max-w-[90%] sm:max-w-[82%] items-start"
        )}
      >
        {message.model && !isUser && (
          <span className="text-[10px] uppercase text-muted-foreground/70 px-1 font-medium">
            {message.model}
          </span>
        )}
        <div
          className={cn(
            "px-4 py-3 text-sm w-full transition-[box-shadow,background-color,border-color] duration-300 overflow-hidden",
            isUser
              ? "bg-electric text-black shadow-[0_0_26px_rgba(176,226,39,0.12)]"
              : "glass-card border-cyan/15 hover:border-cyan/25 hover:shadow-md"
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
                  isUser ? "text-black placeholder:text-black/50" : "text-foreground"
                )}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className={cn(
                    "min-h-[44px] px-3 rounded-lg text-xs inline-flex items-center gap-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isUser
                      ? "bg-black/10 hover:bg-black/20 text-black"
                      : "bg-muted hover:bg-border text-foreground"
                  )}
                  aria-label="Düzenlemeyi iptal et"
                >
                  <X size={11} />
                  İptal
                </button>
                <button
                  onClick={handleSaveEdit}
                  className={cn(
                    "min-h-[44px] px-3 rounded-lg text-xs inline-flex items-center gap-1 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isUser
                      ? "bg-black text-electric hover:bg-black/90"
                      : "bg-primary text-white hover:bg-primary-hover"
                  )}
                  aria-label="Düzenlemeyi kaydet"
                >
                  <Check size={11} />
                  Kaydet
                </button>
              </div>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{displayText}</p>
          ) : isError ? (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap leading-relaxed text-destructive">
                {message.content}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex min-h-[44px] items-center gap-1.5 px-3 rounded-lg text-xs font-medium
                             bg-muted text-foreground hover:bg-surface-elevated
                             border border-border-muted transition-[background-color,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RefreshCw size={12} />
                  Tekrar dene
                </button>
              )}
            </div>
          ) : message.content || isStreaming ? (
            <MarkdownRenderer content={message.content} isStreaming={isStreaming} />
          ) : (
            <span className="text-muted-foreground text-xs italic">Bekleniyor…</span>
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
              "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            {isUser && onEdit && !isError && (
              <button
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Mesajı düzenle"
                aria-label="Mesajı düzenle"
              >
                <Pencil size={11} />
              </button>
            )}
            {!isError && (
              <button
                onClick={handleCopy}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={copied ? "Kopyalandı!" : "Kopyala"}
                aria-label="Mesajı kopyala"
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
