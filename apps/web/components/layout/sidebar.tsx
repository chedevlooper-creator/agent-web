"use client";

import { useChatStore, type Session } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Download,
  FileText,
  Globe,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  Upload,
  Wrench,
  X,
  Pencil,
  Paintbrush,
  FlaskConical,
  Database,
  Gamepad2,
  Code,
  Brain,
  Palette,
  FolderOpen,
  ChevronRight,
  Box,
  BarChart3,
  BookOpen,
  Settings,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { getToolIcon } from "@/lib/tool-icons";

type SidebarTab = "chats" | "tools" | "activity" | "context";
type Group =
  | "Today"
  | "Yesterday"
  | "Previous 7 Days"
  | "Previous 30 Days"
  | "Older";
type ToolStatus = "online" | "idle" | "error";

const TOOLS = [
  {
    name: "Terminal",
    icon: Terminal,
    description: "Execute shell commands in sandbox",
    status: "online" as ToolStatus,
    lastUsed: "local",
  },
  {
    name: "File Reader",
    icon: FileText,
    description: "Read local files, UTF-8, max 5MB",
    status: "online" as ToolStatus,
    lastUsed: "ready",
  },
  {
    name: "Web Search",
    icon: Globe,
    description: "Search the web via DuckDuckGo",
    status: "idle" as ToolStatus,
    lastUsed: "idle",
  },
];

const GROUP_ORDER: Group[] = [
  "Today",
  "Yesterday",
  "Previous 7 Days",
  "Previous 30 Days",
  "Older",
];

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

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 items-center justify-center bg-[var(--primary)] text-[var(--background)] shadow-[0_2px_8px_rgba(0,229,153,0.3)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="M12 4 16 12 12 20 8 12Z" />
        <path d="M12 9V15" />
      </svg>
    </span>
  );
}

function StatusLed({ status = "online" }: { status?: ToolStatus }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 shrink-0",
        status === "online" &&
          "bg-[var(--primary)] shadow-[0_0_6px_rgba(0,229,153,0.5)]",
        status === "idle" && "bg-[var(--dim-foreground)]",
        status === "error" &&
          "bg-[var(--accent)] shadow-[0_0_6px_rgba(255,107,53,0.4)]",
      )}
    />
  );
}

function ChatsTab({ expanded, search }: { expanded: boolean; search: string }) {
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const renameSession = useChatStore((s) => s.renameSession);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);

  const handleDelete = (id: string) => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Delete this conversation?")
    ) {
      deleteSession(id);
    }
  };

  const closeMobileSidebar = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  const handleNewChat = useCallback(async () => {
    // Reuse an existing empty "New Chat" session instead of creating duplicates
    const emptySession = sessions.find(
      (s) => (s.title === "New Chat" || s.title === "Yeni Sohbet") && (!s.messages || s.messages.length === 0)
    );
    if (emptySession) {
      setActiveSession(emptySession.id);
    } else {
      await createSession();
    }
    closeMobileSidebar();
  }, [sessions, createSession, setActiveSession, closeMobileSidebar]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSession(id);
    closeMobileSidebar();
  }, [setActiveSession, closeMobileSidebar]);

  // NOTE: Search is limited to session titles only.
  // Message content search would require loading messages for all sessions from the server.
  const filtered = useMemo(() => {
    let list = sessions;

    // Deduplicate empty "New Chat" sessions (keep only the active one or the most recent one)
    const emptyNewChats = list.filter(s => (s.title === "New Chat" || s.title === "Yeni Sohbet") && (!s.messages || s.messages.length === 0));
    if (emptyNewChats.length > 1) {
      const keepId = emptyNewChats.find(s => s.id === activeSessionId)?.id || emptyNewChats[0].id;
      list = list.filter(s => !((s.title === "New Chat" || s.title === "Yeni Sohbet") && (!s.messages || s.messages.length === 0) && s.id !== keepId));
    }

    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((session) => {
      if (session.title.toLowerCase().includes(q)) return true;
      return session.messages.some((message) =>
        message.content.toLowerCase().includes(q),
      );
    });
  }, [sessions, search]);

  const grouped = useMemo(() => {
    const map = new Map<Group, Session[]>();
    for (const session of filtered) {
      const group = groupOf(session.updatedAt);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(session);
    }
    return GROUP_ORDER.filter((group) => map.has(group)).map((group) => ({
      group,
      sessions: map.get(group)!,
    }));
  }, [filtered]);

  if (!expanded) {
    return (
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <button
          onClick={() => createSession()}
          className="mx-auto mb-2 flex h-9 w-9 items-center justify-center bg-[var(--primary)] text-[var(--primary-foreground)] transition-transform active:translate-y-px"
          aria-label="New chat"
        >
          <Plus size={16} />
        </button>
        <div className="space-y-1">
          {sessions.slice(0, 14).map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={cn(
                  "mx-auto flex h-9 w-9 items-center justify-center border border-transparent transition-colors",
                  isActive
                    ? "border-[var(--primary)] bg-[var(--primary-muted)] text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--overlay)] hover:text-[var(--foreground)]",
                )}
                title={session.title}
            aria-label={`${session.title} oturumunu aç`}
              >
                <MessageSquare size={15} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => createSession()}
        className="mx-2 mt-2 flex h-9 shrink-0 items-center justify-center gap-2 bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] shadow-[0_4px_12px_rgba(0,229,153,0.2)] transition-all hover:bg-[var(--primary-dim)] active:translate-y-px"
      >
        <Plus size={15} />
        New Chat
      </button>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="font-mono text-2xl text-[var(--dim-foreground)]">
              &lt;/&gt;
            </span>
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              No sessions found
            </span>
            <span className="font-mono text-[10px] text-[var(--dim-foreground)]">
              Start a new chat
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              No sessions found
            </span>
            <span className="font-mono text-[10px] text-[var(--dim-foreground)]">
              No match for &quot;{search}&quot;
            </span>
          </div>
        ) : (
          GROUP_ORDER.map(groupName => {
              const actualGroup = grouped.find(g => g.group === groupName);
              if (!actualGroup) return null;
              
              return (
                <div key={groupName} className="space-y-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pb-1">
                    {groupName === "Today" ? "Bugün" : groupName === "Yesterday" ? "Dün" : groupName === "Previous 7 Days" ? "Son 7 Gün" : groupName === "Previous 30 Days" ? "Son 30 Gün" : "Daha Eski"}
                  </p>
                  
                  {actualGroup?.sessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    return (
                      <div key={session.id} className="group relative">
                        <button
                          onClick={() => handleSelectSession(session.id)}
                          className={cn(
                            "flex h-[38px] w-full items-center gap-2 border-l-2 px-2 text-left transition-all",
                            isActive
                              ? "border-[var(--primary)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[inset_1px_0_0_rgba(0,229,153,0.05)]"
                              : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--overlay)] hover:text-[var(--foreground)]",
                          )}
                        >
                          <MessageSquare
                            size={15}
                            className={cn(
                              "shrink-0",
                              isActive && "text-[var(--primary)]",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-medium leading-tight">
                            {session.title}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-[var(--dim-foreground)]">
                            {session.messages.length}
                          </span>
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(session.id);
                          }}
                          className="absolute right-1 top-1/2 flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center border border-transparent bg-[var(--surface-elevated)] text-[var(--muted-foreground)] opacity-0 transition-all hover:border-[var(--destructive)] hover:text-[var(--destructive)] group-hover:opacity-100"
                          aria-label="Delete session"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })
        )}
        {search && filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-8 px-4 animate-fade-in">
            &quot;{search}&quot; ile eşleşen sohbet bulunamadı.
          </div>
        ) : (
          <div className="px-3 py-8 text-xs text-muted-foreground/70">
            Henüz sohbet yok.
          </div>
        )}
      </div>
    </>
  );
}

function ToolsTab() {
  return (
    <div className="flex-1 space-y-1 overflow-y-auto p-2">
      <div className="px-2 pb-1 pt-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--dim-foreground)]">
        Available Tools - {TOOLS.length}
      </div>
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <div
            key={tool.name}
            className="flex items-start gap-2 border border-[var(--border)] bg-[var(--overlay)] p-2 transition-all hover:border-[var(--border-strong)] hover:shadow-[2px_4px_16px_rgba(0,0,0,0.3)]"
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center font-mono text-sm font-bold",
                tool.status === "online" &&
                  "bg-[var(--primary-muted)] text-[var(--primary)]",
                tool.status === "idle" &&
                  "bg-[var(--surface)] text-[var(--dim-foreground)]",
                tool.status === "error" &&
                  "bg-[var(--accent-muted)] text-[var(--accent)]",
              )}
            >
              <Icon size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold leading-tight text-[var(--foreground)]">
                {tool.name}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
                {tool.description}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <StatusLed status={tool.status} />
                <span
                  className={cn(
                    "font-mono text-[9px] font-medium uppercase tracking-[0.06em]",
                    tool.status === "online" && "text-[var(--primary)]",
                    tool.status === "idle" && "text-[var(--dim-foreground)]",
                    tool.status === "error" && "text-[var(--accent)]",
                  )}
                >
                  {tool.status}
                </span>
              </div>
            </div>
            <span className="shrink-0 font-mono text-[9px] text-[var(--dim-foreground)]">
              {tool.lastUsed}
            </span>
          </div>
        );
      })}
      <p className="px-2 pt-1 font-mono text-[10px] leading-relaxed text-[var(--dim-foreground)]">
        Tools execute on the local machine. Use only in trusted environments.
      </p>
    </div>
  );
}

function ActivityTab() {
  const sessions = useChatStore((s) => s.sessions);
  const items = useMemo(() => {
    const recent = sessions.slice(0, 6).map((session) => ({
      type: "system" as const,
      title: `session: ${session.title}`,
      detail: `${session.messages.length} messages`,
      time: formatTime(session.updatedAt),
    }));
    return recent.length
      ? recent
      : [
          {
            type: "tool" as const,
            title: "terminal: ready",
            detail: "local tools online",
            time: "now",
          },
          {
            type: "system" as const,
            title: "workspace initialized",
            detail: "agent-web monorepo",
            time: "now",
          },
        ];
  }, [sessions]);

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <div className="px-2 pb-1 pt-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--dim-foreground)]">
        Recent Activity
      </div>
      {items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className={cn(
            "flex items-start gap-2 border-l-2 px-2 py-2 transition-colors hover:bg-[var(--overlay)]",
            item.type === "tool" && "border-[var(--primary)]",
            item.type === "system" && "border-[var(--info)]",
          )}
        >
          <span
            className={cn(
              "mt-1.5 h-[7px] w-[7px] shrink-0",
              item.type === "tool" && "bg-[var(--primary)]",
              item.type === "system" && "bg-[var(--info)]",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold leading-snug text-[var(--foreground)]">
              {item.title}
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--muted-foreground)]">
              {item.detail}
            </div>
          </div>
          <span className="shrink-0 font-mono text-[9px] text-[var(--dim-foreground)]">
            {item.time}
          </span>
        </div>
      ))}
    </div>
  );
}

function ContextTab() {
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const skills = useChatStore((s) => s.skills);
  const enabledSkills = useChatStore((s) => s.enabledSkills);
  const fetchSkills = useChatStore((s) => s.fetchSkills);
  const toggleSkill = useChatStore((s) => s.toggleSkill);
  const importFromJson = useChatStore((s) => s.importFromJson);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const doFetch = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      await fetchSkills();
    } finally {
      setLoading(false);
    }
  }, [fetchSkills]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void doFetch();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [doFetch]);

  const handleExport = async () => {
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
      setStatus("Exported.");
    } catch {
      setStatus("Export failed.");
    } finally {
      setTimeout(() => setStatus(null), 2500);
    }
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const stats = await importFromJson(await file.text());
      setStatus(`Imported ${stats.sessions} sessions.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-2">
      <div className="border border-[var(--border)] bg-[var(--overlay)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
            Runtime
          </span>
          <span className="font-mono text-[10px] text-[var(--dim-foreground)]">
            active
          </span>
        </div>
        <div className="p-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] py-1.5">
            <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
              provider
            </span>
            <span className="truncate pl-3 font-mono text-[10px] text-[var(--dim-foreground)]">
              {provider}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
              model
            </span>
            <span className="truncate pl-3 font-mono text-[10px] text-[var(--dim-foreground)]">
              {model}
            </span>
          </div>
        </div>
      </div>

      <div className="border border-[var(--border)] bg-[var(--overlay)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
            Skills
          </span>
          <button
            onClick={doFetch}
            className="flex h-6 w-6 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
            aria-label="Refresh skills"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="p-2">
          {loading ? (
            <div className="font-mono text-[10px] text-[var(--dim-foreground)]">
              Scanning...
            </div>
          ) : skills.length === 0 ? (
            <div className="font-mono text-[10px] text-[var(--dim-foreground)]">
              No entries
            </div>
          ) : (
            skills.map((skill) => {
              const isEnabled = enabledSkills.includes(skill.name);
              return (
                <button
                  key={skill.name}
                  onClick={() => toggleSkill(skill.name)}
                  className="flex w-full items-center justify-between border-t border-[var(--border)] py-1.5 text-left first:border-t-0"
                >
                  <span className="truncate pr-2 text-[11px] font-medium text-[var(--foreground)]">
                    {skill.name}
                  </span>
                  <span
                    className={cn(
                      "relative h-4 w-7 shrink-0 border transition-colors",
                      isEnabled
                        ? "border-[var(--primary)] bg-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--surface)]",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-[2px] h-2.5 w-2.5 bg-[var(--foreground)] transition-all",
                        isEnabled
                          ? "left-[14px] bg-[var(--background)]"
                          : "left-[2px]",
                      )}
                    />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="border border-[var(--border)] bg-[var(--overlay)] p-2">
        <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
          Sessions
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="signal-button flex-1"
          >
            <Upload size={11} />
            Import
          </button>
          <button onClick={handleExport} className="signal-button flex-1">
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
        {status && (
          <div className="mt-2 font-mono text-[10px] text-[var(--dim-foreground)]">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const hydrate = useChatStore((s) => s.hydrate);
  const hydrated = useChatStore((s) => s.hydrated);
  const sessions = useChatStore((s) => s.sessions);
  const [activeTab, setActiveTab] = useState<SidebarTab>("chats");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const appliedMobileDefault = useRef(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!hydrated || appliedMobileDefault.current) return;
    appliedMobileDefault.current = true;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, [hydrated, setSidebarOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSidebarOpen(true);
        setActiveTab("chats");
        window.setTimeout(() => searchRef.current?.focus(), 120);
      }
      if (event.key === "Escape" && sidebarOpen && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, setSidebarOpen]);

  const tabs: {
    id: SidebarTab;
    icon: typeof MessageSquare;
    label: string;
    badge?: string;
  }[] = [
    {
      id: "chats",
      icon: MessageSquare,
      label: "Chats",
      badge: String(sessions.length),
    },
    { id: "tools", icon: Wrench, label: "Tools" },
    { id: "activity", icon: Activity, label: "Act" },
    { id: "context", icon: Puzzle, label: "Ctx" },
  ];

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/55 md:hidden"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleSidebar();
            }
          }}
        />
      )}

      <aside
        className={cn(
          "fixed z-50 flex h-dvh flex-col overflow-hidden bg-[var(--surface)] md:relative md:h-full",
          "border-r border-[var(--border-strong)] shadow-[4px_0_20px_rgba(0,0,0,0.3)]",
          "transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarOpen
            ? "w-[288px] translate-x-0"
            : "w-0 -translate-x-full md:w-[56px] md:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-12 shrink-0 items-center border-b border-[var(--border)]",
            sidebarOpen ? "gap-2 px-3" : "justify-center px-0",
          )}
        >
          {sidebarOpen ? (
            <>
              <LogoMark />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold leading-tight text-[var(--foreground)]">
                  Agent Web
                </div>
                <div className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                  v0.4.0
                </div>
              </div>
              <button
                onClick={toggleSidebar}
                className="flex h-7 w-7 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] transition-all hover:bg-[var(--overlay)] hover:text-[var(--foreground)] active:translate-y-px"
                aria-label="Collapse sidebar"
                aria-expanded={sidebarOpen}
              >
                <PanelLeftClose size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--overlay)] hover:text-[var(--foreground)]"
              aria-label="Expand sidebar"
              aria-expanded={sidebarOpen}
            >
              <PanelLeft size={18} />
            </button>
          )}
        </div>

        <div
          className={cn(
            "mx-2 my-2 flex h-[34px] shrink-0 items-center border border-[var(--border)] bg-[var(--overlay)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]",
            sidebarOpen ? "gap-2 px-2.5" : "mx-auto w-9 justify-center px-0",
          )}
          onClick={() => {
            if (!sidebarOpen) {
              setSidebarOpen(true);
              window.setTimeout(() => searchRef.current?.focus(), 120);
            }
          }}
        >
          <Search
            size={14}
            className="shrink-0 text-[var(--muted-foreground)]"
          />
          {sidebarOpen && (
            <>
              <label htmlFor="sidebar-search" className="sr-only">
                Quick command
              </label>
              <input
                ref={searchRef}
                id="sidebar-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (event.target.value.trim()) setActiveTab("chats");
                }}
                placeholder="Quick command..."
                className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:outline-none"
              />
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  className="flex h-5 w-5 items-center justify-center text-[var(--dim-foreground)] hover:text-[var(--foreground)]"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              ) : (
                <span className="border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--dim-foreground)]">
                  Ctrl K
                </span>
              )}
            </>
          )}
        </div>

        <div
          className={cn(
            "shrink-0 border-b border-[var(--border)]",
            sidebarOpen
              ? "flex gap-0.5 px-2 pb-1"
              : "flex flex-col items-center gap-1 px-0 py-1",
          )}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center justify-center gap-1.5 font-mono font-bold uppercase tracking-[0.08em] transition-colors",
                  sidebarOpen ? "h-8 flex-1 text-[10px]" : "h-9 w-9 text-[0]",
                  selected
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--overlay)] hover:text-[var(--foreground)]",
                )}
                title={tab.label}
                aria-label={tab.label}
                aria-pressed={activeTab === tab.id}
                data-tooltip={tab.label}
              >
                <Icon size={14} />
                {sidebarOpen && <span>{tab.label}</span>}
                {sidebarOpen && tab.badge && (
                  <span className="flex h-4 min-w-4 items-center justify-center bg-[var(--primary-muted)] px-1 font-mono text-[9px] text-[var(--primary)]">
                    {tab.badge}
                  </span>
                )}
                {selected && (
                  <span
                    className={cn(
                      "absolute bg-[var(--primary)] shadow-[0_1px_8px_rgba(0,229,153,0.4)]",
                      sidebarOpen
                        ? "bottom-0 left-2 right-2 h-0.5"
                        : "right-0 top-1.5 bottom-1.5 w-0.5",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "chats" && (
          <ChatsTab expanded={sidebarOpen} search={search} />
        )}
        {sidebarOpen && activeTab === "tools" && <ToolsTab />}
        {sidebarOpen && activeTab === "activity" && <ActivityTab />}
        {sidebarOpen && activeTab === "context" && <ContextTab />}

        <div
          className={cn(
            "shrink-0 border-t border-[var(--border)] bg-gradient-to-t from-black/20 to-transparent",
            sidebarOpen
              ? "space-y-1 px-3 py-2"
              : "flex flex-col items-center gap-2 px-0 py-2",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="signal-led" />
            {sidebarOpen && (
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--dim-foreground)]">
                System ready
              </span>
            )}
          </div>
          {sidebarOpen && (
            <>
              <div className="flex items-center justify-between font-mono text-[10px] text-[var(--dim-foreground)]">
                <span>
                  Mem:{" "}
                  <span className="font-semibold text-[var(--muted-foreground)]">
                    {sessions.length}
                  </span>
                </span>
                <span>
                  CPU:{" "}
                  <span className="font-semibold text-[var(--muted-foreground)]">
                    3%
                  </span>
                </span>
                <span>
                  Up:{" "}
                  <span className="font-semibold text-[var(--muted-foreground)]">
                    2h
                  </span>
                </span>
              </div>
              <div className="border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--dim-foreground)]">
                Ctrl K Quick cmd
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
