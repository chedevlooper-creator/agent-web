"use client";

import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Check,
  Folder,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

export function SyncSettings() {
  const obsidianVaultPath = useChatStore((s) => s.obsidianVaultPath);
  const obsidianAutoSync = useChatStore((s) => s.obsidianAutoSync);
  const setObsidianVaultPath = useChatStore((s) => s.setObsidianVaultPath);
  const setObsidianAutoSync = useChatStore((s) => s.setObsidianAutoSync);
  const syncSessionToObsidian = useChatStore((s) => s.syncSessionToObsidian);

  const [vaultInput, setVaultInput] = useState(obsidianVaultPath || "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load config on mount
  useEffect(() => {
    if (configLoaded) return;
    fetch("/api/obsidian/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.vaultPath) {
          setVaultInput(data.vaultPath);
          setObsidianVaultPath(data.vaultPath);
        }
        setConfigLoaded(true);
      })
      .catch(() => {
        setConfigLoaded(true);
      });
  }, [configLoaded, setObsidianVaultPath]);

  const showStatus = useCallback(
    (type: "success" | "error" | "info", text: string) => {
      setStatusMsg({ type, text });
      if (statusTimer.current) clearTimeout(statusTimer.current);
      statusTimer.current = setTimeout(() => setStatusMsg(null), 5000);
    },
    []
  );

  const handleSavePath = useCallback(async () => {
    if (!vaultInput.trim()) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/obsidian/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPath: vaultInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setObsidianVaultPath(vaultInput.trim());
        showStatus("success", "Vault path saved");
      } else {
        showStatus("error", data.error || "Failed to save vault path");
      }
    } catch {
      showStatus("error", "Failed to connect to server");
    } finally {
      setSaving(false);
    }
  }, [vaultInput, setObsidianVaultPath, showStatus]);

  const handleClearPath = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/obsidian/config", { method: "DELETE" });
      setVaultInput("");
      setObsidianVaultPath("");
      showStatus("info", "Vault path cleared");
    } catch {
      showStatus("error", "Failed to clear vault path");
    } finally {
      setSaving(false);
    }
  }, [setObsidianVaultPath, showStatus]);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    setStatusMsg(null);
    try {
      // Get active session from store
      const state = useChatStore.getState();
      const activeId = state.activeSessionId;

      if (activeId) {
        const res = await fetch("/api/obsidian/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeId }),
        });
        const data = await res.json();
        if (res.ok) {
          showStatus("success", `Synced to: ${data.path}`);
        } else {
          showStatus("error", data.error || "Sync failed");
        }
      } else {
        showStatus("info", "No active session to sync");
      }
    } catch {
      showStatus("error", "Failed to sync");
    } finally {
      setSyncing(false);
    }
  }, [showStatus]);

  const handleSyncAll = useCallback(async () => {
    setSyncing(true);
    setStatusMsg(null);
    try {
      // Export all sessions from the server, then sync each one
      const exportRes = await fetch("/api/sessions/export");
      if (!exportRes.ok) {
        showStatus("error", "Failed to export sessions");
        setSyncing(false);
        return;
      }
      const payload = await exportRes.json();
      const sessions = payload.sessions || [];
      let synced = 0;
      let errors = 0;

      for (const s of sessions) {
        try {
          const res = await fetch("/api/obsidian/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: s.id }),
          });
          if (res.ok) synced++;
          else errors++;
        } catch {
          errors++;
        }
      }

      showStatus(
        "success",
        `Synced ${synced} session${synced !== 1 ? "s" : ""}${errors > 0 ? `, ${errors} error${errors !== 1 ? "s" : ""}` : ""}`
      );
    } catch {
      showStatus("error", "Failed to sync sessions");
    } finally {
      setSyncing(false);
    }
  }, [showStatus]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen size={14} className="text-muted-foreground" />
        <label className="section-label">Obsidian Sync</label>
      </div>

      {!configLoaded ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 size={12} className="animate-spin" />
          Loading configuration...
        </div>
      ) : (
        <>
          {/* Vault path input */}
          <div className="relative">
            <input
              id="obsidian-vault-path"
              type="text"
              value={vaultInput}
              onChange={(e) => setVaultInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePath();
              }}
              placeholder="C:/path/to/obsidian-vault"
              className={cn(
                "min-h-[40px] w-full pl-9 pr-8 rounded-xl text-sm",
                "bg-surface-muted border border-border-muted",
                "placeholder:text-muted-foreground/40",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
                "transition-[border-color,box-shadow,background-color] duration-200"
              )}
            />
            <Folder
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {vaultInput && (
                <button
                  type="button"
                  onClick={() => {
                    setVaultInput("");
                    setObsidianVaultPath("");
                  }}
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Clear vault path"
                  title="Clear vault path"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Save/Clear buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSavePath}
              disabled={saving || !vaultInput.trim()}
              className={cn(
                "min-h-[36px] flex-1 flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-medium transition-[opacity,transform,background-color] duration-200",
                "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              {saving ? "Saving..." : "Save Path"}
            </button>
            {obsidianVaultPath && (
              <button
                onClick={handleClearPath}
                disabled={saving}
                className={cn(
                  "min-h-[36px] flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-medium transition-all duration-200",
                  "bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-[0.98]",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                <Trash2 size={12} />
                Clear
              </button>
            )}
          </div>

          {/* Auto-sync toggle */}
          <div className="flex items-center justify-between glass-card px-4 py-3">
            <label htmlFor="obsidian-auto-sync" className="text-xs font-medium cursor-pointer">
              Auto-sync on new messages
            </label>
            <button
              id="obsidian-auto-sync"
              role="switch"
              aria-checked={obsidianAutoSync}
              onClick={() => setObsidianAutoSync(!obsidianAutoSync)}
              className={cn(
                "relative inline-flex min-h-[32px] w-12 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                obsidianAutoSync
                  ? "bg-electric shadow-[0_0_12px_rgba(176,226,39,0.12)]"
                  : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                  obsidianAutoSync ? "translate-x-3" : "-translate-x-3"
                )}
              />
            </button>
          </div>

          {/* Manual sync buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSyncNow}
              disabled={syncing || !obsidianVaultPath}
              className={cn(
                "min-h-[36px] flex-1 flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-medium transition-all duration-200",
                "border border-border/60 hover:bg-muted active:scale-[0.98]",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <RefreshCw
                size={12}
                className={syncing ? "animate-spin" : ""}
              />
              {syncing ? "Syncing..." : "Sync Active Session"}
            </button>
            <button
              onClick={handleSyncAll}
              disabled={syncing || !obsidianVaultPath}
              className={cn(
                "min-h-[36px] flex-1 flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-medium transition-all duration-200",
                "border border-border/60 hover:bg-muted active:scale-[0.98]",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <RefreshCw
                size={12}
                className={syncing ? "animate-spin" : ""}
              />
              {syncing ? "Syncing..." : "Sync All Sessions"}
            </button>
          </div>

          {/* Status message */}
          {statusMsg && (
            <p
              className={cn(
                "text-[11px] leading-relaxed",
                statusMsg.type === "success" && "text-success",
                statusMsg.type === "error" && "text-destructive",
                statusMsg.type === "info" && "text-muted-foreground"
              )}
            >
              {statusMsg.text}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
            {obsidianVaultPath
              ? "Chat sessions will be saved as Markdown notes in the Agent Web/ folder of your vault."
              : "Set your Obsidian vault path to automatically sync chat sessions as Markdown notes."}
          </p>
        </>
      )}
    </section>
  );
}
