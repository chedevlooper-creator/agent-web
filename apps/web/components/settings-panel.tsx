"use client";

import { useChatStore } from "@/lib/store";
import { getShortcutKeys, matchAnyShortcut } from "@/lib/shortcuts-config";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  Server,
  Wrench,
  Brain,
  Zap,
  Users,
  Keyboard,
  KeyRound,
  Globe,
  Trash2,
  Plus,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";

import { PROVIDER_CATALOG, getProviderDefaults, NINEROUTER_DEFAULT_BASE } from "@/lib/providers-catalog";

import { ShortcutsConfigTab } from "@/components/shortcuts-config-tab";

const TABS = [
  { id: "provider" as const, label: "Provider", icon: Zap, description: "LLM configuration" },
  { id: "mcp" as const, label: "MCP", icon: Server, description: "Model Context Protocol" },
  { id: "skills" as const, label: "Skills", icon: Wrench, description: "Custom capabilities" },
  { id: "memory" as const, label: "Memory", icon: Brain, description: "Agent knowledge" },
  { id: "subagents" as const, label: "Agents", icon: Users, description: "Spawn assistants" },
  { id: "shortcuts" as const, label: "Shortcuts", icon: Keyboard, description: "Custom keybindings" },
];

export function SettingsPanel() {
  const { provider, model, apiKey, baseUrl, setConfig } = useChatStore();
  const currentProvider = PROVIDER_CATALOG.find((p) => p.value === provider);
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("provider");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Listen for toggle-settings custom event (dispatched by Ctrl+,)
  useEffect(() => {
    const handler = () => setSettingsOpen((prev) => !prev);
    document.addEventListener("toggle-settings", handler);
    return () => document.removeEventListener("toggle-settings", handler);
  }, []);

  // Alt+1-5 to switch tabs when settings is open (uses configured shortcuts)
  useEffect(() => {
    if (!settingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const overrides = useChatStore.getState().shortcutOverrides;
      for (let i = 0; i < TABS.length; i++) {
        const keys = getShortcutKeys(`settings-tab-${i + 1}`, overrides);
        if (matchAnyShortcut(e, keys)) {
          e.preventDefault();
          e.stopPropagation();
          setTab(TABS[i].id);
          return;
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen]);

  return (
    <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon", className: "h-9 w-9 rounded-xl hover:bg-surface-muted transition-all duration-200" })}>
        <Settings size={18} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[36rem] p-0 overflow-hidden rounded-2xl border-border/50 shadow-2xl bg-surface/95 backdrop-blur-xl animate-scale-in origin-top-right">
        <div className="flex h-[36rem]">
          <div className="w-48 border-r border-border/50 bg-surface-muted/30 flex flex-col py-4">
            <div className="px-4 mb-4">
              <h3 className="font-semibold text-sm">Settings</h3>
              <p className="text-[10px] text-muted-foreground">Manage your workspace</p>
            </div>
            <div className="space-y-1 px-2 flex-1">
              {TABS.map((t, i) => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    title={`${t.label} (Alt+${i + 1})`}
                    onClick={() => setTab(t.id)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                      isActive
                        ? "bg-surface shadow-sm border border-border/50 text-primary"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground border border-transparent"
                    }`}
                  >
                    <Icon size={16} className={`mt-0.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{t.label}</span>
                      <span className="text-[9px] opacity-70 mt-0.5 leading-tight">{t.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-background/50">
            <div className="p-6 max-w-md mx-auto animate-fade-in">
              {tab === "provider" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Provider Settings</h3>
                    <p className="text-xs text-muted-foreground">Configure your AI model provider and connection details.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Zap size={12} className="text-primary" /> Active Provider
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {PROVIDER_CATALOG.map((p) => (
                          <button
                            key={p.value}
                            onClick={() => setConfig(getProviderDefaults(p.value))}
                            className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all duration-200 flex items-center justify-between ${
                              provider === p.value
                                ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                : "bg-surface border-border/50 hover:bg-surface-muted hover:border-border"
                            }`}
                          >
                            {p.label}
                            {provider === p.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Brain size={12} className="text-accent" /> Select Model
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(currentProvider?.models ?? []).map((m) => (
                          <button
                            key={m}
                            onClick={() => setConfig({ model: m })}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                              model === m
                                ? "bg-accent/10 text-accent border-accent/30 shadow-sm"
                                : "bg-surface border-border/50 hover:bg-surface-muted"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <KeyRound size={12} className="text-warning" /> API Key
                      </label>
                      <Input 
                        type="password" 
                        value={apiKey} 
                        onChange={(e) => setConfig({ apiKey: e.target.value })} 
                        placeholder="sk-..." 
                        className="font-mono text-xs h-10 rounded-xl bg-surface focus:bg-background" 
                      />
                    </div>

                    {currentProvider?.needsBaseUrl && (
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Globe size={12} className="text-info" /> Base URL
                        </label>
                        <Input
                          value={baseUrl}
                          onChange={(e) => setConfig({ baseUrl: e.target.value })}
                          placeholder={
                            provider === "9router"
                              ? NINEROUTER_DEFAULT_BASE
                              : provider === "ollama"
                                ? "http://localhost:11434/v1"
                                : "https://api.opencode.ai/v1"
                          }
                          className="text-xs font-mono h-10 rounded-xl bg-surface focus:bg-background"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {tab === "mcp" && <McpTab />}
              {tab === "skills" && <SkillsTab />}
              {tab === "memory" && <MemoryTab />}
              {tab === "subagents" && <SubagentsTab />}
              {tab === "shortcuts" && <ShortcutsConfigTab />}
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function McpTab() {
  const [servers, setServers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchServers = useCallback(async () => {
    const res = await fetch("/api/mcp");
    if (res.ok) setServers(await res.json());
  }, []);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  const addServer = async () => {
    if (!name || !url) return;
    setLoading(true);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      if (!res.ok) throw new Error("Failed to add server");
      setName(""); setUrl("");
      await fetchServers();
      toast.success("MCP server added successfully");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const testServer = async (id: string) => {
    try {
      const res = await fetch(`/api/mcp/${id}`);
      const data = await res.json();
      if (data.tools) {
        toast.success(`Connected successfully! Found ${data.tools.length} tools`);
      } else {
        toast.error(`Error: ${data.error || "Unknown error"}`);
      }
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const deleteServer = async (id: string) => {
    try {
      await fetch(`/api/mcp/${id}`, { method: "DELETE" });
      await fetchServers();
      toast.success("Server removed successfully");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">MCP Servers</h3>
        <p className="text-xs text-muted-foreground">Connect to external tools via Model Context Protocol over SSE.</p>
      </div>
      
      <div className="space-y-4 p-4 rounded-2xl bg-surface border border-border/50 shadow-sm">
        <div className="space-y-3">
          <Input placeholder="Server Name (e.g., local-tools)" value={name} onChange={(e) => setName(e.target.value)} className="text-xs h-10 rounded-xl bg-surface-muted/50" />
          <Input placeholder="SSE Endpoint URL (e.g., http://localhost:8000/sse)" value={url} onChange={(e) => setUrl(e.target.value)} className="text-xs h-10 rounded-xl bg-surface-muted/50" />
          <Button onClick={addServer} disabled={loading || !name || !url} className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-primary/90 shadow-md shadow-primary/20">
            {loading ? "Adding..." : "Add Server"}
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Connected Servers</label>
        <div className="space-y-2">
          {(Array.isArray(servers) ? servers : []).filter((s) => !!s?.id).map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs border border-border/50 rounded-xl p-3 bg-surface hover:shadow-sm transition-all duration-200">
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{s.name}</span>
                <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{s.url}</span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="secondary" className="h-7 text-[10px] px-2.5 rounded-lg" onClick={() => testServer(s.id)}>Test</Button>
                <Button size="icon-sm" variant="ghost" className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => deleteServer(s.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
          {servers.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground bg-surface-muted/30 rounded-xl border border-dashed border-border/50">
              No MCP servers connected yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillsTab() {
  const [skillList, setSkillList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("return 'hello';");

  const fetchSkills = useCallback(async () => {
    const res = await fetch("/api/skills");
    if (res.ok) setSkillList(await res.json());
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const addSkill = async () => {
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, code }),
      });
      if (!res.ok) throw new Error("Failed to create skill");
      setName(""); setDesc(""); setCode("return 'hello';");
      await fetchSkills();
      toast.success("Skill created successfully");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Custom Skills</h3>
        <p className="text-xs text-muted-foreground">Add programmable behaviors and custom scripts for your agent.</p>
      </div>

      <div className="space-y-4 p-4 rounded-2xl bg-surface border border-border/50 shadow-sm">
        <div className="space-y-3">
          <Input placeholder="Skill Name (e.g., summarize_text)" value={name} onChange={(e) => setName(e.target.value)} className="text-xs h-10 rounded-xl bg-surface-muted/50" />
          <Input placeholder="Description (what does this do?)" value={desc} onChange={(e) => setDesc(e.target.value)} className="text-xs h-10 rounded-xl bg-surface-muted/50" />
          <textarea
            className="w-full text-xs border border-border/50 rounded-xl p-3 font-mono bg-surface-muted/50 resize-none outline-none focus:border-primary/50 focus:bg-background transition-all"
            rows={5}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button size="sm" onClick={addSkill} className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-primary/90 shadow-md shadow-primary/20">
            Create Skill
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Available Skills</label>
        <div className="space-y-2 max-h-48 overflow-auto pr-1">
          {(Array.isArray(skillList) ? skillList : []).filter((s) => !!s?.id).map((s) => (
            <div key={s.id} className="text-xs border border-border/50 rounded-xl p-3 bg-surface hover:shadow-sm transition-all duration-200">
              <div className="font-semibold text-primary">{s.name}</div>
              <div className="text-muted-foreground mt-0.5 line-clamp-2">{s.description}</div>
            </div>
          ))}
          {skillList.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground bg-surface-muted/30 rounded-xl border border-dashed border-border/50">
              No custom skills created yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemoryTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const fetchEntries = useCallback(async () => {
    const res = await fetch("/api/memory");
    if (res.ok) setEntries(await res.json());
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addEntry = async () => {
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, category: "fact", importance: 5 }),
      });
      if (!res.ok) throw new Error("Failed to add memory");
      setKey(""); setValue("");
      await fetchEntries();
      toast.success("Memory added successfully");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await fetch(`/api/memory/${id}`, { method: "DELETE" });
      await fetchEntries();
      toast.success("Memory deleted");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Agent Memory</h3>
        <p className="text-xs text-muted-foreground">Manage facts and preferences the agent remembers across sessions.</p>
      </div>

      <div className="space-y-4 p-4 rounded-2xl bg-surface border border-border/50 shadow-sm">
        <div className="space-y-3">
          <Input placeholder="Key (e.g., user_name)" value={key} onChange={(e) => setKey(e.target.value)} className="text-xs h-10 rounded-xl bg-surface-muted/50" />
          <Input placeholder="Value (e.g., Alex)" value={value} onChange={(e) => setValue(e.target.value)} className="text-xs h-10 rounded-xl bg-surface-muted/50" />
          <Button size="sm" onClick={addEntry} className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-primary/90 shadow-md shadow-primary/20">
            Add Memory
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Memory Entries</label>
        <div className="space-y-2 max-h-48 overflow-auto pr-1">
          {(Array.isArray(entries) ? entries : []).filter((e) => !!e?.id).map((e: any) => (
            <div key={e.id} className="text-xs border border-border/50 rounded-xl p-3 bg-surface hover:shadow-sm transition-all duration-200 flex justify-between items-center gap-3">
              <div className="truncate flex-1">
                <span className="font-semibold text-primary">{e.key}</span>
                <span className="text-muted-foreground mx-1.5">→</span>
                <span>{e.value}</span>
              </div>
              <Button size="icon-sm" variant="ghost" className="h-7 w-7 shrink-0 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => deleteEntry(e.id)}>
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground bg-surface-muted/30 rounded-xl border border-dashed border-border/50">
              No memories recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SubagentsTab() {
  const { currentSessionId } = useChatStore();
  const [subList, setSubList] = useState<any[]>([]);
  const [goal, setGoal] = useState("");

  const fetchSubs = useCallback(async () => {
    if (!currentSessionId) return;
    const res = await fetch(`/api/subagents?parentSessionId=${currentSessionId}`);
    if (res.ok) setSubList(await res.json());
  }, [currentSessionId]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const spawn = async () => {
    if (!currentSessionId || !goal) return;
    try {
      const { provider, model, apiKey } = useChatStore.getState();
      const res = await fetch("/api/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentSessionId: currentSessionId, goal, provider, model, apiKey }),
      });
      if (!res.ok) throw new Error("Failed to spawn subagent");
      setGoal("");
      await fetchSubs();
      toast.success("Subagent spawned successfully");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-warning",
    running: "bg-info animate-pulse",
    completed: "bg-success",
    failed: "bg-destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Subagents</h3>
        <p className="text-xs text-muted-foreground">Spawn specialized agents to perform tasks asynchronously.</p>
      </div>

      <div className="space-y-4 p-4 rounded-2xl bg-surface border border-border/50 shadow-sm">
        {!currentSessionId ? (
          <div className="text-xs text-warning bg-warning/10 p-3 rounded-lg border border-warning/20">
            Please open or create a chat session first to spawn subagents.
          </div>
        ) : (
          <div className="space-y-3">
            <Input 
              placeholder="E.g., Research top 5 AI models for coding..." 
              value={goal} 
              onChange={(e) => setGoal(e.target.value)} 
              className="text-xs h-10 rounded-xl bg-surface-muted/50" 
            />
            <Button 
              size="sm" 
              onClick={spawn} 
              disabled={!goal} 
              className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-primary/90 shadow-md shadow-primary/20"
            >
              Spawn Subagent
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Active & Past Agents</label>
        <div className="space-y-2 max-h-48 overflow-auto pr-1">
          {(Array.isArray(subList) ? subList : []).filter((s) => !!s?.id).map((s) => (
            <div key={s.id} className="text-xs border border-border/50 rounded-xl p-3 bg-surface hover:shadow-sm transition-all duration-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${statusColors[s.status] ?? "bg-secondary"}`} />
                <span className="font-semibold text-foreground truncate">{s.goal}</span>
              </div>
              <div className="text-[10px] text-muted-foreground pl-4">
                <span className="uppercase font-medium tracking-wider opacity-70">{s.status}</span>
                {s.result && <span className="ml-2">— {s.result.length > 80 ? s.result.slice(0, 80) + '...' : s.result}</span>}
              </div>
            </div>
          ))}
          {currentSessionId && subList.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground bg-surface-muted/30 rounded-xl border border-dashed border-border/50">
              No subagents spawned in this session.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
