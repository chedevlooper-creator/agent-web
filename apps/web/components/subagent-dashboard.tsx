"use client";

import { useState, useEffect, useCallback } from "react";
import { useChatStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, ChevronDown, ChevronRight, Eye, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export function SubagentDashboard() {
  const { currentSessionId, subagents, setSubagents } = useChatStore();
  const [goal, setGoal] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [maxSteps, setMaxSteps] = useState(25);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [agentMessages, setAgentMessages] = useState<Record<string, any[]>>({});

  const fetchSubagents = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      const res = await fetch(`/api/subagents?parentSessionId=${currentSessionId}`);
      if (res.ok) setSubagents(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [currentSessionId, setSubagents]);

  useEffect(() => { fetchSubagents(); }, [fetchSubagents]);

  // Poll running agents
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSubagents();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchSubagents]);

  const spawnAgent = async () => {
    if (!currentSessionId || !goal.trim()) return;
    try {
      const { provider, apiKey } = useChatStore.getState();
      const res = await fetch("/api/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentSessionId: currentSessionId, goal, provider, model, apiKey, maxSteps }),
      });
      if (!res.ok) throw new Error("Failed to spawn");
      setGoal("");
      await fetchSubagents();
      toast.success("Subagent spawned");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const fetchAgentMessages = async (agentId: string) => {
    try {
      const res = await fetch(`/api/subagents/${agentId}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        setAgentMessages((prev) => ({ ...prev, [agentId]: msgs }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "running": return <Loader2 size={12} className="animate-spin text-blue-500" />;
      case "completed": return <CheckCircle2 size={12} className="text-emerald-500" />;
      case "failed": return <XCircle size={12} className="text-red-500" />;
      default: return <Clock size={12} className="text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-gray-500/20 text-gray-400",
      running: "bg-blue-500/20 text-blue-400",
      completed: "bg-emerald-500/20 text-emerald-400",
      failed: "bg-red-500/20 text-red-400",
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${colors[status] ?? colors.pending}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {!currentSessionId && (
        <div className="text-xs text-muted-foreground text-center py-2">Select a session to spawn subagents.</div>
      )}

      <Input placeholder="Goal for subagent" value={goal} onChange={(e) => setGoal(e.target.value)} disabled={!currentSessionId} className="text-xs" />
      <div className="flex gap-2">
        <Input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} className="text-xs" />
        <Input type="number" value={maxSteps} onChange={(e) => setMaxSteps(parseInt(e.target.value))} className="text-xs" placeholder="Max steps" />
      </div>
      <Button size="sm" onClick={spawnAgent} disabled={!currentSessionId} className="w-full">
        <Plus size={12} className="mr-1" /> Spawn Subagent
      </Button>

      <Separator />

      <ScrollArea className="max-h-64">
        <div className="space-y-1">
          {subagents.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">No subagents</div>
          ) : (
            subagents.map((agent) => (
              <div key={agent.id} className="border rounded-lg bg-muted/20 overflow-hidden">
                <button
                  onClick={() => {
                    const isExpanding = expandedId !== agent.id;
                    setExpandedId(isExpanding ? agent.id : null);
                    if (isExpanding) fetchAgentMessages(agent.id);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-muted/40 transition-colors"
                >
                  {statusIcon(agent.status)}
                  {expandedId === agent.id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  <span className="flex-1 text-left truncate font-medium">{agent.goal}</span>
                  {statusBadge(agent.status)}
                </button>

                {expandedId === agent.id && (
                  <div className="px-2.5 pb-2.5 space-y-2">
                    {agentMessages[agent.id]?.map((msg, i) => (
                      <div key={i} className={`text-[11px] p-1.5 rounded ${msg.role === "user" ? "bg-muted/50" : msg.role === "assistant" ? "bg-primary/5" : "bg-muted/30"}`}>
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase">{msg.role}</span>
                        <div className="mt-0.5">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    )) ?? (
                      <div className="text-[11px] text-muted-foreground">No messages yet...</div>
                    )}
                    {agent.result && (
                      <div className="text-[11px] bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
                        <span className="font-semibold">Result:</span> {agent.result}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
