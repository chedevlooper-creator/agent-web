"use client";

import { useChatStore, useActiveSession } from "@/lib/store";
import { cn } from "@/lib/utils";
import { X, FolderOpen, Brain, Puzzle, MessageSquare, Database } from "lucide-react";

export function ContextPanel() {
  const contextPanelOpen = useChatStore((s) => s.contextPanelOpen);
  const setContextPanelOpen = useChatStore((s) => s.setContextPanelOpen);
  const projects = useChatStore((s) => s.projects);
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const activeSession = useActiveSession();
  const skills = useChatStore((s) => s.skills);
  const enabledSkills = useChatStore((s) => s.enabledSkills);
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const messageCount = activeSession?.messages.length ?? 0;

  return (
    <>
      {contextPanelOpen && (
        <div className="fixed inset-0 z-40 bg-black/55 md:hidden" onClick={() => setContextPanelOpen(false)} />
      )}
      <div
        className={cn(
          "fixed md:relative z-50 flex h-dvh flex-col overflow-hidden bg-[var(--surface)]",
          "border-l border-[var(--border-strong)] shadow-[-4px_0_20px_rgba(0,0,0,0.3)]",
          "transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          contextPanelOpen ? "w-[300px] translate-x-0" : "w-0 translate-x-full md:w-0 md:translate-x-full",
        )}
        id="context-panel"
        role="complementary"
        aria-label="Context panel"
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
            Context
          </span>
          <button
            onClick={() => setContextPanelOpen(false)}
            className="flex h-7 w-7 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] transition-all hover:bg-[var(--overlay)] hover:text-[var(--foreground)]"
            aria-label="Close context panel"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 p-3">
          {/* Project */}
          <section className="border border-[var(--border)] bg-[var(--overlay)]">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <FolderOpen size={12} className="text-[var(--primary)]" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                Project
              </span>
            </div>
            <div className="p-3">
              {activeProject ? (
                <div>
                  <p className="text-xs font-semibold text-[var(--foreground)]">{activeProject.name}</p>
                  <p className="mt-1 font-mono text-[10px] text-[var(--dim-foreground)] truncate">{activeProject.rootPath}</p>
                </div>
              ) : (
                <p className="font-mono text-[10px] text-[var(--dim-foreground)]">No active project</p>
              )}
            </div>
          </section>

          {/* Session info */}
          <section className="border border-[var(--border)] bg-[var(--overlay)]">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <MessageSquare size={12} className="text-[var(--primary)]" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                Session
              </span>
            </div>
            <div className="p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--muted-foreground)]">Messages</span>
                <span className="font-mono text-[10px] text-[var(--dim-foreground)]">{messageCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--muted-foreground)]">Provider</span>
                <span className="font-mono text-[10px] text-[var(--dim-foreground)]">{provider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--muted-foreground)]">Model</span>
                <span className="font-mono text-[10px] text-[var(--dim-foreground)] truncate max-w-[160px]">{model}</span>
              </div>
            </div>
          </section>

          {/* Skills */}
          <section className="border border-[var(--border)] bg-[var(--overlay)]">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <Puzzle size={12} className="text-[var(--primary)]" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                Skills ({enabledSkills.length}/{skills.length})
              </span>
            </div>
            <div className="p-3">
              {skills.length === 0 ? (
                <p className="font-mono text-[10px] text-[var(--dim-foreground)]">No skills installed</p>
              ) : (
                <div className="space-y-1">
                  {skills.slice(0, 6).map((skill) => {
                    const isEnabled = enabledSkills.includes(skill.name);
                    return (
                      <div key={skill.name} className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0",
                            isEnabled ? "bg-[var(--primary)]" : "bg-[var(--dim-foreground)]",
                          )}
                        />
                        <span className={cn(
                          "flex-1 truncate text-[11px]",
                          isEnabled ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)]",
                        )}>
                          {skill.name}
                        </span>
                      </div>
                    );
                  })}
                  {skills.length > 6 && (
                    <p className="pt-1 font-mono text-[10px] text-[var(--dim-foreground)]">
                      +{skills.length - 6} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Memory info */}
          <section className="border border-[var(--border)] bg-[var(--overlay)]">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <Brain size={12} className="text-[var(--primary)]" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                Memory
              </span>
            </div>
            <div className="p-3">
              <p className="font-mono text-[10px] text-[var(--dim-foreground)]">
                Memory is {typeof window !== "undefined" && localStorage.getItem("ENABLE_MEMORY") === "true" ? "enabled" : "disabled"}.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
