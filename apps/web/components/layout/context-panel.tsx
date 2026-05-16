"use client";

import { useChatStore, useActiveSession, useShowVideo, type ChatMessage } from "@/lib/store";
import { cn, estimateTokens } from "@/lib/utils";
import { useMemo, useState, useEffect } from "react";
import {
  X,
  Cpu,
  Database,
  Network,
  Clock,
  Key,
  Zap,
  MessageSquare,
  Wrench,
  Bot,
  User,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { getToolIcon } from "@/lib/tool-icons";

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  return `${(tokens / 1000).toFixed(1)}k`;
}

// ===== Tool Icon Mapper =====
function ToolIcon({ name }: { name: string }) {
  const Icon = getToolIcon(name);
  const iconClass = name.includes("terminal") || name.includes("shell") ? "text-success"
    : name.includes("file") || name.includes("read") ? "text-accent"
    : name.includes("web") || name.includes("search") ? "text-primary"
    : "text-muted-foreground";
  return <Icon size={10} className={iconClass} />;
}

// ===== Stat Card =====
function StatCard({ label, value, icon: Icon, accent }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon size={12} className={accent || "text-muted-foreground"} />
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums text-foreground">{value}</span>
    </div>
  );
}

// ===== Activity Timeline Item =====
function ActivityItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = !isUser && message.content.startsWith("Error:");
  const toolCount = message.toolInvocations?.length || 0;
  const preview = message.content.slice(0, 60).replace(/\n/g, " ");

  return (
    <div className="relative text-xs group">
      {/* Timeline dot with glow */}
      <div
        className={cn(
          "absolute -left-[14px] top-1.5 w-2 h-2 rounded-full border-2 border-surface transition-all duration-200",
          isError
            ? "bg-destructive shadow-sm shadow-destructive/40"
            : isUser
              ? "bg-primary shadow-sm shadow-primary/40"
              : "bg-accent shadow-sm shadow-accent/40"
        )}
      />
      {/* Header */}
      <div className="flex items-center gap-1.5">
        {isUser ? (
          <User size={10} className="text-primary shrink-0" />
        ) : (
          <Bot size={10} className="text-accent shrink-0" />
        )}
        <span className="text-foreground font-medium">
          {isError ? "Error" : isUser ? "You" : "Agent"}
        </span>
        {toolCount > 0 && (
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <Wrench size={9} /> {toolCount}
          </span>
        )}
        <span className="text-muted-foreground/50 ml-auto text-[10px] tabular-nums">
          {formatRelativeTime(message.timestamp)}
        </span>
      </div>
      {/* Preview */}
      <p className="text-muted-foreground truncate mt-0.5 pl-4 pr-2 leading-relaxed">
        {isError ? message.content.slice(7, 67) : preview || "…"}
      </p>
      {/* Tool invocations */}
      {message.toolInvocations && message.toolInvocations.length > 0 && (
        <div className="pl-4 mt-1 flex flex-wrap gap-1">
          {message.toolInvocations.map((t) => (
            <span
              key={t.toolCallId}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                t.state === "result"
                  ? "bg-success/8 text-success border border-success/12"
                  : "bg-warning/8 text-warning border border-warning/12"
              )}
            >
              <ToolIcon name={t.toolName} />
              {t.toolName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Main Context Panel =====
export function ContextPanel() {
  const contextPanelOpen = useChatStore((s) => s.contextPanelOpen);
  const toggleContextPanel = useChatStore((s) => s.toggleContextPanel);
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const apiKey = useChatStore((s) => s.apiKey);
  const isLoading = useChatStore((s) => s.isLoading);
  const compareMode = useChatStore((s) => s.compareMode);
  const selectedModels = useChatStore((s) => s.selectedModels);
  const activeSession = useActiveSession();

  const stats = useMemo(() => {
    if (!activeSession) {
      return {
        messageCount: 0, userMessages: 0, assistantMessages: 0,
        estimatedTokens: 0, toolCalls: 0, pendingTools: 0,
        uniqueModels: [] as string[], sessionAge: "", lastActivity: "",
        errorCount: 0, wordCount: 0,
      };
    }
    const msgs = activeSession.messages;
    const userMsgs = msgs.filter((m) => m.role === "user");
    const assistantMsgs = msgs.filter((m) => m.role === "assistant");
    let toolCalls = 0;
    let pendingTools = 0;
    for (const m of msgs) {
      if (m.toolInvocations) {
        toolCalls += m.toolInvocations.length;
        pendingTools += m.toolInvocations.filter((t) => t.state === "pending").length;
      }
    }
    const uniqueModels = [...new Set(assistantMsgs.map((m) => m.model).filter(Boolean))] as string[];
    const errorCount = assistantMsgs.filter((m) => m.content.startsWith("Error:")).length;
    const wordCount = msgs.reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0);
    return {
      messageCount: msgs.length, userMessages: userMsgs.length, assistantMessages: assistantMsgs.length,
      estimatedTokens: estimateTokens(msgs), toolCalls, pendingTools, uniqueModels,
      sessionAge: formatRelativeTime(activeSession.createdAt),
      lastActivity: msgs.length > 0 ? formatRelativeTime(msgs[msgs.length - 1].timestamp) : "—",
      errorCount, wordCount,
    };
  }, [activeSession]);

  const recentActivity = useMemo(() => {
    if (!activeSession) return [];
    return activeSession.messages.slice(-5).reverse();
  }, [activeSession]);

  const tokenCapacity = useMemo(() => {
    const max = 128000;
    const pct = Math.min((stats.estimatedTokens / max) * 100, 100);
    return { pct, color: pct > 80 ? "var(--destructive)" : pct > 50 ? "var(--warning)" : "var(--primary)" };
  }, [stats.estimatedTokens]);

  const showVideo = useShowVideo();

  if (!contextPanelOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-fade-in cursor-pointer"
        onClick={toggleContextPanel}
      />

      {/* Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-[320px]",
          "lg:static lg:block",
          "flex flex-col",
          showVideo
            ? "glass-subtle border-l border-border/15"
            : "bg-surface/90 backdrop-blur-md border-l border-border/40",
          "shadow-2xl lg:shadow-none",
          "animate-slide-in-right transition-all duration-500"
        )}
      >
        {/* Header */}
        <div className={cn("h-14 flex items-center justify-between px-4 border-b shrink-0 transition-colors duration-500", showVideo ? "border-border/15" : "border-border/40")}>
          <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground tracking-tight">
            <Database size={14} className="text-primary" />
            Context
          </h2>
          <button
            onClick={toggleContextPanel}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer active:scale-95"
            aria-label="Close context panel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* ── Provider & Connection ── */}
          <section className="space-y-2">
            <h3 className="section-label flex items-center gap-1.5">
              <Zap size={10} />
              Connection
            </h3>
            <div className="glass-card rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium capitalize text-foreground">{provider}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Model</span>
                <span className="font-mono text-[10px] truncate max-w-[140px] text-foreground" title={model}>
                  {model.split("/").pop()}
                </span>
              </div>
              {compareMode && selectedModels.length > 1 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Compare</span>
                  <span className="text-accent font-semibold">{selectedModels.length} models</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Key size={10} /> API Key
                </span>
                <span className={cn("flex items-center gap-1.5 font-medium", apiKey ? "text-success" : "text-destructive")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", apiKey ? "bg-success shadow-sm shadow-success/50" : "bg-destructive shadow-sm shadow-destructive/50")} />
                  {apiKey ? "Connected" : "Missing"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className={cn("flex items-center gap-1.5 font-medium", isLoading ? "text-warning" : "text-success")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", isLoading ? "bg-warning animate-pulse" : "bg-success shadow-sm shadow-success/50")} />
                  {isLoading ? "Streaming…" : "Ready"}
                </span>
              </div>
            </div>
          </section>

          {/* ── Session Memory ── */}
          <section className="space-y-2">
            <h3 className="section-label flex items-center gap-1.5">
              <Cpu size={10} />
              Session Memory
            </h3>
            <div className="glass-card rounded-xl p-3 space-y-1">
              <StatCard label="Messages" value={stats.messageCount} icon={MessageSquare} accent="text-primary" />
              <div className="flex justify-between text-xs py-1">
                <span className="text-muted-foreground/50 pl-5">You / Agent</span>
                <span className="font-mono tabular-nums text-xs text-foreground">{stats.userMessages} / {stats.assistantMessages}</span>
              </div>
              <StatCard label="Words" value={stats.wordCount.toLocaleString()} icon={FileText} accent="text-muted-foreground" />
              <StatCard label="Est. Tokens" value={formatTokenCount(stats.estimatedTokens)} icon={Cpu} accent="text-accent" />

              {/* Token capacity bar — gradient progress */}
              <div className="pt-1.5 space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground/50">
                  <span>Context Usage</span>
                  <span className="tabular-nums">{tokenCapacity.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.max(tokenCapacity.pct, 1)}%`,
                      background: `linear-gradient(90deg, ${tokenCapacity.color}, color-mix(in srgb, ${tokenCapacity.color} 70%, var(--accent)))`,
                    }}
                  />
                </div>
              </div>

              {stats.toolCalls > 0 && (
                <StatCard label="Tool Calls" value={`${stats.toolCalls}${stats.pendingTools > 0 ? ` (${stats.pendingTools} pending)` : ""}`} icon={Wrench} accent="text-warning" />
              )}
              {stats.errorCount > 0 && (
                <StatCard label="Errors" value={stats.errorCount} icon={AlertTriangle} accent="text-destructive" />
              )}
            </div>
          </section>

          {/* ── Models Used ── */}
          {stats.uniqueModels.length > 0 && (
            <section className="space-y-2">
              <h3 className="section-label flex items-center gap-1.5">
                <Network size={10} />
                Models Used
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {stats.uniqueModels.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg glass-card text-[10px] font-mono"
                  >
                    <Bot size={9} className="text-accent" />
                    {m.split("/").pop()}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* ── Session Info ── */}
          {activeSession && (
            <section className="space-y-2">
              <h3 className="section-label flex items-center gap-1.5">
                <Clock size={10} />
                Session Info
              </h3>
              <div className="glass-card rounded-xl p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="tabular-nums text-foreground">{stats.sessionAge}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Activity</span>
                  <span className="tabular-nums text-foreground">{stats.lastActivity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session ID</span>
                  <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[100px]" title={activeSession.id}>
                    {activeSession.id.slice(0, 8)}…
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* ── Activity Log ── */}
          <section className="space-y-2">
            <h3 className="section-label flex items-center gap-1.5">
              <Clock size={10} />
              Recent Activity
            </h3>
            {recentActivity.length > 0 ? (
              <div className="relative pl-3 space-y-3 before:absolute before:inset-y-1 before:left-[5px] before:w-px before:bg-gradient-to-b before:from-primary/30 before:to-accent/30">
                {recentActivity.map((m) => (
                  <ActivityItem key={m.id} message={m} />
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic glass-card rounded-xl p-3">
                No activity yet. Start a conversation to see activity here.
              </div>
            )}
          </section>

          {/* ── Project Files ── */}
          <ProjectFiles />
        </div>
      </aside>
    </>
  );
}

function ProjectFiles() {
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const projects = useChatStore((s) => s.projects);
  const [files, setFiles] = useState<{ name: string; path: string; size: number; ext: string; modifiedAt: number }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const project = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    if (!project) { setFiles([]); return; }
    setLoading(true);
    let canceled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(project!.id)}/files`);
        if (res.ok && !canceled) {
          const data = await res.json();
          setFiles(data.files ?? []);
        }
      } catch {} finally {
        if (!canceled) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => { canceled = true; clearInterval(interval); };
  }, [project]);

  if (!project) return null;

  const formatSize = (bytes: number) =>
    bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

  return (
    <section className="space-y-2">
      <h3 className="section-label flex items-center gap-1.5">
        <FileText size={10} />
        Project Files {loading ? "" : `(${files.length})`}
      </h3>
      {files.length === 0 ? (
        <div className="text-xs text-muted-foreground italic glass-card rounded-xl p-3">
          No files yet. Ask the AI to create files in this project.
        </div>
      ) : (
        <div className="glass-card rounded-xl p-2 space-y-0.5 max-h-[240px] overflow-y-auto">
          {files.slice(0, 30).map((f) => (
            <div key={f.path}>
              <button
                onClick={() => {
                  if (expanded === f.path) { setExpanded(null); setContent(null); return; }
                  setExpanded(f.path);
                  setLoading(true);
                  fetch(`/api/projects/${encodeURIComponent(project.id)}/files?path=${encodeURIComponent(f.path)}`)
                    .then((r) => r.json())
                    .then((d) => setContent(d.content ?? "[binary file]"))
                    .catch(() => setContent("[error reading file]"))
                    .finally(() => setLoading(false));
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors text-left group"
              >
                <span className="text-[10px] shrink-0">{getFileExtIcon(f.ext)}</span>
                <span className="flex-1 text-xs truncate font-mono text-foreground/80 group-hover:text-foreground">{f.path}</span>
                <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">{formatSize(f.size)}</span>
              </button>
              {expanded === f.path && (
                <div className="ml-6 mb-1 px-2 py-1.5 rounded-lg bg-background/50 border border-border/30 max-h-[160px] overflow-y-auto">
                  {content === null ? (
                    <span className="text-[10px] text-muted-foreground">Loading…</span>
                  ) : (
                    <pre className="text-[10px] whitespace-pre-wrap font-mono text-foreground/70">{content.slice(0, 2000)}{content.length > 2000 ? "\n…" : ""}</pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function getFileExtIcon(ext: string) {
  if (ext === ".ts" || ext === ".tsx") return "🟦";
  if (ext === ".js" || ext === ".jsx") return "🟨";
  if (ext === ".css") return "🟪";
  if (ext === ".html") return "🟧";
  if (ext === ".json") return "⬛";
  if (ext === ".md") return "⬜";
  if (ext === ".py") return "🟩";
  if (ext === ".sql") return "🟫";
  return "📄";
}
