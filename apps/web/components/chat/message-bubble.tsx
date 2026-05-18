"use client";

import { useState, useEffect, useRef } from "react";
import { Pencil, Check, X, Copy, RefreshCw } from "lucide-react";
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

  const time = new Date(message.timestamp).toTimeString().slice(0, 5);

  if (isUser) {
    return (
      <div
        className="wk-block wk-block--user animate-block-in"
        style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
      >
        <div className="wk-block-margin">
          <span className="wk-block-marker wk-block-marker--user">❯</span>
        </div>
        <div className="wk-block-body">
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
                className="w-full bg-transparent text-sm resize-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] min-h-[44px] max-h-[320px] text-[var(--ink)]"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className="min-h-[36px] px-3 rounded text-xs inline-flex items-center gap-1 font-medium border border-[var(--rule)] bg-[var(--bg-elev)] text-[var(--ink-mute)] hover:text-[var(--ink)]"
                  aria-label="İptal"
                >
                  <X size={11} />
                  İptal
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="min-h-[36px] px-3 rounded text-xs inline-flex items-center gap-1 font-semibold bg-[var(--accent)] text-[var(--bg)] hover:brightness-95"
                  aria-label="Kaydet"
                >
                  <Check size={11} />
                  Kaydet
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="wk-user-block-head">
                <span className="wk-user-tag">sen</span>
                <span className="wk-user-time">{time}</span>
                {onEdit && !isError && (
                  <button
                    onClick={() => {
                      setDraft(message.content);
                      setEditing(true);
                    }}
                    className="ml-auto flex items-center gap-1 text-[10px] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
                    title="Düzenle"
                    aria-label="Mesajı düzenle"
                  >
                    <Pencil size={10} />
                  </button>
                )}
              </div>
              <p className="wk-user-text">{displayText}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="wk-block wk-block--assistant animate-block-in"
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      <div className="wk-block-margin">
        <span className="wk-block-marker">▸</span>
        {message.model && (
          <span className="wk-block-label">{message.model}</span>
        )}
      </div>
      <div className="wk-block-body">
        {isError ? (
          <div className="space-y-2">
            <p className="whitespace-pre-wrap leading-relaxed text-[var(--danger)]">
              {message.content}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--rule)] bg-[var(--bg-elev)] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors"
              >
                <RefreshCw size={12} />
                Tekrar dene
              </button>
            )}
          </div>
        ) : message.content || isStreaming ? (
          <div className="chat-prose">
            <MarkdownRenderer
              content={message.content}
              isStreaming={isStreaming}
            />
          </div>
        ) : (
          <span className="text-xs italic text-[var(--ink-faint)]">Bekleniyor…</span>
        )}

        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {message.toolCalls.map((tc) => (
              <ToolCallBubble
                key={tc.id}
                invocation={{
                  toolCallId: tc.id,
                  toolName: tc.name,
                  state: tc.result ? "done" : "pending",
                  args: (() => {
                    try { return JSON.parse(tc.args); } catch { return {}; }
                  })(),
                  result: tc.result,
                }}
              />
            ))}
          </div>
        )}

        {/* Action bar */}
        {!editing && !isError && (
          <div className="flex items-center gap-0.5 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
              title={copied ? "Kopyalandı!" : "Kopyala"}
              aria-label="Kopyala"
            >
              {copied ? (
                <Check size={11} className="text-[var(--success)]" />
              ) : (
                <Copy size={11} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
