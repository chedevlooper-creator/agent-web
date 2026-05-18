"use client";

import { useChatStore, type Session } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  GitBranch,
  FolderOpen,
  Server,
  Wrench,
  Library,
  Activity,
  Puzzle,
  Search,
  X,
  Settings,
  LogOut,
  Bot,
  Database,
} from "lucide-react";
import { KnowledgePanel } from "@/components/knowledge-panel";
import { AgentMarketplace } from "@/components/agent-marketplace";
import { McpManager } from "@/components/mcp-manager";
import { DataManager } from "@/components/data-manager";
import { SearchDialog } from "@/components/search-dialog";
import { FileManager } from "@/components/file-manager";
import { ThemeToggle } from "@/components/theme-toggle";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

type SidebarTab = "files" | "sessions" | "tools" | "knowledge" | "agents" | "mcp" | "context";

function statusClasses(running: boolean) {
  return cn(
    "wk-status-pill",
    running && "is-running"
  );
}

function FileNode({
  node,
  depth = 0,
  onSelect,
}: {
  node: { type: "dir" | "file"; name: string; expanded?: boolean; children?: typeof node[]; active?: boolean; status?: string; size?: string };
  depth?: number;
  onSelect?: (name: string) => void;
}) {
  const [open, setOpen] = useState(node.expanded ?? false);
  const isDir = node.type === "dir";
  const pad = 10 + depth * 14;

  if (isDir) {
    return (
      <li>
        <button
          className="wk-tree-row wk-tree-row--dir"
          style={{ paddingLeft: pad }}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={cn("wk-tree-caret", open && "is-open")}>▸</span>
          <span className="wk-tree-icon">▤</span>
          <span className="wk-tree-name">{node.name}</span>
        </button>
        {open && node.children && node.children.length > 0 && (
          <ul>
            {node.children.map((c) => (
              <FileNode key={c.name} node={c as any} depth={depth + 1} onSelect={onSelect} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const status = (node as any).status;
  return (
    <li>
      <button
        className={cn("wk-tree-row", (node as any).active && "is-active")}
        style={{ paddingLeft: pad + 14 }}
        onClick={() => onSelect?.(node.name)}
      >
        <span className="wk-tree-name">{node.name}</span>
        {status && (
          <span className={`wk-tree-status wk-tree-status--${status}`}>{status}</span>
        )}
        {(node as any).size && <span className="wk-tree-size">{(node as any).size}</span>}
      </button>
    </li>
  );
}

export function WorkshopSidebar() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const hydrate = useChatStore((s) => s.hydrate);
  const hydrated = useChatStore((s) => s.hydrated);
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const [activeTab, setActiveTab] = useState<SidebarTab>("files");
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
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
        setSearchDialogOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createSession();
      }
      if (event.key === "Escape" && sidebarOpen && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, setSidebarOpen, createSession]);

  const closeMobileSidebar = useCallback(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [setSidebarOpen]);

  const handleNewChat = useCallback(async () => {
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

  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveSession(id);
      closeMobileSidebar();
    },
    [setActiveSession, closeMobileSidebar]
  );

  const handleDelete = (id: string) => {
    if (window.confirm("Bu sohbeti silmek istediğine emin misin?")) {
      deleteSession(id);
    }
  };

  if (!sidebarOpen) {
    return (
      <aside className="wk-sidebar" style={{ width: 56 }}>
        <div className="flex flex-col items-center gap-1 py-2 flex-1">
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
            aria-label="Sidebar'ı aç"
          >
            <svg viewBox="0 0 32 32" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="5" y="5" width="22" height="22" />
              <circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <button
            onClick={() => {
              setSidebarOpen(true);
              setTimeout(() => setActiveTab("sessions"), 100);
            }}
            className="flex h-9 w-9 items-center justify-center text-[var(--ink-faint)] hover:bg-[var(--bg-elev)] hover:text-[var(--ink)] transition-colors"
            title="Sohbetler"
          >
            <MessageSquare size={16} />
          </button>
          <button
            onClick={() => {
              setSidebarOpen(true);
              setTimeout(() => setActiveTab("files"), 100);
            }}
            className="flex h-9 w-9 items-center justify-center text-[var(--ink-faint)] hover:bg-[var(--bg-elev)] hover:text-[var(--ink)] transition-colors"
            title="Dosyalar"
          >
            <FolderOpen size={16} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-2 pb-3">
          <ThemeToggle />
          <button
            onClick={toggleSidebar}
            className="flex h-7 w-7 items-center justify-center text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors"
            aria-label="Sidebar'ı aç"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside className={cn("wk-sidebar", sidebarOpen && "is-open")}>
        {/* Brand */}
        <header className="wk-brand">
          <div className="wk-brand-mark">
            <svg viewBox="0 0 32 32" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="5" y="5" width="22" height="22" />
              <path d="M5 16 L16 5 L27 16 L16 27 Z" opacity="0.55" />
              <circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="wk-brand-text">
            <span className="wk-brand-name">Agent Web</span>
            <span className="wk-brand-sub">workshop</span>
          </div>
          <span className={statusClasses(false)}>hazır</span>
        </header>

        {/* Workspace info */}
        <div className="wk-workspace">
          <div className="wk-workspace-row">
            <span className="wk-ws-icon">⌥</span>
            <span className="wk-ws-name">agent-web</span>
            <span className="wk-ws-branch">main</span>
          </div>
          <div className="wk-workspace-meta">
            <span><span className="wk-dot wk-dot--m" /> 3 değişiklik</span>
            <span className="wk-sep">·</span>
            <span>node-22</span>
            <span className="wk-sep">·</span>
            <span>pnpm 9</span>
          </div>
        </div>

        {/* Tabs */}
        <nav className="wk-tabs">
          {[
            { id: "files" as SidebarTab, label: "Dosyalar", glyph: "▤" },
            { id: "sessions" as SidebarTab, label: "Sohbetler", glyph: "≡" },
            { id: "tools" as SidebarTab, label: "Araçlar", glyph: "⌬" },
          ].map((t) => (
            <button
              key={t.id}
              className={cn("wk-tab", activeTab === t.id && "is-active")}
              onClick={() => setActiveTab(t.id)}
            >
              <span className="wk-tab-glyph">{t.glyph}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Tab body */}
        <div className="wk-sidebar-body">
          {activeTab === "files" && <FileManager expanded={true} />}

          {activeTab === "sessions" && (
            <ul className="wk-session-list">
              <li>
                <button className="wk-new-session" onClick={handleNewChat}>
                  <span className="wk-new-session-glyph">+</span>
                  <span>Yeni sohbet</span>
                  <kbd>⌘N</kbd>
                </button>
              </li>
              {sessions.slice(0, 20).map((s) => (
                <li key={s.id} className="group relative">
                  <button
                    className={cn("wk-session", s.id === activeSessionId && "is-active")}
                    onClick={() => handleSelectSession(s.id)}
                  >
                    <span className="wk-session-marker">
                      {s.id === activeSessionId ? "▸" : " "}
                    </span>
                    <span className="wk-session-title">{s.title}</span>
                    <span className="wk-session-time">
                      {new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(s.updatedAt))}
                    </span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                    className="absolute right-1 top-1/2 flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center border border-transparent bg-[var(--bg-elev)] text-[var(--ink-faint)] opacity-0 transition-all hover:border-[var(--danger)] hover:text-[var(--danger)] group-hover:opacity-100"
                    aria-label="Sohbeti sil"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
              {sessions.length === 0 && (
                <li className="px-3 py-8 text-xs text-[var(--ink-faint)] text-center">
                  Henüz sohbet yok.
                </li>
              )}
            </ul>
          )}

          {activeTab === "tools" && (
            <ul className="wk-tools">
              {[
                { name: "terminal", glyph: "❯", on: true },
                { name: "read_file", glyph: "◧", on: true },
                { name: "write_file", glyph: "◨", on: true },
                { name: "search_files", glyph: "⌕", on: true },
                { name: "web_search", glyph: "◯", on: true },
                { name: "git", glyph: "⌥", on: true },
                { name: "db_query", glyph: "▤", on: false },
              ].map((t) => (
                <li key={t.name}>
                  <label className="wk-tool-row">
                    <span className="wk-tool-glyph">{t.glyph}</span>
                    <span className="wk-tool-name">{t.name}</span>
                    <span className={cn("wk-tool-toggle", t.on && "is-on")}>
                      <span className="wk-tool-toggle-pin" />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <footer className="wk-sidebar-footer">
          <div className="wk-context-bar">
            <div className="wk-context-label">
              <span>bağlam</span>
              <span className="wk-context-num">14.2k / 80k</span>
            </div>
            <div className="wk-context-track">
              <div className="wk-context-fill" style={{ width: "17.7%" }} />
            </div>
          </div>
          <button className="wk-user-btn">
            <span className="wk-user-avatar">SS</span>
            <span>@sertacc</span>
            <Settings size={12} className="ml-auto text-[var(--ink-faint)]" />
          </button>
        </footer>

        {/* Bottom row */}
        <div className="flex items-center gap-1 border-t border-[var(--rule-soft)] px-2 py-1.5">
          <ThemeToggle />
          <KeyboardShortcuts>
            <button
              className="flex h-7 w-7 items-center justify-center text-[var(--ink-faint)] hover:bg-[var(--bg-elev)] hover:text-[var(--ink)] transition-colors"
              aria-label="Klavye kısayolları"
              title="Klavye kısayolları"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h8" />
              </svg>
            </button>
          </KeyboardShortcuts>
          <button
            onClick={toggleSidebar}
            className="ml-auto flex h-7 w-7 items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
            aria-label="Sidebar'ı kapat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </aside>

      <SearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} />
    </>
  );
}

// Keep old export name for compatibility
export { WorkshopSidebar as Sidebar };
