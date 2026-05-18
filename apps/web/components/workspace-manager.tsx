"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Trash2,
  UserPlus,
  UserMinus,
  Loader2,
  Shield,
  ShieldCheck,
  X,
} from "lucide-react";

// ===== Types =====
interface TeamMember {
  userId: string;
  role: string;
  username: string | null;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  members: TeamMember[];
  myRole: string;
}

interface WorkspaceManagerProps {
  expanded: boolean;
}

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

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: "bg-amber-500/20 text-amber-400",
    admin: "bg-sky-500/20 text-sky-400",
    member: "bg-[var(--bg-soft)] text-[var(--ink-faint)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium",
        colors[role] ?? colors.member
      )}
    >
      {role === "owner" && <ShieldCheck size={9} />}
      {role === "admin" && <Shield size={9} />}
      {role}
    </span>
  );
}

export function WorkspaceManager({ expanded }: WorkspaceManagerProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Add member
  const [addUsername, setAddUsername] = useState("");
  const [addRole, setAddRole] = useState("member");
  const [adding, setAdding] = useState(false);

  // Delete / remove
  const [removing, setRemoving] = useState<string | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace");
      if (!res.ok) throw new Error("Failed to fetch teams");
      const data = (await res.json()) as { teams: Team[] };
      setTeams(data.teams ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load teams");
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void fetchTeams(), 0);
    return () => window.clearTimeout(id);
  }, [fetchTeams]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to create team");
      }
      setCreateName("");
      setCreateDescription("");
      setShowCreateForm(false);
      await fetchTeams();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async () => {
    if (!addUsername.trim() || !selectedTeam) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          username: addUsername.trim(),
          role: addRole,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to add member");
      }
      setAddUsername("");
      await fetchTeams();
      // Re-select team to refresh detail view
      const updated = teams.find((t) => t.id === selectedTeam.id);
      if (updated) setSelectedTeam(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return;
    if (!window.confirm("Remove this member from the team?")) return;
    setRemoving(userId);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspace/members?teamId=${encodeURIComponent(selectedTeam.id)}&userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to remove member");
      }
      await fetchTeams();
      const updated = teams.find((t) => t.id === selectedTeam.id);
      if (updated) setSelectedTeam(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setRemoving(null);
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    setDeletingTeam(selectedTeam.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspace?id=${encodeURIComponent(selectedTeam.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to delete team");
      }
      setShowDeleteConfirm(false);
      setSelectedTeam(null);
      setView("list");
      await fetchTeams();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete team");
    } finally {
      setDeletingTeam(null);
    }
  };

  const openTeamDetail = (team: Team) => {
    setSelectedTeam(team);
    setView("detail");
    setShowDeleteConfirm(false);
  };

  const goBack = () => {
    setView("list");
    setSelectedTeam(null);
    setShowDeleteConfirm(false);
  };

  // Collapsed state
  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 px-2">
        <Users size={18} className="text-[var(--accent-css)]" />
        <span className="text-[10px] text-[var(--ink-faint)] text-center leading-tight">
          Teams
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--rule-soft)]">
        <Users size={14} className="text-[var(--accent-css)] shrink-0" />
        {view === "detail" ? (
          <>
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </button>
            <span className="text-xs font-medium text-[var(--ink)] tracking-wide truncate">
              {selectedTeam?.name}
            </span>
          </>
        ) : (
          <>
            <span className="text-xs font-medium text-[var(--ink)] tracking-wide uppercase">
              Teams
            </span>
            <span className="text-[10px] text-[var(--ink-faint)] ml-auto">
              {teams.length}
            </span>
          </>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-2 mt-1 px-2 py-1 text-[10px] text-[var(--danger)] bg-[var(--danger)]/10 rounded flex items-center gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}>
            <X size={10} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[var(--ink-faint)]" />
          </div>
        ) : view === "list" ? (
          /* ===== Team List ===== */
          <>
            {teams.length === 0 && !showCreateForm && (
              <div className="flex flex-col items-center gap-2 py-8 text-[var(--ink-faint)]">
                <Users size={20} className="opacity-40" />
                <span className="text-[11px]">No teams yet</span>
                <span className="text-[10px] text-center max-w-[200px]">
                  Create a team to collaborate with others.
                </span>
              </div>
            )}

            {/* Team cards */}
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => openTeamDetail(team)}
                className="w-full text-left rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/60 hover:bg-[var(--bg-elev)] hover:border-[var(--ink-dim)]/40 transition-all p-2.5 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-medium text-[var(--ink)] truncate">
                        {team.name}
                      </span>
                      <RoleBadge role={team.myRole} />
                    </div>
                    {team.description && (
                      <p className="text-[10px] text-[var(--ink-faint)] line-clamp-1 leading-relaxed">
                        {team.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-[var(--ink-faint)]">
                        {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[9px] text-[var(--ink-faint)]">
                        {formatDate(team.createdAt)}
                      </span>
                    </div>
                  </div>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-[var(--ink-faint)] mt-0.5 shrink-0"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>
            ))}

            {/* Create form */}
            {showCreateForm && (
              <div className="rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/80 p-2.5 space-y-2 mt-1">
                <input
                  type="text"
                  placeholder="Team name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full h-7 px-2 text-[11px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50 transition-colors"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full h-7 px-2 text-[11px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50 transition-colors"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreate}
                    disabled={creating || !createName.trim()}
                    className="flex flex-1 items-center justify-center gap-1 h-7 px-2 text-[10px] font-medium bg-[var(--accent-css)]/20 text-[var(--accent-css)] rounded hover:bg-[var(--accent-css)]/30 transition-colors disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Plus size={10} />
                    )}
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateName("");
                      setCreateDescription("");
                    }}
                    className="flex items-center justify-center h-7 px-2 text-[10px] text-[var(--ink-faint)] border border-[var(--rule-soft)] rounded hover:text-[var(--ink)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Create button */}
            {!showCreateForm && view === "list" && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center justify-center gap-1.5 w-full h-8 px-2 text-[10px] text-[var(--ink-faint)] border border-dashed border-[var(--rule-soft)] rounded hover:text-[var(--ink)] hover:border-[var(--ink-dim)] transition-colors"
              >
                <Plus size={12} />
                Create Team
              </button>
            )}
          </>
        ) : (
          /* ===== Team Detail ===== */
          selectedTeam && (
            <div className="space-y-2">
              {/* Team info */}
              <div className="rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/60 p-2.5">
                <h3 className="text-[11px] font-medium text-[var(--ink)] mb-1">
                  {selectedTeam.name}
                </h3>
                {selectedTeam.description && (
                  <p className="text-[10px] text-[var(--ink-faint)] mb-1.5 leading-relaxed">
                    {selectedTeam.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-[9px] text-[var(--ink-faint)]">
                  <span>Created {formatDate(selectedTeam.createdAt)}</span>
                  <span>·</span>
                  <span>{selectedTeam.members.length} member{selectedTeam.members.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Members section */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--ink-faint)]">
                    Members
                  </span>
                </div>

                {selectedTeam.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-2 rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/40 p-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-css)]/20 flex items-center justify-center text-[9px] font-medium text-[var(--accent-css)] shrink-0">
                      {(member.username ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-[var(--ink)] truncate block">
                        {member.username ?? "Unknown"}
                      </span>
                    </div>
                    <RoleBadge role={member.role} />
                    {(selectedTeam.myRole === "owner" || selectedTeam.myRole === "admin") &&
                      member.role !== "owner" && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          disabled={removing === member.userId}
                          className="flex h-6 w-6 items-center justify-center text-[var(--ink-faint)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded transition-colors disabled:opacity-50 shrink-0"
                          title="Remove member"
                        >
                          {removing === member.userId ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <UserMinus size={11} />
                          )}
                        </button>
                      )}
                  </div>
                ))}
              </div>

              {/* Add member form */}
              {(selectedTeam.myRole === "owner" || selectedTeam.myRole === "admin") && (
                <div className="rounded-lg border border-[var(--rule-soft)] bg-[var(--bg-elev)]/60 p-2.5 space-y-1.5">
                  <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--ink-faint)]">
                    Add Member
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Username"
                      value={addUsername}
                      onChange={(e) => setAddUsername(e.target.value)}
                      className="flex-1 h-7 px-2 text-[11px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-[var(--accent-css)]/50 transition-colors"
                    />
                    <select
                      value={addRole}
                      onChange={(e) => setAddRole(e.target.value)}
                      className="h-7 px-1.5 text-[10px] bg-[var(--bg-soft)] border border-[var(--rule-soft)] rounded text-[var(--ink)] outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={handleAddMember}
                      disabled={adding || !addUsername.trim()}
                      className="flex items-center justify-center gap-1 h-7 px-2 text-[10px] font-medium bg-[var(--accent-css)]/20 text-[var(--accent-css)] rounded hover:bg-[var(--accent-css)]/30 transition-colors disabled:opacity-50"
                    >
                      {adding ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <UserPlus size={10} />
                      )}
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Delete team (owner only) */}
              {selectedTeam.myRole === "owner" && (
                <div className="pt-4">
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center justify-center gap-1.5 w-full h-8 px-2 text-[10px] text-[var(--danger)] border border-[var(--danger)]/30 rounded hover:bg-[var(--danger)]/10 transition-colors"
                    >
                      <Trash2 size={11} />
                      Delete Team
                    </button>
                  ) : (
                    <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-2.5 space-y-1.5">
                      <p className="text-[10px] text-[var(--danger)] leading-relaxed">
                        This will permanently delete "{selectedTeam.name}" and all membership data. This cannot be undone.
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleDeleteTeam}
                          disabled={deletingTeam === selectedTeam.id}
                          className="flex flex-1 items-center justify-center gap-1 h-7 px-2 text-[10px] font-medium bg-[var(--danger)] text-[var(--danger-foreground)] rounded hover:opacity-90 transition-colors disabled:opacity-50"
                        >
                          {deletingTeam === selectedTeam.id ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Trash2 size={10} />
                          )}
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex items-center justify-center h-7 px-2 text-[10px] text-[var(--ink-faint)] border border-[var(--rule-soft)] rounded hover:text-[var(--ink)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
