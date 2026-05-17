"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  Languages,
  Sparkles,
  BookOpen,
  PenLine,
  MessageSquareMore,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageAction {
  type: string;
  label: string;
  icon: typeof Sparkles;
  description: string;
}

const ACTIONS: MessageAction[] = [
  {
    type: "summarize",
    label: "Summarize",
    icon: Sparkles,
    description: "Condense the message",
  },
  {
    type: "translate-en",
    label: "Translate to English",
    icon: Languages,
    description: "Translate to English",
  },
  {
    type: "translate-tr",
    label: "Translate to Turkish",
    icon: BookOpen,
    description: "Translate to Turkish",
  },
  {
    type: "improve",
    label: "Improve writing",
    icon: PenLine,
    description: "Polish clarity and style",
  },
  {
    type: "explain",
    label: "Explain",
    icon: MessageSquareMore,
    description: "Simplify and explain",
  },
];

interface MessageActionsProps {
  content: string;
  onAction: (type: string, content: string) => void;
  className?: string;
  children?: ReactNode;
}

export function MessageActions({
  content,
  onAction,
  className,
  children,
}: MessageActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (type: string) => {
    onAction(type, content);
    setOpen(false);
  };

  return (
    <div ref={menuRef} className={cn("relative inline-flex", className)}>
      {children ? (
        <div onClick={() => setOpen(!open)}>{children}</div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-6 w-6 items-center justify-center",
            "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            "hover:bg-[var(--overlay)] transition-colors",
          )}
          aria-label="Message actions"
          aria-expanded={open}
        >
          <Sparkles size={14} />
        </button>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 min-w-[200px] border border-[var(--border-strong)] bg-[var(--surface-elevated)] shadow-lg animate-slide-up">
            <div className="border-b border-[var(--border)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Enhance
            </div>
            <div className="py-1">
              {ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.type}
                    onClick={() => handleSelect(action.type)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs transition-colors hover:bg-[var(--overlay)]"
                  >
                    <Icon
                      size={14}
                      className="shrink-0 text-[var(--primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-[var(--foreground)]">
                        {action.label}
                      </div>
                      <div className="truncate text-[10px] text-[var(--dim-foreground)]">
                        {action.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
