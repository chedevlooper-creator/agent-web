"use client";

import { useChatStore, useIsEmptySession } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Wrench,
  Puzzle,
  CheckCircle2,
  RefreshCw,
  Search,
  X,
  Pencil,
  Paintbrush,
  FlaskConical,
  Database,
  Gamepad2,
  Code,
  FileText,
  Globe,
  Brain,
  Palette,
  FolderOpen,
  ChevronRight,
  Box,
  BarChart3,
  BookOpen,
  Settings,
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
type Group = "Bugün" | "Dün" | "Son 7 Gün" | "Son 30 Gün" | "Daha Eski";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupOf(timestamp: number): Group {
  const now = new Date();
  const today = startOfDay(now);
  const ts = startOfDay(new Date(timestamp));
  const diffDays = Math.floor((today - ts) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Bugün";
  if (diffDays === 1) return "Dün";
  if (diffDays <= 7) return "Son 7 Gün";
  if (diffDays <= 30) return "Son 30 Gün";
  return "Daha Eski";
}

const GROUP_ORDER: Group[] = [
  "Bugün",
  "Dün",
  "Son 7 Gün",
  "Son 30 Gün",
  "Daha Eski",
];

function AgentMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25L16 2.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 8.4 22.4 12.1v7.8L16 23.6 9.6 19.9v-7.8L16 8.4Z" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".8" />
      <path d="M16 8.4v15.2M9.6 12.1 22.4 19.9M22.4 12.1 9.6 19.9" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" />
    </svg>
  );
}

function formatSessionMeta(timestamp?: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ===== Project Bar =====
function ProjectBar() {
  const projects = useChatStore((s) => s.projects);
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const setActiveProject = useChatStore((s) => s.setActiveProject);
  const createProject = useChatStore((s) => s.createProject);
  const [creating, setCreating] = useState(false);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createProject(`Proje ${projects.length + 1}`);
    } catch {
      toast.error("Proje oluşturulamadı");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-border/60 px-4 pb-3 pt-3">
      <button
        type="button"
        onClick={() => {
          if (projects.length > 0) {
            const next = activeProject ? null : projects[0].id;
            setActiveProject(next);
          } else {
            handleCreate();
          }
        }}
        disabled={creating}
        className="flex min-h-[72px] w-full items-center gap-3 rounded-lg border border-border-strong bg-chrome-muted/70 px-4 text-left transition-[border-color,box-shadow,transform] duration-200 hover:border-electric/35 hover:shadow-[0_0_24px_rgba(176,226,39,0.10)] active:scale-[0.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Proje"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-electric/25 bg-electric-muted/40 text-electric">
          <FolderOpen size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="section-label block">Proje</span>
          <span className="block truncate text-sm font-semibold text-fg-primary">
            {activeProject?.name || "agent-web"}
          </span>
        </span>
        <ChevronRight size={16} className="text-fg-muted" aria-hidden="true" />
      </button>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          { icon: Box, label: "Sistem", active: true },
          { icon: BarChart3, label: "Metrikler" },
          { icon: BookOpen, label: "Dokümanlar" },
          { icon: Settings, label: "Ayarlar" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className={cn(
                "flex min-h-[48px] items-center justify-center rounded-lg border transition-[background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                item.active
                  ? "border-electric/35 bg-electric-muted/35 text-electric"
                  : "border-border/70 bg-black/15 text-fg-secondary hover:border-cyan/30 hover:text-cyan"
              )}
              aria-label={item.label}
            >
              <Icon size={18} aria-hidden="true" />
            </button>
          );
        })}
      </div>
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
  session: { id: string; title: string; updatedAt?: number };
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
    <div className="group relative animate-sidebar-item">
      {isEditing ? (
        <div
          className={cn(
            "min-h-[48px] w-full flex items-center gap-2.5 border px-3 text-left text-sm",
            isActive ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          <MessageSquare
            size={15}
            className={cn("shrink-0 transition-colors duration-200", isActive ? "text-primary" : "")}
            aria-hidden="true"
          />
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
            className="min-h-[44px] flex-1 bg-transparent text-sm border-none outline-none focus:ring-2 focus:ring-primary/30 rounded-lg px-2 -mx-2"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "min-h-[42px] w-full flex items-center gap-2.5 px-3 pr-20 text-left text-[13px] cursor-pointer rounded-[6px]",
            "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring relative group/btn",
            isActive
              ? "bg-white/[0.075] text-foreground font-medium shadow-[inset_0_0_0_1px_rgba(176,226,39,0.04)]"
              : "bg-transparent text-muted-foreground hover:bg-white/[0.045] hover:text-foreground"
          )}
          aria-current={isActive ? "page" : undefined}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 h-7 w-[2px] -translate-y-1/2 bg-electric shadow-[0_0_14px_rgba(176,226,39,0.9)]" />
          )}
          <MessageSquare
            size={14}
            className={cn("shrink-0 transition-colors duration-200", isActive ? "text-electric" : "opacity-80 group-hover/btn:opacity-100")}
            aria-hidden="true"
          />
          <span className="truncate flex-1">{session.title}</span>
          <span className="absolute right-3 top-1/2 max-w-[64px] -translate-y-1/2 truncate text-[10px] font-medium text-muted-foreground/70 transition-opacity duration-200 group-hover/btn:opacity-0">
            {formatSessionMeta(session.updatedAt)}
          </span>
        </button>
      )}
      {!isEditing && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-transparent hover:border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Oturumu yeniden adlandır"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-transparent hover:border-destructive/25 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Oturumu sil"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ===== Chats Tab =====
function ChatsTab({
  sidebarOpen,
  tabs,
  activeTab,
  setActiveTab,
}: {
  sidebarOpen: boolean;
  tabs?: { id: SidebarTab; icon: typeof MessageSquare; label: string }[];
  activeTab?: SidebarTab;
  setActiveTab?: (tab: SidebarTab) => void;
}) {
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const renameSession = useChatStore((s) => s.renameSession);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);

  const [search, setSearch] = useState("");
  const [searchUnlocked, setSearchUnlocked] = useState(false);

  const handleDelete = (id: string) => {
    if (typeof window !== "undefined" && window.confirm("Bu konuşma silinsin mi?")) {
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
      (s) => s.title === "Yeni Sohbet" && (!s.messages || s.messages.length === 0)
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
    const emptyNewChats = list.filter(s => s.title === "Yeni Sohbet" && (!s.messages || s.messages.length === 0));
    if (emptyNewChats.length > 1) {
      const keepId = emptyNewChats.find(s => s.id === activeSessionId)?.id || emptyNewChats[0].id;
      list = list.filter(s => !(s.title === "Yeni Sohbet" && (!s.messages || s.messages.length === 0) && s.id !== keepId));
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, search, activeSessionId]);

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

  if (!sidebarOpen) {
    return (
      <>
        <div className="p-3 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto
                       border border-dashed border-border/60
                       hover:bg-primary/10 hover:border-primary/40 hover:text-primary
                       active:scale-95 transition-[background-color,border-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Yeni sohbet"
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
                onClick={() => handleSelectSession(session.id)}
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center mx-auto transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                )}
                title={session.title}
                aria-label={`${session.title} oturumunu aç`}
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
      <div className="p-3 shrink-0 space-y-4">
        {/* New chat */}
        <button
          type="button"
          onClick={handleNewChat}
          className={cn(
            "min-h-[46px] w-full flex items-center justify-between px-3 text-sm font-semibold rounded-[6px]",
            "bg-electric text-black border border-electric/40 shadow-[0_0_15px_rgba(176,226,39,0.15)]",
            "hover:shadow-[0_0_25px_rgba(176,226,39,0.25)]",
            "active:scale-[0.98] transition-all duration-200"
          )}
          aria-label="Yeni sohbet"
        >
          <div className="flex items-center gap-2">
            <Plus size={16} aria-hidden="true" />
            <span>Yeni Sohbet</span>
          </div>
          <div className="flex items-center gap-1 opacity-90">
            <span className="text-[10px] font-mono border border-black/20 bg-black/5 px-1.5 rounded-[3px]">Ctrl</span>
            <span className="text-[10px] font-mono border border-black/20 bg-black/5 px-1.5 rounded-[3px]">N</span>
          </div>
        </button>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            name="chat-search"
            autoComplete="new-password"
            data-1p-ignore="true"
            data-lpignore="true"
            spellCheck={false}
            readOnly={!searchUnlocked}
            onFocus={() => setSearchUnlocked(true)}
            onPointerDown={() => setSearchUnlocked(true)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sohbetlerde ara..."
            className={cn(
              "w-full pl-9 pr-14 py-2 min-h-[38px] text-[13px] rounded-[6px]",
              "bg-black/30 border border-border/40",
              "placeholder:text-muted-foreground/60",
              "focus:outline-none focus:border-electric/40 focus:ring-1 focus:ring-electric/20",
              "transition-all duration-200"
            )}
          />
          {search ? (
            <button
              onClick={() => setSearch("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded bg-black/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center transition-colors"
              aria-label="Aramayı temizle"
            >
              <X size={12} />
            </button>
          ) : (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-80 pointer-events-none">
              <span className="text-[9px] font-mono border border-border/40 bg-black/40 px-1 rounded-[3px] text-muted-foreground">Ctrl</span>
              <span className="text-[9px] font-mono border border-border/40 bg-black/40 px-1 rounded-[3px] text-muted-foreground">K</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        {tabs && activeTab && setActiveTab && (
          <div className="flex items-center gap-2 border-b border-border/20 pb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 h-[34px] rounded-[6px] text-[12px] font-medium transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-white/5 text-foreground border border-border/40 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <tab.icon size={14} aria-hidden="true" className={activeTab === tab.id ? "text-electric" : "opacity-70"} />
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-4">
        {grouped.length > 0 ? (
          <>
            {GROUP_ORDER.map(groupName => {
              const actualGroup = grouped.find(g => g.group === groupName);
              if (!actualGroup) return null;
              
              return (
                <div key={groupName} className="space-y-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pb-1">
                    {groupName}
                  </p>
                  
                  {actualGroup?.sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      onSelect={() => handleSelectSession(session.id)}
                      onDelete={() => handleDelete(session.id)}
                      onRename={(id, title) => renameSession(id, title)}
                    />
                  ))}
                </div>
              );
            })}
          </>
        ) : search && filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-8 px-4 animate-fade-in">
            &quot;{search}&quot; ile eşleşen sohbet yok.
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
              className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto
                         text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors duration-200"
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
        Ajan Araçları
      </p>
      {tools.map(([key, tool]) => {
        const Icon = getToolIcon(key);
        return (
          <div
            key={key}
            className="flex items-center gap-3 px-3 py-3 rounded-xl glass-card transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/20 hover-lift"
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
        Araçlar yerel makinede tam yetkiyle çalışır. Yalnızca güvenilir
        geliştirme ortamlarında kullanın.
      </p>
    </div>
  );
}

function getSkillIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("design") || n.includes("ui") || n.includes("styling") || n.includes("banner")) return Paintbrush;
  if (n.includes("test") || n.includes("debug") || n.includes("audit")) return FlaskConical;
  if (n.includes("insforge") || n.includes("db") || n.includes("data")) return Database;
  if (n.includes("unity") || n.includes("game")) return Gamepad2;
  if (n.includes("react") || n.includes("vercel") || n.includes("next") || n.includes("frontend")) return Code;
  if (n.includes("ppt") || n.includes("slides") || n.includes("docx") || n.includes("pdf") || n.includes("xlsx")) return FileText;
  if (n.includes("browser") || n.includes("web") || n.includes("desktop")) return Globe;
  if (n.includes("graph") || n.includes("memory") || n.includes("workspace")) return Brain;
  if (n.includes("brand") || n.includes("ckm")) return Palette;
  return Puzzle;
}

function getSkillColor(name: string) {
  const n = name.toLowerCase();
  if (n.includes("design") || n.includes("ui") || n.includes("banner")) return "text-pink-400 bg-pink-400/10";
  if (n.includes("test") || n.includes("debug") || n.includes("audit")) return "text-amber-400 bg-amber-400/10";
  if (n.includes("insforge") || n.includes("db") || n.includes("data")) return "text-emerald-400 bg-emerald-400/10";
  if (n.includes("unity") || n.includes("game")) return "text-violet-400 bg-violet-400/10";
  if (n.includes("react") || n.includes("vercel") || n.includes("frontend")) return "text-sky-400 bg-sky-400/10";
  if (n.includes("ppt") || n.includes("docx") || n.includes("pdf") || n.includes("xlsx")) return "text-orange-400 bg-orange-400/10";
  if (n.includes("browser") || n.includes("web") || n.includes("desktop")) return "text-cyan-400 bg-cyan-400/10";
  if (n.includes("graph") || n.includes("memory") || n.includes("workspace") || n.includes("brain")) return "text-purple-400 bg-purple-400/10";
  return "text-accent bg-accent-muted";
}

function getSkillCategory(name: string) {
  const n = name.toLowerCase();
  if (n.includes("design") || n.includes("ui") || n.includes("styling") || n.includes("banner")) return "Tasarım";
  if (n.includes("test") || n.includes("debug") || n.includes("audit")) return "Kalite";
  if (n.includes("react") || n.includes("next") || n.includes("frontend") || n.includes("vercel")) return "Önyüz";
  if (n.includes("slides") || n.includes("docx") || n.includes("pdf") || n.includes("xlsx")) return "Doküman";
  if (n.includes("insforge") || n.includes("db") || n.includes("data")) return "Veri";
  if (n.includes("browser") || n.includes("web") || n.includes("desktop")) return "Çalışma Zamanı";
  return "Ajan";
}

// ===== Skills Tab =====
function SkillsTab({ expanded }: { expanded: boolean }) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const selectedSkills = useChatStore((s) => s.selectedSkills);
  const toggleSkill = useChatStore((s) => s.toggleSkill);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  }, [skills, search]);

  if (!expanded) {
    return (
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {skills.slice(0, 12).map((s) => {
          const Icon = getSkillIcon(s.name);
          const isSelected = selectedSkills.includes(s.path);
          return (
            <button
              key={s.name}
              onClick={() => toggleSkill(s.path)}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center mx-auto",
                "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "text-electric bg-electric-muted/20"
                  : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              )}
              title={s.name}
              aria-label={`${s.name} yeteneğini ${isSelected ? "kaldır" : "ekle"}`}
              aria-pressed={isSelected}
            >
              <Icon size={18} />
            </button>
          );
        })}
        {skills.length === 0 && !loading && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto text-muted-foreground">
            <Puzzle size={18} className="opacity-30" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Header with count */}
      <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">Yetenekler</span>
          {!loading && (
            <span className="text-[10px] font-medium text-muted-foreground bg-surface-muted/60 px-1.5 py-0.5 rounded-md tabular-nums">
              {skills.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchSkills}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-elevated transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Yetenekleri yenile"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            name="skill-filter"
            autoComplete="new-password"
            data-1p-ignore="true"
            data-lpignore="true"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Yetenekleri filtrele…"
            className="min-h-[44px] w-full pl-8 pr-8 rounded-xl text-xs
                       bg-surface-muted/50 border border-border-muted
                       placeholder:text-muted-foreground/40
                       focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30
                       transition-[border-color,box-shadow,background-color] duration-200"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center"
              aria-label="Aramayı temizle"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {loading ? (
          <div className="space-y-1.5 pt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-lg animate-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-10 px-4 space-y-2.5">
            <div className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
              <Puzzle size={18} className="text-muted-foreground/30" />
            </div>
            <p className="text-xs text-muted-foreground">Henüz yetenek yüklenmemiş.</p>
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed max-w-[200px] mx-auto">
              <code className="px-1 py-0.5 rounded bg-surface-muted text-[10px] border border-border-muted font-mono">skills/</code> dizinine yetenek ekleyin
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-muted-foreground">&quot;{search}&quot; ile eşleşen yetenek yok</p>
          </div>
        ) : (
          filtered.map((skill, i) => {
            const Icon = getSkillIcon(skill.name);
            const colorClass = getSkillColor(skill.name);
            const isSelected = selectedSkills.includes(skill.path);
            return (
              <button
                key={skill.path}
                onClick={() => toggleSkill(skill.path)}
                className={cn(
                  "group flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-left",
                  "transition-all duration-150",
                  "hover:bg-surface-elevated/70",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "animate-slide-up",
                  isSelected && "bg-electric-muted/20 ring-1 ring-electric/30"
                )}
                style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}
                aria-pressed={isSelected}
                aria-label={`${skill.name} yeteneğini ${isSelected ? "kaldır" : "ekle"}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 leading-tight">
                    <span className="min-w-0 truncate text-[12px] font-medium text-foreground">
                      {skill.name}
                    </span>
                    <span className="shrink-0 rounded-md border border-border-muted bg-surface-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {getSkillCategory(skill.name)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 truncate leading-relaxed mt-0.5">
                    {skill.description}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ===== Main Sidebar =====
export function Sidebar() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const [activeTab, setActiveTab] = useState<SidebarTab>("chats");

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

  const showVideo = useIsEmptySession();

  const tabs: { id: SidebarTab; icon: typeof MessageSquare; label: string }[] = [
    { id: "chats", icon: MessageSquare, label: "Sohbetler" },
    { id: "tools", icon: Wrench, label: "Araçlar" },
    { id: "skills", icon: Puzzle, label: "Yetenekler" },
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
          "fixed md:relative z-50 h-dvh flex flex-col overflow-hidden",
          showVideo
            ? "glass-subtle border-r border-border/20"
            : "sidebar-cockpit border-r border-border/60",
          "transition-[width,transform,background-color,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarOpen
            ? "w-[320px] 2xl:w-[360px] translate-x-0"
            : "w-0 md:w-[64px] -translate-x-[320px] 2xl:-translate-x-[360px] md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center h-[82px] px-5 border-b shrink-0 transition-colors duration-500", showVideo ? "border-border/20" : "border-border/60")}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-11 h-11 flex items-center justify-center shrink-0 text-electric shadow-[0_0_22px_rgba(176,226,39,0.14)] animate-pulse-ring">
                  <AgentMark className="h-11 w-11" />
                </div>
                <span className="font-black text-lg uppercase truncate animate-fade-in">
                  Agent <span className="text-electric">Web</span>
                </span>
              </div>
              <button
                onClick={toggleSidebar}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-transparent hover:border-border/70 hover:bg-muted transition-colors duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Kenar çubuğunu daralt"
              >
                <PanelLeftClose size={16} className="text-muted-foreground" />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-transparent hover:border-border/70 hover:bg-muted transition-colors duration-200 mx-auto active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Kenar çubuğunu genişlet"
            >
              <PanelLeft size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Tab bar — segmented control style */}
        {sidebarOpen ? (
          activeTab !== "chats" && (
          <div className={cn("px-3 py-2 border-b shrink-0 transition-colors duration-500", showVideo ? "border-border/20" : "border-border/60")}>
            <div className="relative flex items-center gap-1 border border-border/70 bg-black/20 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative z-10 min-h-[44px] flex-1 flex items-center justify-center gap-1.5 px-2 text-[11px] font-semibold",
                    "transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeTab === tab.id
                      ? "bg-electric text-black shadow-[0_0_18px_rgba(176,226,39,0.16)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={tab.label}
                  title={tab.label}
                >
                  <tab.icon size={15} aria-hidden="true" />
                  <span className="sr-only">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          )
        ) : (
          <div className={cn("flex flex-col items-center gap-1 py-2 border-b shrink-0 transition-colors duration-500", showVideo ? "border-border/20" : "border-border/40")}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center",
                  "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                )}
                title={tab.label}
                aria-label={tab.label}
              >
                <tab.icon size={18} />
              </button>
            ))}
          </div>
        )}

        {activeTab === "chats" && (
          <ChatsTab
            sidebarOpen={sidebarOpen}
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === "tools" && <ToolsTab expanded={sidebarOpen} />}
        {activeTab === "skills" && <SkillsTab expanded={sidebarOpen} />}
        {sidebarOpen && <ProjectBar />}
      </aside>
    </>
  );
}
