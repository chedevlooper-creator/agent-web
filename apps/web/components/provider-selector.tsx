"use client";

import { useState } from "react";
import { useChatStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Globe, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PROVIDER_CATALOG, getProviderDefaults, NINEROUTER_DEFAULT_BASE } from "@/lib/providers-catalog";

export function ProviderSelector() {
  const { provider, model, apiKey, baseUrl, setConfig } = useChatStore();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [customBaseUrl, setCustomBaseUrl] = useState("");

  const currentProvider = PROVIDER_CATALOG.find((p) => p.value === provider);
  const currentModel = currentProvider?.models.find((m) => m === model);
  const contextLength = currentModel ? (currentProvider?.contextLength ?? 0) : 0;

  const premiumModels =
    currentProvider?.freeModels != null
      ? currentProvider.models.filter((m) => !currentProvider.freeModels!.includes(m))
      : [];

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const effectiveBase = customBaseUrl || baseUrl;
      const res = await fetch(
        `/api/provider?action=test&provider=${provider}&model=${model}&apiKey=${encodeURIComponent(apiKey)}${effectiveBase ? `&baseUrl=${encodeURIComponent(effectiveBase)}` : ""}`
      );
      const data = await res.json();
      if (data.success) {
        setTestResult("success");
        toast.success("Connection successful");
      } else {
        setTestResult("error");
        toast.error(`Connection failed: ${data.error}`);
      }
    } catch (e) {
      setTestResult("error");
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  const apiKeyOptional = currentProvider?.optionalApiKey === true;

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Providers</div>
      <div className="grid grid-cols-3 gap-2">
        {PROVIDER_CATALOG.map((p) => (
          <button
            key={p.value}
            onClick={() => setConfig(getProviderDefaults(p.value))}
            className={`px-2 py-2 rounded-lg text-[10px] font-medium border transition-all text-center ${
              provider === p.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 border-border hover:bg-muted"
            }`}
          >
            <Globe size={12} className="mx-auto mb-0.5" />
            {p.label}
          </button>
        ))}
      </div>

      <Separator />

      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Models</div>
      {provider === "openrouter" && currentProvider?.freeModels ? (
        <div className="space-y-2">
          <div>
            <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
              Free ({currentProvider.freeModels.length})
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {currentProvider.freeModels.map((m) => (
                <button
                  key={m}
                  onClick={() => setConfig({ model: m })}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-all ${
                    model === m
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-muted/50 border-border hover:bg-muted"
                  }`}
                >
                  {m.replace(":free", "")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Premium</div>
            <div className="flex flex-wrap gap-1.5">
              {premiumModels.map((m) => (
                <button
                  key={m}
                  onClick={() => setConfig({ model: m })}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-all ${
                    model === m
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted/50 border-border hover:bg-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {(currentProvider?.models ?? []).map((m) => (
            <button
              key={m}
              onClick={() => setConfig({ model: m })}
              className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-all ${
                model === m
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/50 border-border hover:bg-muted"
              }`}
            >
              {m.replace(":free", "")}
            </button>
          ))}
        </div>
      )}

      {contextLength > 0 && (
        <div className="text-[10px] text-muted-foreground">
          Context window: {(contextLength / 1000).toFixed(0)}K tokens
        </div>
      )}

      <Separator />

      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        API Key {apiKeyOptional ? "(optional — server .env)" : ""}
      </div>
      <Input
        type="password"
        value={apiKey}
        onChange={(e) => setConfig({ apiKey: e.target.value })}
        placeholder={apiKeyOptional ? "Uses NINEROUTER_KEY from server if empty" : "sk-..."}
        className="font-mono text-xs"
      />

      {currentProvider?.needsBaseUrl ? (
        <>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Base URL</div>
          <Input
            value={customBaseUrl || baseUrl}
            onChange={(e) => {
              setCustomBaseUrl(e.target.value);
              setConfig({ baseUrl: e.target.value });
            }}
            placeholder={provider === "9router" ? NINEROUTER_DEFAULT_BASE : "http://localhost:11434/v1"}
            className="text-xs font-mono"
          />
        </>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={testConnection}
          disabled={testing || (!apiKeyOptional && !apiKey)}
          className="flex-1"
        >
          {testing ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
          {testing ? "Testing..." : "Test Connection"}
        </Button>
        {testResult === "success" && <CheckCircle2 size={14} className="text-emerald-500" />}
        {testResult === "error" && <XCircle size={14} className="text-red-500" />}
      </div>
    </div>
  );
}
