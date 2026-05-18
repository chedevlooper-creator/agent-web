"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Search, MessageSquare, FileText, Command, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/store";

interface MessageResult {
  id: string;
  sessionId: string;
  snippet: string;
  role: string;
  timestamp: number;
}

interface SessionResult {
  id: string;
  title: string;
  updatedAt: number;
}

interface SearchResults {
  messages: MessageResult[];
  sessions: SessionResult[];
}

const RECENT_SEARCHES_KEY = "agent-web-recent-searches";
const MAX_RECENT = 8;

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT);
    }
  } catch {}
  return [];
}

function saveRecentSearch(query: string) {
  try {
    const recent = loadRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {}
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setActiveSession = useChatStore((s) => s.setActiveSession);

  useEffect(() => {
    if (open) {
      setRecentSearches(loadRecentSearches());
      setQuery("");
      setResults(null);
      setSearched(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as { results: SearchResults };
      setResults(data.results);
      if (data.results.messages.length > 0 || data.results.sessions.length > 0) {
        saveRecentSearch(trimmed);
        setRecentSearches(loadRecentSearches());
      }
    } catch {
      setResults({ messages: [], sessions: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch]
  );

  const handleSelectMessage = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId);
      onOpenChange(false);
    },
    [setActiveSession, onOpenChange]
  );

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId);
      onOpenChange(false);
    },
    [setActiveSession, onOpenChange]
  );

  const handleRecentClick = useCallback(
    (q: string) => {
      setQuery(q);
      doSearch(q);
    },
    [doSearch]
  );

  if (!open) return null;

  const hasResults =
    results && (results.messages.length > 0 || results.sessions.length > 0);
  const emptyResults = searched && results && !hasResults;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Search messages and sessions"
    >
      <div className="fixed inset-0 bg-black/60" onClick={() => onOpenChange(false)} />
      <div
        className="relative z-10 w-full max-w-lg animate-scale-in border border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Search size={16} className="shrink-0 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search messages and sessions..."
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:outline-none"
          />
          {loading ? (
            <Loader2 size={14} className="animate-spin shrink-0 text-[var(--muted-foreground)]" />
          ) : query ? (
            <button
              onClick={() => {
                setQuery("");
                setResults(null);
                setSearched(false);
                inputRef.current?.focus();
              }}
              className="flex h-5 w-5 items-center justify-center text-[var(--dim-foreground)] hover:text-[var(--foreground)]"
            >
              <X size={13} />
            </button>
          ) : null}
          <kbd className="flex h-5 items-center border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 font-mono text-[10px] text-[var(--dim-foreground)]">
            <Command size={10} className="mr-0.5" />K
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-[var(--overlay)] p-2.5"
                >
                  <div className="h-4 w-4 animate-shimmer bg-[var(--surface-elevated)]" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="h-3 w-3/4 animate-shimmer bg-[var(--surface-elevated)]" />
                    <div className="h-2.5 w-1/2 animate-shimmer bg-[var(--surface-elevated)]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search results */}
          {!loading && hasResults && (
            <div className="p-2">
              {results.messages.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <MessageSquare size={12} className="text-[var(--primary)]" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                      Messages ({results.messages.length})
                    </span>
                  </div>
                  {results.messages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg.sessionId)}
                      className="flex w-full items-start gap-3 px-2 py-2 text-left transition-colors hover:bg-[var(--overlay)]"
                    >
                      <MessageSquare
                        size={14}
                        className="mt-0.5 shrink-0 text-[var(--muted-foreground)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-mono text-[10px] font-bold uppercase tracking-[0.06em]",
                              msg.role === "user"
                                ? "text-[var(--primary)]"
                                : "text-[var(--info)]"
                            )}
                          >
                            {msg.role}
                          </span>
                          <span className="font-mono text-[9px] text-[var(--dim-foreground)]">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--muted-foreground)]">
                          {msg.snippet}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.sessions.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <FileText size={12} className="text-[var(--info)]" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                      Sessions ({results.sessions.length})
                    </span>
                  </div>
                  {results.sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className="flex w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-[var(--overlay)]"
                    >
                      <FileText
                        size={14}
                        className="shrink-0 text-[var(--muted-foreground)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-[var(--foreground)]">
                          {session.title}
                        </div>
                        <div className="mt-0.5 font-mono text-[9px] text-[var(--dim-foreground)]">
                          {formatTime(session.updatedAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state: no results */}
          {!loading && emptyResults && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Search size={24} className="text-[var(--dim-foreground)]" />
              <span className="text-sm font-medium text-[var(--muted-foreground)]">
                No results for &quot;{query}&quot;
              </span>
              <span className="font-mono text-[10px] text-[var(--dim-foreground)]">
                Try a different search term
              </span>
            </div>
          )}

          {/* Empty state: recent searches */}
          {!loading && !searched && !query && (
            <div className="p-3">
              {recentSearches.length > 0 ? (
                <>
                  <div className="mb-2 px-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                    Recent Searches
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((q, i) => (
                      <button
                        key={`${q}-${i}`}
                        onClick={() => handleRecentClick(q)}
                        className="border border-[var(--border)] bg-[var(--overlay)] px-2 py-1 font-mono text-[11px] text-[var(--muted-foreground)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Command size={20} className="text-[var(--dim-foreground)]" />
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">
                    Type to search across all messages and sessions
                  </span>
                  <span className="font-mono text-[10px] text-[var(--dim-foreground)]">
                    Press Ctrl+K to toggle this dialog
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--dim-foreground)]">
            <span className="border border-[var(--border)] bg-[var(--surface-elevated)] px-1">↑↓</span>
            Navigate
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--dim-foreground)]">
            <span className="border border-[var(--border)] bg-[var(--surface-elevated)] px-1">Esc</span>
            Close
          </div>
        </div>
      </div>
    </div>
  );
}
