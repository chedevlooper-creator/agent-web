"use client";

import { useChatStore, useShowVideo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Wrench,
  Puzzle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Search,
  Download,
  Upload,
  X,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { toolDescriptions } from "@agent-web/core";
import { getToolIcon } from "@/lib/tool-icons";

type SidebarTab = "chats" | "tools" | "skills";

interface SkillInfo {
  name: string;
  description: string;
  path: string;
}

// ===== Date grouping =====
type Group = "Today" | "Yesterday" | "Previous 7 Days" | "Previous 30 Days" | "Older";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupOf(timestamp: number): Group {
  const now = new Date();
  const today = startOfDay(now);
  const ts = startOfDay(new Date(timestamp));
  const diffDays = Math.floor((today - ts) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Previous 7 Days";
  if (diffDays <= 30) return "Previous 30 Days";
  return "Older";
}

const GROUP_ORDER: Group[] = [
  "Today",
  "Yesterday",
  "Previous 7 Days",
  "Previous 30 Days",
  "Older",
];

// ===== Project Bar =====
function ProjectBar() {
  const projects = useChatStore((s) => s.projects);
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const setActiveProject = useChatStore((s) => s.setActiveProject);
  const createProject = useChatStore((s) => s.createProject);
  const deleteProject = useChatStore((s) => s.deleteProject);
  const [creating, setCreating] = useState(false);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createProject(`Project ${projects.length + 1}`);
    } catch {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-3 py-2 border-b border-border/30 space-y-1.5 shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <select
            value={activeProjectId ?? "__default__"}
            onChange={(e) => {
              const v = e.target.value;
              setActiveProject(v === "__default__" ? null : v);
            }}
            className="w-full bg-surface-elevated border border-border/40 rounded-lg px-2 py-1.5 text-xs text-foreground truncate focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
            aria-label="Select project"
          >
            <option value="__default__">Default</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="min-w-[28px] h-7 flex items-center justify-center rounded-lg bg-gradient-to-r from-primary to-primary-hover text-white text-xs transition-all duration-200 hover:shadow-md hover:shadow-primary/20 active:scale-95 disabled:opacity-50"
            aria-label="Create new project"
          >
            <Plus size={13} />
          </button>
          {activeProject && (
            <button
              onClick={() => {
                if (confirm(`Delete project "${activeProject.name}"? All sessions will be deleted.`)) {
                  deleteProject(activeProject.id);
                }
              }}
              className="min-w-[28px] h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-200"
              aria-label="Delete project"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      {activeProject && (
        <p className="text-[10px] text-muted-foreground/60 truncate px-1">
          {activeProject.rootPath}
        </p>
      )}
    </div>
  );
}

// ===== Session Item =====
function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  session: { id: string; title: string };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (id: string, title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(session.id, trimmed);
    } else {
      setTitle(session.title);
    }
    setIsEditing(false);
  };

  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm",
          "transition-all duration-200",
          isActive
            ? "bg-primary/10 text-foreground font-medium"
            : "text-muted-foreground hover:bg-surface-elevated/80 hover:text-foreground"
        )}
      >
        <MessageSquare
          size={15}
          className={cn("shrink-0 transition-colors duration-200", isActive ? "text-primary" : "")}
        />
        {isEditing ? (
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setTitle(session.title);
                setIsEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-sm border-none outline-none focus:ring-1 focus:ring-primary/50 rounded-sm px-1 py-0.5 -mx-1"
          />
        ) : (
          <span className="truncate animate-fade-in pr-12">{session.title}</span>
        )}
        {/* Active indicator bar — gradient left edge */}
        {isActive && !isEditing && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-primary to-accent animate-scale-in" />
        )}
      </button>
      {!isEditing && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Rename session"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Delete session"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ===== Chats Tab =====
function ChatsTab({ sidebarOpen }: { sidebarOpen: boolean }) {
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const renameSession = useChatStore((s) => s.renameSession);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const importFromJson = useChatStore((s) => s.importFromJson);

  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = (id: string) => {
    if (typeof window !== "undefined" && window.confirm("Delete this conversation?")) {
      deleteSession(id);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      if (s.title.toLowerCase().includes(q)) return true;
      return s.messages.some((m) => m.content.toLowerCase().includes(q));
    });
  }, [sessions, search]);

  const grouped = useMemo(() => {
    const map = new Map<Group, typeof filtered>();
    for (const s of filtered) {
      const g = groupOf(s.updatedAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      sessions: map.get(g)!,
    }));
  }, [filtered]);

  const handleExport = async () => {
    try {
      const res = await fetch("/api/sessions/export");
      if (!res.ok) {
        toast.error("Export failed: Unable to fetch sessions");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agent-web-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Sessions exported successfully");
    } catch {
      toast.error("Export failed due to a network error");
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const stats = await importFromJson(text);
      toast.success(`Imported ${stats.sessions} sessions, ${stats.messages} messages.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(`Import error: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  if (!sidebarOpen) {
    return (
      <>
        <div className="p-3 shrink-0">
          <button
            onClick={() => createSession()}
            className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto
                       border border-dashed border-border/60
                       hover:bg-primary/10 hover:border-primary/40 hover:text-primary
                       active:scale-95 transition-all duration-200"
            aria-label="New chat"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {sessions.slice(0, 15).map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                onClick={() => setActiveSession(session.id)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                )}
                title={session.title}
              >
                <MessageSquare size={16} />
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="p-3 shrink-0 space-y-2.5">
        {/* New chat */}
        <button
          onClick={() => createSession()}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium",
            "border border-dashed border-border/50",
            "hover:bg-primary/8 hover:border-primary/30 hover:text-primary",
            "active:scale-[0.98] transition-all duration-200"
          )}
        >
          <Plus size={16} />
          <span className="animate-fade-in">New Chat</span>
        </button>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            className={cn(
              "w-full pl-8 pr-8 py-2 rounded-xl text-sm",
              "bg-surface-muted/70 border border-border-muted",
              "placeholder:text-muted-foreground/50",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
              "transition-all duration-200"
            )}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Import / Export */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleImportClick}
            disabled={importing}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium",
              "bg-surface-muted/50 text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
              "border border-border-muted hover:border-border",
              "transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title="Import sessions from JSON"
          >
            <Upload size={11} />
            Import
          </button>
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium
                       bg-surface-muted/50 text-muted-foreground hover:bg-surface-elevated hover:text-foreground
                       border border-border-muted hover:border-border
                       transition-all duration-200"
            title="Export all sessions as JSON"
          >
            <Download size={11} />
            Export
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-8 px-4 animate-fade-in">
            No conversations yet.
            <br />
            Start a new chat to begin.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-8 px-4 animate-fade-in">
            No chats match &quot;{search}&quot;.
          </div>
        ) : (
          grouped.map(({ group, sessions: groupSessions }) => (
            <div key={group} className="space-y-0.5">
              <p className="section-label px-3 pt-2 pb-1">
                {group}
              </p>
              {groupSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => setActiveSession(session.id)}
                  onDelete={() => handleDelete(session.id)}
                  onRename={(id, title) => renameSession(id, title)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ===== Tools Tab =====
function ToolsTab({ expanded }: { expanded: boolean }) {
  const tools = Object.entries(toolDescriptions);

  if (!expanded) {
    return (
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {tools.map(([key, tool]) => {
          const Icon = getToolIcon(key);
          return (
            <div
              key={key}
              className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto
                         text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-all duration-200"
              title={tool.name}
            >
              <Icon size={18} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 animate-fade-in">
      <p className="section-label px-1 mb-2">
        Agent Tools
      </p>
      {tools.map(([key, tool]) => {
        const Icon = getToolIcon(key);
        return (
          <div
            key={key}
            className="flex items-center gap-3 px-3 py-3 rounded-xl glass-card transition-all duration-200 hover:border-primary/20 hover-lift"
          >
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <Icon size={15} className="text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{tool.name}</span>
                {tool.status === "active" && <CheckCircle2 size={12} className="text-success shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {tool.description}
              </p>
            </div>
          </div>
        );
      })}

      <p className="text-[11px] text-muted-foreground/60 px-1 pt-2 leading-relaxed">
        Tools execute on the local machine with full permissions. Only use in
        trusted development environments.
      </p>
    </div>
  );
}

// ===== Skills Tab =====
function SkillsTab({ expanded }: { expanded: boolean }) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSkills = useCallback(() => {
    setLoading(true);
    fetch("/api/skills")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSkills(data))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSkills();
  }, [fetchSkills]);

  if (!expanded) {
    return (
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {skills.map((s) => (
          <div
            key={s.name}
            className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto
                       text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-all duration-200"
            title={s.name}
          >
            <Puzzle size={18} />
          </div>
        ))}
        {skills.length === 0 && !loading && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto text-muted-foreground">
            <Puzzle size={18} className="opacity-30" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 animate-fade-in">
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="section-label">
          Installed Skills
        </p>
        <button
          onClick={fetchSkills}
          className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Refresh skills"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <div className="text-center py-8 px-4 space-y-2 animate-fade-in">
          <Puzzle size={28} className="mx-auto text-muted-foreground opacity-30" />
          <p className="text-xs text-muted-foreground">
            No skills installed yet.
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Add skills to <code className="px-1.5 py-0.5 rounded-md bg-surface-muted text-[10px] border border-border-muted">.verdent/skills/</code>
          </p>
        </div>
      ) : (
        skills.map((skill, i) => (
          <div
            key={skill.name}
            className="group px-3 py-3 rounded-xl glass-card
                       hover:border-accent/20 transition-all duration-200 animate-slide-up hover-lift"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-muted to-primary-muted flex items-center justify-center shrink-0 mt-0.5">
                <Puzzle size={14} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{skill.name}</span>
                  <ChevronRight size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                  {skill.description}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ===== Main Sidebar =====
export function Sidebar() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const hydrate = useChatStore((s) => s.hydrate);
  const hydrated = useChatStore((s) => s.hydrated);
  const [activeTab, setActiveTab] = useState<SidebarTab>("chats");

  // Hydrate from DB on first mount
  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrated, hydrate]);

  // Close sidebar on Escape (mobile)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) {
        if (typeof window !== "undefined" && window.innerWidth < 768) {
          setSidebarOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, setSidebarOpen]);

  const showVideo = useShowVideo();

  const tabs: { id: SidebarTab; icon: typeof MessageSquare; label: string }[] = [
    { id: "chats", icon: MessageSquare, label: "Chats" },
    { id: "tools", icon: Wrench, label: "Tools" },
    { id: "skills", icon: Puzzle, label: "Skills" },
  ];

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed md:relative z-50 h-dvh flex flex-col",
          showVideo
            ? "glass-subtle border-r border-border/20"
            : "bg-surface border-r border-border/40",
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarOpen
            ? "w-[280px] translate-x-0"
            : "w-0 md:w-[64px] -translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center h-14 px-3 border-b shrink-0 transition-colors duration-500", showVideo ? "border-border/20" : "border-border/40")}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-xl gradient-bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/25 animate-glow-ring">
                  <Sparkles size={15} className="text-white" />
                </div>
                <span className="font-semibold text-sm tracking-tight truncate animate-fade-in">
                  Agent Web
                </span>
              </div>
              <button
                onClick={toggleSidebar}
                className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-muted transition-all duration-200 active:scale-95"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={16} className="text-muted-foreground" />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-muted transition-all duration-200 mx-auto active:scale-95"
              aria-label="Expand sidebar"
            >
              <PanelLeft size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Project selector */}
        {sidebarOpen && <ProjectBar />}

        {/* Tab bar — segmented control style */}
        {sidebarOpen ? (
          <div className={cn("px-3 py-2 border-b shrink-0 transition-colors duration-500", showVideo ? "border-border/20" : "border-border/40")}>
            <div className="relative flex items-center gap-0.5 p-0.5 rounded-xl bg-surface-muted/40 border border-border-muted">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative z-10 flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium",
                    "transition-all duration-250 active:scale-[0.97]",
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-primary to-primary-hover text-primary-foreground shadow-sm shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon size={13} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn("flex flex-col items-center gap-1 py-2 border-b shrink-0 transition-colors duration-500", showVideo ? "border-border/20" : "border-border/40")}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  "transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                )}
                title={tab.label}
              >
                <tab.icon size={18} />
              </button>
            ))}
          </div>
        )}

        {activeTab === "chats" && <ChatsTab sidebarOpen={sidebarOpen} />}
        {activeTab === "tools" && <ToolsTab expanded={sidebarOpen} />}
        {activeTab === "skills" && <SkillsTab expanded={sidebarOpen} />}
      </aside>
    </>
  );
}
