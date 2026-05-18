"use client";

import {
  useChatStore,
  useActiveMessages,
  genId,
  type ChatMessage,
  type ToolCallInfo,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Send,
  Bot,
  User,
  ArrowDown,
  Loader2,
  RefreshCw,
  Pencil,
  Check,
  X,
  Copy,
  GitCompare,
  GitBranch,
  Sparkles,
  Terminal,
  FileText,
  Globe,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Table2,
  Code2,
  FileJson,
  CornerDownLeft,
  Lightbulb,
  Target,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { TtsButton } from "@/components/tts-button";
import { SttButton } from "@/components/stt-button";
import { BranchIndicator } from "@/components/chat/branch-indicator";
import { MessageActions } from "@/components/message-actions";
import { ThreadIndicator } from "@/components/thread-indicator";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// ---- File preview types ----
interface FilePreview {
  type: "excel" | "csv" | "json" | "text" | "unsupported";
  filename: string;
  rows?: number;
  headers?: string[];
  data?: Record<string, unknown>[];
  content?: string;
  error?: string;
}

const PREVIEWABLE_EXTS = new Set([
  "xlsx",
  "xls",
  "numbers",
  "csv",
  "tsv",
  "json",
  "txt",
  "md",
  "log",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "env",
  "xml",
  "html",
  "css",
  "js",
  "ts",
  "py",
  "sh",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
]);

function isPreviewable(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? PREVIEWABLE_EXTS.has(ext) : false;
}


const STARTER_PROMPTS = [
  {
    key: "migration",
    label: "migration",
    prompt: "Drizzle şemasındaki messages tablosuna nullable bir tags (JSON array) kolonu ekle. V7 idempotent migration olsun. Sonra vitest dosyası yaz.",
    desc: "Drizzle şemasına tags kolonu ekle",
  },
  {
    key: "audit",
    label: "audit",
    prompt: "Bu repodaki tüm useEffect hooks'larını tarayıp dependency array eksik olanları listele.",
    desc: "useEffect dependency eksiklerini bul",
  },
  {
    key: "mcp",
    label: "mcp",
    prompt: "MCP filesystem server'ı kurup tool'ları listele.",
    desc: "filesystem MCP'yi kur ve test et",
  },
  {
    key: "scaffold",
    label: "scaffold",
    prompt: "packages/core'da yeni bir image_generate tool'u taslağı oluştur.",
    desc: "Yeni bir agent tool'u iskelesi",
  },
] as const;

function TooltipIconButton({
  label,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button {...props} />}>
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Persist a single message directly via API (used when we want to insert
// a streaming assistant result after stream completion).
async function persistMessage(
  sessionId: string,
  msg: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    model?: string;
    timestamp: number;
  },
) {
  try {
    useChatStore.getState().setSyncing(true);
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
  } catch (e) {
    console.error("persistMessage failed:", e);
  } finally {
    useChatStore.getState().setSyncing(false);
  }
}

async function updateMessageRemote(
  sessionId: string,
  id: string,
  content: string,
) {
  try {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content }),
    });
  } catch (e) {
    console.error("updateMessageRemote failed:", e);
  }
}

// ===== File Preview Card =====
function FilePreviewCard({
  preview,
  onClose,
}: {
  preview: FilePreview;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (preview.error) {
    return (
      <div className="border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-3 text-sm text-[var(--destructive)] animate-slide-up">
        <p className="text-xs">{preview.error}</p>
        <button onClick={onClose} className="mt-1 text-[11px] hover:underline">
          Dismiss
        </button>
      </div>
    );
  }

  if (preview.type === "unsupported") return null;

  const iconClass = "shrink-0";
  let icon: React.ReactNode;
  let iconColor: string;
  if (preview.type === "excel" || preview.type === "csv") {
    icon = <Table2 size={14} className={iconClass} />;
    iconColor = "text-[var(--success)]";
  } else if (preview.type === "json") {
    icon = <FileJson size={14} className={iconClass} />;
    iconColor = "text-[var(--accent)]";
  } else {
    icon = <Code2 size={14} className={iconClass} />;
    iconColor = "text-[var(--primary)]";
  }

  const displayName = preview.filename.split(/[/\\]/).pop() || preview.filename;

  return (
    <div className="border border-[var(--border-strong)] glass-strong overflow-hidden animate-slide-up shadow-lg">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--muted)]/50 transition-colors"
      >
        <span className={iconColor}>{icon}</span>
        <span className="text-xs font-medium truncate flex-1 text-left">
          {displayName}
        </span>
        {preview.rows !== undefined && (
          <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 font-mono">
            {preview.rows.toLocaleString()} rows
          </span>
        )}
        {expanded ? (
          <ChevronDown
            size={12}
            className="text-[var(--muted-foreground)] shrink-0"
          />
        ) : (
          <ChevronRight
            size={12}
            className="text-[var(--muted-foreground)] shrink-0"
          />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-[var(--border)] max-h-[300px] overflow-auto">
          {(preview.type === "excel" || preview.type === "csv") &&
          preview.headers &&
          preview.data ? (
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-[var(--muted)]/80 backdrop-blur-sm">
                <tr>
                  {preview.headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-semibold border-b border-[var(--border-strong)] whitespace-nowrap text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-[var(--muted)]/30 transition-colors"
                  >
                    {preview.headers!.map((h) => (
                      <td
                        key={h}
                        className="px-3 py-1.5 border-b border-[var(--border)]/50 max-w-[200px] truncate"
                        title={String(row[h] ?? "")}
                      >
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (preview.type === "json" || preview.type === "text") &&
            preview.content ? (
            <SyntaxHighlighter
              language={preview.type === "json" ? "json" : "text"}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: "0.6875rem",
                maxHeight: 300,
              }}
            >
              {preview.content}
            </SyntaxHighlighter>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ===== Typing Indicator (Workshop) =====
function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="wk-block wk-block--running" role="status">
      <div className="wk-block-margin">
        <span className="wk-spinner" />
      </div>
      <div className="wk-block-body">
        <span className="wk-running-label">
          {label ?? "agent çalışıyor"}
        </span>
      </div>
    </div>
  );
}

// ===== Assistant Content Renderer =====
function AssistantContent({ content }: { content: string }) {
  return (
    <div className="chat-prose">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !className?.includes("language-");
            return !isInline && match ? (
              <SyntaxHighlighter
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                style={vscDarkPlus as any}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: "0.5rem 0",
                  borderRadius: "0.5rem",
                  fontSize: "0.8125rem",
                }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs"
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="w-full border-collapse text-sm">
                  {children}
                </table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th
                className="border border-[var(--border)] px-3 py-2 text-left font-medium bg-[var(--muted)]"
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td
                className="border border-[var(--border)] px-3 py-2"
                {...props}
              >
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ===== Tool Call Card (Workshop) =====
function ToolCallCard({ tc }: { tc: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = tc.result !== undefined;
  const status = !isDone ? "running" : "ok";

  const glyphMap: Record<string, string> = {
    terminal: "❯", read_file: "◧", write_file: "◨",
    search_files: "⌕", web_search: "◯", git: "⌥", db_query: "▤",
    execute_code: "⌘", knowledge_search: "◉", api_test: "↗",
    list_directory: "▤",
  };
  const glyph = glyphMap[tc.name] || "▤";

  let argsPreview = "";
  try {
    const parsed = JSON.parse(tc.args);
    const vals = Object.values(parsed);
    if (vals.length > 0) {
      const first = typeof vals[0] === "string" ? vals[0] as string : JSON.stringify(vals[0]);
      argsPreview = first.length > 60 ? first.slice(0, 57) + "…" : first;
    }
  } catch { argsPreview = tc.args.slice(0, 60); }

  return (
    <div className={cn("wk-tool-block", status === "running" && "wk-tool-block--running", status === "ok" && "wk-tool-block--ok")}>
      <button
        className="wk-tool-block-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="wk-tool-block-glyph">{glyph}</span>
        <span className="wk-tool-block-name">{tc.name}</span>
        <span className="wk-tool-block-args">{argsPreview}</span>
        <span className="wk-tool-block-spacer" />
        {status === "running" && <span className="wk-spinner" />}
        {status === "ok" && <span className="wk-tool-block-tick">✓</span>}
        <span className={cn("wk-tool-block-caret", expanded && "is-open")}>▾</span>
      </button>
      {expanded && (
        <div className="wk-tool-block-body">
          {tc.args && tc.args !== "{}" && (
            <pre className="wk-tool-block-output">{JSON.stringify(JSON.parse(tc.args), null, 2)}</pre>
          )}
          {tc.result && (
            <pre className="wk-tool-block-output">{tc.result}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Message Bubble (Workshop) =====
function MessageBubble({
  message,
  index,
  onRetry,
  onEdit,
  onBranch,
  onMessageAction,
}: {
  message: ChatMessage;
  index: number;
  onRetry?: () => void;
  onEdit?: (newContent: string) => void;
  onBranch?: (messageId: string) => void;
  onMessageAction?: (type: string, content: string) => void;
}) {
  const isUser = message.role === "user";
  const isError = !isUser && message.content.startsWith("Error:");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const autoSize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 320) + "px";
  };

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
      autoSize(editRef.current);
    }
  }, [editing]);

  const handleSaveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      setDraft(message.content);
      return;
    }
    onEdit?.(trimmed);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setDraft(message.content);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const time = new Date(message.timestamp).toTimeString().slice(0, 5);

  if (isUser) {
    return (
      <div
        className="wk-block wk-block--user animate-block-in group/message"
        style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="wk-block-margin">
          <span className="wk-block-marker wk-block-marker--user">❯</span>
        </div>
        <div className="wk-block-body">
          {editing ? (
            <div className="flex flex-col gap-3">
              <textarea
                ref={editRef}
                value={draft}
                onChange={(e) => { setDraft(e.target.value); autoSize(e.target); }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { e.preventDefault(); handleCancelEdit(); }
                  else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSaveEdit(); }
                }}
                className="min-h-20 max-h-[320px] w-full resize-none border border-[var(--rule)] bg-transparent font-mono text-sm text-[var(--ink)] px-3 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
              />
              <div className="flex items-center justify-end gap-2">
                <button onClick={handleCancelEdit} className="wk-starter">İptal</button>
                <button onClick={handleSaveEdit} className="wk-send is-ready">Kaydet</button>
              </div>
            </div>
          ) : (
            <>
              <div className="wk-user-block-head">
                <span className="wk-user-tag">sen</span>
                <span className="wk-user-time">{time}</span>
              </div>
              <p className="wk-user-text">{message.content}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="wk-block wk-block--assistant animate-block-in group/message"
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="wk-block-margin">
        <span className="wk-block-marker">
          {message.toolCalls && message.toolCalls.length > 0 ? "▸" : "▸"}
        </span>
        {message.model && (
          <span className="wk-block-label">{message.model}</span>
        )}
      </div>
      <div className="wk-block-body">
        {message.parentId && <ThreadIndicator parentMessage={{ id: message.parentId, content: message.content, role: message.role }} />}

        {editing ? (
          <div className="flex flex-col gap-3">
            <textarea
              ref={editRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); autoSize(e.target); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.preventDefault(); handleCancelEdit(); }
                else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSaveEdit(); }
              }}
              className="min-h-20 max-h-[320px] w-full resize-none border border-[var(--rule)] bg-transparent font-mono text-sm text-[var(--ink)] px-3 py-2 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={handleCancelEdit} className="wk-starter">İptal</button>
              <button onClick={handleSaveEdit} className="wk-send is-ready">Kaydet</button>
            </div>
          </div>
        ) : isError ? (
          <div className="space-y-2">
            <p className="wk-text-line" style={{ color: 'var(--danger)' }}>{message.content}</p>
            {onRetry && (
              <button onClick={onRetry} className="signal-button">
                <RefreshCw size={11} /> Tekrar dene
              </button>
            )}
          </div>
        ) : (
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-2">
                {message.toolCalls.map((tc) => (
                  <ToolCallCard key={tc.id} tc={tc} />
                ))}
              </div>
            )}
            {message.content ? (
              <AssistantContent content={message.content} />
            ) : (
              <span className="text-xs italic text-[var(--ink-faint)]">Bekleniyor…</span>
            )}
          </>
        )}

        {/* Action bar */}
        {!editing && (
          <div
            className={cn(
              "flex items-center gap-1 mt-1 transition-all duration-200",
              showActions ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            {isUser && onEdit && !isError && (
              <button
                onClick={() => { setDraft(message.content); setEditing(true); }}
                className="wk-composer-tool"
                aria-label="Düzenle"
              >
                <Pencil size={11} />
              </button>
            )}
            {!isError && (
              <button onClick={handleCopy} className="wk-composer-tool" aria-label={copied ? "Kopyalandı" : "Kopyala"}>
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            )}
            {!isUser && !isError && message.content && (
              <TtsButton text={message.content} />
            )}
            {!isUser && !isError && message.content && onMessageAction && (
              <MessageActions content={message.content} onAction={onMessageAction} />
            )}
            {!isError && onBranch && (
              <button onClick={() => onBranch(message.id)} className="wk-composer-tool" aria-label="Dallandır">
                <GitBranch size={11} />
              </button>
            )}
            {!isError && <BranchIndicator messageId={message.id} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Empty State (Workshop) =====
function EmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="wk-stream-inner">
        <div className="wk-empty">
          <div className="wk-empty-eyebrow">Agent Web · workshop</div>
          <h1>
            Bugün ne <em>inşa edelim?</em>
          </h1>
          <p>
            Bir görev yaz — agent depoyu okuyacak, planı parçalayacak ve
            dosyalara dokunmadan önce her adımı sana gösterecek.
          </p>
          <div className="wk-quick-grid">
            {STARTER_PROMPTS.map((item) => (
              <button
                key={item.key}
                className="wk-quick"
                onClick={() => onPrompt(item.prompt)}
              >
                <span className="wk-quick-title">{item.label}</span>
                <span className="wk-quick-desc">{item.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Stream Parser =====
const STREAM_TIMEOUT_MS = 60_000;

interface ToolCallEvent {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
}

async function streamChat(
  payload: {
    messages: { role: string; content: string }[];
    provider: string;
    model: string;
    enabledSkills?: string[];
    files?: { name: string; path: string }[];
    agentId?: string | null;
  },
  onText: (delta: string) => void,
  onToolCall?: (tc: ToolCallEvent) => void,
  signal?: AbortSignal,
): Promise<{ text: string; error?: string; toolCalls: ToolCallEvent[] }> {
  const controller = new AbortController();
  const linkedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  let lastChunkTime = Date.now();
  const timeoutId = setInterval(() => {
    if (Date.now() - lastChunkTime > STREAM_TIMEOUT_MS) {
      controller.abort();
    }
  }, 5_000);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: linkedSignal,
    });
    if (!res.ok || !res.body) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}
      return { text: "", error: msg, toolCalls: [] };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let error: string | undefined;
    const toolCalls: ToolCallEvent[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lastChunkTime = Date.now();
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("0:")) {
          try {
            const t = JSON.parse(trimmed.slice(2));
            if (typeof t === "string") {
              text += t;
              onText(t);
            }
          } catch {}
        } else if (trimmed.startsWith("1:")) {
          try {
            const tc: ToolCallEvent = JSON.parse(trimmed.slice(2));
            toolCalls.push(tc);
            onToolCall?.(tc);
          } catch {}
        } else if (trimmed.startsWith("2:")) {
          try {
            const tr: ToolCallEvent = JSON.parse(trimmed.slice(2));
            const existing = toolCalls.find(
              (t) => t.toolCallId === tr.toolCallId,
            );
            if (existing) {
              existing.result = tr.result;
            } else {
              toolCalls.push(tr);
            }
            onToolCall?.(tr);
          } catch {}
        } else if (trimmed.startsWith("3:")) {
          try {
            const e = JSON.parse(trimmed.slice(2));
            error = typeof e === "string" ? e : JSON.stringify(e);
          } catch {
            error = trimmed.slice(2);
          }
        } else if (trimmed.startsWith("9:")) {
          // tool call started (Vercel AI SDK format)
          try {
            const tc = JSON.parse(trimmed.slice(2));
            if (tc.toolCallId && tc.toolName) {
              onToolCall?.({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args ?? {},
              });
            }
          } catch {}
        } else if (trimmed.startsWith("a:")) {
          // tool call result (Vercel AI SDK format)
          try {
            const tr = JSON.parse(trimmed.slice(2));
            if (tr.toolCallId) {
              const result = typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result);
              onToolCall?.({
                toolCallId: tr.toolCallId,
                toolName: "",
                args: {},
                result,
              });
            }
          } catch {}
        }
      }
    }
    return { text, error, toolCalls };
  } catch (e: unknown) {
    if (controller.signal.aborted) {
      return {
        text: "",
        error: `Stream timed out after ${STREAM_TIMEOUT_MS / 1000}s.`,
        toolCalls: [],
      };
    }
    const err = e as Error;
    if (err.name === "AbortError") {
      return { text: "", error: "Request cancelled.", toolCalls: [] };
    }
    return { text: "", error: err.message, toolCalls: [] };
  } finally {
    clearInterval(timeoutId);
  }
}

// ===== Compare Row (Workshop) =====
function CompareRow({
  left,
  right,
  index,
}: {
  left: ChatMessage;
  right: ChatMessage;
  index: number;
}) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-block-in"
      style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
    >
      <CompareCell message={left} />
      <CompareCell message={right} />
    </div>
  );
}

function CompareCell({ message }: { message: ChatMessage }) {
  const isError = message.content.startsWith("Error:");
  return (
    <div className="wk-block">
      <div className="wk-block-margin">
        <span className="wk-block-marker">▸</span>
        {message.model && <span className="wk-block-label">{message.model}</span>}
      </div>
      <div className="wk-block-body">
        {isError ? (
          <p className="text-sm text-[var(--danger)]">{message.content}</p>
        ) : (
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {message.toolCalls.map((tc) => (
                  <ToolCallCard key={tc.id} tc={tc} />
                ))}
              </div>
            )}
            {message.content ? (
              <AssistantContent content={message.content} />
            ) : (
              <span className="text-xs italic text-[var(--ink-faint)]">Bekleniyor…</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ===== Main Chat Interface =====
export function ChatInterface() {
  const isLoading = useChatStore((s) => s.isLoading);
  const setLoading = useChatStore((s) => s.setLoading);
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const hasApiKey = useChatStore((s) => s.hasApiKey);
  const enabledSkills = useChatStore((s) => s.enabledSkills);
  const selectedModels = useChatStore((s) => s.selectedModels);
  const compareMode = useChatStore((s) => s.compareMode);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const selectedSkills = useChatStore((s) => s.selectedSkills);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const truncateAfter = useChatStore((s) => s.truncateAfter);
  const appendLocalMessage = useChatStore((s) => s.appendLocalMessage);
  const patchLocalMessage = useChatStore((s) => s.patchLocalMessage);
  const createSession = useChatStore((s) => s.createSession);
  const branchFrom = useChatStore((s) => s.branchFrom);
  const hydrated = useChatStore((s) => s.hydrated);

  const commandPrefill = useChatStore((s) => s.commandPrefill);
  const setCommandPrefill = useChatStore((s) => s.setCommandPrefill);
  const directSend = useChatStore((s) => s.directSend);
  const setDirectSend = useChatStore((s) => s.setDirectSend);
  const contextPanelOpen = useChatStore((s) => s.contextPanelOpen);
  const setContextPanelOpen = useChatStore((s) => s.setContextPanelOpen);

  const activeAgent = useChatStore((s) => s.activeAgent);
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const setActiveAgent = useChatStore((s) => s.setActiveAgent);
  const fetchAndSetActiveAgent = useChatStore((s) => s.fetchAndSetActiveAgent);

  const messages = useActiveMessages();

  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<
    { name: string; path: string }[]
  >([]);
  const [branchTargetId, setBranchTargetId] = useState<string | null>(null);
  const [branchInput, setBranchInput] = useState("");
  const [filePreviews, setFilePreviews] = useState<Map<string, FilePreview>>(
    new Map(),
  );
  const [uploading, setUploading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScroll = useRef(true);

  const [installedAgents, setInstalledAgents] = useState<Array<{id: string; presetId: string; preset: {id: string; name: string; description: string; category: string; avatar: string | null; systemPrompt: string; tools: string; model: string | null; provider: string | null; temperature: number | null}}>>([]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom < 100;
    shouldAutoScroll.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, []);

  // Auto-scroll to bottom when messages change (new message, stream update, etc.)
  useEffect(() => {
    if (shouldAutoScroll.current && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Watch for commandPrefill from CommandRail, set input and focus
  useEffect(() => {
    if (commandPrefill) {
      const frame = requestAnimationFrame(() => {
        setInput(commandPrefill);
        setCommandPrefill(null);
        const inputEl = document.querySelector<HTMLTextAreaElement>('[data-chat-input]');
        inputEl?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [commandPrefill, setCommandPrefill]);

  // Fetch installed agents on mount
  useEffect(() => {
    fetch('/api/agents/installed').then(r => r.json()).then(data => {
      if (data.agents) setInstalledAgents(data.agents);
    }).catch(() => {});
  }, []);

  const abortRef = useRef<AbortController | null>(null);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 320) + "px";
    },
    [],
  );

  const effectiveModels = useMemo(() => {
    if (compareMode && selectedModels.length >= 2) {
      return selectedModels.slice(0, 2);
    }
    return [model];
  }, [compareMode, selectedModels, model]);




  const runSingle = useCallback(
    async (
      sessionId: string,
      msgs: { role: string; content: string }[],
      useModel: string,
      placeholderId: string,
    ) => {
      const currentFiles = attachedFiles;
      const { text, error } = await streamChat(
        {
          messages: msgs,
          provider,
          model: useModel,
          enabledSkills,
          files: currentFiles.length > 0 ? currentFiles : undefined,
          agentId: useChatStore.getState().activeAgentId,
        },
        (delta) => {
          patchLocalMessage(
            placeholderId,
            getCurrentText(placeholderId) + delta,
          );
        },
        (tc) => {
          // Update tool calls in the local message
          const ses = useChatStore
            .getState()
            .sessions.find((s: { id: string }) => s.id === sessionId);
            const msg = ses?.messages.find((m: ChatMessage) => m.id === placeholderId);
          if (msg) {
            const existing = msg.toolCalls || [];
            const idx = existing.findIndex((t: ToolCallInfo) => t.id === tc.toolCallId);
            const mappedTc = {
              id: tc.toolCallId,
              name: tc.toolName,
              args: JSON.stringify(tc.args),
              result: tc.result ? JSON.stringify(tc.result) : undefined,
            };
            if (idx >= 0) {
              existing[idx] = mappedTc;
            } else {
              existing.push(mappedTc);
            }
            patchLocalMessage(placeholderId, msg.content);
          }
        },
      );

      const finalText = error ? "Error: " + error : text;
      if (error) toast.error(`Yanıt oluşturulurken hata: ${error}`);

      await persistMessage(sessionId, {
        id: placeholderId,
        role: "assistant",
        content: finalText,
        model: useModel,
        timestamp: Date.now(),
      });
      patchLocalMessage(placeholderId, finalText);

      function getCurrentText(id: string): string {
        const ses = useChatStore.getState().sessions.find((s: { id: string }) => s.id === sessionId);
        return ses?.messages.find((m: ChatMessage) => m.id === id)?.content ?? "";
      }
    },
    [provider, enabledSkills, attachedFiles, patchLocalMessage],
  );

  const submitChat = useCallback(
    async (msgs: { role: string; content: string }[]) => {
      if (isLoading || !hasApiKey) return;
      let sessionId = activeSessionId;
      if (!sessionId) {
        try {
          sessionId = await createSession();
        } catch {
          toast.error("Oturum oluşturulamadı. Lütfen tekrar deneyin.");
          setLoading(false);
          return;
        }
      }
      setLoading(true);

      const ac = new AbortController();
      abortRef.current = ac;

      const placeholders = effectiveModels.map((useModel) => {
        const id = genId();
        const msg: ChatMessage = { id, role: "assistant", content: "", model: useModel, timestamp: Date.now() };
        appendLocalMessage(msg);
        return { id, model: useModel };
      });

      try {
        const results = await Promise.allSettled(
          placeholders.map((p) => runSingle(sessionId!, msgs, p.model, p.id)),
        );
        results.forEach((r: PromiseSettledResult<void>, i: number) => {
          if (r.status === "rejected") {
            const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
            toast.error(`${placeholders[i].model}: ${reason}`);
          }
        });
      } finally {
        abortRef.current = null;
        setLoading(false);
      }
    },
    [
      isLoading,
      hasApiKey,
      activeSessionId,
      createSession,
      setLoading,
      effectiveModels,
      appendLocalMessage,
      runSingle,
    ],
  );

  // Fetch preview for a single uploaded file
  const fetchPreview = useCallback(
    async (f: { name: string; path: string }) => {
      if (!isPreviewable(f.name)) return;
      try {
        const res = await fetch("/api/upload/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: f.path }),
        });
        if (!res.ok) return;
        const preview = (await res.json()) as FilePreview;
        setFilePreviews((prev) => {
          const next = new Map(prev);
          next.set(f.name, preview);
          return next;
        });
      } catch {
        // preview fetch failed — silently skip
      }
    },
    [],
  );

  // Upload files
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const flist = e.target.files;
      if (!flist || flist.length === 0) return;
      setUploading(true);
      try {
        const fd = new FormData();
        for (let i = 0; i < flist.length; i++) {
          fd.append("files", flist[i]);
        }
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const data = (await res.json()) as {
          files: { name: string; path: string }[];
        };
        setAttachedFiles((prev) => [...prev, ...data.files]);
        // Fetch previews for new files
        for (const f of data.files) {
          fetchPreview(f);
        }
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [fetchPreview],
  );

  // Remove attached file
  const removeFile = useCallback((name: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.name !== name));
    setFilePreviews((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
  }, []);

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !hasApiKey) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: input,
      timestamp: Date.now(),
    };
    
    setInput("");

    await addMessage(userMsg);

    // Clear attached files after sending
    if (attachedFiles.length > 0) {
      setAttachedFiles([]);
      setFilePreviews(new Map());
    }

    const currentMessages = [
      ...(useChatStore
        .getState()
        .sessions.find((s: { id: string }) => s.id === useChatStore.getState().activeSessionId)
        ?.messages ?? []),
    ];
    // Build prompt history (skip empty assistant placeholders, drop model meta)
    const msgs = currentMessages
      .filter((m: ChatMessage) => m.content)
      .map((m: ChatMessage) => ({ role: m.role, content: m.content }));

    await submitChat(msgs);
  }, [input, isLoading, hasApiKey, addMessage, attachedFiles, submitChat]);

  const handleRetry = useCallback(
    async (errorMessageId: string) => {
      const idx = messages.findIndex((m: ChatMessage) => m.id === errorMessageId);
      if (idx === -1) return;
      const target = messages[idx];
      await truncateAfter(target.timestamp, true);
      const freshSession = useChatStore.getState().sessions.find(
        (s: { id: string }) => s.id === useChatStore.getState().activeSessionId
      );
      const remaining = freshSession?.messages ?? [];
      const msgs = remaining.filter((m: ChatMessage) => m.content).map((m: ChatMessage) => ({ role: m.role, content: m.content }));
      await submitChat(msgs);
    },
    [messages, truncateAfter, submitChat],
  );

  const handleEdit = useCallback(
    async (messageId: string, newContent: string) => {
      const idx = messages.findIndex((m: ChatMessage) => m.id === messageId);
      if (idx === -1) return;
      const target = messages[idx];
      await updateMessage(messageId, newContent);
      await truncateAfter(target.timestamp, false);

      // Build prompt: messages up to and including edited message (with new content)
      const remaining = messages
        .slice(0, idx + 1)
        .map((m: ChatMessage) => (m.id === messageId ? { ...m, content: newContent } : m));
      const msgs = remaining
        .filter((m: ChatMessage) => m.content)
        .map((m: ChatMessage) => ({ role: m.role, content: m.content }));

      await submitChat(msgs);
    },
    [messages, updateMessage, truncateAfter, submitChat],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleStarterPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 320) + "px";
    });
  }, []);

  const handleBranch = useCallback(
    async (messageId: string) => {
      const msg = prompt("Enter your branch message:");
      if (!msg || !msg.trim()) return;
      try {
        await branchFrom(activeSessionId!, messageId, msg.trim());
      } catch (e) {
        toast.error("Failed to create branch");
        console.error("Branch failed:", e);
      }
    },
    [branchFrom, activeSessionId],
  );

  const handleMessageAction = useCallback(
    async (type: string, content: string) => {
      const SYSTEM_PREFIXES: Record<string, string> = {
        summarize: "Please summarize the following message concisely:\n\n",
        "translate-en": "Translate the following message to English:\n\n",
        "translate-tr": "Translate the following message to Turkish:\n\n",
        improve: "Rewrite the following to improve its clarity and style:\n\n",
        explain: "Explain the following in simple terms:\n\n",
      };
      const prefix = SYSTEM_PREFIXES[type] ?? "";
      const newMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content: prefix + content,
        timestamp: Date.now(),
      };
      console.log("MessageAction:", type, newMsg.content.slice(0, 80));
      await addMessage(newMsg);

      // Build prompt history and submit
      const currentMessages = [
        ...(useChatStore
          .getState()
          .sessions.find((s: { id: string }) => s.id === useChatStore.getState().activeSessionId)
          ?.messages ?? []),
      ];
      const msgs = currentMessages
        .filter((m: ChatMessage) => m.content)
        .map((m: ChatMessage) => ({ role: m.role, content: m.content }));
      await submitChat(msgs);
    },
    [addMessage, submitChat],
  );

  // Group messages for compare-mode rendering. Consecutive assistant messages
  // sharing the same user-prompt timestamp (i.e., dispatched in parallel) are
  // rendered side-by-side as a CompareRow.
  const renderItems = useMemo(() => {
    type Item =
      | { kind: "single"; msg: ChatMessage; index: number }
      | {
          kind: "compare";
          left: ChatMessage;
          right: ChatMessage;
          index: number;
        };
    const items: Item[] = [];
    let i = 0;
    while (i < messages.length) {
      const m = messages[i];
      if (
        m.role === "assistant" &&
        i + 1 < messages.length &&
        messages[i + 1].role === "assistant" &&
        Math.abs(messages[i + 1].timestamp - m.timestamp) < 2000 &&
        m.model && messages[i + 1].model &&
        m.model !== messages[i + 1].model
      ) {
        items.push({
          kind: "compare",
          left: m,
          right: messages[i + 1],
          index: i,
        });
        i += 2;
        continue;
      }
      items.push({ kind: "single", msg: m, index: i });
      i++;
    }
    return items;
  }, [messages]);

  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2
          size={20}
          className="animate-spin text-[var(--muted-foreground)]"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col relative">
      <KeyboardShortcuts />
      {/* Messages Area */}
      {messages.length === 0 ? (
        <EmptyState onPrompt={handleStarterPrompt} />
      ) : (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="wk-stream"
        >
          <div className="wk-stream-inner">
            {renderItems.map((item) =>
              item.kind === "single" ? (
                <MessageBubble
                  key={item.msg.id}
                  message={item.msg}
                  index={item.index}
                  onRetry={
                    item.msg.role === "assistant" && item.msg.content.startsWith("Error:")
                      ? () => handleRetry(item.msg.id)
                      : undefined
                  }
                  onEdit={
                    item.msg.role === "user"
                      ? (newContent) => handleEdit(item.msg.id, newContent)
                      : undefined
                  }
                  onBranch={
                    activeSessionId ? () => handleBranch(item.msg.id) : undefined
                  }
                  onMessageAction={
                    item.msg.role === "assistant" && item.msg.content && !item.msg.content.startsWith("Error:")
                      ? (type, content) => handleMessageAction(type, content)
                      : undefined
                  }
                />
              ) : (
                <CompareRow
                  key={`${item.left.id}-${item.right.id}`}
                  left={item.left}
                  right={item.right}
                  index={item.index}
                />
              ),
            )}
            {isLoading ? (
              <TypingIndicator
                label={
                  compareMode && effectiveModels.length > 1
                    ? `${effectiveModels.join(" vs ")} karşılaştırılıyor`
                    : undefined
                }
              />
            ) : null}
            <div ref={messagesEndRef} className="wk-stream-anchor" />
          </div>
        </div>
      )}

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={scrollToBottom}
            className="wk-send is-ready animate-slide-up"
            aria-label="Aşağı kaydır"
          >
            <ArrowDown size={14} />
          </button>
        </div>
      )}

      {/* Composer — Workshop */}
      <div className="wk-composer-wrap safe-bottom">
        {!isLoading && input === "" && messages.length === 0 && (
          <div className="wk-starters">
            {STARTER_PROMPTS.slice(0, 4).map((item) => (
              <button
                key={item.key}
                className="wk-starter"
                onClick={() => {
                  setInput(item.prompt);
                  requestAnimationFrame(() => {
                    const ta = document.querySelector<HTMLTextAreaElement>('[data-chat-input]');
                    if (ta) {
                      ta.style.height = "auto";
                      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
                    }
                  });
                }}
              >
                {item.desc}
              </button>
            ))}
          </div>
        )}

        {compareMode && effectiveModels.length > 1 && (
          <div className="max-w-[880px] mx-auto px-8 pt-2">
            <span className="font-mono text-[10px] text-[var(--accent)]">
              Compare: {effectiveModels.join(" vs ")}
            </span>
          </div>
        )}

        {/* Agent selector */}
        {installedAgents.length > 0 && (
          <div className="max-w-[880px] mx-auto px-8 pt-2 flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--ink-faint)] uppercase tracking-wider">Agent</span>
            <select
              value={activeAgentId || ''}
              onChange={(e) => fetchAndSetActiveAgent(e.target.value || null)}
              className="flex-1 h-7 rounded border border-[var(--rule-soft)] bg-[var(--bg-subtle)] px-2 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">Default</option>
              {installedAgents.map((a: { id: string; presetId: string; preset: { id: string; name: string } }) => (
                <option key={a.id} value={a.presetId}>{a.preset.name}</option>
              ))}
            </select>
            <button
              onClick={() => fetchAndSetActiveAgent(null)}
              className="h-7 w-7 flex items-center justify-center rounded text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--bg-elev)] transition-colors"
              title="Clear agent selection"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {filePreviews.size > 0 && (
          <div className="max-w-[880px] mx-auto px-8 pt-2 flex flex-col gap-2">
            {Array.from(filePreviews.entries()).map(([name, preview]) => (
              <FilePreviewCard key={name} preview={preview} onClose={() => removeFile(name)} />
            ))}
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="max-w-[880px] mx-auto px-8 pt-2 flex flex-wrap gap-1.5">
            {attachedFiles.map((f) => (
              <span key={f.name} className="wk-starter">
                <Paperclip size={10} className="inline mr-1" />
                {f.name}
                <button onClick={() => removeFile(f.name)} className="ml-1 hover:text-[var(--danger)]" aria-label={`Kaldır ${f.name}`}>
                  <X size={10} className="inline" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Image previews */}
        {attachedFiles.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name)).length > 0 && (
          <div className="max-w-[880px] mx-auto px-8 pt-2 flex flex-wrap gap-2">
            {attachedFiles
              .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name))
              .map((f) => (
                <div key={f.name} className="group relative">
                  <img
                    src={`/api/upload/preview?path=${encodeURIComponent(f.path)}`}
                    alt={f.name}
                    className="h-20 w-20 rounded border border-[var(--rule-soft)] object-cover"
                  />
                  <button
                    onClick={() => removeFile(f.name)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--ink-faint)] opacity-0 shadow-sm transition-opacity hover:text-[var(--danger)] group-hover:opacity-100"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X size={10} />
                  </button>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {f.name}
                  </span>
                </div>
              ))}
          </div>
        )}

        <div className="wk-composer">
          <span className="wk-composer-prompt">❯</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            aria-label="Dosya yükle"
          />
          <label htmlFor="chat-input" className="sr-only">Mesaj</label>
          <textarea
            ref={textareaRef}
            id="chat-input"
            data-chat-input
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              hasApiKey
                ? isLoading
                  ? "agent yanıtlıyor…"
                  : "agent'a yaz…   ⇧⏎ yeni satır · ⌘⏎ gönder"
                : "API anahtarı yapılandırılmamış"
            }
            disabled={!hasApiKey || isLoading}
            rows={1}
            className="wk-composer-input"
          />
          <div className="wk-composer-side">
            <button
              className="wk-composer-tool"
              onClick={() => fileInputRef.current?.click()}
              disabled={!hasApiKey || uploading}
              aria-label="Dosya ekle"
              title="Dosya ekle"
            >
              {uploading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Paperclip size={13} />
              )}
            </button>
            <SttButton
              onTranscript={(text) => {
                setInput(text);
                requestAnimationFrame(() => {
                  const ta = document.querySelector<HTMLTextAreaElement>('[data-chat-input]');
                  if (ta) {
                    ta.style.height = "auto";
                    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
                  }
                });
              }}
              disabled={!hasApiKey}
            />
            {isLoading ? (
              <button className="wk-stop" onClick={() => abortRef.current?.abort()}>
                <span className="wk-stop-square" />
                <span>Dur</span>
              </button>
            ) : (
              <button
                className={cn("wk-send", input.trim() && hasApiKey && "is-ready")}
                onClick={handleSend}
                disabled={!input.trim() || !hasApiKey}
              >
                <span>Gönder</span>
                <span className="wk-send-key">⌘⏎</span>
              </button>
            )}
          </div>
        </div>

        {installedAgents.length > 0 && (
          <div className="max-w-[880px] mx-auto px-8 py-1.5 flex items-center gap-2">
            <Bot size={12} className="text-[var(--ink-faint)] shrink-0" />
            <select
              value={activeAgentId || ''}
              onChange={(e) => fetchAndSetActiveAgent(e.target.value || null)}
              className="text-[11px] bg-transparent border border-[var(--rule)] rounded px-2 py-0.5 text-[var(--ink)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            >
              <option value="">Default Agent</option>
              {installedAgents.map(a => (
                <option key={a.id} value={a.presetId}>{a.preset.name}</option>
              ))}
            </select>
            {activeAgent && (
              <span className="text-[10px] text-[var(--accent)] truncate">
                {activeAgent.name}
              </span>
            )}
          </div>
        )}

        <div className="wk-status-strip">
          <span><span className="wk-led wk-led--on" /> {provider} · {model}</span>
          <span>bağlam 14.2k/80k</span>
          <span>11 araç</span>
          <span className="wk-status-right">⌘K komut paleti</span>
        </div>
      </div>

      {/* Live region for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {(() => {
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "assistant") return messages[i].content;
          }
          return "";
        })()}
      </div>
    </div>
  );
}

