"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Layers,
  Plus,
  Trash2,
  X,
  Loader2,
  Pencil,
  Check,
  Play,
  GitBranch,
  ListTree,
  Bot,
} from "lucide-react";

// ===== Types =====
interface AgentPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string;
  avatar: string | null;
  systemPrompt: string;
  tools: string;
  model: string | null;
  provider: string | null;
  temperature: number | null;
  featured: boolean;
  installs: number;
  createdAt: number;
  updatedAt: number;
}

interface InstalledAgent {
  id: string;
  userId: string;
  presetId: string;
  customName: string | null;
  customPrompt: string | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  preset: AgentPreset;
}

interface AgentGroupMember {
  presetId: string;
  role: string;
  order: number;
}

interface AgentGroup {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  agents: string; // JSON string of AgentGroupMember[]
  strategy: string;
  createdAt: number;
  updatedAt: number;
}

interface AgentGroupEditorProps {
  expanded: boolean;
}

const STRATEGIES = [
  { value: "parallel", label: "Parallel", icon: "≡" },
  { value: "sequential", label: "Sequential", icon: "→" },
];

const STRATEGY_ICONS: Record<string, string> = {
  parallel: "≡",
  sequential: "→",
};

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0)
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AgentGroupEditor({ expanded }: AgentGroupEditorProps) {
  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [installedAgents, setInstalledAgents] = useState<InstalledAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStrategy, setNewStrategy] = useState("parallel");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStrategy, setEditStrategy] = useState("");
  const [editAgentIds, setEditAgentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  // Run state
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [showRunOutput, setShowRunOutput] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      const data = (await res.json()) as { groups: AgentGroup[] };
      setGroups(data.groups ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load groups");
      setGroups([]);
    }
  }, []);

  const fetchInstalledAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/installed");
      if (!res.ok) throw new Error("Failed to fetch installed agents");
      const data = (await res.json()) as { agents: InstalledAgent[] };
      setInstalledAgents(data.agents ?? []);
    } catch {
      // Silently fail — installed agents may not be available
      setInstalledAgents([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchGroups(), fetchInstalledAgents()]).finally(() =>
      setLoading(false),
    );
  }, [fetchGroups, fetchInstalledAgents]);

  const toggleAgentSelection = (presetId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(presetId)
        ? prev.filter((id) => id !== presetId)
        : [...prev, presetId],
    );
  };

  const toggleEditAgentSelection = (presetId: string) => {
    setEditAgentIds((prev) =>
      prev.includes(presetId)
        ? prev.filter((id) => id !== presetId)
        : [...prev, presetId],
    );
  };

  const handleCreate = async () => {
    if (!newName.trim() || selectedAgentIds.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/agent-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          agentIds: selectedAgentIds,
          strategy: newStrategy,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create group");
      }
      setNewName("");
      setNewDescription("");
      setNewStrategy("parallel");
      setSelectedAgentIds([]);
      setShowCreateForm(false);
      await fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (group: AgentGroup) => {
    setEditingId(group.id);
    setEditName(group.name);
    setEditDescription(group.description ?? "");
    setEditStrategy(group.strategy);
    const members: AgentGroupMember[] = JSON.parse(group.agents);
    setEditAgentIds(members.map((m) => m.presetId));
  };

  const handleSave = async (id: string) => {
    setSaving(id);
    setError(null);
    try {
      const res = await fetch("/api/agent-groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: editName.trim(),
          description: editDescription.trim() || null,
          agentIds: editAgentIds,
          strategy: editStrategy,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setEditingId(null);
      await fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save group");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/agent-groups?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete group");
    } finally {
      setDeleting(null);
    }
  };

  const handleRun = async (group: AgentGroup) => {
    setRunningId(group.id);
    setRunOutput(null);
    setShowRunOutput(true);
    try {
      const members: AgentGroupMember[] = JSON.parse(group.agents);
      // Collect prompt from each agent preset
      const agents = members.map((m) => {
        const installed = installedAgents.find(
          (a) => a.presetId === m.presetId,
        );
        const prompt =
          installed?.customPrompt ??
          installed?.preset.systemPrompt ??
          "You are a helpful assistant.";
        return {
          presetId: m.presetId,
          systemPrompt: prompt,
          tools: installed?.preset.tools ?? "",
          model: installed?.preset.model ?? null,
          provider: installed?.preset.provider ?? null,
          temperature: installed?.preset.temperature ?? null,
        };
      });

      const res = await fetch("/api/agent-groups/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.id,
          strategy: group.strategy,
          agents,
          message: "Execute the group task.",
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to run group");
      }

      const data = (await res.json()) as { agentResults: Array<{ agentId: string; output: string }>; combined: string };
      setRunOutput(data.combined);
    } catch (e) {
      setRunOutput(
        `[Error: ${e instanceof Error ? e.message : "Failed to run group"}]`,
      );
    } finally {
      setRunningId(null);
    }
  };

  const getAgentLabel = (presetId: string): string => {
    const agent = installedAgents.find((a) => a.presetId === presetId);
    return agent?.customName ?? agent?.preset.name ?? presetId;
  };

  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 px-2">
        <Layers size={18} className="text-[var(--accent-css)]" />
        <span className="text-[10px] text-[var(--ink-faint)] text-center leading-tight">
          Groups
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--rule-soft)]">
        <Layers size={14} className="text-[var(--accent-css)] shrink-0" />
        <span className="text-xs font-medium text-[var(--ink)] tracking-wide uppercase">
          Agent Groups
        </span>
        <span className="text-[10px] text-[var(--ink-faint)] ml-auto">
          {groups.length}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-2 mt-1 mb-0 px-2 py-1 text-[10px] text-[var(--danger)] bg-[var(--danger)]/10 rounded">
          {error}
          <button onClick={() => setError(null)} className="ml-2 align-middle">
            <X size={10} />
          </button>
        </div>
      )}

      {/* Create button / form */}
      <div className="px-2 pt-2 pb-1">
        {showCreateForm ? (
          <div className="space-y-2 p-2 border border-[var(--rule-soft)] rounded-lg bg-[var(--bg-elev)]/60">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-[var(--ink)] uppercase tracking-wide">
                New Group
              </span>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X size={12} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Group name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full h-7 px-2 text-[11px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50 transition-colors"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full h-7 px-2 text-[11px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50 transition-colors"
            />

            {/* Strategy selector */}
            <div className="flex gap-1">
              {STRATEGIES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setNewStrategy(s.value)}
                  className={cn(
                    "flex items-center gap-1 flex-1 h-7 px-2 text-[10px] rounded border transition-colors",
                    newStrategy === s.value
                      ? "border-[var(--accent-css)]/40 text-[var(--accent-css)] bg-[var(--accent-css)]/10"
                      : "border-[var(--rule-soft)] text-[var(--ink-faint)] hover:text-[var(--ink)]",
                  )}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Agent selector */}
            <div>
              <span className="text-[9px] text-[var(--ink-faint)] uppercase tracking-wide block mb-1">
                Select Agents ({selectedAgentIds.length})
              </span>
              <div className="max-h-28 overflow-y-auto space-y-0.5">
                {installedAgents
                  .filter((a) => a.enabled)
                  .map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgentSelection(agent.presetId)}
                      className={cn(
                        "flex items-center gap-1.5 w-full px-1.5 py-1 text-[10px] rounded transition-colors text-left",
                        selectedAgentIds.includes(agent.presetId)
                          ? "bg-[var(--accent-css)]/10 text-[var(--accent-css)]"
                          : "text-[var(--ink-dim)] hover:bg-[var(--bg-soft)]",
                      )}
                    >
                      <Bot size={10} className="shrink-0" />
                      <span className="truncate">
                        {agent.customName ?? agent.preset.name}
                      </span>
                    </button>
                  ))}
                {installedAgents.filter((a) => a.enabled).length === 0 && (
                  <span className="text-[10px] text-[var(--ink-faint)] italic">
                    No enabled agents installed
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={
                creating || !newName.trim() || selectedAgentIds.length === 0
              }
              className="flex items-center justify-center gap-1 w-full h-7 text-[10px] bg-[var(--accent-css)]/20 text-[var(--accent-css)] rounded hover:bg-[var(--accent-css)]/30 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Check size={10} />
              )}
              Create Group
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 w-full h-7 px-2 text-[10px] text-[var(--ink-faint)] border border-dashed border-[var(--rule-soft)] rounded hover:text-[var(--ink)] hover:border-[var(--ink-dim)] transition-colors"
          >
            <Plus size={11} />
            <span>New Agent Group</span>
          </button>
        )}
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[var(--ink-faint)]" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[var(--ink-faint)]">
            <Layers size={20} className="opacity-40" />
            <span className="text-[11px]">No agent groups yet</span>
            <span className="text-[10px] text-center max-w-[200px]">
              Create groups of agents to run together in parallel or sequence.
            </span>
          </div>
        ) : (
          groups.map((group) => {
            const members: AgentGroupMember[] = JSON.parse(group.agents);
            const isEditing = editingId === group.id;

            if (isEditing) {
              return (
                <div
                  key={group.id}
                  className="rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/60 p-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-6 px-1.5 text-[11px] font-medium bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] outline-none focus:border-[var(--accent-css)]/50"
                    />
                    <button
                      onClick={() => setEditingId(null)}
                      className="ml-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full h-6 px-1.5 text-[10px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50"
                  />
                  <div className="flex gap-1">
                    {STRATEGIES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setEditStrategy(s.value)}
                        className={cn(
                          "flex items-center gap-1 flex-1 h-6 px-2 text-[10px] rounded border transition-colors",
                          editStrategy === s.value
                            ? "border-[var(--accent-css)]/40 text-[var(--accent-css)] bg-[var(--accent-css)]/10"
                            : "border-[var(--rule-soft)] text-[var(--ink-faint)]",
                        )}
                      >
                        <span>{s.icon}</span>
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--ink-faint)] block mb-0.5">
                      Agents ({editAgentIds.length})
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-0.5">
                      {installedAgents
                        .filter((a) => a.enabled)
                        .map((agent) => (
                          <button
                            key={agent.id}
                            onClick={() =>
                              toggleEditAgentSelection(agent.presetId)
                            }
                            className={cn(
                              "flex items-center gap-1.5 w-full px-1.5 py-0.5 text-[10px] rounded transition-colors text-left",
                              editAgentIds.includes(agent.presetId)
                                ? "bg-[var(--accent-css)]/10 text-[var(--accent-css)]"
                                : "text-[var(--ink-dim)] hover:bg-[var(--bg-soft)]",
                            )}
                          >
                            <Bot size={9} className="shrink-0" />
                            <span className="truncate">
                              {agent.customName ?? agent.preset.name}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-1 pt-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-[10px] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(group.id)}
                      disabled={saving === group.id}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] bg-[var(--accent-css)]/20 text-[var(--accent-css)] rounded hover:bg-[var(--accent-css)]/30 transition-colors disabled:opacity-50"
                    >
                      {saving === group.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Check size={10} />
                      )}
                      Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={group.id}
                className="group relative rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/60 hover:bg-[var(--bg-elev)] transition-colors"
              >
                <div className="p-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-medium text-[var(--ink)] truncate">
                          {group.name}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1 rounded inline-flex items-center gap-0.5",
                            group.strategy === "parallel"
                              ? "bg-sky-500/10 text-sky-400"
                              : "bg-amber-500/10 text-amber-400",
                          )}
                        >
                          <span>
                            {group.strategy === "parallel" ? "≡" : "→"}
                          </span>
                          <span>{group.strategy}</span>
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-[10px] text-[var(--ink-dim)] leading-relaxed line-clamp-1">
                          {group.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {members.map((m, i) => (
                          <span
                            key={m.presetId}
                            className="text-[9px] text-[var(--ink-faint)] bg-[var(--bg-soft)] px-1 rounded inline-flex items-center gap-0.5"
                          >
                            <Bot size={8} />
                            <span>{getAgentLabel(m.presetId)}</span>
                            {i < members.length - 1 && (
                              <span className="text-[var(--ink-faint)] opacity-50">
                                {group.strategy === "sequential" ? "→" : "|"}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                      <span className="text-[9px] text-[var(--ink-faint)] mt-0.5 block">
                        {formatDate(group.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleRun(group)}
                        disabled={runningId === group.id}
                        className="flex h-6 w-6 items-center justify-center text-[var(--ink-faint)] hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
                        title="Run group"
                      >
                        {runningId === group.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Play size={11} />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(group)}
                        className="flex h-6 w-6 items-center justify-center text-[var(--ink-faint)] hover:text-[var(--accent-css)] hover:bg-[var(--accent-css)]/10 rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete group "${group.name}"? This cannot be undone.`,
                            )
                          ) {
                            handleDelete(group.id);
                          }
                        }}
                        disabled={deleting === group.id}
                        className="flex h-6 w-6 items-center justify-center text-[var(--ink-faint)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === group.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Trash2 size={11} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Run output overlay */}
      {showRunOutput && (
        <div className="border-t border-[var(--rule-soft)] bg-[var(--bg-elev)]">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] font-medium text-[var(--ink)]">
              Run Output
            </span>
            <button
              onClick={() => {
                setShowRunOutput(false);
                setRunOutput(null);
              }}
              className="text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              <X size={12} />
            </button>
          </div>
          <div className="px-3 pb-2 max-h-40 overflow-y-auto">
            {runningId ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={12} className="animate-spin text-[var(--accent-css)]" />
                <span className="text-[10px] text-[var(--ink-faint)]">
                  Running agents...
                </span>
              </div>
            ) : (
              <pre className="text-[10px] text-[var(--ink-dim)] whitespace-pre-wrap font-sans leading-relaxed">
                {runOutput}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
