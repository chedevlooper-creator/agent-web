import { Bot } from "lucide-react";
import type { ChatMessage } from "@/lib/store";
import { MarkdownRenderer } from "./markdown-renderer";

export function CompareRow({
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
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-accent/15">
        <Bot size={12} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {message.model ? (
          <div className="section-label mb-1">
            {message.model}
          </div>
        ) : null}
        <div className="px-3 py-2.5 rounded-xl text-sm glass-card">
          {isError ? (
            <p className="text-destructive whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <MarkdownRenderer content={message.content} />
          ) : (
            <span className="text-muted-foreground text-xs italic">Waiting...</span>
          )}
        </div>
      </div>
    </div>
  );
}
