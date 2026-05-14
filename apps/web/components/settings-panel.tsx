"use client";

import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Settings, X, Eye, EyeOff, GitCompare } from "lucide-react";
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
    value: "opencode",
    label: "OpenCode",
    models: ["opencode-go", "opencode-zen"],
  },
];

export function SettingsPanel() {
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const apiKey = useChatStore((s) => s.apiKey);
  const selectedModels = useChatStore((s) => s.selectedModels);
  const compareMode = useChatStore((s) => s.compareMode);
  const setConfig = useChatStore((s) => s.setConfig);
  const toggleSelectedModel = useChatStore((s) => s.toggleSelectedModel);
  const setCompareMode = useChatStore((s) => s.setCompareMode);
  const setSelectedModels = useChatStore((s) => s.setSelectedModels);

  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const currentProvider = PROVIDERS.find((p) => p.value === provider);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
      return;
    }
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
    // Clear cross-provider selected models when provider changes
    setSelectedModels([]);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className={cn(
          "min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-200",
          "hover:bg-[var(--muted)] active:scale-[0.95]",
          "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        )}
        aria-label="Open settings"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Settings size={18} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={cn(
          "fixed top-0 right-0 z-50 h-dvh w-[380px] max-w-[90vw]",
          "bg-[var(--surface)] border-l border-[var(--border)]",
          "flex flex-col shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-14 px-5 border-b border-[var(--border)] shrink-0">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            onClick={() => setOpen(false)}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-[var(--muted)] transition-colors"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Provider */}
          <section className="space-y-2.5">
            <label
              id="provider-label"
              className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]"
            >
              Provider
            </label>
            <div
              role="radiogroup"
              aria-labelledby="provider-label"
              className="grid grid-cols-3 gap-1.5"
            >
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  role="radio"
                  aria-checked={provider === p.value}
                  onClick={() => handleProviderChange(p.value)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                    "active:scale-[0.97]",
                    provider === p.value
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Compare mode toggle */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                Compare Mode (A/B)
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
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  compareMode ? "bg-[var(--accent)]" : "bg-[var(--muted)]"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                    compareMode ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
              <GitCompare size={10} className="inline mr-1" />
              {compareMode
                ? `Select up to 2 models. ${selectedModels.length}/2 selected.`
                : "Send a prompt to two models side-by-side."}
            </p>
          </section>

          {/* Model */}
          <section className="space-y-2.5">
            <label
              id="model-label"
              className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]"
            >
              Model{compareMode ? "s" : ""}
            </label>
            <div
              role={compareMode ? "group" : "radiogroup"}
              aria-labelledby="model-label"
              className="space-y-1.5"
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
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150",
                      "active:scale-[0.98] flex items-center justify-between gap-2",
                      compareMode
                        ? isSelected
                          ? "bg-[var(--accent)]/15 text-[var(--foreground)] font-medium border border-[var(--accent)]/40"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] border border-transparent"
                        : isPrimary
                        ? "bg-[var(--primary-muted)] text-[var(--foreground)] font-medium border border-[var(--primary)]/30"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] border border-transparent"
                    )}
                  >
                    <span className="truncate">{m}</span>
                    {compareMode && isSelected && (
                      <span
                        className={cn(
                          "shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold",
                          slotIndex === 0
                            ? "bg-[var(--primary)] text-white"
                            : "bg-[var(--accent)] text-white"
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

          {/* API Key */}
          <section className="space-y-2.5">
            <label
              htmlFor="api-key-input"
              className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]"
            >
              API Key
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                className={cn(
                  "w-full px-3 py-2.5 pr-10 rounded-lg text-sm",
                  "bg-[var(--muted)] border border-[var(--border)]",
                  "placeholder:text-[var(--muted-foreground)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 focus:border-[var(--primary)]",
                  "transition-all duration-200"
                )}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md
                           text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Your API key is stored locally in your browser.
            </p>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                apiKey ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]"
              )}
            />
            <span className="text-xs text-[var(--muted-foreground)] truncate">
              {apiKey
                ? compareMode && selectedModels.length > 1
                  ? `${provider} / ${selectedModels.join(" vs ")}`
                  : `${provider} / ${model}`
                : "No API key configured"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
