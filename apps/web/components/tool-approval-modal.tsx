"use client";

import { useState } from "react";
import { AlertTriangle, XCircle, CheckCircle2, ShieldAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface PendingApproval {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  isDangerous: boolean;
  reason?: string;
}

interface ToolApprovalModalProps {
  pendingApproval: PendingApproval | null;
  onApprove: (id: string, approved: boolean) => void;
  onClose: () => void;
}

export function ToolApprovalModal({ pendingApproval, onApprove, onClose }: ToolApprovalModalProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!pendingApproval) return null;

  const handleBlock = () => {
    onApprove(pendingApproval.id, false);
    onClose();
  };

  const handleApprove = () => {
    onApprove(pendingApproval.id, true);
    onClose();
  };

  const handleReject = () => {
    onApprove(pendingApproval.id, false);
    onClose();
  };

  const dangerousCheck = pendingApproval.isDangerous
    ? { detected: true, reason: pendingApproval.reason }
    : checkCommandApproval(
        typeof pendingApproval.args.command === "string"
          ? pendingApproval.args.command
          : typeof pendingApproval.args.code === "string"
            ? pendingApproval.args.code
            : ""
      );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <Card className="relative w-full max-w-md mx-4 shadow-2xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <ShieldAlert size={24} className="text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold">Tool Execution Approval</h3>
              <p className="text-xs text-muted-foreground">A tool requires your confirmation</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {pendingApproval.toolName}
              </Badge>
              {dangerousCheck.detected && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Dangerous
                </Badge>
              )}
            </div>

            {dangerousCheck.reason && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-amber-600 dark:text-amber-400 text-sm">Security Warning</div>
                    <div className="text-amber-600/80 dark:text-amber-400/80 text-xs mt-1">
                      {dangerousCheck.reason}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Clock size={12} />
                {showDetails ? "Hide" : "Show"} Arguments
              </button>

              {showDetails && (
                <pre className="mt-2 text-xs font-mono bg-muted rounded-lg p-3 overflow-auto max-h-48">
                  {JSON.stringify(pendingApproval.args, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <Button variant="outline" size="sm" onClick={handleBlock} className="flex items-center gap-1 text-xs">
              <XCircle size={12} />
              Block
            </Button>
            <div className="flex-1" />
            <Button variant="destructive" size="sm" onClick={handleReject} className="flex items-center gap-1">
              <XCircle size={14} />
              Reject
            </Button>
            <Button size="sm" onClick={handleApprove} className="flex items-center gap-1">
              <CheckCircle2 size={14} />
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function checkCommandApproval(command: string): { detected: boolean; reason?: string } {
  const dangerPatterns = [
    { pattern: /rm\s+-rf/i, reason: "Recursive delete command" },
    { pattern: /format\s+/i, reason: "Disk format command" },
    { pattern: /del\s+\/q\s+\/s/i, reason: "Windows recursive delete" },
    { pattern: /git\s+reset\s+--hard/i, reason: "Git reset can lose uncommitted changes" },
    { pattern: /git\s+push\s+--force/i, reason: "Force push can overwrite remote history" },
    { pattern: /curl\s+.*\s*\|/i, reason: "Pipe to shell can execute arbitrary code" },
    { pattern: /wget\s+.*\s*\|/i, reason: "Pipe to shell can execute arbitrary code" },
    { pattern: /eval\s*\(/i, reason: "Dynamic code execution" },
  ];

  for (const { pattern, reason } of dangerPatterns) {
    if (pattern.test(command)) {
      return { detected: true, reason };
    }
  }

  return { detected: false };
}

export function checkToolDangerous(toolName: string, args: Record<string, unknown>): { detected: boolean; reason?: string } {
  if (toolName === "terminal" || toolName === "execute_code") {
    const command =
      typeof args.command === "string"
        ? args.command
        : typeof args.code === "string"
          ? args.code
          : "";

    return checkCommandApproval(command);
  }

  if (toolName === "write_file" || toolName === "edit_file") {
    if (typeof args.path === "string") {
      const dangerousPaths = [/system32/i, /etc\/passwd/i, /\.ssh\//i, /\/root\//i];

      for (const pattern of dangerousPaths) {
        if (pattern.test(args.path)) {
          return { detected: true, reason: `Writing to sensitive path: ${args.path}` };
        }
      }
    }
  }

  return { detected: false };
}
