"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Save,
  X,
  Settings,
  Sliders,
  Loader2,
  Terminal,
  Globe,
  FileText,
  Code,
  Bot,
} from "lucide-react";

// ===== Types =====
interface AgentPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string;
  avatar: string | null;
  systemPrompt: string;
  tools: string;
  model: string | null;
  provider: string | null;
  temperature: number | null;
  featured: boolean;
  installs: number;
  createdAt: number;
  updatedAt: number;
}

export interface InstalledAgent {
  id: string;
  userId: string;
  presetId: string;
  customName: string | null;
  customPrompt: string | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  preset: AgentPreset;
}

interface ToolOption {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_TOOLS: ToolOption[] = [
  { id: "terminal", name: "Terminal", description: "Execute shell commands" },
  { id: "read_file", name: "Read File", description: "Read text files" },
  { id: "write_file", name: "Write File", description: "Write text files" },
  { id: "web_search", name: "Web Search", description: "Search the web" },
  { id: "web_fetch", name: "Web Fetch", description: "Fetch URL content" },
  { id: "list_directory", name: "List Directory", description: "List directory contents" },
  { id: "search_files", name: "Search Files", description: "Search files by pattern" },
  { id: "execute_code", name: "Execute Code", description: "Run code in sandbox" },
  { id: "git", name: "Git", description: "Execute Git commands" },
  { id: "db_query", name: "DB Query", description: "Query SQLite database" },
  { id: "api_test", name: "API Test", description: "Send HTTP requests" },
  { id: "image_generate", name: "Image Generate", description: "Generate images" },
];

function getToolIcon(toolId: string) {
  switch (toolId) {
    case "terminal": return Terminal;
    case "web_search":
    case "web_fetch": return Globe;
    case "read_file":
    case "write_file":
    case "search_files":
    case "list_directory": return FileText;
    case "execute_code":
    case "git":
    case "db_query":
    case "api_test": return Code;
    default: return Bot;
  }
}

// ===== API Helpers =====

async function updateAgentApi(
  id: string,
  data: {
    customName?: string | null;
    customPrompt?: string | null;
    enabled?: boolean;
  }
): Promise<void> {
  const res = await fetch("/api/agents/installed", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  });
  if (!res.ok) throw new Error("Failed to update agent");
}

// ===== Agent Config Editor =====

interface AgentConfigEditorProps {
  agent: InstalledAgent;
  onClose: () => void;
  onSave: (agent: InstalledAgent) => void;
}

export function AgentConfigEditor({
  agent,
  onClose,
  onSave,
}: AgentConfigEditorProps) {
  const [name, setName] = useState(agent.customName || agent.preset.name);
  const [systemPrompt, setSystemPrompt] = useState(
    agent.customPrompt || agent.preset.systemPrompt
  );
  const [enabledTools, setEnabledTools] = useState<Set<string>>(() => {
    const presetTools = agent.preset.tools
      ? new Set(agent.preset.tools.split(",").filter(Boolean))
      : new Set<string>();
    return presetTools;
  });
  const [model, setModel] = useState(agent.preset.model || "");
  const [temperature, setTemperature] = useState(
    agent.preset.temperature ?? 0.7
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleTool = (toolId: string) => {
    setEnabledTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateAgentApi(agent.id, {
        customName: name !== agent.preset.name ? name : null,
        customPrompt: systemPrompt !== agent.preset.systemPrompt ? systemPrompt : null,
      });

      onSave({
        ...agent,
        customName: name !== agent.preset.name ? name : agent.customName,
        customPrompt:
          systemPrompt !== agent.preset.systemPrompt ? systemPrompt : agent.customPrompt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={cn(
          "flex max-h-[85vh] w-full max-w-[520px] flex-col",
          "border border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_8px_40px_rgba(0,0,0,0.5)]",
          "backdrop-blur-xl"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-[var(--primary)]" />
            <span className="text-sm font-bold text-[var(--foreground)]">
              Agent Config
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center border border-[var(--border-strong)] text-[var(--muted-foreground)] transition-all hover:bg-[var(--overlay)] hover:text-[var(--foreground)]"
            aria-label="Close editor"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2">
              <p className="font-mono text-[10px] text-[var(--destructive)]">
                {error}
              </p>
            </div>
          )}

          {/* Agent Name */}
          <div className="space-y-1.5">
            <label className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Agent Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--overlay)] px-3 py-2 text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:border-[var(--primary)] focus:outline-none"
              placeholder="Agent name"
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-1.5">
            <label className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={10}
              className="w-full resize-none border border-[var(--border)] bg-[var(--overlay)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:border-[var(--primary)] focus:outline-none"
              placeholder="Enter system prompt..."
            />
          </div>

          {/* Tools */}
          <div className="space-y-1.5">
            <label className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Tools ({enabledTools.size} selected)
            </label>
            <div className="grid grid-cols-2 gap-1">
              {AVAILABLE_TOOLS.map((tool) => {
                const enabled = enabledTools.has(tool.id);
                const Icon = getToolIcon(tool.id);
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToggleTool(tool.id)}
                    className={cn(
                      "flex items-center gap-2 border px-2.5 py-2 text-left transition-all",
                      enabled
                        ? "border-[var(--primary)]/40 bg-[var(--primary-muted)] text-[var(--foreground)]"
                        : "border-[var(--border)] bg-[var(--overlay)] text-[var(--muted-foreground)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                    )}
                  >
                    <Icon
                      size={12}
                      className={cn(
                        "shrink-0",
                        enabled ? "text-[var(--primary)]" : "text-[var(--dim-foreground)]"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10px] font-medium leading-tight">
                        {tool.name}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center border text-[8px] font-bold transition-colors",
                        enabled
                          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "border-[var(--border)] text-transparent"
                      )}
                    >
                      {enabled ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Model
            </label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--overlay)] px-3 py-2 text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:border-[var(--primary)] focus:outline-none"
              placeholder="e.g., gpt-4o, claude-3-opus"
            />
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sliders size={11} className="text-[var(--primary)]" />
              <label className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                Temperature
              </label>
              <span className="font-mono text-[10px] text-[var(--primary)]">
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full cursor-pointer"
              style={{
                accentColor: "var(--primary)",
                background: "var(--border)",
                height: "4px",
                borderRadius: "2px",
              }}
            />
            <div className="flex justify-between font-mono text-[8px] text-[var(--dim-foreground)]">
              <span>0 (Precise)</span>
              <span>2 (Creative)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            onClick={onClose}
            className="border border-[var(--border)] px-3 py-1.5 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--overlay)] hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-[var(--primary)] px-3 py-1.5 text-[10px] font-bold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-dim)] disabled:opacity-40"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
