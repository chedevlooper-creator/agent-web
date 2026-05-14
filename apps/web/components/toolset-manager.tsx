"use client";

import { useState, useEffect, useCallback } from "react";
import { useChatStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { toast } from "sonner";

const TOOLSET_GROUPS: Record<string, string[]> = {
  web: ["web_search", "web_fetch"],
  terminal: ["execute_command"],
  file: ["read_file", "write_file", "edit_file", "list_directory", "search_files"],
  browser: ["browser_navigate", "browser_snapshot", "browser_click", "browser_fill", "browser_vision"],
  vision: ["vision_analyze", "image_generate"],
  code: ["execute_code"],
  memory: ["memory_add", "memory_replace", "memory_remove", "session_search"],
  delegate: ["delegate_task", "clarify"],
  todo: ["todo_write", "todo_read"],
};

export function ToolsetManager() {
  const { tools, toolsets, setTools, setToolsets } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});

  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tools");
      if (res.ok) {
        const data = await res.json();
        if (data.tools) setTools(data.tools);
        if (data.toolsets) setToolsets(data.toolsets);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setTools, setToolsets]);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  const toggleToolset = async (toolsetName: string, enabled: boolean) => {
    try {
      await fetch("/api/tools", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolset: toolsetName, enabled }),
      });
      await fetchTools();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const toggleTool = async (toolName: string, enabled: boolean) => {
    try {
      await fetch("/api/tools", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: toolName, enabled }),
      });
      await fetchTools();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-3">
      <ScrollArea className="max-h-80">
        <div className="space-y-1">
          {loading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
          ) : Object.keys(TOOLSET_GROUPS).length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">No tools available</div>
          ) : (
            Object.entries(TOOLSET_GROUPS).map(([toolsetName, toolNames]) => {
              const isExpanded = expandedSets[toolsetName];
              const getTool = (name: string) => tools.find((t) => t.name === name);
              const isToolsetEnabled = toolNames.some((t) => getTool(t)?.enabled !== false);

              return (
                <div key={toolsetName} className="border rounded-lg bg-muted/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <button
                      onClick={() => setExpandedSets((p) => ({ ...p, [toolsetName]: !isExpanded }))}
                      className="shrink-0"
                    >
                      {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                    <Wrench size={12} className="text-muted-foreground" />
                    <span className="text-xs font-medium flex-1 capitalize">{toolsetName}</span>
                    <button
                      onClick={() => toggleToolset(toolsetName, !isToolsetEnabled)}
                      className={`w-8 h-4 rounded-full transition-colors relative ${isToolsetEnabled ? "bg-primary" : "bg-muted"}`}
                    >
                      <div className={`w-3 h-3 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${isToolsetEnabled ? "left-4.5" : "left-0.5"}`} />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-2 space-y-1 border-t bg-muted/10">
                      {toolNames.map((toolName) => {
                        const toolStatus = tools.find((t) => t.name === toolName);
                        const isEnabled = toolStatus?.enabled !== false;
                        return (
                          <div key={toolName} className="flex items-center justify-between py-1">
                            <span className="text-[11px] font-mono truncate flex-1">{toolName}</span>
                            <button
                              onClick={() => toggleTool(toolName, !isEnabled)}
                              className={`w-7 h-3.5 rounded-full transition-colors relative ml-2 ${isEnabled ? "bg-primary/60" : "bg-muted"}`}
                            >
                              <div className={`w-2.5 h-2.5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${isEnabled ? "left-4" : "left-0.5"}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
