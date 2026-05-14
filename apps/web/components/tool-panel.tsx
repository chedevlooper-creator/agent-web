"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Wrench, Clock, Copy, Check, Terminal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ToolCallEntry {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "running" | "success" | "error";
  duration?: number;
  startTime?: number;
}

interface ToolPanelProps {
  toolCalls: ToolCallEntry[];
  onExpandChange?: (expanded: boolean) => void;
}

export function ToolPanel({ toolCalls, onExpandChange }: ToolPanelProps) {
  const [allExpanded, setAllExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const toggleAll = () => {
    const newState = !allExpanded;
    setAllExpanded(newState);
    onExpandChange?.(newState);
  };

  const completedCount = toolCalls.filter(t => t.status === "success").length;
  const runningCount = toolCalls.filter(t => t.status === "running").length;

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-1.5 rounded-lg">
            <Terminal size={12} className="text-primary" />
          </div>
          <span className="text-xs font-medium">{toolCalls.length} tool{toolCalls.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={10} className="text-success" />
              {completedCount}
            </span>
            {runningCount > 0 && (
              <span className="flex items-center gap-1">
                <Loader2 size={10} className="text-info animate-spin" />
                {runningCount}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAll}
          className="h-6 px-2 text-[10px] rounded-lg hover:bg-surface-muted transition-all"
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </Button>
      </div>

      <div className="space-y-1.5">
        {toolCalls.map((toolCall) => (
          <ToolCallCard key={toolCall.id} toolCall={toolCall} expanded={allExpanded} />
        ))}
      </div>
    </div>
  );
}

interface ToolCallCardProps {
  toolCall: ToolCallEntry;
  expanded?: boolean;
}

function ToolCallCard({ toolCall, expanded = false }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const text = toolCall.result ?? JSON.stringify(toolCall.args, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusIcon = getStatusIcon(toolCall.status);
  const borderColor = getStatusBorderColor(toolCall.status);
  const statusBadgeClass = getStatusBadgeColor(toolCall.status);

  const formatDuration = (ms?: number) => {
    if (ms === undefined) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div
      className={`border border-l-2 rounded-xl overflow-hidden transition-all duration-200 ${borderColor} ${
        isExpanded ? "bg-surface shadow-sm" : "bg-surface/50 hover:bg-surface"
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-surface-muted/50 transition-colors"
      >
        <div className="transition-transform duration-200">
          {isExpanded ? (
            <ChevronDown size={12} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={12} className="text-muted-foreground" />
          )}
        </div>
        <div className="shrink-0">{statusIcon}</div>
        <span className="font-mono font-medium text-[11px] truncate flex-1">{toolCall.name}</span>
        <Badge
          variant="outline"
          className={`text-[9px] px-1.5 py-0 h-4 rounded-md shrink-0 ${statusBadgeClass}`}
        >
          {toolCall.status}
        </Badge>
        {toolCall.duration !== undefined && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
            <Clock size={10} />
            {formatDuration(toolCall.duration)}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 animate-fade-in">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Arguments
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyToClipboard}
                className="h-5 w-5 rounded-md hover:bg-surface-muted"
              >
                {copied ? (
                  <Check size={10} className="text-success" />
                ) : (
                  <Copy size={10} className="text-muted-foreground" />
                )}
              </Button>
            </div>
            <pre className="text-[11px] font-mono bg-surface-muted/50 rounded-lg p-2.5 overflow-auto max-h-40 border border-border/30">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {toolCall.result !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Result
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="h-5 w-5 rounded-md hover:bg-surface-muted"
                >
                  {copied ? (
                    <Check size={10} className="text-success" />
                  ) : (
                    <Copy size={10} className="text-muted-foreground" />
                  )}
                </Button>
              </div>
              <pre className="text-[11px] font-mono bg-surface-muted/50 rounded-lg p-2.5 overflow-auto max-h-48 border border-border/30">
                {typeof toolCall.result === "string"
                  ? toolCall.result.length > 5000
                    ? toolCall.result.slice(0, 5000) + "\n... (truncated)"
                    : toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}

          {toolCall.status === "error" && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-2.5 text-[11px] text-destructive flex items-center gap-2">
              <XCircle size={14} />
              <span>Error occurred during tool execution</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusIcon(status: ToolCallEntry["status"]) {
  switch (status) {
    case "pending":
      return <Clock size={14} className="text-warning" />;
    case "running":
      return <Loader2 size={14} className="text-info animate-spin" />;
    case "success":
      return <CheckCircle2 size={14} className="text-success" />;
    case "error":
      return <XCircle size={14} className="text-destructive" />;
  }
}

function getStatusBorderColor(status: ToolCallEntry["status"]) {
  switch (status) {
    case "pending":
      return "border-l-warning";
    case "running":
      return "border-l-info";
    case "success":
      return "border-l-success";
    case "error":
      return "border-l-destructive";
  }
}

function getStatusBadgeColor(status: ToolCallEntry["status"]) {
  switch (status) {
    case "pending":
      return "border-warning/30 text-warning bg-warning/5";
    case "running":
      return "border-info/30 text-info bg-info/5";
    case "success":
      return "border-success/30 text-success bg-success/5";
    case "error":
      return "border-destructive/30 text-destructive bg-destructive/5";
  }
}
