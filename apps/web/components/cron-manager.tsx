"use client";

import { useState, useEffect, useCallback } from "react";
import { useChatStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Pause, Play, Trash2, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";

export function CronManager() {
  const { cronJobs, setCronJobs } = useChatStore();
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("*/30 * * * *");
  const [prompt, setPrompt] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/cron");
      if (res.ok) setCronJobs(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [setCronJobs]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const createJob = async () => {
    if (!name.trim() || !schedule.trim() || !prompt.trim()) return;
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, schedule, prompt }),
      });
      if (!res.ok) throw new Error("Failed");
      setName(""); setSchedule("*/30 * * * *"); setPrompt("");
      await fetchJobs();
      toast.success("Cron job created");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const toggleJob = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/cron/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await fetchJobs();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const deleteJob = async (id: string) => {
    try {
      await fetch(`/api/cron/${id}`, { method: "DELETE" });
      await fetchJobs();
      toast.success("Job deleted");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return "Not scheduled";
    const date = new Date(nextRun);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return "Overdue";
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    return `in ${Math.round(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Input placeholder="Job name" value={name} onChange={(e) => setName(e.target.value)} className="text-xs" />
        <Input placeholder="Cron schedule (e.g. */30 * * * *)" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="text-xs font-mono" />
        <Textarea placeholder="Prompt for agent to run..." value={prompt} onChange={(e) => setPrompt(e.target.value)} className="text-xs" rows={3} />
        <Button size="sm" onClick={createJob} className="w-full">
          <Plus size={12} className="mr-1" /> Create Job
        </Button>
      </div>

      <Separator />

      <ScrollArea className="max-h-64">
        <div className="space-y-1">
          {cronJobs.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">No cron jobs</div>
          ) : (
            cronJobs.map((job) => (
              <div key={job.id} className="border rounded-lg bg-muted/20 overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-muted/40 transition-colors"
                >
                  {expandedId === job.id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  <Clock size={12} className="text-muted-foreground" />
                  <span className="flex-1 text-left truncate font-medium">{job.name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground">{formatNextRun(job.nextRun)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleJob(job.id, !job.enabled); }}
                    className="h-5 w-5 p-0"
                    title={job.enabled ? "Pause" : "Resume"}
                  >
                    {job.enabled ? <Pause size={10} /> : <Play size={10} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                    className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 size={10} />
                  </button>
                </button>

                {expandedId === job.id && (
                  <div className="px-2.5 pb-2.5 space-y-1.5 text-[11px]">
                    <div><span className="font-semibold">Schedule:</span> <code className="font-mono">{job.schedule}</code></div>
                    <div><span className="font-semibold">Prompt:</span> {job.prompt}</div>
                    {job.result && (
                      <div className="bg-muted/50 rounded p-1.5">
                        <span className="font-semibold">Last result:</span> {job.result}
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
