"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Search,
  Trash2,
  Pencil,
  X,
  Check,
  Loader2,
  Filter,
} from "lucide-react";

// ===== Types =====
interface Memory {
  id: string;
  userId: string | null;
  key: string;
  value: string;
  category: string;
  importance: number;
  context: string | null;
  createdAt: number;
  updatedAt: number;
}

interface MemoryManagerProps {
  expanded: boolean;
}

const CATEGORIES = [
  "all",
  "user_info",
  "preference",
  "fact",
  "task_context",
  "conversation_summary",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  user_info: "User Info",
  preference: "Preference",
  fact: "Fact",
  task_context: "Task Context",
  conversation_summary: "Summary",
};

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0)
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const IMPORTANCE_COLORS: Record<number, string> = {
  1: "bg-[var(--danger)]/20 text-[var(--danger)]",
  2: "bg-[var(--warning)]/20 text-[var(--warning)]",
  3: "bg-[var(--accent-css)]/20 text-[var(--accent-css)]",
  4: "bg-[var(--accent-dim)]/20 text-[var(--accent-dim)]",
  5: "bg-emerald-500/20 text-emerald-400",
  6: "bg-emerald-500/20 text-emerald-400",
  7: "bg-emerald-500/20 text-emerald-400",
  8: "bg-sky-500/20 text-sky-400",
  9: "bg-sky-500/20 text-sky-400",
  10: "bg-purple-500/20 text-purple-400",
};

export function MemoryManager({ expanded }: MemoryManagerProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editImportance, setEditImportance] = useState(3);
  const [editCategory, setEditCategory] = useState("fact");
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<string | null>(
    null
  );
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory");
      if (!res.ok) throw new Error("Failed to fetch memories");
      const data = (await res.json()) as { memories: Memory[] };
      setMemories(data.memories ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memories");
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchMemories();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchMemories]);

  const filtered = memories.filter((m) => {
    if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.key.toLowerCase().includes(q) ||
        m.value.toLowerCase().includes(q) ||
        (m.context ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleEdit = (m: Memory) => {
    setEditingKey(m.key);
    setEditValue(m.value);
    setEditImportance(m.importance);
    setEditCategory(m.category);
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          value: editValue,
          importance: editImportance,
          category: editCategory,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setEditingKey(null);
      await fetchMemories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save memory");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (key: string) => {
    setDeleting(key);
    try {
      const res = await fetch(`/api/memory?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setMemories((prev) => prev.filter((m) => m.key !== key));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete memory");
    } finally {
      setDeleting(null);
    }
  };

  const handleMaintenance = async () => {
    setMaintenanceLoading(true);
    setMaintenanceStatus(null);
    try {
      const res = await fetch("/api/memory/maintenance", { method: "POST" });
      if (!res.ok) throw new Error("Maintenance failed");
      const data = (await res.json()) as { deleted: number };
      setMaintenanceStatus(`Cleaned up ${data.deleted} expired memories.`);
      await fetchMemories();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Maintenance failed"
      );
    } finally {
      setMaintenanceLoading(false);
      setTimeout(() => setMaintenanceStatus(null), 3000);
    }
  };

  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 px-2">
        <Brain size={18} className="text-[var(--accent-css)]" />
        <span className="text-[10px] text-[var(--ink-faint)] text-center leading-tight">
          Memory
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--rule-soft)]">
        <Brain size={14} className="text-[var(--accent-css)] shrink-0" />
        <span className="text-xs font-medium text-[var(--ink)] tracking-wide uppercase">
          Memory
        </span>
        <span className="text-[10px] text-[var(--ink-faint)] ml-auto">
          {memories.length}
        </span>
      </div>

      {/* Search + Filter row */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        <div className="relative flex-1">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 pl-7 pr-2 text-[11px] bg-[var(--bg-elev)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              <X size={11} />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowCategoryMenu((v) => !v)}
            className={cn(
              "flex items-center gap-1 h-7 px-2 text-[11px] rounded border transition-colors",
              categoryFilter !== "all"
                ? "border-[var(--accent-css)]/40 text-[var(--accent-css)] bg-[var(--accent-css)]/10"
                : "border-[var(--rule-soft)] text-[var(--ink-faint)] hover:text-[var(--ink)] hover:border-[var(--ink-dim)]"
            )}
          >
            <Filter size={11} />
            <span className="hidden sm:inline">
              {CATEGORY_LABELS[categoryFilter] ?? categoryFilter}
            </span>
          </button>
          {showCategoryMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowCategoryMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-40 py-1 bg-[var(--bg-elev)] border border-[var(--rule-soft)] rounded-lg shadow-xl">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setCategoryFilter(cat);
                      setShowCategoryMenu(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-[11px] transition-colors",
                      categoryFilter === cat
                        ? "text-[var(--accent-css)] bg-[var(--accent-css)]/10"
                        : "text-[var(--ink)] hover:bg-[var(--bg-soft)]"
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Maintenance button */}
      <div className="px-2 pb-1">
        <button
          onClick={handleMaintenance}
          disabled={maintenanceLoading}
          className="flex items-center gap-1.5 w-full h-7 px-2 text-[10px] text-[var(--ink-faint)] border border-dashed border-[var(--rule-soft)] rounded hover:text-[var(--ink)] hover:border-[var(--ink-dim)] transition-colors disabled:opacity-50"
        >
          {maintenanceLoading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 12a9 9 0 1 0 9-9" />
              <path d="M3 3v4h4" />
            </svg>
          )}
          <span>
            {maintenanceLoading
              ? "Cleaning..."
              : "Run maintenance (cleanup TTL)"}
          </span>
        </button>
        {maintenanceStatus && (
          <div className="mt-1 text-[10px] text-emerald-400 px-1">
            {maintenanceStatus}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-2 mb-1 px-2 py-1 text-[10px] text-[var(--danger)] bg-[var(--danger)]/10 rounded">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 align-middle"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[var(--ink-faint)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[var(--ink-faint)]">
            <Brain size={20} className="opacity-40" />
            <span className="text-[11px]">
              {searchQuery || categoryFilter !== "all"
                ? "No matching memories"
                : "No memories yet"}
            </span>
            {!(searchQuery || categoryFilter !== "all") && (
              <span className="text-[10px] text-center max-w-[200px]">
                Memories are automatically extracted from conversations when
                ENABLE_MEMORY is on.
              </span>
            )}
          </div>
        ) : (
          filtered.map((m) => (
            <div
              key={m.key}
              className="group relative rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/60 hover:bg-[var(--bg-elev)] transition-colors"
            >
              {editingKey === m.key ? (
                /* Edit mode */
                <div className="p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-[var(--ink-faint)] truncate flex-1">
                      {m.key}
                    </span>
                    <button
                      onClick={() => setEditingKey(null)}
                      className="text-[var(--ink-faint)] hover:text-[var(--ink)]"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={2}
                    className="w-full text-[11px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded px-1.5 py-1 text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none resize-none focus:border-[var(--accent-css)]/40 transition-colors"
                    placeholder="Value"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-[var(--ink-faint)]">
                        Importance:
                      </span>
                      <select
                        value={editImportance}
                        onChange={(e) =>
                          setEditImportance(Number(e.target.value))
                        }
                        className="text-[10px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded px-1 py-0.5 text-[var(--ink)] outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-[var(--ink-faint)]">
                        Category:
                      </span>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="text-[10px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded px-1 py-0.5 text-[var(--ink)] outline-none"
                      >
                        {CATEGORIES.filter((c) => c !== "all").map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditingKey(null)}
                      className="px-2 py-1 text-[10px] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(m.key)}
                      disabled={saving === m.key}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] bg-[var(--accent-css)]/20 text-[var(--accent-css)] rounded hover:bg-[var(--accent-css)]/30 transition-colors disabled:opacity-50"
                    >
                      {saving === m.key ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Check size={10} />
                      )}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="p-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-mono font-medium text-[var(--ink)] truncate">
                          {m.key}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1 rounded",
                            IMPORTANCE_COLORS[m.importance] ??
                              "bg-[var(--bg-soft)] text-[var(--ink-faint)]"
                          )}
                        >
                          {m.importance}
                        </span>
                        <span className="text-[9px] text-[var(--ink-faint)] bg-[var(--bg-soft)] px-1 rounded">
                          {CATEGORY_LABELS[m.category] ?? m.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--ink-dim)] leading-relaxed line-clamp-2">
                        {m.value}
                      </p>
                      {m.context && (
                        <p className="text-[9px] text-[var(--ink-faint)] mt-0.5 italic line-clamp-1">
                          {m.context}
                        </p>
                      )}
                      <span className="text-[9px] text-[var(--ink-faint)] mt-0.5 block">
                        {formatDate(m.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleEdit(m)}
                        className="flex h-6 w-6 items-center justify-center text-[var(--ink-faint)] hover:text-[var(--accent-css)] hover:bg-[var(--accent-css)]/10 rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete memory "${m.key}"? This cannot be undone.`
                            )
                          ) {
                            handleDelete(m.key);
                          }
                        }}
                        disabled={deleting === m.key}
                        className="flex h-6 w-6 items-center justify-center text-[var(--ink-faint)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === m.key ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Trash2 size={11} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
