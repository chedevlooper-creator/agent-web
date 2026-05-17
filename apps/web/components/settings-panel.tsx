"use client";

import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Settings, X, GitCompare, CheckCircle2, CircleDot } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { SyncSettings } from "./settings/sync-settings";

const PROVIDERS = [
  {
    value: "openai",
    label: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    models: [
      "anthropic/claude-sonnet-4",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "google/gemini-2.5-pro",
      "deepseek/deepseek-chat",
      "meta-llama/llama-3.3-70b-instruct",
    ],
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"],
  },
];

export function SettingsPanel() {
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const hasApiKey = useChatStore((s) => s.hasApiKey);
  const serverProviders = useChatStore((s) => s.serverProviders);
  const selectedModels = useChatStore((s) => s.selectedModels);
  const compareMode = useChatStore((s) => s.compareMode);
  const setConfig = useChatStore((s) => s.setConfig);
  const checkApiKeyStatus = useChatStore((s) => s.checkApiKeyStatus);
  const toggleSelectedModel = useChatStore((s) => s.toggleSelectedModel);
  const setCompareMode = useChatStore((s) => s.setCompareMode);
  const setSelectedModels = useChatStore((s) => s.setSelectedModels);
  const saveKey = useChatStore((s) => s.saveKey);
  const deleteKey = useChatStore((s) => s.deleteKey);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const currentProvider = PROVIDERS.find((p) => p.value === provider);
  const hasKeyForProvider = !!serverProviders && serverProviders[provider];

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    checkApiKeyStatus();
  }, [checkApiKeyStatus]);

  // Sync native <dialog> open/close with React state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  // onClose fires when dialog closes via Escape, backdrop click, or programmatic close()
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const availableModels = currentProvider?.models ?? [];

  const handleSaveKey = useCallback(async (key: string) => {
    if (key.length < 4) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveKey(provider, key);
      setSaveMsg("Anahtar kaydedildi.");
      setKeyInput("");
    } catch {
      setSaveMsg("Anahtar kaydedilemedi. Sunucu çalışıyor mu?");
    } finally {
      setSaving(false);
    }
  }, [provider, saveKey]);

  const handleDeleteKey = useCallback(async () => {
    try {
      await deleteKey(provider);
      setKeyInput("");
      setSaveMsg(null);
    } catch {
      setSaveMsg("Anahtar kaldırılamadı.");
    }
  }, [provider, deleteKey]);

  const handleProviderChange = (v: string) => {
    const p = PROVIDERS.find((x) => x.value === v);
    if (!p) return;
    setConfig({ provider: v, model: p.models[0] });
    setSelectedModels([]);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={cn(
          "signal-button h-6 w-7 px-0",
          "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        )}
        aria-label="Ayarları aç"
        aria-haspopup="dialog"
        aria-controls="settings-panel"
        data-tooltip="Ayarları aç"
        title="Ayarları aç"
      >
        <Settings size={16} />
      </button>

      <dialog
        id="settings-panel"
        ref={dialogRef}
        aria-label="Ayarlar"
        className="flex flex-col"
        onClose={handleClose}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-11 px-3 border-b border-[var(--border)] shrink-0">
          <h2 className="text-[10px] font-bold tracking-[0.15em] uppercase font-mono text-[var(--muted-foreground)]">Settings</h2>
          <button
            onClick={() => dialogRef.current?.close()}
            className="min-w-[28px] min-h-[28px] flex items-center justify-center border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:bg-[var(--overlay)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close settings"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* Provider */}
          <section className="space-y-2">
            <label
              id="provider-label"
              className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--muted-foreground)] font-mono"
            >
              Sağlayıcı
            </label>
            <div
              role="radiogroup"
              aria-labelledby="provider-label"
              className="grid grid-cols-3 gap-1"
            >
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  role="radio"
                  aria-checked={provider === p.value}
                  onClick={() => handleProviderChange(p.value)}
                  className={cn(
                    "px-2.5 py-1.5 text-[11px] font-medium transition-all duration-100 font-mono",
                    "active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:outline-none",
                    "border",
                    provider === p.value
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] border-[var(--border)]"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Compare mode toggle */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--muted-foreground)] font-mono">
                Compare (A/B)
              </label>
              <button
                onClick={() => {
                  const next = !compareMode;
                  setCompareMode(next);
                  if (!next) setSelectedModels([]);
                }}
                aria-label={compareMode ? "Karşılaştırma modunu kapat" : "Karşılaştırma modunu aç"}
                aria-pressed={compareMode}
                className={cn(
                  "relative inline-flex h-4 w-8 items-center transition-colors",
                  "border",
                  compareMode
                    ? "bg-[var(--primary-muted)] border-[var(--primary)]"
                    : "bg-[var(--muted)] border-[var(--border)]"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3 w-3 transform transition-transform",
                    compareMode
                      ? "translate-x-[17px] bg-[var(--primary)]"
                      : "translate-x-[2px] bg-[var(--muted-foreground)]"
                  )}
                />
              </button>
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)] leading-relaxed font-mono">
              <GitCompare size={9} className="inline mr-1" />
              {compareMode
                ? `Select up to 2 models. ${selectedModels.length}/2 selected.`
                : "Send to two models side-by-side."}
            </p>
          </section>

          {/* Model */}
          <section className="space-y-2">
            <label
              id="model-label"
              className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--muted-foreground)] font-mono"
            >
              Model{compareMode ? "ler" : ""}
            </label>
            <div
              role={compareMode ? "group" : "radiogroup"}
              aria-labelledby="model-label"
              className="space-y-1"
            >
              {availableModels.map((m) => {
                const isPrimary = !compareMode && model === m;
                const isSelected = compareMode && selectedModels.includes(m);
                const slotIndex = compareMode ? selectedModels.indexOf(m) : -1;
                return (
                  <button
                    key={m}
                    role={compareMode ? "checkbox" : "radio"}
                    aria-checked={compareMode ? isSelected : isPrimary}
                    onClick={() => {
                      if (compareMode) toggleSelectedModel(m);
                      else setConfig({ model: m });
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 text-xs transition-colors duration-100",
                      "active:scale-[0.98] flex items-center justify-between gap-2",
                      "focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:outline-none",
                      "border",
                      compareMode
                        ? isSelected
                          ? "bg-[var(--accent-muted)] text-[var(--foreground)] font-medium border-[var(--accent)]/40"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] border-transparent"
                        : isPrimary
                        ? "bg-[var(--primary-muted)] text-[var(--foreground)] font-medium border-[var(--primary)]/30"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] border-transparent"
                    )}
                  >
                    <span className="truncate font-mono text-[11px]">{m}</span>
                    {compareMode && isSelected && (
                      <span
                        className={cn(
                          "shrink-0 text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-wider",
                          slotIndex === 0
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        )}
                      >
                        {slotIndex === 0 ? "A" : "B"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* API Key Status */}
          <section className="space-y-2" aria-labelledby="server-api-keys-heading">
            <h3 id="server-api-keys-heading" className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--muted-foreground)] font-mono">
              Server API Keys
            </h3>
            <div className="space-y-1">
              {Object.entries(serverProviders).length === 0 ? (
                <p className="text-[11px] text-[var(--muted-foreground)] py-2 font-mono">
                  Checking...
                </p>
              ) : (
                Object.entries(serverProviders).map(([name, configured]) => (
                  <div
                    key={name}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 text-xs border transition-colors",
                      configured
                        ? "bg-[var(--success)]/5 border-[var(--success)]/30"
                        : "bg-[var(--muted)] border-[var(--border)]"
                    )}
                  >
                    {configured ? (
                      <CheckCircle2 size={13} className="text-[var(--success)] shrink-0" />
                    ) : (
                      <CircleDot size={13} className="text-[var(--muted-foreground)] shrink-0" />
                    )}
                    <span className="flex-1 truncate capitalize text-[11px]">{name}</span>
                    <span
                      className={cn(
                        "text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-wider",
                        configured
                          ? "bg-[var(--success)]/15 text-[var(--success)]"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      )}
                    >
                      {configured ? "OK" : "N/A"}
                    </span>
                  </div>
                ))
              )}
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)] font-mono">
              Set <code className="px-1 py-0.5 bg-[var(--muted)] text-[10px]">{provider === "openai" ? "OPENAI_API_KEY" : provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENROUTER_API_KEY"}</code> in server env.
            </p>
          </section>

          {/* API Key Input (transient, for current session) */}
          <section className="space-y-2" aria-labelledby="transient-api-key-heading">
            <h3 id="transient-api-key-heading" className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--muted-foreground)] font-mono">
              Transient API Key
            </h3>
            <div className="flex gap-1">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveKey(keyInput);
                }}
                placeholder="Paste API key to save..."
                className={cn(
                  "min-w-0 flex-1 bg-[var(--input)] border border-[var(--border)] px-2 py-1.5 font-mono text-[11px]",
                  "text-[var(--foreground)] placeholder:text-[var(--dim-foreground)]",
                  "focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--ring)]"
                )}
                disabled={saving}
                aria-label="API key input"
              />
              <button
                onClick={() => handleSaveKey(keyInput)}
                disabled={keyInput.length < 4 || saving}
                className={cn(
                  "px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider font-mono border transition-colors",
                  "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
                aria-label="Save key"
              >
                {saving ? "..." : "Save"}
              </button>
              {hasKeyForProvider && (
                <button
                  onClick={handleDeleteKey}
                  className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider font-mono border border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors"
                  aria-label="Delete key"
                >
                  Del
                </button>
              )}
            </div>
            {saveMsg && (
              <p className="text-[10px] text-[var(--dim-foreground)] font-mono">{saveMsg}</p>
            )}
          </section>

          {/* Obsidian Sync */}
          <div className="border-t border-border/30 my-2" role="separator" />
          <SyncSettings />
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-1.5 h-1.5",
                hasApiKey ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]"
              )}
            />
            <span className="text-[10px] text-[var(--muted-foreground)] truncate font-mono">
              {hasApiKey
                ? compareMode && selectedModels.length > 1
                  ? `${provider} / ${selectedModels.join(" vs ")}`
                  : `${provider} / ${model}`
                : "NO API KEY"}
            </span>
          </div>
        </div>
      </dialog>
    </>
  );
}
