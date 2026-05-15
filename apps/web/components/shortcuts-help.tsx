"use client";

import { useEffect } from "react";
import { useChatStore } from "@/lib/store";
import { getCategoriesWithShortcuts } from "@/lib/shortcuts-config";
import { X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export interface ShortcutItem {
  keys: string[];
  description: string;
}

export interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutItem[];
}

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
  categories?: ShortcutCategory[];
}



function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border/30 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70">
      {children}
    </kbd>
  );
}

export function ShortcutsHelp({ open, onClose, categories }: ShortcutsHelpProps) {
  const shortcutOverrides = useChatStore((s) => s.shortcutOverrides);
  const items = categories ?? getCategoriesWithShortcuts(shortcutOverrides);

  // Focus the close button when dialog opens
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const container = document.querySelector('[data-shortcuts-dialog="true"]');
      const closeBtn = container?.querySelector<HTMLButtonElement>(
        'button[aria-label="Kapat"]'
      );
      closeBtn?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  return (
    <div
      data-shortcuts-dialog="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Klavye kısayolları"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-border/40 bg-card p-5 shadow-xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            Klavye Kısayolları
          </h3>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center"
            aria-label="Kapat"
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
          {items.map((category) => (
            <div key={category.title}>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {category.title}
              </h4>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys.join("-")}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={key} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-[10px] text-muted-foreground/40">
                              /
                            </span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Separator className="my-3" />
        <p className="text-[10px] text-muted-foreground/40 text-center">
          Kısayollar yalnızca metin girişi odakta değilken çalışır
        </p>
      </div>
    </div>
  );
}
