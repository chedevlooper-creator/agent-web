"use client";

import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Settings, X, Eye, EyeOff, GitCompare, Check, Trash2, Loader2 } from "lucide-react";
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
  const savedProviders = useChatStore((s) => s.savedProviders);
  const selectedModels = useChatStore((s) => s.selectedModels);
  const compareMode = useChatStore((s) => s.compareMode);
  const setConfig = useChatStore((s) => s.setConfig);
  const toggleSelectedModel = useChatStore((s) => s.toggleSelectedModel);
  const setCompareMode = useChatStore((s) => s.setCompareMode);
  const setSelectedModels = useChatStore((s) => s.setSelectedModels);
  const saveKey = useChatStore((s) => s.saveKey);
  const deleteKey = useChatStore((s) => s.deleteKey);

  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const currentProvider = PROVIDERS.find((p) => p.value === provider);
  const hasKeyForProvider = savedProviders.includes(provider);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

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
      if (wasOpenRef.current) {
        triggerRef.current?.focus();
      }
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;
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

  const handleSaveKey = useCallback(async (key: string) => {
    if (key.length < 4) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const preview = await saveKey(provider, key);
      if (preview) {
        setSaveMsg(`Kaydedildi (${preview})`);
        setKeyInput("");
      } else {
        setSaveMsg("Anahtar kaydedilemedi. Sunucu günlüklerini kontrol edin.");
      }
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
        onClick={() => setOpen(true)}
        className={cn(
          "min-w-[44px] min-h-[44px] flex items-center justify-center border transition-colors duration-200",
          "hover:bg-muted hover:border-border/70 active:scale-95",
          open
            ? "border-electric/45 bg-electric-muted/35 text-electric"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
        aria-label={open ? "Ayarlar paneli açık" : "Ayarları aç"}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="settings-panel"
        data-tooltip={open ? "Ayarlar açık" : "Ayarları aç"}
        title={open ? "Ayarlar açık" : "Ayarları aç"}
      >
        <Settings size={18} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
      <div
        id="settings-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ayarlar"
        className={cn(
          "fixed top-0 right-0 z-50 h-dvh w-full sm:w-[380px] sm:max-w-[90vw]",
          "sidebar-cockpit border-l border-border/60",
          "flex flex-col shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] translate-x-0"
        )}
      >
        <div className="flex items-center justify-between h-14 px-5 border-b border-border/60 shrink-0">
          <h2 className="text-sm font-semibold"><span className="text-electric">Ayarlar</span></h2>
          <button
            onClick={() => setOpen(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-transparent hover:border-border/70 hover:bg-muted transition-colors duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ayarları kapat"
            data-tooltip="Ayarları kapat"
            title="Ayarları kapat"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Provider */}
          <section className="space-y-2.5">
            <label
              id="provider-label"
              className="section-label"
            >
              Sağlayıcı
            </label>
            <div
              role="radiogroup"
              aria-labelledby="provider-label"
              className="p-1 bg-black/20 border border-border/70 grid grid-cols-2 gap-1"
            >
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  role="radio"
                  aria-checked={provider === p.value}
                  onClick={() => handleProviderChange(p.value)}
                  className={cn(
                    "min-h-[44px] px-3 text-xs font-medium transition-[background-color,color,box-shadow,transform] duration-200",
                    "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    provider === p.value
                      ? "bg-electric text-black shadow-[0_0_18px_rgba(176,226,39,0.15)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Compare mode toggle */}
          <section className="glass-card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="section-label">
                Karşılaştırma Modu (A/B)
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
                  "relative inline-flex min-h-[44px] w-14 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  compareMode ? "bg-electric shadow-[0_0_18px_rgba(176,226,39,0.16)]" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                    compareMode ? "translate-x-3" : "-translate-x-3"
                  )}
                />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              <GitCompare size={10} className="inline mr-1" />
              {compareMode
                ? `En fazla 2 model seçin. ${selectedModels.length}/2 seçildi.`
                : "İki modele yan yana bir mesaj gönderin."}
            </p>
          </section>

          {/* Model */}
          <section className="space-y-2.5">
            <label
              id="model-label"
              className="section-label"
            >
              Model{compareMode ? "ler" : ""}
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
                      "min-h-[44px] w-full text-left px-3 rounded-xl text-sm transition-[background-color,border-color,color,box-shadow,transform] duration-200",
                      "active:scale-[0.98] flex items-center justify-between gap-2 hover-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
              API Anahtarı
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setSaveMsg(null);
                }}
                onPaste={(e) => {
                  // Trigger save on paste for convenience
                  const pasted = e.clipboardData.getData("text");
                  setTimeout(() => {
                    if (pasted.length > 10) {
                      handleSaveKey(pasted);
                    }
                  }, 0);
                }}
                placeholder={hasKeyForProvider ? "••••••••" : "sk-…"}
                className={cn(
                  "min-h-[44px] w-full px-3 pr-24 rounded-xl text-sm",
                  "bg-surface-muted border border-border-muted",
                  "placeholder:text-muted-foreground/40",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
                  "transition-[border-color,box-shadow,background-color] duration-200"
                )}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg
                             text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showKey ? "API anahtarını gizle" : "API anahtarını göster"}
                  aria-pressed={showKey}
                  data-tooltip={showKey ? "Anahtarı gizle" : "Anahtarı göster"}
                  title={showKey ? "Anahtarı gizle" : "Anahtarı göster"}
                >
                  {showKey ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
                {hasKeyForProvider && (
                  <button
                    type="button"
                    onClick={handleDeleteKey}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg
                               text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Kayıtlı API anahtarını kaldır"
                    data-tooltip="Kayıtlı anahtarı kaldır"
                    title="Kayıtlı anahtarı kaldır"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            {keyInput && (
              <button
                onClick={() => handleSaveKey(keyInput)}
                disabled={saving || keyInput.length < 4}
                className={cn(
                  "min-h-[44px] w-full flex items-center justify-center gap-2 px-3 rounded-xl text-sm font-medium transition-[opacity,transform,background-color] duration-200",
                  "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                {saving ? "Kaydediliyor…" : "Anahtarı Kaydet"}
              </button>
            )}
            {saveMsg && (
              <p
                className={cn(
                  "text-[11px] leading-relaxed",
                  saveMsg.startsWith("Kaydedildi")
                    ? "text-success"
                    : "text-destructive"
                )}
              >
                {saveMsg}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              {hasKeyForProvider
                ? "API anahtarı sunucuda şifrelenerek kaydedildi."
                : "API anahtarınız şifrelenerek sunucuda saklanacak."}
            </p>
          </section>

          {/* Obsidian Sync */}
          <div className="border-t border-border/30 my-2" role="separator" />
          <SyncSettings />
        </div>

        <div className="px-5 py-3 border-t border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                hasKeyForProvider ? "bg-success shadow-sm shadow-success/40" : "bg-muted-foreground"
              )}
            />
            <span className="text-xs text-muted-foreground truncate">
              {hasKeyForProvider
                ? compareMode && selectedModels.length > 1
                  ? `${provider} / ${selectedModels.join(" vs ")}`
                  : `${provider} / ${model}`
                : "API anahtarı yapılandırılmamış"}
            </span>
          </div>
        </div>
      </div>
      )}
    </>
  );
}
