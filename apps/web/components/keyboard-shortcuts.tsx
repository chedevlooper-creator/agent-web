"use client";

import { useEffect, useState, useCallback } from "react";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  label: string;
  category: "Navigation" | "Chat" | "Sessions" | "General";
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["Ctrl", "K"], label: "Search", category: "Navigation" },
  { keys: ["Ctrl", "N"], label: "New Chat", category: "Sessions" },
  { keys: ["Ctrl", ","], label: "Settings", category: "Navigation" },
  { keys: ["Enter"], label: "Send message", category: "Chat" },
  { keys: ["Shift", "Enter"], label: "New line", category: "Chat" },
  {
    keys: ["Ctrl", "Shift", "/"],
    label: "Show this help",
    category: "General",
  },
  { keys: ["?"], label: "Show this help", category: "General" },
  { keys: ["Escape"], label: "Close modals / sidebar", category: "General" },
];

const CATEGORIES = ["Navigation", "Chat", "Sessions", "General"] as const;

function Kbd({ keys }: { keys: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <span key={i}>
          <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] px-1.5 font-mono text-[10px] font-medium text-[var(--muted-foreground)] shadow-[inset_0_-1px_0_var(--border-strong)]">
            {key}
          </kbd>
          {i < keys.length - 1 && (
            <span className="mx-0.5 text-[10px] text-[var(--dim-foreground)]">
              +
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

interface KeyboardShortcutsProps {
  /** Optional custom trigger element */
  children?: React.ReactNode;
}

export function KeyboardShortcuts({ children }: KeyboardShortcutsProps) {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // ? key (when not in an input/textarea)
      if (
        e.key === "?" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // Ctrl+Shift+/ or Cmd+Shift+/
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key === "/"
      ) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // Escape to close
      if (e.key === "Escape" && open) {
        setOpen(false);
        e.preventDefault();
      }
    },
    [open],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* If children is provided, clicking it opens the dialog */}
      {children && (
        <div onClick={() => setOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(true); }}>
          {children}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center bg-[var(--primary-muted)]">
                  <Keyboard
                    size={15}
                    className="text-[var(--primary)]"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    Keyboard Shortcuts
                  </h2>
                  <p className="font-mono text-[10px] text-[var(--dim-foreground)]">
                    {SHORTCUTS.length} shortcuts available
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--overlay)] hover:text-[var(--foreground)]"
                aria-label="Close shortcuts"
              >
                <span className="text-xs">&times;</span>
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {CATEGORIES.map((category) => {
                const categoryShortcuts = SHORTCUTS.filter(
                  (s) => s.category === category,
                );
                if (categoryShortcuts.length === 0) return null;

                return (
                  <div key={category} className="mb-5 last:mb-0">
                    <h3 className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                      {category}
                    </h3>
                    <div className="space-y-1">
                      {categoryShortcuts.map((shortcut) => (
                        <div
                          key={shortcut.label}
                          className={cn(
                            "flex items-center justify-between",
                            "border border-[var(--border)] bg-[var(--overlay)] px-3 py-2",
                          )}
                        >
                          <span className="text-xs text-[var(--foreground)]">
                            {shortcut.label}
                          </span>
                          <Kbd keys={shortcut.keys} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border)] px-5 py-2.5">
              <p className="font-mono text-[10px] text-[var(--dim-foreground)]">
                Press <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] px-1 font-mono text-[9px] text-[var(--muted-foreground)]">?</kbd> or{" "}
                <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] px-1 font-mono text-[9px] text-[var(--muted-foreground)]">Ctrl</kbd>
                {" + "}
                <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] px-1 font-mono text-[9px] text-[var(--muted-foreground)]">Shift</kbd>
                {" + "}
                <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] px-1 font-mono text-[9px] text-[var(--muted-foreground)]">/</kbd> to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
