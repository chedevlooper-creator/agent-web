"use client";

import { CornerDownRight, MessageSquareQuote } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThreadIndicatorProps {
  parentMessage?: {
    id: string;
    content: string;
    role: string;
  } | null;
  className?: string;
}

function truncateContent(content: string, max = 60): string {
  const singleLine = content.replace(/\s+/g, " ").trim();
  if (singleLine.length <= max) return singleLine;
  return singleLine.slice(0, max) + "...";
}

/**
 * Visual indicator shown above a message that is a reply in a thread.
 * Displays a "Replying to" header with the parent message content preview
 * and a left border accent line for visual threading.
 */
export function ThreadIndicator({
  parentMessage,
  className,
}: ThreadIndicatorProps) {
  if (!parentMessage) return null;

  const isUser = parentMessage.role === "user";

  return (
    <div className={cn("flex flex-col", className)}>
      {/* "Replying to" header */}
      <div className="mb-1.5 flex items-center gap-1.5 pl-2">
        <CornerDownRight
          size={11}
          className="shrink-0 text-[var(--accent)]"
        />
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
          Replying to
        </span>
      </div>

      {/* Parent message preview with left border accent */}
      <div
        className={cn(
          "relative ml-[3px] border-l-2 border-[var(--accent)]/40 bg-[var(--overlay)] px-3 py-2",
          "mb-2",
        )}
      >
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote
            size={11}
            className="shrink-0 text-[var(--muted-foreground)]"
          />
          <span
            className={cn(
              "font-mono text-[10px] font-semibold uppercase tracking-wider",
              isUser
                ? "text-[var(--primary-foreground)]"
                : "text-[var(--primary)]",
            )}
          >
            {isUser ? "You" : "Assistant"}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted-foreground)] line-clamp-2">
          {truncateContent(parentMessage.content)}
        </p>
      </div>
    </div>
  );
}

/**
 * An inline reply-preview badge that shows a quoted snippet of the parent
 * message. Useful when composing a reply in the input area.
 */
export function ReplyPreview({
  parentContent,
  onClear,
  className,
}: {
  parentContent: string;
  onClear: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-l-2 border-[var(--accent)] bg-[var(--overlay)] px-3 py-1.5",
        className,
      )}
    >
      <CornerDownRight
        size={12}
        className="shrink-0 text-[var(--accent)]"
      />
      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted-foreground)]">
        {truncateContent(parentContent, 40)}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--dim-foreground)] hover:text-[var(--foreground)] transition-colors"
        aria-label="Clear reply"
      >
        <span className="text-[11px] leading-none">&times;</span>
      </button>
    </div>
  );
}
