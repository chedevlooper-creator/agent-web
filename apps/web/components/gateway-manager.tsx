"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  Phone,
  Wifi,
  WifiOff,
  Plug,
  PlugZap,
  Loader2,
  Bot,
  Plus,
  Trash2,
} from "lucide-react";

// ===== Types =====

interface GatewayConfig {
  platform: string;
  enabled: boolean;
  credentials: Record<string, string>;
  agentId: string | null;
}

interface GatewayStatus {
  platform: string;
  connected: boolean;
  error?: string;
  lastActivity?: number;
}

interface GatewayData {
  configs: GatewayConfig[];
  statuses: GatewayStatus[];
}

// ===== API Helpers =====

async function fetchGateways(): Promise<GatewayData> {
  const res = await fetch("/api/gateway");
  if (!res.ok) throw new Error("Failed to fetch gateways");
  return res.json();
}

async function saveGatewayApi(config: GatewayConfig): Promise<{ success: boolean; connectError?: string }> {
  const res = await fetch("/api/gateway", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to save gateway");
  }
  return res.json();
}

async function removeGatewayApi(platform: string): Promise<void> {
  const res = await fetch(`/api/gateway?platform=${encodeURIComponent(platform)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to remove gateway");
  }
}

// ===== Platform Config =====

const PLATFORM_META: Record<string, { label: string; icon: typeof MessageCircle; credentialLabel: string; credentialKey: string }> = {
  discord: {
    label: "Discord",
    icon: MessageCircle,
    credentialLabel: "Bot Token",
    credentialKey: "token",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: Phone,
    credentialLabel: "API Key",
    credentialKey: "apiKey",
  },
};

const PLATFORMS = ["discord", "whatsapp"];

// ===== GatewayManager Component =====

export function GatewayManager({ expanded = true }: { expanded?: boolean }) {
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [statuses, setStatuses] = useState<GatewayStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState<string | null>(null);

  // Config form state per platform
  const [showForm, setShowForm] = useState<string | null>(null);
  const [formToken, setFormToken] = useState("");
  const [formAgentId, setFormAgentId] = useState("");

  const loadGateways = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGateways();
      setConfigs(data.configs);
      setStatuses(data.statuses);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGateways();
  }, [loadGateways]);

  const getStatusForPlatform = (platform: string): GatewayStatus | undefined => {
    return statuses.find((s) => s.platform === platform);
  };

  const getConfigForPlatform = (platform: string): GatewayConfig | undefined => {
    return configs.find((c) => c.platform === platform);
  };

  const handleConfigure = async (platform: string) => {
    setActionLoading(platform);
    setError(null);
    try {
      const existing = getConfigForPlatform(platform);
      const credentials: Record<string, string> = {};
      const meta = PLATFORM_META[platform];
      if (meta) {
        credentials[meta.credentialKey] = formToken.trim();
      }

      await saveGatewayApi({
        platform,
        enabled: existing?.enabled ?? true,
        credentials,
        agentId: formAgentId.trim() || existing?.agentId || null,
      });

      setFormToken("");
      setFormAgentId("");
      setShowForm(null);
      await loadGateways();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to configure");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleEnabled = async (config: GatewayConfig, enabled: boolean) => {
    setActionLoading(config.platform);
    setError(null);
    try {
      await saveGatewayApi({ ...config, enabled });
      await loadGateways();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnect = async (platform: string) => {
    setConnectLoading(platform);
    setError(null);
    try {
      await saveGatewayApi({
        ...getConfigForPlatform(platform)!,
        enabled: true,
      });
      await loadGateways();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setConnectLoading(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    setConnectLoading(platform);
    setError(null);
    try {
      await saveGatewayApi({
        ...getConfigForPlatform(platform)!,
        enabled: false,
      });
      await loadGateways();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setConnectLoading(null);
    }
  };

  const handleRemove = async (platform: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Remove ${PLATFORM_META[platform]?.label ?? platform} configuration?`
      )
    )
      return;
    setActionLoading(platform);
    setError(null);
    try {
      await removeGatewayApi(platform);
      await loadGateways();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setActionLoading(null);
    }
  };

  const openForm = (platform: string) => {
    const existing = getConfigForPlatform(platform);
    setShowForm(platform);
    setFormToken("");
    setFormAgentId(existing?.agentId ?? "");
    setError(null);
  };

  // Collapsed state
  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <Wifi size={16} className="text-[var(--muted-foreground)]" />
        <span className="font-mono text-[9px] text-[var(--dim-foreground)] uppercase tracking-wider">
          Gateway
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--dim-foreground)]">
          Gateways {configs.length > 0 && `(${configs.length})`}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-2 mb-1 border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-2 py-1">
          <p className="font-mono text-[9px] text-[var(--destructive)]">
            {error}
          </p>
        </div>
      )}

      {/* Gateway List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2
              size={14}
              className="animate-spin text-[var(--muted-foreground)]"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {PLATFORMS.map((platform) => {
              const meta = PLATFORM_META[platform];
              const Icon = meta.icon;
              const config = getConfigForPlatform(platform);
              const status = getStatusForPlatform(platform);
              const isConfigured = !!config;
              const isEnabled = config?.enabled ?? false;
              const isConnected = status?.connected ?? false;
              const isLoading = actionLoading === platform;
              const isConnectLoading = connectLoading === platform;
              const isFormOpen = showForm === platform;

              return (
                <div key={platform}>
                  {/* Platform Card */}
                  <div className="border border-[var(--border)] bg-[var(--overlay)] transition-all hover:border-[var(--border-strong)]">
                    <div className="flex items-start gap-2.5 p-2.5">
                      {/* Platform Icon */}
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center transition-colors",
                          isConnected
                            ? "bg-[var(--primary-muted)] text-[var(--primary)]"
                            : isConfigured
                              ? "bg-[var(--surface)] text-[var(--muted-foreground)]"
                              : "bg-[var(--surface)] text-[var(--dim-foreground)]"
                        )}
                      >
                        {isConnected ? (
                          <Wifi size={14} />
                        ) : isConfigured ? (
                          <WifiOff size={14} />
                        ) : (
                          <Icon size={14} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11px] font-semibold text-[var(--foreground)]">
                            {meta.label}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-[8px] uppercase tracking-[0.08em]",
                              isConnected
                                ? "text-[var(--primary)]"
                                : isConfigured
                                  ? "text-[var(--muted-foreground)]"
                                  : "text-[var(--dim-foreground)]"
                            )}
                          >
                            {isConnected
                              ? "Connected"
                              : isConfigured
                                ? "Disconnected"
                                : "Not configured"}
                          </span>
                        </div>

                        {/* Status details */}
                        {isConfigured && (
                          <div className="mt-0.5 space-y-0.5">
                            {status?.error && (
                              <p className="line-clamp-1 font-mono text-[8px] text-[var(--destructive)]">
                                {status.error}
                              </p>
                            )}
                            {status?.lastActivity && (
                              <p className="font-mono text-[8px] text-[var(--dim-foreground)]">
                                Last activity:{" "}
                                {new Date(status.lastActivity).toLocaleTimeString()}
                              </p>
                            )}
                            {config.agentId && (
                              <p className="flex items-center gap-1 font-mono text-[8px] text-[var(--muted-foreground)]">
                                <Bot size={8} />
                                Agent: {config.agentId}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 flex-col gap-1">
                        {isConfigured ? (
                          <>
                            {/* Connect/Disconnect */}
                            <button
                              onClick={() =>
                                isConnected
                                  ? handleDisconnect(platform)
                                  : handleConnect(platform)
                              }
                              disabled={isConnectLoading}
                              className={cn(
                                "flex h-6 w-6 items-center justify-center border transition-all disabled:opacity-40",
                                isConnected
                                  ? "border-[var(--primary)]/40 bg-[var(--primary-muted)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]"
                                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                              )}
                              aria-label={
                                isConnected ? `Disconnect ${meta.label}` : `Connect ${meta.label}`
                              }
                            >
                              {isConnectLoading ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : isConnected ? (
                                <PlugZap size={10} />
                              ) : (
                                <Plug size={10} />
                              )}
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => openForm(platform)}
                              disabled={isLoading}
                              className="flex h-6 w-6 items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:text-[var(--primary)] disabled:opacity-40"
                              aria-label={`Configure ${meta.label}`}
                            >
                              <Icon size={10} />
                            </button>

                            {/* Remove */}
                            <button
                              onClick={() => handleRemove(platform)}
                              disabled={isLoading}
                              className="flex h-6 w-6 items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] transition-all hover:border-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] disabled:opacity-40"
                              aria-label={`Remove ${meta.label}`}
                            >
                              {isLoading ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <Trash2 size={10} />
                              )}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openForm(platform)}
                            className="flex h-6 w-6 items-center justify-center border border-[var(--border)] text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                            aria-label={`Configure ${meta.label}`}
                          >
                            <Plus size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Config Form */}
                  {isFormOpen && (
                    <div className="ml-4 border-l border-[var(--border)] pl-2 pb-2 pt-1">
                      <div className="border border-[var(--border)] bg-[var(--surface)] p-2">
                        <div className="space-y-1.5">
                          <div>
                            <label className="block font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--dim-foreground)]">
                              {meta.credentialLabel}
                            </label>
                            <input
                              type="password"
                              value={formToken}
                              onChange={(e) => setFormToken(e.target.value)}
                              placeholder={
                                platform === "discord"
                                  ? "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.."
                                  : "Enter API key..."
                              }
                              className="mt-0.5 w-full border border-[var(--border)] bg-transparent px-2 py-1 font-mono text-[9px] text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:border-[var(--primary)] focus:outline-none"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--dim-foreground)]">
                              Agent ID (optional)
                            </label>
                            <input
                              type="text"
                              value={formAgentId}
                              onChange={(e) => setFormAgentId(e.target.value)}
                              placeholder="agent-id-to-handle-messages"
                              className="mt-0.5 w-full border border-[var(--border)] bg-transparent px-2 py-1 font-mono text-[9px] text-[var(--foreground)] placeholder:text-[var(--dim-foreground)] focus:border-[var(--primary)] focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-1.5 pt-1">
                            <button
                              onClick={() => handleConfigure(platform)}
                              disabled={!formToken.trim()}
                              className="flex flex-1 items-center justify-center gap-1 bg-[var(--primary)] px-2 py-1 text-[9px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-dim)] disabled:opacity-40"
                            >
                              <Plus size={9} />
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setShowForm(null);
                                setFormToken("");
                                setFormAgentId("");
                              }}
                              className="border border-[var(--border)] px-2 py-1 text-[9px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {!loading && configs.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Wifi size={24} className="text-[var(--dim-foreground)]" />
                <p className="font-mono text-[10px] text-[var(--dim-foreground)]">
                  No gateways configured
                </p>
                <p className="font-mono text-[8px] text-[var(--dim-foreground)] leading-relaxed max-w-[200px]">
                  Configure Discord or WhatsApp to bridge your agents to external messaging platforms.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
