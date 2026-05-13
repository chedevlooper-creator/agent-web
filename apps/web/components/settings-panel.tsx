"use client";

import { useChatStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings } from "lucide-react";

const PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "o3-mini"] },
  { value: "openrouter", label: "OpenRouter", models: ["anthropic/claude-sonnet-4", "openai/gpt-4o", "google/gemini-2.5-pro"] },
  { value: "opencode", label: "OpenCode", models: ["opencode-go", "opencode-zen"] },
];

export function SettingsPanel() {
  const { provider, model, apiKey, setConfig } = useChatStore();
  const currentProvider = PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm"><Settings size={14} className="mr-1" /> Settings</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Provider</label>
            <div className="flex gap-1">
              {PROVIDERS.map((p) => (
                <Button
                  key={p.value}
                  size="sm"
                  variant={provider === p.value ? "default" : "outline"}
                  onClick={() => setConfig({ provider: p.value, model: p.models[0] })}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Model</label>
            <div className="flex flex-wrap gap-1">
              {(currentProvider?.models ?? []).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={model === m ? "default" : "outline"}
                  onClick={() => setConfig({ model: m })}
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setConfig({ apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
