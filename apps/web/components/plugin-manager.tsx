"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Puzzle,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  Globe,
} from "lucide-react";

// ===== Types =====

interface PluginToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  entrypoint: string;
  tools: PluginToolDef[];
  settings?: Record<string, { type: string; required: boolean; default?: unknown }>;
}

interface PluginConfig {
  id: string;
  enabled: boolean;
}

interface PluginInfo {
  config: PluginConfig;
  manifest: PluginManifest;
}

// ===== API Helpers =====

async function fetchPlugins(): Promise<PluginInfo[]> {
  const res = await fetch("/api/plugins");
  if (!res.ok) throw new Error("Failed to fetch plugins");
  const data = await res.json();
  return data.plugins ?? [];
}

async function installPluginApi(
  manifest: PluginManifest
): Promise<PluginConfig> {
  const res = await fetch("/api/plugins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to install plugin");
  }
  const data = await res.json();
  return data.plugin;
}

async function uninstallPluginApi(id: string): Promise<void> {
  const res = await fetch(`/api/plugins?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to uninstall plugin");
}

async function setPluginEnabledApi(
  id: string,
  enabled: boolean
): Promise<void> {
  const res = await fetch("/api/plugins", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, enabled }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to update plugin");
  }
}

// ===== PluginManager Component =====

export function PluginManager({ expanded = true }: { expanded?: boolean }) {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedPluginIds, setExpandedPluginIds] = useState<Set<string>>(
    new Set()
  );

  // Install form
  const [manifestJson, setManifestJson] = useState("");
  const [installError, setInstallError] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlugins();
      setPlugins(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleToggleEnabled = async (
    plugin: PluginInfo,
    enabled: boolean
  ) => {
    setActionLoading(plugin.config.id);
    setError(null);
    try {
      await setPluginEnabledApi(plugin.config.id, enabled);
      setPlugins((prev) =>
        prev.map((p) =>
          p.config.id === plugin.config.id
            ? { ...p, config: { ...p.config, enabled } }
            : p
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Uninstall this plugin? This will remove the manifest and configuration.`
      )
    )
      return;
    setError(null);
    try {
      await uninstallPluginApi(id);
      setPlugins((prev) => prev.filter((p) => p.config.id !== id));
      setExpandedPluginIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to uninstall");
    }
  };

  const handleInstall = async () => {
    setInstallError(null);

    let manifest: PluginManifest;
    try {
      manifest = JSON.parse(manifestJson) as PluginManifest;
    } catch {
      setInstallError("Invalid JSON. Please check the manifest format.");
      return;
    }

    if (!manifest.id || !manifest.name || !manifest.entrypoint) {
      setInstallError("Manifest must include 'id', 'name', and 'entrypoint'.");
      return;
    }

    setActionLoading("install");
    setError(null);
    try {
      await installPluginApi(manifest);
      setManifestJson("");
      setShowInstallForm(false);
      // Reload the full list to get fresh data
      await loadPlugins();
    } catch (e) {
      setInstallError(
        e instanceof Error ? e.message : "Failed to install plugin"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPluginIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Collapsed state
  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <Puzzle size={16} className="text-[var(--muted-foreground)]" />
        <span className="font-mono text-[9px] text-[var(--dim-foreground)] uppercase tracking-wider">
          Plugins
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--dim-foreground)]">
          Plugins {plugins.length > 0 && `(${plugins.length})`}
        </span>
        <button
          onClick={() => {
            setShowInstallForm(true);
            setError(null);
            setInstallError(null);
          }}
          className="flex h-5 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
          aria-label="Install plugin"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-2 mb-1 border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-2 py-1">
          <p className="font-mono text-[9px] text-[var(--destructive)]">
            {error}
          </p>
        </div>
      )}

      {/* Install Form */}
      {showInstallForm && (
        <div className="mx-2 mb-2 border border-[var(--border)] bg-[var(--overlay)] p-2.5 shadow-[2px_4px_16px_rgba(0,0,0,0.3)]">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Install Plugin
            </span>
            <button
              onClick={() => {
                setShowInstallForm(false);
                setInstallError(null);
                setManifestJson("");
              }}
              className="flex h-4 w-4 items-center justify-center text-[var(--dim-foreground)] hover:text-[var(--foreground)]"
              aria-label="Close install form"
            >
              <X size={10} />
            </button>
          </div>

          {installError && (
            <div className="mb-2 border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-2 py-1">
              <p className="font-mono text-[8px] text-[var(--destructive)]">
                {installError}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <textarea
              value={manifestJson}
              onChange={(e) => setManifestJson(e.target.value)}
              placeholder={`{\n  "id": "my-plugin",\n  "name": "My Plugin",\n  "description": "...",\n  "version": "1.0.0",\n  "entrypoint": "https://example.com/plugin",\n  "tools": [\n    {\n      "name": "hello",\n      "description": "Say hello",\n      "parameters": {\n        "type": "object",\n        "properties": {\n          "name": { "type": "string" }\n        },\n        "required": ["name"]\n      }\n    }\n  ]\n}`}
              className="w-full border border-[var(--border)] bg-transparent px-2 py-1 font-mono text-[10px] leading-relaxed text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:border-[var(--primary)] focus:outline-none"
              rows={10}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowInstallForm(false);
                  setInstallError(null);
                  setManifestJson("");
                }
              }}
              autoFocus
            />
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={handleInstall}
                disabled={actionLoading === "install" || !manifestJson.trim()}
                className="flex flex-1 items-center justify-center gap-1 bg-[var(--primary)] px-2 py-1 text-[10px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-dim)] disabled:opacity-40"
              >
                {actionLoading === "install" ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Plus size={10} />
                )}
                Install
              </button>
              <button
                onClick={() => {
                  setShowInstallForm(false);
                  setInstallError(null);
                  setManifestJson("");
                }}
                className="border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plugin List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2
              size={14}
              className="animate-spin text-[var(--muted-foreground)]"
            />
          </div>
        ) : plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Puzzle size={24} className="text-[var(--dim-foreground)]" />
            <p className="font-mono text-[10px] text-[var(--dim-foreground)]">
              No plugins installed
            </p>
            <button
              onClick={() => {
                setShowInstallForm(true);
                setError(null);
                setInstallError(null);
              }}
              className="border border-[var(--border)] px-2 py-1 text-[10px] font-mono text-[var(--muted-foreground)] transition-colors hover:bg-[var(--overlay)] hover:text-[var(--foreground)]"
            >
              <Plus size={10} className="mr-1 inline" />
              Install Plugin
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {plugins.map((plugin) => {
              const isExpanded = expandedPluginIds.has(plugin.config.id);
              const isEnabled = plugin.config.enabled;
              const isLoading = actionLoading === plugin.config.id;
              const tools = plugin.manifest.tools ?? [];

              return (
                <div key={plugin.config.id}>
                  {/* Plugin Header */}
                  <div className="group relative border border-[var(--border)] bg-[var(--overlay)] transition-all hover:border-[var(--border-strong)]">
                    <div className="flex items-start gap-2.5 p-2.5">
                      {/* Plugin Icon */}
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center transition-colors",
                          isEnabled
                            ? "bg-[var(--primary-muted)] text-[var(--primary)]"
                            : "bg-[var(--surface)] text-[var(--dim-foreground)]"
                        )}
                      >
                        <Puzzle size={14} />
                      </div>

                      {/* Content */}
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => toggleExpand(plugin.config.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11px] font-semibold text-[var(--foreground)]">
                            {plugin.manifest.name}
                          </span>
                          <span className="shrink-0 font-mono text-[8px] text-[var(--dim-foreground)]">
                            v{plugin.manifest.version}
                          </span>
                        </div>
                        {plugin.manifest.description && (
                          <p className="mt-0.5 line-clamp-1 text-[9px] text-[var(--muted-foreground)]">
                            {plugin.manifest.description}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2">
                          <span className="flex items-center gap-1 font-mono text-[8px] text-[var(--dim-foreground)]">
                            <Globe size={8} />
                            {plugin.manifest.entrypoint.length > 30
                              ? plugin.manifest.entrypoint.slice(0, 30) + "…"
                              : plugin.manifest.entrypoint}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-[8px] uppercase tracking-[0.08em]",
                              isEnabled
                                ? "text-[var(--primary)]"
                                : "text-[var(--dim-foreground)]"
                            )}
                          >
                            {isEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          onClick={() =>
                            handleToggleEnabled(plugin, !isEnabled)
                          }
                          disabled={isLoading}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center border transition-all disabled:opacity-40",
                            isEnabled
                              ? "border-[var(--primary)]/40 bg-[var(--primary-muted)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]"
                              : "border-[var(--border)] text-[var(--dim-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                          )}
                          aria-label={
                            isEnabled
                              ? `Disable ${plugin.manifest.name}`
                              : `Enable ${plugin.manifest.name}`
                          }
                        >
                          {isLoading ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : isEnabled ? (
                            <ToggleRight size={10} />
                          ) : (
                            <ToggleLeft size={10} />
                          )}
                        </button>
                        <button
                          onClick={() => handleUninstall(plugin.config.id)}
                          className="flex h-6 w-6 items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] transition-all hover:border-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                          aria-label={`Uninstall ${plugin.manifest.name}`}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Show Tools */}
                  {isExpanded && (
                    <div className="ml-4 border-l border-[var(--border)] pl-2 pb-1">
                      {tools.length > 0 ? (
                        <div className="mt-1 space-y-0.5">
                          <span className="block px-1.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--dim-foreground)]">
                            Tools ({tools.length})
                          </span>
                          {tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 transition-colors hover:border-[var(--border-strong)]"
                            >
                              <div className="flex items-center gap-1.5">
                                <Globe
                                  size={10}
                                  className="shrink-0 text-[var(--primary)]"
                                />
                                <span className="truncate text-[10px] font-medium text-[var(--foreground)]">
                                  {tool.name}
                                </span>
                              </div>
                              {tool.description && (
                                <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-[var(--muted-foreground)]">
                                  {tool.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-2 py-2 font-mono text-[9px] text-[var(--dim-foreground)]">
                          No tools defined for this plugin
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
