"use client";

import { useChatStore, useActiveSession, useIsEmptySession, type ChatMessage, type ToolCallInfo } from "@/lib/store";
import { cn, estimateTokens } from "@/lib/utils";
import React, { useMemo } from "react";
import {
  X,
  Cpu,
  MessageSquare,
  Wrench,
  Box,
  Clock,
  ActivitySquare,
  Minus,
  Square,
  Activity,
  FileText,
  Code,
  FileSpreadsheet,
  Database,
} from "lucide-react";
import { getToolIcon } from "@/lib/tool-icons";

function formatTokenCount(tokens: number): string {
  if (tokens === 0) return "0";
  if (tokens < 1000) return tokens.toString();
  return `${(tokens / 1000).toFixed(1)}k`;
}

function StatRow({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs text-fg-secondary">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-muted-foreground" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <span className="font-mono text-foreground font-medium">{value}</span>
    </div>
  );
}

// ===== Main Context Panel =====
export function ContextPanel() {
  const contextPanelOpen = useChatStore((s) => s.contextPanelOpen);
  const toggleContextPanel = useChatStore((s) => s.toggleContextPanel);
  const activeSession = useActiveSession();

  const stats = useMemo(() => {
    if (!activeSession) {
      return {
        messageCount: 0,
        estimatedTokens: 0,
        toolCalls: 0,
        modelCount: 1,
      };
    }
    const msgs = activeSession.messages;
    const assistantMsgs = msgs.filter((m: ChatMessage) => m.role === "assistant");
    let toolCalls = 0;
    for (const m of msgs) {
      if (m.toolCalls) {
        toolCalls += m.toolCalls.length;
      }
    }
    const uniqueModels = [...new Set(assistantMsgs.map((m: ChatMessage) => m.model).filter(Boolean))] as string[];

    return {
      messageCount: msgs.length,
      estimatedTokens: estimateTokens(msgs),
      toolCalls,
      modelCount: uniqueModels.length || 1,
    };
  }, [activeSession]);

  const tokenCapacity = useMemo(() => {
    const max = 128000;
    const pct = Math.min((stats.estimatedTokens / max) * 100, 100);
    const color = pct > 80 ? "var(--destructive)" : pct > 50 ? "var(--warning)" : "var(--primary)";
    return { pct, max, color };
  }, [stats.estimatedTokens]);

  // Active tools from the last assistant message.
  const activeTools = (() => {
    if (!activeSession) return [];
    const msgs = activeSession.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].toolCalls && msgs[i].toolCalls!.length > 0) {
        return msgs[i].toolCalls!.filter((t: ToolCallInfo) => t.result === undefined);
      }
    }
    return [];
  })();

  const showVideo = useIsEmptySession();

  if (!contextPanelOpen) return null;

  return (
    <>
      {/* Tablet/Mobile Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm xl:hidden animate-fade-in cursor-pointer"
        onClick={toggleContextPanel}
        aria-label="Bağlam panelini kapat"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleContextPanel();
          }
        }}
      />

      {/* Panel */}
      <aside
        id="context-panel"
        aria-label="Bağlam paneli"
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-[360px] xl:w-[292px]",
          "xl:static xl:block",
          "flex flex-col",
          showVideo
            ? "glass-subtle border-l border-border/15"
            : "sidebar-cockpit border-l border-border/60",
          "shadow-2xl xl:shadow-none",
          "animate-slide-in-right transition-[background-color,border-color,box-shadow] duration-500"
        )}
      >
        {/* Header */}
        <div className={cn("h-[66px] flex items-center justify-between px-5 border-b shrink-0 transition-colors duration-500", showVideo ? "border-border/15" : "border-border/60")}>
          <h2 className="text-[13px] font-semibold flex items-center gap-2 text-foreground uppercase tracking-wide">
            Bağlam
            <span className="h-1.5 w-1.5 rounded-full bg-electric shadow-[0_0_14px_rgba(176,226,39,0.8)]" />
          </h2>
          <div className="ml-auto flex items-center gap-2.5 text-fg-muted">
            <button
              type="button"
              onClick={toggleContextPanel}
              className="flex min-h-[32px] min-w-[32px] items-center justify-center border border-transparent text-fg-muted transition-colors duration-200 hover:border-border/70 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Bağlam panelini daralt"
              aria-controls="context-panel"
              aria-expanded="true"
              data-tooltip="Bağlamı daralt"
              title="Bağlamı daralt"
            >
              <Minus size={12} aria-hidden="true" />
            </button>
            <span
              role="status"
              className="flex min-h-[32px] min-w-[32px] items-center justify-center border border-border/45 bg-black/15 text-fg-muted"
              aria-label="Bağlam paneli masaüstünde sabitlenir, tablet ve mobilde çekmece olarak açılır"
              data-tooltip="Sabit / çekmece"
              title="Masaüstünde sabit, tablet ve mobilde çekmece"
            >
              <Square size={10} aria-hidden="true" />
            </span>
            <button
              type="button"
              onClick={toggleContextPanel}
              className="flex min-h-[32px] min-w-[32px] items-center justify-center border border-transparent text-fg-muted transition-colors duration-200 hover:border-border/70 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
              aria-label="Bağlam çekmecesini kapat"
              aria-controls="context-panel"
              aria-expanded="true"
              data-tooltip="Çekmeceyi kapat"
              title="Çekmeceyi kapat"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-0">
          <section className="context-section space-y-4">
            <h3 className="section-label">Oturum Özeti</h3>
            <div className="space-y-1">
              <StatRow label="Mesajlar" value={stats.messageCount} icon={MessageSquare} />
              <StatRow label="Token (tahmini)" value={stats.estimatedTokens} icon={Cpu} />
              <StatRow label="Araç Çağrıları" value={stats.toolCalls} icon={Wrench} />
              <StatRow label="Modeller" value={stats.modelCount} icon={Box} />
              <StatRow label="Oturum Süresi" value="0dk" icon={Clock} />
              <StatRow label="Son Aktivite" value="-" icon={ActivitySquare} />
            </div>
          </section>

          {/* ── TOKEN USAGE ── */}
          <section className="context-section space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="section-label">Token Kullanımı</h3>
              <div className="text-xs font-mono tabular-nums text-foreground">
                {formatTokenCount(stats.estimatedTokens)} <span className="text-muted-foreground">/ 128K</span>
              </div>
            </div>
            <div className="space-y-2">
              {/* Progress bar */}
              <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width,background-color] duration-700 ease-out"
                  style={{
                    width: `${Math.max(tokenCapacity.pct, 0)}%`,
                    background: `linear-gradient(90deg, ${tokenCapacity.color}, color-mix(in srgb, ${tokenCapacity.color} 70%, var(--accent)))`,
                  }}
                />
              </div>
              {/* Scale markers */}
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono tabular-nums">
                <span>0</span>
                <span>64K</span>
                <span>128K</span>
              </div>
            </div>
          </section>

          {/* ── ACTIVE TOOLS ── */}
          <section className="context-section space-y-4">
            <h3 className="section-label">Aktif Araçlar</h3>
            {activeTools.length > 0 ? (
              <div className="space-y-1">
                {activeTools.map((t: ToolCallInfo) => {
                  const ToolIcon = getToolIcon(t.name);
                  return (
                    <div key={t.id} className="flex items-center gap-2 text-xs text-warning">
                      <ToolIcon size={12} aria-hidden="true" />
                      <span className="min-w-0 truncate font-mono">{t.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground animate-pulse">çalışıyor…</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-electric/50" />
                Aktif araç yok
              </div>
            )}
          </section>

          {/* ── RECENT ACTIVITY ── */}
          <section className="context-section space-y-4">
            <h3 className="section-label">Son Aktivite</h3>
            <div className="flex items-start justify-between text-xs text-muted-foreground gap-4">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Henüz aktivite yok</p>
                <p className="leading-relaxed">Aktiviteyi görmek için bir konuşma başlatın.</p>
              </div>
              <Activity size={24} className="text-electric/50 shrink-0" />
            </div>
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
  const [files, setFiles] = React.useState<{ name: string; path: string; size: number; ext: string; modifiedAt: number }[]>([]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const project = projects.find((p) => p.id === activeProjectId);

  React.useEffect(() => {
    if (!project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFiles([]);
      return;
    }
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
        Proje Dosyaları {loading ? "" : `(${files.length})`}
      </h3>
      {files.length === 0 ? (
        <div className="text-xs text-muted-foreground italic glass-card rounded-xl p-3">
          Henüz dosya yok. Ajandan bu projede dosya oluşturmasını isteyin.
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
                    .then((d) => setContent(d.content ?? "[ikili dosya]"))
                    .catch(() => setContent("[dosya okuma hatası]"))
                    .finally(() => setLoading(false));
                }}
                className="min-h-[44px] w-full flex items-center gap-2 px-2 rounded-lg hover:bg-muted/30 transition-colors text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted/70">
                  {getFileExtIcon(f.ext)}
                </span>
                <span className="flex-1 text-xs truncate font-mono text-foreground/80 group-hover:text-foreground">{f.path}</span>
                <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">{formatSize(f.size)}</span>
              </button>
              {expanded === f.path && (
                <div className="ml-6 mb-1 px-2 py-1.5 rounded-lg bg-background/50 border border-border/30 max-h-[160px] overflow-y-auto">
                  {content === null ? (
                    <span className="text-[10px] text-muted-foreground">Yükleniyor…</span>
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
  if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx" || ext === ".css" || ext === ".html" || ext === ".py") {
    return <Code size={14} className="text-primary" aria-hidden="true" />;
  }
  if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
    return <FileSpreadsheet size={14} className="text-success" aria-hidden="true" />;
  }
  if (ext === ".sql") {
    return <Database size={14} className="text-accent" aria-hidden="true" />;
  }
  return <FileText size={14} className="text-muted-foreground" aria-hidden="true" />;
}
