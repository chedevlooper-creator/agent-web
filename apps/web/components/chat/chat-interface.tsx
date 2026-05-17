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
  ArrowDown,
  Loader2,
  GitCompare,
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
  X,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { streamChat } from "@/lib/stream-chat";
import { MessageBubble } from "./message-bubble";
import { CompareRow } from "./compare-row";
import { TypingIndicator } from "./typing-indicator";

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
  "xlsx", "xls", "numbers", "csv", "tsv", "json",
  "txt", "md", "log", "yaml", "yml", "toml", "ini",
  "cfg", "env", "xml", "html", "css", "js", "ts",
  "py", "sh",
]);

function isPreviewable(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? PREVIEWABLE_EXTS.has(ext) : false;
}

const STARTER_PROMPTS = [
  "Review this interface and return three UX improvements.",
  "Turn this idea into a polished execution plan.",
  "Compare two approaches and recommend the stronger one.",
];

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

async function persistMessage(
  sessionId: string,
  msg: { id: string; role: "user" | "assistant" | "system"; content: string; model?: string; timestamp: number },
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

// ===== File Preview Card =====
function FilePreviewCard({ preview, onClose }: { preview: FilePreview; onClose: () => void }) {
  const [expanded, setExpanded] = useState(true);

  if (preview.error) {
    return (
      <div className="border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-3 text-sm text-[var(--destructive)] animate-slide-up">
        <p className="text-xs">{preview.error}</p>
        <button onClick={onClose} className="mt-1 text-[11px] hover:underline">Dismiss</button>
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
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--muted)]/50 transition-colors"
      >
        <span className={iconColor}>{icon}</span>
        <span className="text-xs font-medium truncate flex-1 text-left">{displayName}</span>
        {preview.rows !== undefined && (
          <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 font-mono">
            {preview.rows.toLocaleString()} rows
          </span>
        )}
        {expanded ? (
          <ChevronDown size={12} className="text-[var(--muted-foreground)] shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-[var(--muted-foreground)] shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-[var(--border)] max-h-[300px] overflow-auto">
          {(preview.type === "excel" || preview.type === "csv") && preview.headers && preview.data ? (
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-[var(--muted)]/80 backdrop-blur-sm">
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold border-b border-[var(--border-strong)] whitespace-nowrap text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--muted)]/30 transition-colors">
                    {preview.headers!.map((h) => (
                      <td key={h} className="px-3 py-1.5 border-b border-[var(--border)]/50 max-w-[200px] truncate" title={String(row[h] ?? "")}>
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (preview.type === "json" || preview.type === "text") && preview.content ? (
            <SyntaxHighlighter
              language={preview.type === "json" ? "json" : "text"}
              style={vscDarkPlus}
              customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.6875rem", maxHeight: 300 }}
            >
              {preview.content}
            </SyntaxHighlighter>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ===== Tool Call Card (inline, used by message-bubble rendering) =====
function ToolCallCard({ tc }: { tc: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = tc.result !== undefined;
  const IconComp = tc.name === "terminal"
    ? Terminal
    : tc.name.includes("file") || tc.name.includes("read")
      ? FileText
      : Globe;

  let argsPreview: string;
  try {
    const parsed = JSON.parse(tc.args);
    argsPreview =
      typeof parsed === "object" && parsed !== null
        ? Object.values(parsed)[0]?.toString()?.slice(0, 60) || tc.args.slice(0, 60)
        : tc.args.slice(0, 60);
  } catch {
    argsPreview = tc.args.slice(0, 60);
  }
  if (argsPreview.length >= 60) argsPreview += "...";

  return (
    <Card className="agent-tool-card my-1 gap-0 py-0" size="sm">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => isDone && setExpanded(!expanded)}
        disabled={!isDone}
        className={cn(
          "h-auto w-full justify-start rounded-none px-3 py-2 font-mono text-xs",
          "disabled:pointer-events-auto disabled:opacity-100",
        )}
        aria-label={isDone ? `${tc.name} sonucunu görüntüle` : `${tc.name} çalışıyor`}
      >
        <IconComp
          data-icon="inline-start"
          className={cn(
            isDone ? "text-[var(--success)]" : "animate-pulse text-[var(--accent)]",
          )}
        />
        <span className="font-semibold">{tc.name}</span>
        <span className="min-w-0 flex-1 truncate text-left text-[var(--muted-foreground)]">
          {argsPreview}
        </span>
        {!isDone && (
          <Badge variant="outline" className="agent-status-badge text-[var(--accent)]">
            running
          </Badge>
        )}
        {isDone && (expanded ? (
          <ChevronDown className="text-[var(--muted-foreground)]" />
        ) : (
          <ChevronRight className="text-[var(--muted-foreground)]" />
        ))}
      </Button>
      {expanded && isDone && (
        <CardContent className="border-t border-[var(--border)] bg-[var(--background)] px-3 py-2">
          <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
            {tc.result}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

// ===== Assistant Content Renderer (inline, used by message-bubble rendering) =====
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
                style={vscDarkPlus as any}
                language={match[1]}
                PreTag="div"
                customStyle={{ margin: "0.5rem 0", borderRadius: "0.5rem", fontSize: "0.8125rem" }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs" {...props}>
                {children}
              </code>
            );
          },
          a({ href, children, ...props }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline" {...props}>
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th className="border border-[var(--border)] px-3 py-2 text-left font-medium bg-[var(--muted)]" {...props}>
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td className="border border-[var(--border)] px-3 py-2" {...props}>
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

// ===== Empty State =====
function EmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="agent-empty-state animate-fade-in">
      <div className="agent-empty-visual" aria-hidden="true">
        <div className="agent-orbit agent-orbit--outer" />
        <div className="agent-orbit agent-orbit--inner" />
        <div className="agent-core-cube"><span /><span /><span /></div>
      </div>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="signal-ready agent-ready-copy">
          <span className="text-[var(--primary)]/60">&gt;</span> ready<span className="signal-caret" />
        </div>
        <div className="flex max-w-2xl flex-wrap justify-center gap-2">
          {STARTER_PROMPTS.map((prompt) => (
            <Button key={prompt} type="button" variant="outline" size="sm" className="agent-starter-prompt" onClick={() => onPrompt(prompt)}>
              {prompt}
            </Button>
          ))}
        </div>
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
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const truncateAfter = useChatStore((s) => s.truncateAfter);
  const appendLocalMessage = useChatStore((s) => s.appendLocalMessage);
  const patchLocalMessage = useChatStore((s) => s.patchLocalMessage);
  const createSession = useChatStore((s) => s.createSession);
  const hydrated = useChatStore((s) => s.hydrated);

  const commandPrefill = useChatStore((s) => s.commandPrefill);
  const setCommandPrefill = useChatStore((s) => s.setCommandPrefill);

  const messages = useActiveMessages();

  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; path: string }[]>([]);
  const [filePreviews, setFilePreviews] = useState<Map<string, FilePreview>>(new Map());
  const [uploading, setUploading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScroll = useRef(true);

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

  const abortRef = useRef<AbortController | null>(null);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 320) + "px";
  }, []);

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
      useModel: string | undefined,
      placeholderId: string,
    ) => {
      const currentFiles = attachedFiles;
      const { text, error } = await streamChat(
        {
          messages: msgs,
          // Only send model when user explicitly picked (compare mode)
          ...(useModel ? { model: useModel } : {}),
          enabledSkills,
          files: currentFiles.length > 0 ? currentFiles : undefined,
        },
        (delta) => {
          patchLocalMessage(placeholderId, getCurrentText(placeholderId) + delta);
        },
        (tc) => {
          const ses = useChatStore.getState().sessions.find((s: { id: string }) => s.id === sessionId);
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
    [enabledSkills, attachedFiles, patchLocalMessage],
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
        // In normal mode (single model), don't send model — server auto-selects
        // In compare mode, send explicit models so both variants are triggered
        const sendModel = compareMode ? useModel : undefined;
        return { id, model: sendModel };
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
    [isLoading, hasApiKey, activeSessionId, createSession, setLoading, effectiveModels, appendLocalMessage, runSingle],
  );

  const fetchPreview = useCallback(async (f: { name: string; path: string }) => {
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
    } catch {}
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const flist = e.target.files;
    if (!flist || flist.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (let i = 0; i < flist.length; i++) fd.append("files", flist[i]);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = (await res.json()) as { files: { name: string; path: string }[] };
      setAttachedFiles((prev) => [...prev, ...data.files]);
      for (const f of data.files) fetchPreview(f);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [fetchPreview]);

  const removeFile = useCallback((name: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.name !== name));
    setFilePreviews((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
  }, []);

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

    if (attachedFiles.length > 0) {
      setAttachedFiles([]);
      setFilePreviews(new Map());
    }

    const currentMessages = [
      ...(useChatStore.getState().sessions.find(
        (s: { id: string }) => s.id === useChatStore.getState().activeSessionId,
      )?.messages ?? []),
    ];
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
        (s: { id: string }) => s.id === useChatStore.getState().activeSessionId,
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
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 320) + "px";
    });
  }, []);

  const renderItems = useMemo(() => {
    type Item =
      | { kind: "single"; msg: ChatMessage; index: number }
      | { kind: "compare"; left: ChatMessage; right: ChatMessage; index: number };
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
        items.push({ kind: "compare", left: m, right: messages[i + 1], index: i });
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
        <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="agent-chat-stage relative flex h-full min-w-0 flex-col overflow-hidden">
      {messages.length === 0 ? (
        <EmptyState onPrompt={handleStarterPrompt} />
      ) : (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
        >
          <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
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
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {showScrollBtn && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10">
          <TooltipIconButton
            type="button"
            label="Scroll to bottom"
            variant="outline"
            size="icon-lg"
            onClick={scrollToBottom}
            className="agent-scroll-button animate-slide-up"
            aria-label="Scroll to bottom"
          >
            <ArrowDown />
          </TooltipIconButton>
        </div>
      )}

      <div className="w-full min-w-0 shrink-0 overflow-hidden border-t border-[var(--border)] bg-[var(--background)] safe-bottom">
        <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-3 sm:px-6">
          {compareMode && effectiveModels.length > 1 && (
            <Badge variant="outline" className="agent-compare-badge mb-2">
              <GitCompare data-icon="inline-start" />
              Compare mode: {effectiveModels.join(" vs ")}
            </Badge>
          )}
          {filePreviews.size > 0 && (
            <div className="mb-2 flex flex-col gap-2">
              {Array.from(filePreviews.entries()).map(([name, preview]) => (
                <FilePreviewCard key={name} preview={preview} onClose={() => removeFile(name)} />
              ))}
            </div>
          )}
          {attachedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachedFiles.map((f) => (
                <Badge key={f.name} variant="outline" className="agent-file-badge">
                  <Paperclip data-icon="inline-start" className="text-[var(--accent)]" />
                  {f.name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeFile(f.name)}
                    className="ml-0.5 size-5 hover:text-[var(--destructive)]"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          <Card className="agent-composer w-full min-w-0 gap-0 py-0">
            <CardContent className="flex min-w-0 items-end gap-2 px-2 py-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload files"
              />
              <TooltipIconButton
                type="button"
                label={uploading ? "Uploading files" : "Attach files"}
                variant="ghost"
                size="icon-lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={!hasApiKey || uploading}
                className="shrink-0"
                aria-label="Upload files"
              >
                {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
              </TooltipIconButton>
              <label htmlFor="chat-input" className="sr-only">Message</label>
              <Textarea
                ref={textareaRef}
                id="chat-input"
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={hasApiKey ? "Message Agent Web..." : "No API key configured on server"}
                disabled={!hasApiKey}
                rows={1}
                className="min-h-10 max-h-[320px] min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2 font-mono text-xs shadow-none focus-visible:ring-0"
              />
              <TooltipIconButton
                type="button"
                label={isLoading ? "Sending" : "Send message"}
                variant={input.trim() && hasApiKey && !isLoading ? "default" : "ghost"}
                size="icon-lg"
                onClick={handleSend}
                disabled={isLoading || !input.trim() || !hasApiKey}
                className={cn(
                  "shrink-0",
                  input.trim() && hasApiKey && !isLoading
                    ? "agent-send-button"
                    : "text-[var(--muted-foreground)]",
                )}
                aria-label={isLoading ? "Sending..." : "Send message"}
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
              </TooltipIconButton>
            </CardContent>
            <Separator />
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <p className="truncate font-mono text-[10px] text-[var(--dim-foreground)]">
                {provider} / {compareMode && effectiveModels.length > 1 ? effectiveModels.join(", ") : model}
              </p>
              <p className="hidden shrink-0 items-center gap-1 font-mono text-[10px] text-[var(--dim-foreground)] sm:flex">
                <CornerDownLeft /> Enter to send
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Screen reader live region */}
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
