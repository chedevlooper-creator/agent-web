"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ToolInvocation } from "@/lib/store";

export function ToolCallBubble({ invocation }: { invocation: ToolInvocation }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = invocation.state === "pending" || invocation.state === "running";
  const status = isPending ? "running" : "ok";

  const argsPreview = useMemo(() => {
    const entries = Object.entries(invocation.args);
    if (entries.length === 0) return "";
    const first = entries[0];
    const val =
      typeof first[1] === "string" ? first[1] : JSON.stringify(first[1]);
    return val.length > 60 ? val.slice(0, 57) + "…" : val;
  }, [invocation.args]);

  const glyphMap: Record<string, string> = {
    terminal: "❯",
    read_file: "◧",
    write_file: "◨",
    search_files: "⌕",
    web_search: "◯",
    git: "⌥",
    db_query: "▤",
    execute_code: "⌘",
    knowledge_search: "◉",
    api_test: "↗",
    list_directory: "▤",
  };

  const glyph = glyphMap[invocation.toolName] || "▤";

  return (
    <div
      className={cn(
        "wk-tool-block",
        status === "running" && "wk-tool-block--running",
        status === "ok" && "wk-tool-block--ok"
      )}
    >
      <button
        className="wk-tool-block-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="wk-tool-block-glyph">{glyph}</span>
        <span className="wk-tool-block-name">{invocation.toolName}</span>
        <span className="wk-tool-block-args">{argsPreview}</span>
        <span className="wk-tool-block-spacer" />
        {status === "running" && <span className="wk-spinner" />}
        {status === "ok" && <span className="wk-tool-block-tick">✓</span>}
        <span
          className={cn(
            "wk-tool-block-caret",
            expanded && "is-open"
          )}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="wk-tool-block-body">
          {Object.keys(invocation.args).length > 0 && (
            <pre className="wk-tool-block-output">
              {JSON.stringify(invocation.args, null, 2)}
            </pre>
          )}
          {invocation.result != null && (
            <pre className="wk-tool-block-output">{invocation.result}</pre>
          )}
        </div>
      )}
    </div>
  );
}
