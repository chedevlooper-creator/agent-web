"use client";

import { useState, useMemo } from "react";
import { useChatStore } from "@/lib/store";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BranchIndicatorProps {
  messageId: string;
  className?: string;
}

export function BranchIndicator({ messageId, className }: BranchIndicatorProps) {
  const sessions = useChatStore((s) => s.sessions);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const [open, setOpen] = useState(false);

  // Find branch sessions where this message is the branchRootId
  const branchSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (!s.branchId) return false;
      return s.messages.some((m) => m.branchRootId === messageId);
    });
  }, [sessions, messageId]);

  if (branchSessions.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative inline-flex", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="h-6 w-6 text-xs text-[var(--accent)] hover:bg-[var(--accent-muted)]"
        onClick={() => setOpen(!open)}
        aria-label={`${branchSessions.length} branches`}
      >
        <GitBranch size={12} />
        <span className="ml-0.5 text-[10px] font-mono">{branchSessions.length}</span>
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-50 mb-2 min-w-[200px] border border-[var(--border-strong)] bg-[var(--surface-elevated)] shadow-lg animate-slide-up">
            <div className="border-b border-[var(--border)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Branches
            </div>
            <div className="py-1">
              {branchSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSession(s.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--overlay)] transition-colors"
                >
                  <GitBranch size={12} className="shrink-0 text-[var(--accent)]" />
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
