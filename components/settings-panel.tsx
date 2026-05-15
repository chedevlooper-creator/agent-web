"use client";

import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Settings, X, GitCompare, CheckCircle2, CircleDot } from "lucide-react";
import { useState, useRef, useEffect } from "react";

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

  const [open, setOpen] = useState(false);
  const currentProvider = PROVIDERS.find((p) => p.value === provider);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hadOpenedRef = useRef(false);

  useEffect(() => {
    checkApiKeyStatus();
  }, [checkApiKeyStatus]);

  useEffect(() => {
    if (!open) return;
    checkApiKeyStatus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, checkApiKeyStatus]);

  useEffect(() => {
    if (!open) {
      if (hadOpenedRef.current) {
        triggerRef.current?.focus();
        hadOpenedRef.current = false;
      }
      return;
    }
    hadOpenedRef.current = true;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    first?.focus();

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusables.length === 0) return;
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onTab);
    return () => window.removeEventListener("keydown", onTab);
  }, [open]);

  const availableModels = currentProvider?.models ?? [];

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
        onClick={() => setOpen(true)}
        className={cn(
          "signal-button h-6 w-7 px-0",
          "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        )}
        aria-label="Open settings"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Settings size={16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={cn(
          "fixed top-0 right-0 z-50 h-dvh w-[360px] max-w-[95vw]",
          "bg-[var(--surface)] border-l border-[var(--border-strong)] shadow-[0_0_40px_rgba(0,0,0,0.55)]",
          "flex flex-col",
          "transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-11 px-3 border-b border-[var(--border)] shrink-0">
          <h2 className="text-[10px] font-bold tracking-[0.15em] uppercase font-mono text-[var(--muted-foreground)]">Settings</h2>
          <button
            onClick={() => setOpen(false)}
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
              Provider
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
                  if (!next) {
                    setSelectedModels([]);
                  }
                }}
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
              Model{compareMode ? "s" : ""}
            </label>
            <div
              role={compareMode ? "group" : "radiogroup"}
              aria-labelledby="model-label"
              className="space-y-1"
            >
              {availableModels.map((m) => {
                const isPrimary = !compareMode && model === m;
                const isSelected = compareMode && selectedModels.includes(m);
                const slotIndex = compareMode
                  ? selectedModels.indexOf(m)
                  : -1;
                return (
                  <button
                    key={m}
                    role={compareMode ? "checkbox" : "radio"}
                    aria-checked={compareMode ? isSelected : isPrimary}
                    onClick={() => {
                      if (compareMode) {
                        toggleSelectedModel(m);
                      } else {
                        setConfig({ model: m });
                      }
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
          <section className="space-y-2">
            <label className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--muted-foreground)] font-mono">
              Server API Keys
            </label>
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
      </div>
    </>
  );
}
