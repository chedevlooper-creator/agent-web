"use client";

import { useChatStore, SessionItem } from "@/lib/store";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  MessageSquare,
  Pencil,
  Check,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Pin,
  Tag,
  Download,
  Sparkles,
} from "lucide-react";

function groupSessions(sessions: SessionItem[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 7 * 86400000;

  const groups: Record<string, SessionItem[]> = {
    Pinned: [],
    Today: [],
    Yesterday: [],
    "Last Week": [],
    Older: [],
  };

  for (const s of sessions) {
    const ts = new Date(s.updatedAt ?? s.createdAt).getTime();
    if (s.pinned) {
      groups.Pinned.push(s);
    } else if (ts >= todayStart) {
      groups.Today.push(s);
    } else if (ts >= yesterdayStart) {
      groups.Yesterday.push(s);
    } else if (ts >= weekStart) {
      groups["Last Week"].push(s);
    } else {
      groups.Older.push(s);
    }
  }

  return Object.entries(groups).filter(([key, vals]) => key === "Pinned" || vals.length > 0);
}

export function SessionSidebar() {
  const { sessions, currentSessionId, setSessions, setCurrentSession, setMessages, sidebarCollapsed, toggleSidebar } = useChatStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    }
  }, [setSessions]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const session = await res.json();
        setSessions([session, ...sessions]);
        setCurrentSession(session.id);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const loadSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentSession(id);
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
            toolResults: m.toolResults ? JSON.parse(m.toolResults) : undefined,
          }))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      setSessions(sessions.filter((s) => s.id !== id));
      if (currentSessionId === id) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const saveRename = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });
      setSessions(
        sessions.map((s) => (s.id === id ? { ...s, title: editTitle } : s))
      );
    } catch (e) {
      console.error(e);
    }
    setEditingId(null);
  };

  const togglePin = async (id: string, pinned: boolean) => {
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !pinned }),
      });
      setSessions(
        sessions.map((s) => (s.id === id ? { ...s, pinned: !pinned } : s))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const exportSession = async (session: SessionItem) => {
    const res = await fetch(`/api/sessions/${session.id}`);
    if (res.ok) {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${session.title.replace(/[^a-z0-9]/gi, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.tags && s.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, [sessions, searchQuery]);

  const grouped = useMemo(() => groupSessions(filteredSessions), [filteredSessions]);

  if (sidebarCollapsed) {
    return (
      <div className="w-16 border-r flex flex-col h-full shrink-0 bg-surface border-border/50 items-center py-3 gap-2 transition-all duration-300">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl hover:bg-surface-muted transition-all duration-200"
          onClick={toggleSidebar}
          title="Expand sidebar"
        >
          <PanelLeftOpen size={18} className="text-muted-foreground" />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="h-10 w-10 rounded-xl shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-105"
          onClick={createSession}
          title="New Chat"
        >
          <Plus size={18} />
        </Button>
        <div className="w-8 h-px bg-border my-2" />
        <ScrollArea className="flex-1 w-full px-1">
          <div className="flex flex-col items-center gap-1.5 py-1">
            {(Array.isArray(filteredSessions) ? filteredSessions : []).filter((s): s is typeof s & { id: string } => !!s?.id).map((session) => (
              <button
                key={session.id}
                onClick={() => loadSession(session.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  currentSessionId === session.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "hover:bg-surface-muted text-muted-foreground"
                }`}
                title={session.title}
              >
                {session.pinned ? (
                  <Pin size={14} className={session.pinned ? "text-amber-500" : ""} />
                ) : (
                  <MessageSquare size={14} />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="w-72 border-r flex flex-col h-full shrink-0 bg-surface border-border/50 transition-all duration-300">
      <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-primary/20 to-accent/20 p-1.5 rounded-lg">
            <Sparkles size={14} className="text-primary" />
          </div>
          <h2 className="text-sm font-semibold tracking-tight">Sessions</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="default"
            size="icon-sm"
            className="h-8 w-8 rounded-lg shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30"
            onClick={createSession}
            title="New Chat"
          >
            <Plus size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 rounded-lg hover:bg-surface-muted transition-all duration-200"
            onClick={toggleSidebar}
            title="Collapse sidebar"
          >
            <PanelLeftClose size={14} className="text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-border/50">
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary">
            <Search size={14} />
          </div>
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs pl-9 h-9 rounded-xl bg-surface-muted border-transparent focus:border-primary/50 focus:bg-background transition-all duration-200"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {grouped.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-12 px-4 animate-fade-in">
              <div className="bg-surface-muted p-4 rounded-2xl mb-3 inline-block">
                <MessageSquare size={24} className="opacity-30" />
              </div>
              <p className="font-medium text-foreground mb-1">No sessions yet</p>
              <p className="text-muted-foreground">Start a new conversation to begin</p>
            </div>
          )}
          {grouped.map(([groupName, groupSessions]) => (
            <div key={groupName} className="animate-slide-up">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                <span>{groupName}</span>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-muted text-[9px] font-medium">
                  {groupSessions.length}
                </span>
              </div>
              <div className="space-y-0.5 px-1">
                {(groupSessions as SessionItem[]).map((session, index) => (
                  <div
                    key={session.id}
                    className={`group/session flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm cursor-pointer transition-all duration-200 animate-fade-in ${
                      currentSessionId === session.id
                        ? "bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 shadow-sm"
                        : "hover:bg-surface-muted border border-transparent"
                    }`}
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => loadSession(session.id)}
                  >
                    {session.pinned && <Pin size={12} className="text-amber-500 shrink-0" />}
                    <MessageSquare size={14} className={`shrink-0 transition-colors duration-200 ${
                      currentSessionId === session.id ? "text-primary" : "text-muted-foreground"
                    }`} />
                    {editingId === session.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="h-7 text-xs py-0 rounded-lg"
                          onKeyDown={(e) => e.key === "Enter" && saveRename(session.id)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="h-6 w-6 rounded-lg hover:bg-success/10 hover:text-success"
                          onClick={(e) => { e.stopPropagation(); saveRename(session.id); }}
                        >
                          <Check size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="h-6 w-6 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                        >
                          <X size={12} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className={`flex-1 truncate text-xs font-medium transition-colors duration-200 ${
                          currentSessionId === session.id ? "text-foreground" : "text-foreground/80"
                        }`}>
                          {session.title}
                        </span>
                        <div className="hidden group-hover/session:flex items-center gap-0.5 opacity-0 group-hover/session:opacity-100 transition-all duration-200 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="h-6 w-6 rounded-lg hover:bg-surface-muted"
                            onClick={(e) => { e.stopPropagation(); togglePin(session.id, session.pinned ?? false); }}
                            title={session.pinned ? "Unpin" : "Pin"}
                          >
                            <Pin size={10} className={session.pinned ? "text-amber-500" : "text-muted-foreground"} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="h-6 w-6 rounded-lg hover:bg-surface-muted"
                            onClick={(e) => { e.stopPropagation(); exportSession(session); }}
                            title="Export"
                          >
                            <Download size={10} className="text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="h-6 w-6 rounded-lg hover:bg-surface-muted"
                            onClick={(e) => { e.stopPropagation(); startRename(session.id, session.title); }}
                            title="Rename"
                          >
                            <Pencil size={10} className="text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="h-6 w-6 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                            title="Delete"
                          >
                            <Trash2 size={10} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
