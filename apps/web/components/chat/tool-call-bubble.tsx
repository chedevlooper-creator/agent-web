"use client";

import { useState, useMemo } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToolIcon } from "@/lib/tool-icons";
import type { ToolInvocation } from "@/lib/store";

export function ToolCallBubble({ invocation }: { invocation: ToolInvocation }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(invocation.toolName);
  const isPending = invocation.state === "pending";

  const argsPreview = useMemo(() => {
    const entries = Object.entries(invocation.args);
    if (entries.length === 0) return "";
    const first = entries[0];
    const val = typeof first[1] === "string" ? first[1] : JSON.stringify(first[1]);
    return val.length > 60 ? val.slice(0, 57) + "…" : val;
  }, [invocation.args]);

  return (
    <div className={cn(
      "my-1 rounded-xl overflow-hidden text-xs transition-all duration-200 border-l-[3px]",
      isPending
        ? "border-l-warning bg-warning/5 border border-warning/15"
        : "border-l-success bg-success/5 border border-success/15"
    )}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={cn(
          "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
          isPending
            ? "bg-warning/12 text-warning"
            : "bg-success/12 text-success"
        )}>
          {isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Icon size={12} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-foreground">
            {invocation.toolName.replace(/_/g, " ")}
          </span>
          {argsPreview ? (
            <span className="ml-1.5 text-muted-foreground truncate">
              {argsPreview}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPending ? (
            <span className="text-[10px] text-warning font-semibold">Running…</span>
          ) : (
            <span className="text-[10px] text-success font-semibold">Done</span>
          )}
          {expanded ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-muted/50 animate-slide-up">
          {Object.keys(invocation.args).length > 0 && (
            <div className="px-3 py-2 border-b border-border-muted/50">
              <p className="section-label mb-1">Arguments</p>
              <pre className="text-[11px] text-foreground bg-muted/50 rounded-lg px-2.5 py-1.5 overflow-x-auto max-h-40 whitespace-pre-wrap break-all border border-border-muted">
                {JSON.stringify(invocation.args, null, 2)}
              </pre>
            </div>
          )}
          {invocation.result != null && (
            <div className="px-3 py-2">
              <p className="section-label mb-1">Result</p>
              <pre className="text-[11px] text-foreground bg-muted/50 rounded-lg px-2.5 py-1.5 overflow-x-auto max-h-60 whitespace-pre-wrap break-all border border-border-muted">
                {invocation.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
