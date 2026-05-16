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
    value: "deepseek",
    label: "DeepSeek",
    models: ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
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
    setSelectedModels([]);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className={cn(
          "min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl transition-all duration-200",
          "hover:bg-muted active:scale-95",
          "text-muted-foreground hover:text-foreground"
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
          "bg-background border-l border-border/40",
          "flex flex-col shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-14 px-5 border-b border-border/40 shrink-0">
          <h2 className="text-sm font-semibold tracking-tight">Settings</h2>
          <button
            onClick={() => setOpen(false)}
            className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-muted transition-all duration-200 active:scale-95"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Provider */}
          <section className="space-y-2.5">
            <label
              id="provider-label"
              className="section-label"
            >
              Provider
            </label>
            <div
              role="radiogroup"
              aria-labelledby="provider-label"
              className="p-0.5 rounded-xl bg-surface-muted/40 border border-border-muted grid grid-cols-4 gap-1"
            >
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  role="radio"
                  aria-checked={provider === p.value}
                  onClick={() => handleProviderChange(p.value)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                    "active:scale-[0.97]",
                    provider === p.value
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Compare mode toggle */}
          <section className="glass-card rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="section-label">
                Compare Mode (A/B)
              </label>
              <button
                onClick={() => {
                  const next = !compareMode;
                  setCompareMode(next);
                  if (!next) setSelectedModels([]);
                }}
                aria-pressed={compareMode}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300",
                  compareMode ? "bg-gradient-to-r from-primary to-accent shadow-sm shadow-primary/20" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                    compareMode ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
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
              className="section-label"
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
                      "w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                      "active:scale-[0.98] flex items-center justify-between gap-2 hover-glow",
                      compareMode
                        ? isSelected
                          ? "bg-accent/8 text-foreground font-medium border border-accent/20"
                          : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground border border-transparent"
                        : isPrimary
                        ? "bg-primary/8 text-foreground font-medium border border-primary/20"
                        : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground border border-transparent"
                    )}
                  >
                    <span className="truncate">{m}</span>
                    {compareMode && isSelected && (
                      <span
                        className={cn(
                          "shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-bold",
                          slotIndex === 0
                            ? "bg-primary text-white"
                            : "bg-accent text-white"
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
              className="section-label"
            >
              API Key
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setConfig({ apiKey: e.target.value })}
                placeholder="sk-…"
                className={cn(
                  "w-full px-3 py-2.5 pr-10 rounded-xl text-sm",
                  "bg-surface-muted border border-border-muted",
                  "placeholder:text-muted-foreground/40",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
                  "transition-all duration-200"
                )}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg
                           text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              Your API key is stored locally in your browser.
            </p>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                apiKey ? "bg-success shadow-sm shadow-success/40" : "bg-muted-foreground"
              )}
            />
            <span className="text-xs text-muted-foreground truncate">
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
