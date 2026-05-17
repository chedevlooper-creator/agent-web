"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  Plug,
  PlugZap,
  Plus,
  Trash2,
  Server,
  Wifi,
  WifiOff,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ===== Types =====
interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  enabled: boolean;
}

interface McpToolDefinition {
  serverId: string;
  serverName: string;
  toolName: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface McpToolDescription {
  name: string;
  description: string;
}

// Track which servers are connected via connection state
interface ServerState {
  id: string;
  connected: boolean;
  tools: McpToolDescription[];
  error?: string;
}

// ===== API Helpers =====

async function fetchServers(): Promise<McpServerConfig[]> {
  const res = await fetch("/api/mcp/servers");
  if (!res.ok) throw new Error("Failed to fetch MCP servers");
  const data = await res.json();
  return data.servers ?? [];
}

async function addServerApi(config: {
  name: string;
  command: string;
  args: string[];
}): Promise<McpServerConfig> {
  const res = await fetch("/api/mcp/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to add server");
  const data = await res.json();
  return data.server;
}

async function connectServerApi(
  id: string
): Promise<{ server: { id: string }; tools: McpToolDescription[] }> {
  const res = await fetch("/api/mcp/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action: "connect" }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to connect");
  }
  return res.json();
}

async function disconnectServerApi(id: string): Promise<void> {
  const res = await fetch("/api/mcp/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action: "disconnect" }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to disconnect");
  }
}

async function deleteServerApi(id: string): Promise<void> {
  const res = await fetch(`/api/mcp/servers?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete server");
}

// ===== MCP Manager Component =====

export function McpManager({ expanded = true }: { expanded?: boolean }) {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [serverStates, setServerStates] = useState<Map<string, ServerState>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedServerIds, setExpandedServerIds] = useState<Set<string>>(
    new Set()
  );

  // Add form fields
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newArgs, setNewArgs] = useState("");

  const loadServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServers();
      setServers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const updateServerState = (
    id: string,
    update: Partial<ServerState>
  ) => {
    setServerStates((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        next.set(id, { ...existing, ...update });
      } else {
        next.set(id, {
          id,
          connected: false,
          tools: [],
          error: undefined,
          ...update,
        });
      }
      return next;
    });
  };

  const handleConnect = async (server: McpServerConfig) => {
    setActionLoading(server.id);
    setError(null);
    try {
      const result = await connectServerApi(server.id);
      updateServerState(server.id, {
        connected: true,
        tools: result.tools,
        error: undefined,
      });
    } catch (e) {
      updateServerState(server.id, {
        connected: false,
        error: e instanceof Error ? e.message : "Connection failed",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setActionLoading(id);
    setError(null);
    try {
      await disconnectServerApi(id);
      updateServerState(id, { connected: false, tools: [], error: undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this MCP server configuration?")
    )
      return;
    setError(null);
    try {
      await deleteServerApi(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
      setServerStates((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setExpandedServerIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newCommand.trim()) return;
    setActionLoading("new");
    setError(null);
    try {
      const server = await addServerApi({
        name: newName.trim(),
        command: newCommand.trim(),
        args: newArgs
          .split(/\s+/)
          .map((a) => a.trim())
          .filter(Boolean),
      });
      setServers((prev) => [...prev, server]);
      setNewName("");
      setNewCommand("");
      setNewArgs("");
      setShowAddForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedServerIds((prev) => {
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
        <Server size={16} className="text-[var(--muted-foreground)]" />
        <span className="font-mono text-[9px] text-[var(--dim-foreground)] uppercase tracking-wider">
          MCP
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--dim-foreground)]">
          MCP Servers {servers.length > 0 && `(${servers.length})`}
        </span>
        <button
          onClick={() => {
            setShowAddForm(true);
            setError(null);
          }}
          className="flex h-5 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
          aria-label="Add MCP server"
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

      {/* Add Form */}
      {showAddForm && (
        <div className="mx-2 mb-2 border border-[var(--border)] bg-[var(--overlay)] p-2.5 shadow-[2px_4px_16px_rgba(0,0,0,0.3)]">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              New Server
            </span>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex h-4 w-4 items-center justify-center text-[var(--dim-foreground)] hover:text-[var(--foreground)]"
              aria-label="Close add form"
            >
              <X size={10} />
            </button>
          </div>
          <div className="space-y-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Server name"
              className="w-full border border-[var(--border)] bg-transparent px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:border-[var(--primary)] focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setShowAddForm(false);
              }}
              autoFocus
            />
            <input
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              placeholder="Command (e.g., npx)"
              className="w-full border border-[var(--border)] bg-transparent px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:border-[var(--primary)] focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setShowAddForm(false);
              }}
            />
            <input
              value={newArgs}
              onChange={(e) => setNewArgs(e.target.value)}
              placeholder="Args (space-separated)"
              className="w-full border border-[var(--border)] bg-transparent px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:border-[var(--primary)] focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setShowAddForm(false);
              }}
            />
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={handleAdd}
                disabled={actionLoading === "new" || !newName.trim() || !newCommand.trim()}
                className="flex flex-1 items-center justify-center gap-1 bg-[var(--primary)] px-2 py-1 text-[10px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-dim)] disabled:opacity-40"
              >
                {actionLoading === "new" ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Plus size={10} />
                )}
                Add Server
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewName("");
                  setNewCommand("");
                  setNewArgs("");
                }}
                className="border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2
              size={14}
              className="animate-spin text-[var(--muted-foreground)]"
            />
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Server size={24} className="text-[var(--dim-foreground)]" />
            <p className="font-mono text-[10px] text-[var(--dim-foreground)]">
              No MCP servers configured
            </p>
            <button
              onClick={() => {
                setShowAddForm(true);
                setError(null);
              }}
              className="border border-[var(--border)] px-2 py-1 text-[10px] font-mono text-[var(--muted-foreground)] transition-colors hover:bg-[var(--overlay)] hover:text-[var(--foreground)]"
            >
              <Plus size={10} className="mr-1 inline" />
              Add Server
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {servers.map((server) => {
              const state = serverStates.get(server.id);
              const connected = state?.connected ?? false;
              const isExpanded = expandedServerIds.has(server.id);
              const isLoading = actionLoading === server.id;
              const tools = state?.tools ?? [];

              return (
                <div key={server.id}>
                  {/* Server Header */}
                  <div className="group relative border border-[var(--border)] bg-[var(--overlay)] transition-all hover:border-[var(--border-strong)]">
                    <div className="flex items-start gap-2.5 p-2.5">
                      {/* Server Icon */}
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center transition-colors",
                          connected
                            ? "bg-[var(--primary-muted)] text-[var(--primary)]"
                            : "bg-[var(--surface)] text-[var(--dim-foreground)]"
                        )}
                      >
                        <Server size={14} />
                      </div>

                      {/* Content */}
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => toggleExpand(server.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11px] font-semibold text-[var(--foreground)]">
                            {server.name}
                          </span>
                          {connected && (
                            <Wifi
                              size={10}
                              className="shrink-0 text-[var(--primary)]"
                            />
                          )}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[9px] text-[var(--muted-foreground)]">
                          {server.command}{" "}
                          {server.args?.join(" ")}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={cn(
                              "flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.08em]",
                              connected
                                ? "text-[var(--primary)]"
                                : "text-[var(--dim-foreground)]"
                            )}
                          >
                            {connected ? (
                              <Wifi size={8} />
                            ) : (
                              <WifiOff size={8} />
                            )}
                            {connected ? "Connected" : "Disconnected"}
                          </span>
                          {state?.error && (
                            <span className="font-mono text-[8px] text-[var(--destructive)]">
                              {state.error}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 flex-col gap-1">
                        {connected ? (
                          <button
                            onClick={() => handleDisconnect(server.id)}
                            disabled={isLoading}
                            className="flex h-6 w-6 items-center justify-center border border-[var(--accent)]/40 bg-[var(--accent-muted)] text-[var(--accent)] transition-all hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] disabled:opacity-40"
                            aria-label={`Disconnect ${server.name}`}
                          >
                            {isLoading ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <PlugZap size={10} />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(server)}
                            disabled={isLoading}
                            className="flex h-6 w-6 items-center justify-center border border-[var(--primary)]/40 bg-[var(--primary-muted)] text-[var(--primary)] transition-all hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] disabled:opacity-40"
                            aria-label={`Connect ${server.name}`}
                          >
                            {isLoading ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Plug size={10} />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(server.id)}
                          className="flex h-6 w-6 items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] transition-all hover:border-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                          aria-label={`Delete ${server.name}`}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Show Tools */}
                  {isExpanded && (
                    <div className="ml-4 border-l border-[var(--border)] pl-2 pb-1">
                      {connected && tools.length > 0 ? (
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
                                <PlugZap
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
                      ) : connected && tools.length === 0 ? (
                        <div className="px-2 py-2 font-mono text-[9px] text-[var(--dim-foreground)]">
                          No tools available from this server
                        </div>
                      ) : (
                        <div className="px-2 py-2 font-mono text-[9px] text-[var(--dim-foreground)]">
                          Connect to see available tools
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
