"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Search,
  X,
  ChevronLeft,
  Download,
  Check,
  Power,
  PowerOff,
  Pencil,
  Trash2,
  Loader2,
  Sparkles,
  Eye,
  Code,
  Globe,
  Terminal,
  FileText,
  Library,
  Zap,
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

interface InstalledAgent {
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

type MarketplaceTab = "marketplace" | "installed";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "coding", label: "Coding" },
  { value: "writing", label: "Writing" },
  { value: "research", label: "Research" },
  { value: "creative", label: "Creative" },
  { value: "analysis", label: "Analysis" },
  { value: "productivity", label: "Productivity" },
  { value: "general", label: "General" },
];

const CATEGORY_AVATARS: Record<string, string> = {
  coding: "💻",
  writing: "✍️",
  research: "🔬",
  creative: "🎨",
  analysis: "📊",
  productivity: "⚡",
  general: "🤖",
};

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    coding: "text-[#5e9eff] border-[#5e9eff]/30 bg-[#5e9eff]/10",
    writing: "text-[#ffb800] border-[#ffb800]/30 bg-[#ffb800]/10",
    research: "text-[#00e599] border-[#00e599]/30 bg-[#00e599]/10",
    creative: "text-[#bf5eff] border-[#bf5eff]/30 bg-[#bf5eff]/10",
    analysis: "text-[#ff6b35] border-[#ff6b35]/30 bg-[#ff6b35]/10",
    productivity: "text-[#5effb8] border-[#5effb8]/30 bg-[#5effb8]/10",
    general: "text-[#9595a3] border-[#9595a3]/30 bg-[#9595a3]/10",
  };
  return colors[category] || colors.general;
}

function getToolIcon(tool: string) {
  switch (tool) {
    case "terminal": return Terminal;
    case "web_search": return Globe;
    case "web_fetch": return Globe;
    case "read_file": return FileText;
    case "write_file": return FileText;
    case "search_files": return FileText;
    case "list_directory": return FileText;
    case "execute_code": return Code;
    default: return Bot;
  }
}

// ===== API Helpers =====

async function fetchMarketplace(
  category?: string,
  search?: string
): Promise<AgentPreset[]> {
  const params = new URLSearchParams();
  if (category && category !== "all") params.set("category", category);
  if (search) params.set("search", search);
  const res = await fetch(`/api/agents/marketplace?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch marketplace");
  const data = await res.json();
  return data.presets ?? [];
}

async function fetchInstalled(): Promise<InstalledAgent[]> {
  const res = await fetch("/api/agents/installed");
  if (!res.ok) throw new Error("Failed to fetch installed agents");
  const data = await res.json();
  return data.agents ?? [];
}

async function installAgentApi(
  presetId: string,
  customName?: string,
  customPrompt?: string
): Promise<InstalledAgent> {
  const res = await fetch("/api/agents/installed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ presetId, customName, customPrompt }),
  });
  if (!res.ok) throw new Error("Failed to install agent");
  const data = await res.json();
  return data.agent;
}

async function uninstallAgentApi(id: string): Promise<void> {
  const res = await fetch(`/api/agents/installed?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to uninstall agent");
}

async function updateInstalledAgentApi(
  id: string,
  data: { customName?: string | null; customPrompt?: string | null; enabled?: boolean }
): Promise<void> {
  const res = await fetch("/api/agents/installed", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  });
  if (!res.ok) throw new Error("Failed to update agent");
}

// ===== Component =====

export function AgentMarketplace({
  expanded = true,
}: {
  expanded?: boolean;
}) {
  const [tab, setTab] = useState<MarketplaceTab>("marketplace");
  const [presets, setPresets] = useState<AgentPreset[]>([]);
  const [installed, setInstalled] = useState<InstalledAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedPreset, setSelectedPreset] = useState<AgentPreset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const loadMarketplace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketplace(category, search.trim() || undefined);
      setPresets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  const loadInstalled = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInstalled();
      setInstalled(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard load-on-change; loaders set loading state synchronously.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (tab === "marketplace") {
      loadMarketplace();
    } else {
      loadInstalled();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [tab, loadMarketplace, loadInstalled]);

  const handleInstall = async (preset: AgentPreset) => {
    setActionLoading(true);
    setError(null);
    try {
      await installAgentApi(preset.id);
      setInstalled((prev) => [
        {
          id: "pending-" + preset.id,
          userId: "",
          presetId: preset.id,
          customName: null,
          customPrompt: null,
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          preset,
        } as InstalledAgent,
        ...prev,
      ]);
      // Refresh to get real IDs
      const updated = await fetchInstalled();
      setInstalled(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to install");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUninstall = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Uninstall this agent?")) return;
    setError(null);
    try {
      await uninstallAgentApi(id);
      setInstalled((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to uninstall");
    }
  };

  const handleToggleEnabled = async (agent: InstalledAgent) => {
    try {
      await updateInstalledAgentApi(agent.id, { enabled: !agent.enabled });
      setInstalled((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, enabled: !a.enabled } : a))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateInstalledAgentApi(id, { customName: editName.trim() });
      setInstalled((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, customName: editName.trim() } : a
        )
      );
      setEditingId(null);
      setEditName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename");
    }
  };

  // Collapsed state
  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <Bot size={16} className="text-[var(--muted-foreground)]" />
        <span className="font-mono text-[9px] text-[var(--dim-foreground)] uppercase tracking-wider">
          Agents
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab Toggle */}
      <div className="mx-2 mt-2 flex gap-0.5 rounded-none border border-[var(--border)] bg-[var(--overlay)] p-0.5">
        <button
          onClick={() => { setTab("marketplace"); setSelectedPreset(null); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.06em] transition-all",
            tab === "marketplace"
              ? "bg-[var(--surface-elevated)] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          <Download size={11} />
          Marketplace
        </button>
        <button
          onClick={() => { setTab("installed"); setSelectedPreset(null); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.06em] transition-all",
            tab === "installed"
              ? "bg-[var(--surface-elevated)] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          <Check size={11} />
          Installed {installed.length > 0 && `(${installed.length})`}
        </button>
      </div>

      {/* Detail View */}
      {selectedPreset && tab === "marketplace" ? (
        <AgentDetailView
          preset={selectedPreset}
          onBack={() => setSelectedPreset(null)}
          onInstall={handleInstall}
          actionLoading={actionLoading}
        />
      ) : tab === "marketplace" ? (
        <MarketplaceView
          presets={presets}
          loading={loading}
          error={error}
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          onSelect={setSelectedPreset}
          onInstall={handleInstall}
          actionLoading={actionLoading}
        />
      ) : (
        <InstalledView
          agents={installed}
          loading={loading}
          error={error}
          onUninstall={handleUninstall}
          onToggleEnabled={handleToggleEnabled}
          editingId={editingId}
          editName={editName}
          onStartEdit={(id, name) => { setEditingId(id); setEditName(name || ""); }}
          onEditNameChange={setEditName}
          onRename={handleRename}
          onCancelEdit={() => { setEditingId(null); setEditName(""); }}
        />
      )}
    </div>
  );
}

// ===== Marketplace View =====

function MarketplaceView({
  presets,
  loading,
  error,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  onSelect,
  onInstall,
  actionLoading,
}: {
  presets: AgentPreset[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  onSelect: (p: AgentPreset) => void;
  onInstall: (p: AgentPreset) => void;
  actionLoading: boolean;
}) {
  const installedIds = new Set<string>(); // Will be populated from parent if needed

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search */}
      <div className="mx-2 mt-2 flex items-center gap-2 border border-[var(--border)] bg-[var(--overlay)] px-2.5 py-1.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
        <Search size={12} className="shrink-0 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search agents..."
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:outline-none"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="flex h-4 w-4 items-center justify-center text-[var(--dim-foreground)] hover:text-[var(--foreground)]"
            aria-label="Clear search"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Category Filters */}
      <div className="mx-2 mt-1.5 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={cn(
              "whitespace-nowrap border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.06em] transition-all shrink-0",
              category === cat.value
                ? "border-[var(--primary)] bg-[var(--primary-muted)] text-[var(--primary)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-2 mt-1 border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-2 py-1">
          <p className="font-mono text-[9px] text-[var(--destructive)]">{error}</p>
        </div>
      )}

      {/* Preset Grid */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : presets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Bot size={24} className="text-[var(--dim-foreground)]" />
            <p className="font-mono text-[10px] text-[var(--dim-foreground)]">
              {search ? "No agents match your search" : "No agents available"}
            </p>
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--overlay)] hover:text-[var(--foreground)] transition-colors font-mono"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {presets.map((preset) => {
              const isInstalling = actionLoading;
              return (
                <div
                  key={preset.id}
                  className="group border border-[var(--border)] bg-[var(--overlay)] transition-all hover:border-[var(--border-strong)] hover:shadow-[2px_4px_16px_rgba(0,0,0,0.3)]"
                >
                  <div className="flex items-start gap-2.5 p-2.5">
                    {/* Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--surface-elevated)] text-base">
                      {preset.avatar || CATEGORY_AVATARS[preset.category] || "🤖"}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-semibold text-[var(--foreground)]">
                          {preset.name}
                        </span>
                        {preset.featured && (
                          <Sparkles size={10} className="shrink-0 text-[var(--warning)]" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--muted-foreground)]">
                        {preset.description}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={cn(
                          "inline-flex items-center border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em]",
                          getCategoryColor(preset.category)
                        )}>
                          {preset.category}
                        </span>
                        <span className="font-mono text-[8px] text-[var(--dim-foreground)]">
                          {preset.installs} installs
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        onClick={() => onSelect(preset)}
                        className="flex h-6 w-6 items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
                        aria-label={`View ${preset.name}`}
                      >
                        <Eye size={11} />
                      </button>
                      <button
                        onClick={() => onInstall(preset)}
                        disabled={isInstalling}
                        className="flex h-6 w-6 items-center justify-center border border-[var(--primary)]/40 bg-[var(--primary-muted)] text-[var(--primary)] transition-all hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] disabled:opacity-40"
                        aria-label={`Install ${preset.name}`}
                      >
                        {isInstalling ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Download size={10} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Agent Detail View =====

function AgentDetailView({
  preset,
  onBack,
  onInstall,
  actionLoading,
}: {
  preset: AgentPreset;
  onBack: () => void;
  onInstall: (p: AgentPreset) => void;
  actionLoading: boolean;
}) {
  const toolList = preset.tools ? preset.tools.split(",").filter(Boolean) : [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Back Button */}
      <div className="mx-2 mt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 border border-[var(--border)] px-2 py-1 text-[10px] font-mono text-[var(--muted-foreground)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft size={11} />
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2.5">
        {/* Header */}
        <div className="border border-[var(--border)] bg-[var(--overlay)] p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--surface-elevated)] text-xl">
              {preset.avatar || CATEGORY_AVATARS[preset.category] || "🤖"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-[var(--foreground)]">
                  {preset.name}
                </h3>
                {preset.featured && (
                  <Sparkles size={12} className="shrink-0 text-[var(--warning)]" />
                )}
              </div>
              <span className={cn(
                "mt-1 inline-flex items-center border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em]",
                getCategoryColor(preset.category)
              )}>
                {preset.category}
              </span>
            </div>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            {preset.description}
          </p>

          {/* Stats */}
          <div className="mt-2 flex gap-3 border-t border-[var(--border)] pt-2">
            <div className="font-mono text-[9px] text-[var(--dim-foreground)]">
              <span className="text-[var(--muted-foreground)]">Installs: </span>
              {preset.installs}
            </div>
            {preset.model && (
              <div className="font-mono text-[9px] text-[var(--dim-foreground)]">
                <span className="text-[var(--muted-foreground)]">Model: </span>
                {preset.model}
              </div>
            )}
            {preset.temperature !== null && (
              <div className="font-mono text-[9px] text-[var(--dim-foreground)]">
                <span className="text-[var(--muted-foreground)]">Temp: </span>
                {preset.temperature}
              </div>
            )}
          </div>

          {/* Install Button */}
          <button
            onClick={() => onInstall(preset)}
            disabled={actionLoading}
            className="mt-2 flex w-full items-center justify-center gap-1.5 bg-[var(--primary)] px-3 py-1.5 text-[10px] font-bold text-[var(--primary-foreground)] transition-all hover:bg-[var(--primary-dim)] disabled:opacity-40 font-mono uppercase tracking-[0.06em]"
          >
            {actionLoading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Download size={11} />
            )}
            Install Agent
          </button>
        </div>

        {/* System Prompt */}
        <div className="border border-[var(--border)] bg-[var(--overlay)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-2.5 py-1.5">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              System Prompt
            </span>
            <Code size={11} className="text-[var(--dim-foreground)]" />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-2.5">
            <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-[var(--foreground)]">
              {preset.systemPrompt}
            </pre>
          </div>
        </div>

        {/* Tools */}
        {toolList.length > 0 && (
          <div className="border border-[var(--border)] bg-[var(--overlay)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-2.5 py-1.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                Tools ({toolList.length})
              </span>
              <Zap size={11} className="text-[var(--dim-foreground)]" />
            </div>
            <div className="flex flex-wrap gap-1 p-2.5">
              {toolList.map((tool) => {
                const Icon = getToolIcon(tool);
                return (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--muted-foreground)]"
                  >
                    <Icon size={9} />
                    {tool}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags */}
        {preset.tags && (
          <div className="border border-[var(--border)] bg-[var(--overlay)] p-2.5">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Tags
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {preset.tags.split(",").map((tag) => (
                <span
                  key={tag}
                  className="border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[8px] text-[var(--dim-foreground)]"
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Installed View =====

function InstalledView({
  agents,
  loading,
  error,
  onUninstall,
  onToggleEnabled,
  editingId,
  editName,
  onStartEdit,
  onEditNameChange,
  onRename,
  onCancelEdit,
}: {
  agents: InstalledAgent[];
  loading: boolean;
  error: string | null;
  onUninstall: (id: string) => void;
  onToggleEnabled: (agent: InstalledAgent) => void;
  editingId: string | null;
  editName: string;
  onStartEdit: (id: string, name: string) => void;
  onEditNameChange: (v: string) => void;
  onRename: (id: string) => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Error */}
      {error && (
        <div className="mx-2 mt-1 border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-2 py-1">
          <p className="font-mono text-[9px] text-[var(--destructive)]">{error}</p>
        </div>
      )}

      {/* Installed List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Bot size={24} className="text-[var(--dim-foreground)]" />
            <p className="font-mono text-[10px] text-[var(--dim-foreground)]">
              No installed agents
            </p>
            <p className="font-mono text-[8px] text-[var(--dim-foreground)]">
              Install agents from the Marketplace tab
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {agents.map((agent) => {
              const displayName = agent.customName || agent.preset.name;
              return (
                <div
                  key={agent.id}
                  className={cn(
                    "border border-[var(--border)] bg-[var(--overlay)] transition-all hover:border-[var(--border-strong)]",
                    !agent.enabled && "opacity-50"
                  )}
                >
                  <div className="flex items-start gap-2.5 p-2.5">
                    {/* Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--surface-elevated)] text-base">
                      {agent.preset.avatar || CATEGORY_AVATARS[agent.preset.category] || "🤖"}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {editingId === agent.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editName}
                            onChange={(e) => onEditNameChange(e.target.value)}
                            className="min-w-0 flex-1 border border-[var(--primary)] bg-transparent px-1.5 py-0.5 text-[11px] font-semibold text-[var(--foreground)] focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onRename(agent.id);
                              if (e.key === "Escape") onCancelEdit();
                            }}
                          />
                          <button
                            onClick={() => onRename(agent.id)}
                            disabled={!editName.trim()}
                            className="border border-[var(--primary)] bg-[var(--primary-muted)] px-1.5 py-0.5 text-[8px] font-mono text-[var(--primary)] disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            onClick={onCancelEdit}
                            className="border border-[var(--border)] px-1.5 py-0.5 text-[8px] font-mono text-[var(--muted-foreground)]"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11px] font-semibold text-[var(--foreground)]">
                            {displayName}
                          </span>
                          {agent.customName && (
                            <span className="truncate text-[8px] text-[var(--dim-foreground)] font-mono">
                              ({agent.preset.name})
                            </span>
                          )}
                        </div>
                      )}

                      <p className="mt-0.5 line-clamp-1 text-[9px] text-[var(--muted-foreground)]">
                        {agent.preset.description}
                      </p>

                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={cn(
                          "inline-flex items-center border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em]",
                          getCategoryColor(agent.preset.category)
                        )}>
                          {agent.preset.category}
                        </span>
                        <span className={cn(
                          "font-mono text-[8px]",
                          agent.enabled ? "text-[var(--primary)]" : "text-[var(--dim-foreground)]"
                        )}>
                          {agent.enabled ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        onClick={() => onToggleEnabled(agent)}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center border transition-all",
                          agent.enabled
                            ? "border-[var(--primary)]/40 bg-[var(--primary-muted)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]"
                            : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
                        )}
                        aria-label={agent.enabled ? "Disable agent" : "Enable agent"}
                      >
                        {agent.enabled ? <Power size={10} /> : <PowerOff size={10} />}
                      </button>
                      <button
                        onClick={() => onStartEdit(agent.id, agent.customName || agent.preset.name)}
                        className="flex h-6 w-6 items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
                        aria-label="Rename agent"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => onUninstall(agent.id)}
                        className="flex h-6 w-6 items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] transition-all hover:border-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                        aria-label="Uninstall agent"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
