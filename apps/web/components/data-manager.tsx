"use client";

import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import {
  Download,
  Upload,
  AlertTriangle,
  Trash2,
  Loader2,
  Database,
  Check,
} from "lucide-react";

// ===== Data Manager Component =====

export function DataManager({ expanded = true }: { expanded?: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStep, setResetStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearStatus = () => {
    setTimeout(() => {
      setStatus(null);
      setError(null);
    }, 3000);
  };

  const handleExport = async () => {
    setLoading("export");
    setError(null);
    try {
      const res = await fetch("/api/sessions/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agent-web-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("Sessions exported successfully.");
      clearStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
      clearStatus();
    } finally {
      setLoading(null);
    }
  };

  const handleImportSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLoading("import");
    setError(null);
    try {
      const res = await fetch("/api/sessions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await file.text(),
      });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      setStatus(
        data.sessions
          ? `Imported ${data.sessions} sessions successfully.`
          : "Import completed."
      );
      clearStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      clearStatus();
    } finally {
      setLoading(null);
    }
  };

  const handleClearMessages = async () => {
    setLoading("clear");
    setError(null);
    try {
      // Clear all messages for all sessions by hitting the sessions API
      const sessionsRes = await fetch("/api/sessions");
      if (!sessionsRes.ok) throw new Error("Failed to fetch sessions");
      const sessionsData = await sessionsRes.json();
      const sessions = sessionsData.sessions ?? [];

      for (const session of sessions) {
        await fetch(
          `/api/sessions/${encodeURIComponent(session.id)}/messages?clear=true`,
          { method: "DELETE" }
        );
      }

      setShowClearConfirm(false);
      setStatus("All messages cleared.");
      clearStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear messages.");
      clearStatus();
    } finally {
      setLoading(null);
    }
  };

  const handleResetEverything = async () => {
    setLoading("reset");
    setError(null);
    try {
      // Delete all sessions
      const sessionsRes = await fetch("/api/sessions");
      if (!sessionsRes.ok) throw new Error("Failed to fetch sessions");
      const sessionsData = await sessionsRes.json();
      const sessions = sessionsData.sessions ?? [];

      for (const session of sessions) {
        await fetch(
          `/api/sessions/${encodeURIComponent(session.id)}`,
          { method: "DELETE" }
        );
      }

      setShowResetConfirm(false);
      setResetStep(0);
      setStatus("Everything has been reset.");
      clearStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed.");
      clearStatus();
    } finally {
      setLoading(null);
    }
  };

  // Collapsed state
  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <Database size={16} className="text-[var(--muted-foreground)]" />
        <span className="font-mono text-[9px] text-[var(--dim-foreground)] uppercase tracking-wider">
          Data
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--dim-foreground)]">
          Data Management
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {/* Status / Error */}
        {status && (
          <div className="flex items-center gap-2 border border-[var(--success)]/30 bg-[var(--success)]/5 px-2.5 py-1.5">
            <Check size={10} className="shrink-0 text-[var(--success)]" />
            <p className="font-mono text-[9px] text-[var(--success)]">
              {status}
            </p>
          </div>
        )}
        {error && (
          <div className="border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-2.5 py-1.5">
            <p className="font-mono text-[9px] text-[var(--destructive)]">
              {error}
            </p>
          </div>
        )}

        {/* Export */}
        <div className="border border-[var(--border)] bg-[var(--overlay)] p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <Download size={12} className="text-[var(--primary)]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--foreground)]">
              Export Sessions
            </span>
          </div>
          <p className="mb-2 font-mono text-[9px] leading-relaxed text-[var(--muted-foreground)]">
            Download all sessions and messages as a JSON file.
          </p>
          <button
            onClick={handleExport}
            disabled={loading === "export"}
            className="flex w-full items-center justify-center gap-1.5 border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-[10px] font-semibold text-[var(--foreground)] transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--primary-muted)] hover:text-[var(--primary)] disabled:opacity-40"
          >
            {loading === "export" ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Download size={11} />
            )}
            Export All
          </button>
        </div>

        {/* Import */}
        <div className="border border-[var(--border)] bg-[var(--overlay)] p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <Upload size={12} className="text-[var(--info)]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--foreground)]">
              Import Sessions
            </span>
          </div>
          <p className="mb-2 font-mono text-[9px] leading-relaxed text-[var(--muted-foreground)]">
            Import sessions from a previously exported JSON file.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading === "import"}
            className="flex w-full items-center justify-center gap-1.5 border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-[10px] font-semibold text-[var(--foreground)] transition-all hover:border-[var(--info)]/40 hover:bg-[var(--info)]/10 hover:text-[var(--info)] disabled:opacity-40"
          >
            {loading === "import" ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Upload size={11} />
            )}
            Select File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportSelected}
            className="hidden"
          />
        </div>

        {/* Danger Zone */}
        <div className="border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={12} className="text-[var(--destructive)]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--destructive)]">
              Danger Zone
            </span>
          </div>

          {/* Clear All Messages */}
          {!showClearConfirm ? (
            <button
              onClick={() => {
                setShowClearConfirm(true);
                setShowResetConfirm(false);
              }}
              className="mb-2 flex w-full items-center justify-center gap-1.5 border border-[var(--destructive)]/40 px-3 py-1.5 text-[10px] font-semibold text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/10"
            >
              <Trash2 size={11} />
              Clear All Messages
            </button>
          ) : (
            <div className="mb-2 border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-2">
              <p className="mb-1.5 font-mono text-[9px] leading-relaxed text-[var(--destructive)]">
                This will remove all messages but keep session titles. This
                cannot be undone.
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={handleClearMessages}
                  disabled={loading === "clear"}
                  className="flex flex-1 items-center justify-center gap-1 bg-[var(--destructive)] px-2 py-1 text-[10px] font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90 disabled:opacity-40"
                >
                  {loading === "clear" ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Trash2 size={10} />
                  )}
                  Confirm Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reset Everything (Double Confirm) */}
          {!showResetConfirm ? (
            <button
              onClick={() => {
                setShowResetConfirm(true);
                setShowClearConfirm(false);
                setResetStep(1);
              }}
              className="flex w-full items-center justify-center gap-1.5 border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-1.5 text-[10px] font-semibold text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/20"
            >
              <AlertTriangle size={11} />
              Reset Everything
            </button>
          ) : (
            <div className="border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-2">
              {resetStep === 1 ? (
                <>
                  <p className="mb-1.5 font-mono text-[9px] leading-relaxed text-[var(--destructive)]">
                    This will permanently delete ALL sessions and data. This
                    cannot be undone.
                  </p>
                  <button
                    onClick={() => setResetStep(2)}
                    className="flex w-full items-center justify-center gap-1.5 border border-[var(--destructive)]/40 px-2 py-1.5 text-[10px] font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
                  >
                    <AlertTriangle size={10} />
                    I Understand, Continue
                  </button>
                  <button
                    onClick={() => {
                      setShowResetConfirm(false);
                      setResetStep(0);
                    }}
                    className="mt-1 flex w-full items-center justify-center border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-1.5 font-mono text-[9px] leading-relaxed text-[var(--destructive)]">
                    Final confirmation. Are you ABSOLUTELY sure?
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleResetEverything}
                      disabled={loading === "reset"}
                      className="flex flex-1 items-center justify-center gap-1 bg-[var(--destructive)] px-2 py-1 text-[10px] font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90 disabled:opacity-40"
                    >
                      {loading === "reset" ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <AlertTriangle size={10} />
                      )}
                      Yes, Delete Everything
                    </button>
                    <button
                      onClick={() => {
                        setShowResetConfirm(false);
                        setResetStep(0);
                      }}
                      className="border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
