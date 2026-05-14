"use client";

import { useChatStore } from "@/lib/store";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Wrench,
  Brain,
  Wrench as ToolIcon,
  Users,
  Clock,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Zap,
  Server,
  Loader2,
  Trash2,
  Plus,
  Check,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const TABS = [
  { id: "tools" as const, label: "Tools", icon: Wrench },
  { id: "memory" as const, label: "Memory", icon: Brain },
  { id: "skills" as const, label: "Skills", icon: ToolIcon },
  { id: "subagents" as const, label: "Agents", icon: Users },
  { id: "cron" as const, label: "Cron", icon: Clock },
  { id: "search" as const, label: "Search", icon: Search },
];

export function ContextPanel() {
  const { contextPanelOpen, contextPanelTab, setContextPanelOpen, setContextPanelTab } = useChatStore();

  if (!contextPanelOpen) {
    return (
      <div className="w-14 border-l flex flex-col h-full shrink-0 bg-surface border-border/50 items-center py-3 gap-2 transition-all duration-300">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl hover:bg-surface-muted transition-all duration-200"
          onClick={() => setContextPanelOpen(true)}
          title="Open context panel"
        >
          <PanelRightOpen size={18} className="text-muted-foreground" />
        </Button>
        <div className="w-8 h-px bg-border my-1" />
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setContextPanelOpen(true);
                setContextPanelTab(t.id);
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                contextPanelTab === t.id
                  ? "bg-gradient-to-br from-primary/20 to-accent/20 text-primary shadow-sm"
                  : "hover:bg-surface-muted text-muted-foreground"
              }`}
              title={t.label}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-80 border-l flex flex-col h-full shrink-0 bg-surface border-border/50 transition-all duration-300">
      <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-1">
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-1.5 rounded-lg mr-1">
            <Sparkles size={12} className="text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground">Context</span>
        </div>
        <div className="flex items-center gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setContextPanelTab(t.id)}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  contextPanelTab === t.id
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "hover:bg-surface-muted text-muted-foreground"
                }`}
                title={t.label}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg hover:bg-surface-muted transition-all duration-200"
          onClick={() => setContextPanelOpen(false)}
          title="Collapse panel"
        >
          <PanelRightClose size={14} className="text-muted-foreground" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {contextPanelTab === "tools" && <ToolsTab />}
          {contextPanelTab === "memory" && <MemoryTab />}
          {contextPanelTab === "skills" && <SkillsTab />}
          {contextPanelTab === "subagents" && <SubagentsTab />}
          {contextPanelTab === "cron" && <CronTab />}
          {contextPanelTab === "search" && <SearchTab />}
        </div>
      </ScrollArea>
    </div>
  );
}

function ToolsTab() {
  const { toolsets, tools, toggleToolset } = useChatStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch("/api/tools");
      if (res.ok) {
        const data = await res.json();
        useChatStore.setState({ tools: data.tools, toolsets: data.toolsets });
      }
    } catch (e) {
      console.error("Failed to fetch tools", e);
    }
  }, []);

  const toggleTool = async (name: string) => {
    try {
      await fetch("/api/tools", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled: !tools.find((t) => t.name === name)?.enabled }),
      });
      await fetchTools();
    } catch (e) {
      console.error(e);
    }
  };

  const toolsetGroups = tools.reduce((acc: Record<string, typeof tools>, tool) => {
    const key = tool.toolset || "default";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tool);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(toolsetGroups).map(([toolset, groupTools]) => (
        <Card key={toolset} size="sm" className="border-border/50 overflow-hidden">
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 capitalize">
                <div className={`w-2 h-2 rounded-full ${toolsets[toolset] ? "bg-success" : "bg-muted-foreground/30"}`} />
                {toolset.replace("_", " ")}
              </span>
              <Badge
                variant={toolsets[toolset] ? "default" : "outline"}
                className={`text-[10px] ${
                  toolsets[toolset]
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {toolsets[toolset] ? "Enabled" : "Disabled"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 py-2 px-4">
            {groupTools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-surface-muted transition-colors"
              >
                <span className="font-mono text-[11px] truncate mr-2">{tool.name}</span>
                <button
                  onClick={() => toggleTool(tool.name)}
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 shrink-0 ${
                    tool.enabled
                      ? "bg-success/10 text-success hover:bg-success/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {tool.enabled ? <Check size={12} /> : <X size={12} />}
                </button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-8 text-xs rounded-lg"
              onClick={() => toggleToolset(toolset)}
            >
              {toolsets[toolset] ? "Disable" : "Enable"} all in {toolset}
            </Button>
          </CardContent>
        </Card>
      ))}
      {tools.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-12 animate-fade-in">
          <div className="bg-surface-muted p-4 rounded-2xl mb-3 inline-block">
            <Loader2 size={20} className="animate-spin opacity-30" />
          </div>
          <p className="font-medium text-foreground mb-1">Loading tools...</p>
          <p className="text-muted-foreground text-[10px]">Fetching available tools</p>
        </div>
      )}
    </div>
  );
}

function MemoryTab() {
  const { memoryUsage, memoryLimit, userMdUsage, userMdLimit } = useChatStore();
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    fetchEntries();
    fetchUsage();
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/memory");
      if (res.ok) setEntries(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/memory/usage");
      if (res.ok) {
        const data = await res.json();
        useChatStore.setState({
          memoryUsage: data.memory,
          memoryLimit: data.memoryLimit,
          userMdUsage: data.user,
          userMdLimit: data.userLimit,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteEntry = async (id: string) => {
    try {
      await fetch(`/api/memory/${id}`, { method: "DELETE" });
      await fetchEntries();
      await fetchUsage();
    } catch (e) {
      console.error(e);
    }
  };

  const memoryPercent = Math.round((memoryUsage / memoryLimit) * 100);
  const userPercent = Math.round((userMdUsage / userMdLimit) * 100);

  return (
    <div className="space-y-3">
      <Card size="sm" className="border-border/50 overflow-hidden">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain size={14} className="text-primary" />
            Memory Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 py-3 px-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium">MEMORY.md</span>
              <span className={memoryPercent > 80 ? "text-destructive font-medium" : "text-muted-foreground"}>
                {memoryUsage}/{memoryLimit} ({memoryPercent}%)
              </span>
            </div>
            <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  memoryPercent > 80 ? "bg-destructive" : memoryPercent > 60 ? "bg-warning" : "bg-gradient-to-r from-primary to-accent"
                }`}
                style={{ width: `${Math.min(memoryPercent, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium">USER.md</span>
              <span className={userPercent > 80 ? "text-destructive font-medium" : "text-muted-foreground"}>
                {userMdUsage}/{userMdLimit} ({userPercent}%)
              </span>
            </div>
            <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  userPercent > 80 ? "bg-destructive" : userPercent > 60 ? "bg-warning" : "bg-gradient-to-r from-primary to-accent"
                }`}
                style={{ width: `${Math.min(userPercent, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1">
        {entries.map((entry: any) => (
          <div
            key={entry.id}
            className="text-xs border border-border/50 rounded-xl p-3 bg-surface-muted/30 flex justify-between items-start gap-2 hover:bg-surface-muted/50 transition-colors"
          >
            <div className="truncate flex-1">
              <Badge variant="outline" className="text-[10px] mb-1.5 bg-primary/5 text-primary border-primary/20">
                {entry.target ?? "memory"}
              </Badge>
              <div className="font-semibold text-[11px]">{entry.key}:</div>
              <div className="text-muted-foreground truncate text-[10px]">{entry.value}</div>
            </div>
            <Button
              size="icon-xs"
              variant="ghost"
              className="h-6 w-6 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
              onClick={() => deleteEntry(entry.id)}
            >
              <Trash2 size={10} />
            </Button>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-12 animate-fade-in">
            <div className="bg-surface-muted p-4 rounded-2xl mb-3 inline-block">
              <Brain size={20} className="opacity-30" />
            </div>
            <p className="font-medium text-foreground mb-1">No memories yet</p>
            <p className="text-muted-foreground text-[10px]">Memories will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillsTab() {
  const { currentSessionId } = useChatStore();
  const [skills, setSkills] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills-new");
      if (res.ok) setSkills(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const addSkill = async () => {
    try {
      await fetch("/api/skills-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, content }),
      });
      setName(""); setDesc(""); setContent("");
      await fetchSkills();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          placeholder="Skill name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-xs border border-border/50 rounded-xl p-2.5 bg-surface-muted/30 focus:bg-surface focus:border-primary/50 transition-all outline-none"
        />
        <input
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full text-xs border border-border/50 rounded-xl p-2.5 bg-surface-muted/30 focus:bg-surface focus:border-primary/50 transition-all outline-none"
        />
        <textarea
          placeholder="SKILL.md content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full text-xs border border-border/50 rounded-xl p-2.5 font-mono bg-surface-muted/30 focus:bg-surface focus:border-primary/50 transition-all outline-none resize-none"
        />
        <Button size="sm" onClick={addSkill} className="w-full rounded-xl shadow-md shadow-primary/10">
          <Plus size={12} /> Add Skill
        </Button>
      </div>

      <Separator />

      <div className="space-y-1 max-h-60 overflow-auto">
        {skills.map((s: any) => (
          <div key={s.id} className="text-xs border border-border/50 rounded-xl p-3 bg-surface-muted/30 hover:bg-surface-muted/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">{s.name}</span>
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                {s.category ?? "general"}
              </Badge>
            </div>
            <div className="text-muted-foreground truncate text-[10px]">{s.description}</div>
            <div className="text-[9px] text-muted-foreground mt-1.5 flex items-center gap-2">
              <span>v{s.version}</span>
              <span>•</span>
              <span>{s.usageCount ?? 0} uses</span>
            </div>
          </div>
        ))}
        {skills.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-12 animate-fade-in">
            <div className="bg-surface-muted p-4 rounded-2xl mb-3 inline-block">
              <ToolIcon size={20} className="opacity-30" />
            </div>
            <p className="font-medium text-foreground mb-1">No skills yet</p>
            <p className="text-muted-foreground text-[10px]">Create a skill to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SubagentsTab() {
  const { currentSessionId, subagents, setSubagents } = useChatStore();
  const [goal, setGoal] = useState("");

  useEffect(() => {
    fetchSubs();
  }, [currentSessionId]);

  const fetchSubs = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      const res = await fetch(`/api/subagents?parentSessionId=${currentSessionId}`);
      if (res.ok) setSubagents(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [currentSessionId]);

  const spawn = async () => {
    if (!currentSessionId || !goal) return;
    try {
      const { provider, model, apiKey } = useChatStore.getState();
      await fetch("/api/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentSessionId: currentSessionId, goal, provider, model, apiKey }),
      });
      setGoal("");
      await fetchSubs();
    } catch (e) {
      console.error(e);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-warning",
    running: "bg-info",
    completed: "bg-success",
    failed: "bg-destructive",
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          placeholder="Goal for subagent"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          disabled={!currentSessionId}
          className="w-full text-xs border border-border/50 rounded-xl p-2.5 bg-surface-muted/30 focus:bg-surface focus:border-primary/50 transition-all outline-none disabled:opacity-50"
        />
        <Button size="sm" onClick={spawn} disabled={!currentSessionId || !goal} className="w-full rounded-xl shadow-md shadow-primary/10">
          <Plus size={12} /> Spawn Subagent
        </Button>
      </div>

      <Separator />

      <div className="space-y-1 max-h-60 overflow-auto">
        {subagents.map((s: any) => (
          <div key={s.id} className="text-xs border border-border/50 rounded-xl p-3 bg-surface-muted/30 hover:bg-surface-muted/50 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-2 h-2 rounded-full ${statusColors[s.status] ?? "bg-gray-500"} animate-pulse`} />
              <span className="font-semibold truncate text-[11px]">{s.goal}</span>
            </div>
            <div className="text-muted-foreground text-[10px] flex items-center gap-1.5">
              <span className="capitalize">{s.status}</span>
              {s.result && (
                <>
                  <span>•</span>
                  <span className="truncate"> {s.result.slice(0, 40)}...</span>
                </>
              )}
            </div>
          </div>
        ))}
        {subagents.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-12 animate-fade-in">
            <div className="bg-surface-muted p-4 rounded-2xl mb-3 inline-block">
              <Users size={20} className="opacity-30" />
            </div>
            <p className="font-medium text-foreground mb-1">No subagents yet</p>
            <p className="text-muted-foreground text-[10px]">Spawn a subagent to help</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CronTab() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/cron");
      if (res.ok) setJobs(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const addJob = async () => {
    try {
      await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, schedule, prompt }),
      });
      setName(""); setSchedule(""); setPrompt("");
      await fetchJobs();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input placeholder="Job name" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-xs border border-border/50 rounded-xl p-2.5 bg-surface-muted/30 focus:bg-surface focus:border-primary/50 transition-all outline-none" />
        <input placeholder="Cron schedule (e.g. */5 * * * *)" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="w-full text-xs border border-border/50 rounded-xl p-2.5 font-mono bg-surface-muted/30 focus:bg-surface focus:border-primary/50 transition-all outline-none" />
        <textarea
          placeholder="Prompt to execute"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full text-xs border border-border/50 rounded-xl p-2.5 bg-surface-muted/30 focus:bg-surface focus:border-primary/50 transition-all outline-none resize-none"
        />
        <Button size="sm" onClick={addJob} className="w-full rounded-xl shadow-md shadow-primary/10">
          <Plus size={12} /> Add Cron Job
        </Button>
      </div>

      <Separator />

      <div className="space-y-1 max-h-60 overflow-auto">
        {jobs.map((j: any) => (
          <div key={j.id} className="text-xs border border-border/50 rounded-xl p-3 bg-surface-muted/30 hover:bg-surface-muted/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">{j.name}</span>
              <Badge
                variant={j.enabled ? "default" : "outline"}
                className={`text-[10px] ${
                  j.enabled ? "bg-success/10 text-success border-success/20" : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {j.enabled ? "Active" : "Paused"}
              </Badge>
            </div>
            <div className="font-mono text-[10px] text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded inline-block mb-1">{j.schedule}</div>
            <div className="text-muted-foreground truncate text-[10px]">{j.prompt}</div>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-12 animate-fade-in">
            <div className="bg-surface-muted p-4 rounded-2xl mb-3 inline-block">
              <Clock size={20} className="opacity-30" />
            </div>
            <p className="font-medium text-foreground mb-1">No cron jobs yet</p>
            <p className="text-muted-foreground text-[10px]">Schedule automated tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 20 }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          placeholder="Search past conversations..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          className="flex-1 text-xs border border-border/50 rounded-xl p-2.5 bg-surface-muted/30 focus:bg-surface focus:border-primary/50 transition-all outline-none"
        />
        <Button size="sm" onClick={search} disabled={loading || !query.trim()} className="rounded-xl shadow-md shadow-primary/10">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </Button>
      </div>

      <div className="space-y-2 max-h-72 overflow-auto">
        {results.map((r: any, i: number) => (
          <div key={i} className="text-xs border border-border/50 rounded-xl p-3 bg-surface-muted/30 hover:bg-surface-muted/50 transition-colors">
            <div className="font-semibold mb-1 text-[11px]">{r.sessionTitle}</div>
            <div className="text-muted-foreground line-clamp-3 text-[10px]">{r.messageContent}</div>
            <div className="text-[9px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
              <span className="capitalize">{r.messageRole}</span>
              <ChevronRight size={8} />
              <span>{new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {results.length === 0 && query && !loading && (
          <div className="text-xs text-muted-foreground text-center py-12 animate-fade-in">
            <div className="bg-surface-muted p-4 rounded-2xl mb-3 inline-block">
              <Search size={20} className="opacity-30" />
            </div>
            <p className="font-medium text-foreground mb-1">No results found</p>
            <p className="text-muted-foreground text-[10px]">Try different keywords</p>
          </div>
        )}
        {!query && (
          <div className="text-xs text-muted-foreground text-center py-12 animate-fade-in">
            <div className="bg-surface-muted p-4 rounded-2xl mb-3 inline-block">
              <Search size={20} className="opacity-30" />
            </div>
            <p className="font-medium text-foreground mb-1">Search conversations</p>
            <p className="text-muted-foreground text-[10px]">Find past messages and sessions</p>
          </div>
        )}
      </div>
    </div>
  );
}
