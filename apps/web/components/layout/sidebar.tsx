"use client";

import { useChatStore } from "@/lib/store";
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
  Terminal,
  FileText,
  Globe,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Search,
  Download,
  Upload,
  X,
} from "lucide-react";

type SidebarTab = "chats" | "tools" | "skills";

interface SkillInfo {
  name: string;
  description: string;
  path: string;
}

// ===== Tools Data =====
const TOOLS = [
  {
    name: "Terminal",
    icon: Terminal,
    description: "Execute shell commands (full access)",
    status: "active" as const,
  },
  {
    name: "File Reader",
    icon: FileText,
    description: "Read local files (UTF-8, max 5MB)",
    status: "active" as const,
  },
  {
    name: "Web Search",
    icon: Globe,
    description: "Search the web via DuckDuckGo",
    status: "active" as const,
  },
];

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

// ===== Chats Tab =====
function ChatsTab({ sidebarOpen }: { sidebarOpen: boolean }) {
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const importFromJson = useChatStore((s) => s.importFromJson);

  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
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
        setImportStatus("Export failed");
        setTimeout(() => setImportStatus(null), 3000);
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
      setImportStatus("Exported.");
      setTimeout(() => setImportStatus(null), 2000);
    } catch {
      setImportStatus("Export failed");
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const stats = await importFromJson(text);
      setImportStatus(`Imported ${stats.sessions} sessions, ${stats.messages} messages.`);
      setTimeout(() => setImportStatus(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setImportStatus(msg);
      setTimeout(() => setImportStatus(null), 4000);
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
            className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto
                       border border-dashed border-[var(--border)]
                       hover:bg-[var(--muted)] hover:border-[var(--primary)]
                       active:scale-[0.97] transition-all duration-150"
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
                  "w-11 h-11 rounded-xl flex items-center justify-center mx-auto",
                  isActive
                    ? "bg-[var(--primary-muted)] text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
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
      <div className="p-3 shrink-0 space-y-2">
        {/* New chat */}
        <button
          onClick={() => createSession()}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium",
            "border border-dashed border-[var(--border)]",
            "hover:bg-[var(--muted)] hover:border-[var(--primary)]",
            "active:scale-[0.97] transition-all duration-150"
          )}
        >
          <Plus size={16} />
          <span className="animate-fade-in">New Chat</span>
        </button>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className={cn(
              "w-full pl-8 pr-8 py-2 rounded-lg text-sm",
              "bg-[var(--muted)] border border-[var(--border)]",
              "placeholder:text-[var(--muted-foreground)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 focus:border-[var(--primary)]"
            )}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
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
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs",
              "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]",
              "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title="Import sessions from JSON"
          >
            <Upload size={11} />
            Import
          </button>
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs
                       bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]
                       transition-colors"
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
        {importStatus && (
          <p className="text-[11px] text-[var(--muted-foreground)] px-1 animate-fade-in">
            {importStatus}
          </p>
        )}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center text-[var(--muted-foreground)] text-xs py-8 px-4 animate-fade-in">
            No conversations yet.
            <br />
            Start a new chat to begin.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-[var(--muted-foreground)] text-xs py-8 px-4 animate-fade-in">
            No chats match &quot;{search}&quot;.
          </div>
        ) : (
          grouped.map(({ group, sessions: groupSessions }) => (
            <div key={group} className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-medium px-3 pt-2">
                {group}
              </p>
              {groupSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <div key={session.id} className="group relative">
                    <button
                      onClick={() => setActiveSession(session.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm",
                        "transition-all duration-150",
                        isActive
                          ? "bg-[var(--primary-muted)] text-[var(--foreground)] font-medium"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                      )}
                    >
                      <MessageSquare
                        size={15}
                        className={cn("shrink-0", isActive && "text-[var(--primary)]")}
                      />
                      <span className="truncate animate-fade-in pr-7">{session.title}</span>
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--primary)] animate-scale-in" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(session.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-md
                                 opacity-0 group-hover:opacity-100 hover:bg-[var(--destructive)]/10
                                 text-[var(--muted-foreground)] hover:text-[var(--destructive)]
                                 transition-all duration-150"
                      aria-label="Delete session"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ===== Tools Tab =====
function ToolsTab({ expanded }: { expanded: boolean }) {
  if (!expanded) {
    return (
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {TOOLS.map((tool) => (
          <div
            key={tool.name}
            className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto
                       text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
            title={tool.name}
          >
            <tool.icon size={18} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 animate-fade-in">
      <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-medium px-1 mb-2">
        Agent Tools
      </p>
      {TOOLS.map((tool) => (
        <div
          key={tool.name}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] transition-all duration-150 hover:border-[var(--primary)]/30"
        >
          <div className="w-8 h-8 rounded-lg bg-[var(--success)]/10 flex items-center justify-center shrink-0">
            <tool.icon size={15} className="text-[var(--success)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{tool.name}</span>
              <CheckCircle2 size={12} className="text-[var(--success)] shrink-0" />
            </div>
            <p className="text-xs text-[var(--muted-foreground)] truncate">
              {tool.description}
            </p>
          </div>
        </div>
      ))}

      <p className="text-[11px] text-[var(--muted-foreground)] px-1 pt-2 leading-relaxed">
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
                       text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
            title={s.name}
          >
            <Puzzle size={18} />
          </div>
        ))}
        {skills.length === 0 && !loading && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto text-[var(--muted-foreground)]">
            <Puzzle size={18} className="opacity-30" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 animate-fade-in">
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-medium">
          Installed Skills
        </p>
        <button
          onClick={fetchSkills}
          className="p-1 rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
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
          <Puzzle size={28} className="mx-auto text-[var(--muted-foreground)] opacity-40" />
          <p className="text-xs text-[var(--muted-foreground)]">
            No skills installed yet.
          </p>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Add skills to <code className="px-1 py-0.5 rounded bg-[var(--muted)] text-[10px]">.verdent/skills/</code>
          </p>
        </div>
      ) : (
        skills.map((skill, i) => (
          <div
            key={skill.name}
            className="group px-3 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]
                       hover:border-[var(--accent)]/30 transition-all duration-150 animate-slide-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-muted)] to-[var(--primary-muted)] flex items-center justify-center shrink-0 mt-0.5">
                <Puzzle size={14} className="text-[var(--accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{skill.name}</span>
                  <ChevronRight size={12} className="text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mt-0.5 leading-relaxed">
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
        // Only collapse on mobile widths
        if (typeof window !== "undefined" && window.innerWidth < 768) {
          setSidebarOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, setSidebarOpen]);

  const tabs: { id: SidebarTab; icon: typeof MessageSquare; label: string }[] = [
    { id: "chats", icon: MessageSquare, label: "Chats" },
    { id: "tools", icon: Wrench, label: "Tools" },
    { id: "skills", icon: Puzzle, label: "Skills" },
  ];

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed md:relative z-50 h-dvh flex flex-col",
          "bg-[var(--surface)] border-r border-[var(--border)]",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarOpen
            ? "w-[300px] translate-x-0"
            : "w-0 md:w-[64px] -translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex items-center h-14 px-3 border-b border-[var(--border)] shrink-0">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center shrink-0">
                  <Sparkles size={16} className="text-white" />
                </div>
                <span className="font-semibold text-sm truncate animate-fade-in">
                  Agent Web
                </span>
              </div>
              <button
                onClick={toggleSidebar}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-[var(--muted)] transition-colors"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={18} className="text-[var(--muted-foreground)]" />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-[var(--muted)] transition-colors mx-auto"
              aria-label="Expand sidebar"
            >
              <PanelLeft size={18} className="text-[var(--muted-foreground)]" />
            </button>
          )}
        </div>

        {sidebarOpen ? (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium",
                  "transition-all duration-150 active:scale-[0.97]",
                  activeTab === tab.id
                    ? "bg-[var(--primary-muted)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2 border-b border-[var(--border)] shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center",
                  "transition-all duration-150",
                  activeTab === tab.id
                    ? "bg-[var(--primary-muted)] text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
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
