import { Bot } from "lucide-react";

export function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex items-start gap-3 animate-message-in" role="status">
      <div className="w-8 h-8 rounded-xl gradient-bg-primary flex items-center justify-center shrink-0 animate-pulse-glow shadow-md shadow-primary/20">
        <Bot size={15} className="text-white" />
      </div>
      <div className="px-4 py-3 rounded-2xl glass-card">
        <div className="flex gap-1.5 items-center h-5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
          {label && (
            <span className="ml-2 text-xs text-muted-foreground/80">{label}</span>
          )}
        </div>
      </div>
    </div>
  );
}
