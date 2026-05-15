"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { eventToShortcutString, matchAnyShortcut } from "@/lib/shortcuts-config";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface ShortcutKeyRecorderProps {
  /** Current shortcut strings (e.g. ["Ctrl+B"]) */
  currentKeys: readonly string[];
  /** Default shortcut strings to show reset target */
  defaultKeys: readonly string[];
  /** Called with new array of shortcut strings */
  onSave: (keys: string[]) => void;
  /** Called to reset to defaults */
  onReset: () => void;
  /** Whether this shortcut collides with another */
  hasConflict?: boolean;
  /** IDs of conflicting shortcuts (for display) */
  conflictIds?: string[];
}

export function ShortcutKeyRecorder({
  currentKeys,
  defaultKeys,
  onSave,
  onReset,
  hasConflict,
}: ShortcutKeyRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [tempKeys, setTempKeys] = useState<string[]>([]);
  const inputRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isChanged =
    JSON.stringify([...currentKeys].sort()) !==
    JSON.stringify([...defaultKeys].sort());

  const handleStartRecording = useCallback(() => {
    setRecording(true);
    setTempKeys([]);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!recording) return;

      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only presses
      if (
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Shift" ||
        e.key === "Meta"
      ) {
        return;
      }

      const shortcutStr = eventToShortcutString(e.nativeEvent);

      // Add to temp keys (avoid duplicates)
      setTempKeys((prev) => {
        if (prev.includes(shortcutStr)) return prev;
        const next = [...prev, shortcutStr];
        return next;
      });
    },
    [recording]
  );

  const handleConfirm = useCallback(() => {
    if (tempKeys.length > 0) {
      onSave(tempKeys);
    }
    setRecording(false);
    setTempKeys([]);
  }, [tempKeys, onSave]);

  const handleCancel = useCallback(() => {
    setRecording(false);
    setTempKeys([]);
  }, []);

  // Auto-confirm when recording a single key (user releases)
  useEffect(() => {
    if (!recording || tempKeys.length === 0) return;

    // Give a tiny delay to allow multi-key combos
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      handleConfirm();
    }, 600);
  }, [recording, tempKeys, handleConfirm]);

  const displayKeys = recording && tempKeys.length > 0 ? tempKeys : currentKeys;

  return (
    <div className="flex items-center gap-2">
      <button
        ref={inputRef}
        type="button"
        onClick={handleStartRecording}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (recording && tempKeys.length === 0) {
            setRecording(false);
          }
        }}
        className={`
          flex items-center gap-1 min-w-[100px] h-8 px-2.5 rounded-lg
          border text-xs font-mono transition-all duration-200
          ${
            recording
              ? "border-primary/50 bg-primary/5 text-primary ring-1 ring-primary/20"
              : hasConflict
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-border/50 bg-surface-muted/50 text-foreground hover:border-border"
          }
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30
        `}
        aria-label="Click to record shortcut"
      >
        {recording && tempKeys.length === 0 ? (
          <span className="text-muted-foreground animate-pulse">
            Tuşlara basın...
          </span>
        ) : (
          <>
            {displayKeys.map((k, i) => (
              <span key={k} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="text-[10px] text-muted-foreground/40">/</span>
                )}
                <kbd className="rounded border border-border/30 bg-background px-1.5 py-0.5 text-[10px] font-medium">
                  {k}
                </kbd>
              </span>
            ))}
          </>
        )}
      </button>

      {isChanged && !recording && (
        <button
          type="button"
          onClick={onReset}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-surface-muted transition-all"
          aria-label="Varsayılana dön"
          title="Varsayılana dön"
        >
          <RotateCcw size={12} />
        </button>
      )}

      {recording && tempKeys.length > 0 && (
        <>
          <button
            type="button"
            onClick={handleConfirm}
            className="h-7 px-2.5 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20"
          >
            Onayla
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="h-7 px-2.5 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-all"
          >
            İptal
          </button>
        </>
      )}
    </div>
  );
}
