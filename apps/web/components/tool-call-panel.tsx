"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Wrench } from "lucide-react";

interface ToolCallEntry {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "running" | "success" | "error";
  duration?: number;
}

export function ToolCallPanel({ toolCalls }: { toolCalls: ToolCallEntry[] }) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      {toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallEntry }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    toolCall.status === "running" ? (
      <Loader2 size={14} className="animate-spin text-blue-500" />
    ) : toolCall.status === "success" ? (
      <CheckCircle2 size={14} className="text-emerald-500" />
    ) : (
      <XCircle size={14} className="text-red-500" />
    );

  const borderColor =
    toolCall.status === "running"
      ? "border-l-blue-500"
      : toolCall.status === "success"
        ? "border-l-emerald-500"
        : "border-l-red-500";

  return (
    <div className={`border border-border/50 rounded-lg border-l-4 ${borderColor} bg-muted/20`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/40 transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {statusIcon}
        <Wrench size={12} className="text-muted-foreground" />
        <span className="font-mono font-medium">{toolCall.name}</span>
        {toolCall.duration !== undefined && (
          <span className="text-[10px] text-muted-foreground ml-auto">{toolCall.duration}ms</span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Arguments</div>
            <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-auto max-h-32">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Result</div>
              <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-auto max-h-48">
                {typeof toolCall.result === "string" ? toolCall.result : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
