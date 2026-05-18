"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Plus,
  Trash2,
  Play,
  ToggleLeft,
  ToggleRight,
  Loader2,
  X,
} from "lucide-react";

// ===== Types =====
interface ScheduledTask {
  id: string;
  name: string;
  agentId: string | null;
  prompt: string;
  cronExpr: string;
  enabled: number;
  lastRunAt: number | null;
  nextRunAt: number;
}

interface ScheduleManagerProps {
  expanded: boolean;
}

function formatDate(ms: number | null): string {
  if (ms === null) return "—";
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

const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Weekly on Monday", value: "0 0 * * 1" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
];

export function ScheduleManager({ expanded }: ScheduleManagerProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formCron, setFormCron] = useState("0 * * * *");
  const [formAgentId, setFormAgentId] = useState("");
  const [creating, setCreating] = useState(false);

  // Execution state
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule");
      if (!res.ok) throw new Error("Failed to fetch scheduled tasks");
      const data = (await res.json()) as { tasks: ScheduledTask[] };
      setTasks(data.tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTasks();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchTasks]);

  const handleCreate = async () => {
    if (!formName.trim() || !formPrompt.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          prompt: formPrompt.trim(),
          cronExpr: formCron,
          agentId: formAgentId.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      setShowForm(false);
      setFormName("");
      setFormPrompt("");
      setFormCron("0 * * * *");
      setFormAgentId("");
      await fetchTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (task: ScheduledTask) => {
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          enabled: !task.enabled,
        }),
      });
      if (!res.ok) throw new Error("Failed to toggle task");
      await fetchTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle task");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this scheduled task?")) return;
    try {
      const res = await fetch(`/api/schedule?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task");
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete task");
    }
  };

  const handleRunNow = async (task: ScheduledTask) => {
    setRunningTaskId(task.id);
    try {
      const res = await fetch("/api/schedule/tick", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to run task");
      await fetchTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run task");
    } finally {
      setRunningTaskId(null);
    }
  };

  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 px-2">
        <Clock size={18} className="text-[var(--accent-css)]" />
        <span className="text-[10px] text-[var(--ink-faint)] text-center leading-tight">
          Schedule
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--rule-soft)]">
        <Clock size={14} className="text-[var(--accent-css)] shrink-0" />
        <span className="text-xs font-medium text-[var(--ink)] tracking-wide uppercase">
          Schedule
        </span>
        <span className="text-[10px] text-[var(--ink-faint)] ml-auto">
          {tasks.length}
        </span>
      </div>

      {/* Create button */}
      <div className="px-2 pt-2 pb-1">
        <button
          onClick={() => {
            setShowForm(true);
            setError(null);
          }}
          className="flex items-center gap-1.5 w-full h-7 px-2 text-[11px] text-[var(--ink-faint)] border border-dashed border-[var(--rule-soft)] rounded hover:text-[var(--ink)] hover:border-[var(--ink-dim)] transition-colors"
        >
          <Plus size={12} />
          <span>New scheduled task</span>
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mx-2 mb-2 p-2 rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[var(--ink-dim)] uppercase tracking-wide">
              New Task
            </span>
            <button
              onClick={() => setShowForm(false)}
              className="text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              <X size={12} />
            </button>
          </div>

          <div>
            <label className="text-[9px] text-[var(--ink-faint)] block mb-0.5">Name</label>
            <input
              type="text"
              placeholder="e.g. Daily summary"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full h-7 px-2 text-[11px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-[9px] text-[var(--ink-faint)] block mb-0.5">Prompt</label>
            <textarea
              placeholder="What should the agent do?"
              value={formPrompt}
              onChange={(e) => setFormPrompt(e.target.value)}
              rows={2}
              className="w-full text-[11px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded px-2 py-1 text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none resize-none focus:border-[var(--accent-css)]/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-[9px] text-[var(--ink-faint)] block mb-0.5">Cron Expression</label>
            <div className="flex gap-1 flex-wrap mb-1">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setFormCron(p.value)}
                  className={cn(
                    "px-1.5 py-0.5 text-[9px] rounded border transition-colors",
                    formCron === p.value
                      ? "border-[var(--accent-css)]/40 text-[var(--accent-css)] bg-[var(--accent-css)]/10"
                      : "border-[var(--rule-soft)] text-[var(--ink-faint)] hover:border-[var(--ink-dim)] hover:text-[var(--ink)]"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="0 * * * *"
              value={formCron}
              onChange={(e) => setFormCron(e.target.value)}
              className="w-full h-7 px-2 text-[11px] font-mono bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-[9px] text-[var(--ink-faint)] block mb-0.5">Agent ID (optional)</label>
            <input
              type="text"
              placeholder="Leave empty for default"
              value={formAgentId}
              onChange={(e) => setFormAgentId(e.target.value)}
              className="w-full h-7 px-2 text-[11px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50 transition-colors"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !formName.trim() || !formPrompt.trim()}
            className="flex items-center justify-center gap-1 w-full h-7 text-[11px] bg-[var(--accent-css)]/20 text-[var(--accent-css)] rounded hover:bg-[var(--accent-css)]/30 transition-colors disabled:opacity-50"
          >
            {creating ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Plus size={11} />
            )}
            Create Task
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-2 mb-1 px-2 py-1 text-[10px] text-[var(--danger)] bg-[var(--danger)]/10 rounded">
          {error}
          <button onClick={() => setError(null)} className="ml-2 align-middle">
            <X size={10} />
          </button>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[var(--ink-faint)]" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[var(--ink-faint)]">
            <Clock size={20} className="opacity-40" />
            <span className="text-[11px]">No scheduled tasks</span>
            <span className="text-[10px] text-center max-w-[200px]">
              Create scheduled tasks to run prompts automatically on a cron
              schedule.
            </span>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="group relative rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/60 hover:bg-[var(--bg-elev)] transition-colors"
            >
              <div className="p-2">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    {/* Name + status */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-medium text-[var(--ink)] truncate">
                        {task.name}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] px-1 rounded",
                          task.enabled
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-[var(--bg-soft)] text-[var(--ink-faint)]"
                        )}
                      >
                        {task.enabled ? "active" : "paused"}
                      </span>
                    </div>

                    {/* Prompt preview */}
                    <p className="text-[11px] text-[var(--ink-dim)] leading-relaxed line-clamp-2 mb-1">
                      {task.prompt}
                    </p>

                    {/* Cron + timing */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono text-[var(--accent-css)] bg-[var(--accent-css)]/10 px-1 rounded">
                        {task.cronExpr}
                      </span>
                      <span className="text-[9px] text-[var(--ink-faint)]">
                        Last: {formatDate(task.lastRunAt)}
                      </span>
                      <span className="text-[9px] text-[var(--ink-faint)]">
                        Next: {formatDate(task.nextRunAt)}
                      </span>
                    </div>

                    {task.agentId && (
                      <span className="text-[9px] text-[var(--ink-faint)] mt-0.5 block">
                        Agent: {task.agentId}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleRunNow(task)}
                      disabled={runningTaskId === task.id}
                      className="flex h-6 w-6 items-center justify-center text-[var(--ink-faint)] hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
                      title="Run now"
                    >
                      {runningTaskId === task.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Play size={11} />
                      )}
                    </button>
                    <button
                      onClick={() => handleToggle(task)}
                      className="flex h-6 w-6 items-center justify-center text-[var(--ink-faint)] hover:text-[var(--accent-css)] hover:bg-[var(--accent-css)]/10 rounded transition-colors"
                      title={task.enabled ? "Disable" : "Enable"}
                    >
                      {task.enabled ? (
                        <ToggleRight size={11} />
                      ) : (
                        <ToggleLeft size={11} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="flex h-6 w-6 items-center justify-center text-[var(--ink-faint)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
