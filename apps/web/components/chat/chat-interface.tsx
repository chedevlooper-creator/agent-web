"use client";

import { useChatStore } from "@/lib/store";
import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Bot, User, Loader2, Sparkles, Copy, Check, AlertCircle, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { streamParser, type StreamEvent } from "@/lib/stream-parser";
import { ToolPanel, type ToolCallEntry } from "@/components/tool-panel";
import { ToolApprovalModal, checkToolDangerous } from "@/components/tool-approval-modal";
import type { PendingApproval } from "@/components/tool-approval-modal";

function genId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <span className="w-2 h-2 rounded-full bg-primary animate-typing-dot" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 rounded-full bg-primary animate-typing-dot" style={{ animationDelay: "160ms" }} />
      <span className="w-2 h-2 rounded-full bg-primary animate-typing-dot" style={{ animationDelay: "320ms" }} />
    </div>
  );
}

export function ChatInterface() {
  const { 
    messages, 
    isLoading, 
    setMessages, 
    apiKey, 
    provider, 
    baseUrl,
    toolExecutions,
    pendingApprovals,
    addToolExecution,
    updateToolExecution,
    clearToolExecutions,
    addPendingApproval,
    removePendingApproval
  } = useChatStore();
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, toolExecutions.length]);

  const handleApproval = useCallback(async (id: string, approved: boolean) => {
    try {
      await fetch("/api/chat/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved }),
      });
      if (!approved) {
        updateToolExecution(id, { status: "error", result: "Rejected by user" });
      } else {
        updateToolExecution(id, { status: "running" });
      }
    } catch (e) {
      console.error("Failed to submit approval", e);
    } finally {
      removePendingApproval(id);
    }
  }, [removePendingApproval, updateToolExecution]);

  const handleSend = useCallback(async () => {
    const state = useChatStore.getState();
    const canSend = state.apiKey || state.provider === "9router";
    if (!input.trim() || state.isLoading || !canSend) return;

    state.clearToolExecutions();

    const userContent = input.trim();
    const userMsg = { id: genId(), role: "user" as const, content: userContent };
    state.addMessage(userMsg);
    setInput("");
    state.setLoading(true);
    state.startStreaming();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      let sid = state.currentSessionId;
      if (!sid) {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userContent.slice(0, 40) || "New Chat" }),
        });
        const session = await res.json();
        state.setSessions([session, ...state.sessions]);
        state.setCurrentSession(session.id);
        sid = session.id;
      }

      const msgs = [{ role: "user" as const, content: userContent }];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          messages: msgs,
          provider: state.provider,
          model: state.model,
          apiKey: state.apiKey,
          baseUrl: state.baseUrl,
          enableMemory: true,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Failed");

      const assistantId = genId();
      state.addMessage({ id: assistantId, role: "assistant", content: "", toolCalls: [], toolResults: [] });

      let text = "";
      let tokenCount = 0;

      for await (const event of streamParser(res.body.getReader())) {
        switch (event.type) {
          case "text-delta":
            if (typeof event.payload === "string") {
              text += event.payload;
              tokenCount++;
              useChatStore.setState((s) => ({
                messages: s.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: text } : m
                ),
                streamingTokens: tokenCount,
              }));
            }
            break;
          case "tool-call": {
            const toolPayload = event.payload as Record<string, unknown>;
            const toolName = typeof toolPayload === "object" ? (toolPayload.name ?? "tool") : "tool";
            const toolArgs = typeof toolPayload === "object" ? (toolPayload.args ?? toolPayload) : {};
            const toolId = typeof toolPayload === "object" && toolPayload.id ? (toolPayload.id as string) : genId();

            const dangerCheck = checkToolDangerous(toolName as string, toolArgs as Record<string, unknown>);
            const newToolCall: ToolCallEntry = {
              id: toolId,
              name: toolName as string,
              args: toolArgs as Record<string, unknown>,
              status: "running",
              startTime: Date.now(),
              result: undefined,
            };

            if (dangerCheck.detected) {
              newToolCall.status = "pending";
              useChatStore.getState().addPendingApproval({
                id: toolId,
                toolName: toolName as string,
                args: toolArgs as Record<string, unknown>,
                isDangerous: true,
                reason: dangerCheck.reason,
              });
            }

            useChatStore.getState().addToolExecution(newToolCall);
            break;
          }
          case "tool-result": {
            const resultPayload = event.payload as Record<string, unknown>;
            const toolResult = typeof resultPayload === "object" ? (resultPayload.result ?? resultPayload) : event.payload;
            const toolCallId = typeof resultPayload === "object" && resultPayload.toolCallId ? (resultPayload.toolCallId as string) : null;
            
            const currentStore = useChatStore.getState();
            if (toolCallId) {
              const existing = currentStore.toolExecutions.find(t => t.id === toolCallId);
              const duration = existing?.startTime ? Date.now() - existing.startTime : undefined;
              currentStore.updateToolExecution(toolCallId, {
                status: "success",
                result: String(toolResult),
                duration
              });
            } else {
              const executions = currentStore.toolExecutions;
              if (executions.length > 0) {
                const lastTool = executions[executions.length - 1];
                const duration = lastTool.startTime ? Date.now() - lastTool.startTime : undefined;
                currentStore.updateToolExecution(lastTool.id, {
                  status: "success",
                  result: String(toolResult),
                  duration
                });
              }
            }
            break;
          }
          case "error": {
            const errText =
              typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload);
            const display = errText.includes("MODEL_CAPACITY_EXHAUSTED") || errText.includes("503")
              ? "Model is temporarily unavailable (capacity limit). Try another model in Settings, e.g. ag/gemini-3-flash."
              : errText;
            text = text.trim() ? `${text}\n\n[Error: ${display}]` : `[Error: ${display}]`;
            useChatStore.setState((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, content: text } : m
              ),
            }));
            break;
          }
        }
      }

      state.stopStreaming();
    } catch (e) {
      state.addMessage({ id: genId(), role: "assistant", content: "Error: " + (e as Error).message });
    } finally {
      state.setLoading(false);
      state.stopStreaming();
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isEmpty = !Array.isArray(messages) || messages.length === 0;
  const hasNoKey = !apiKey && provider !== "9router";

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <ScrollArea className="flex-1 px-4 py-8">
        <div className="space-y-6 max-w-2xl mx-auto">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
              <div className="relative mb-6">
                <div className="bg-gradient-to-br from-primary via-primary to-accent p-5 rounded-3xl shadow-xl shadow-primary/25 animate-pulse-glow">
                  <Sparkles size={36} className="text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-background animate-pulse" />
              </div>
              <h2 className="text-xl font-semibold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                How can I help you today?
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-8">
                {hasNoKey
                  ? "Enter your API key in settings to start chatting with AI."
                  : "Start a new conversation or select a session from the sidebar."}
              </p>
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>AI Models</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span>Code Help</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span>Memory</span>
                </div>
              </div>
            </div>
          )}

          {(Array.isArray(messages) ? messages : []).filter((m) => !!m?.id).map((msg, idx) => {
            const isUser = msg.role === "user";
            const isLastAssistant = !isUser && idx === messages.length - 1 && isLoading;

            return (
              <div
                key={msg.id}
                className={`flex gap-4 animate-slide-up ${isUser ? "flex-row-reverse" : ""}`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="shrink-0">
                  <div className={`relative ${isUser ? "" : ""}`}>
                    <Avatar className={`h-10 w-10 rounded-xl border-2 ${
                      isUser
                        ? "border-primary/20 bg-gradient-to-br from-primary to-primary/80"
                        : "border-accent/20 bg-gradient-to-br from-accent/20 to-accent/10"
                    }`}>
                      <AvatarFallback className={isUser ? "text-primary-foreground font-semibold" : "text-accent font-medium"}>
                        {isUser ? <User size={16} /> : <Bot size={16} />}
                      </AvatarFallback>
                    </Avatar>
                    {!isUser && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-background" />
                    )}
                  </div>
                </div>

                <div className="flex flex-col max-w-[85%] flex-1">
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className={`text-xs font-medium ${isUser ? "text-primary" : "text-accent"}`}>
                      {isUser ? "You" : "Agent Web"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                    {!isUser && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-6 w-6 rounded-md ml-auto opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-muted"
                        onClick={() => copyMessage(msg.id, msg.content)}
                      >
                        {copiedId === msg.id ? <Check size={10} className="text-success" /> : <Copy size={10} />}
                      </Button>
                    )}
                  </div>

                  {!isUser && toolExecutions.length > 0 && idx === messages.length - 1 && (
                    <div className="mb-3 animate-fade-in">
                      <ToolPanel toolCalls={toolExecutions} />
                    </div>
                  )}

                  <div className={`group rounded-2xl px-4 py-3 transition-all duration-200 ${
                    isUser
                      ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 rounded-tr-sm"
                      : "bg-surface border border-border/50 shadow-sm rounded-tl-sm"
                  }`}>
                    {isUser ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            code({ inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || "");
                              return !inline && match ? (
                                <div className="relative group/code my-3">
                                  <div className="absolute top-2 right-2 px-2 py-1 text-[10px] font-mono bg-muted/80 text-muted-foreground rounded-md opacity-0 group-hover/code:opacity-100 transition-opacity backdrop-blur-sm">
                                    {match[1]}
                                  </div>
                                  <div className="rounded-lg overflow-hidden border border-border/50">
                                    <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                                      {String(children).replace(/\n$/, "")}
                                    </SyntaxHighlighter>
                                  </div>
                                </div>
                              ) : (
                                <code
                                  className="bg-muted/50 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                            p({ children }: any) {
                              return <p className="mb-3 last:mb-0 leading-relaxed text-sm">{children}</p>;
                            },
                            h1({ children }: any) {
                              return <h1 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h1>;
                            },
                            h2({ children }: any) {
                              return <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>;
                            },
                            h3({ children }: any) {
                              return <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>;
                            },
                            ul({ children }: any) {
                              return <ul className="list-disc list-inside mb-2 space-y-1 text-sm">{children}</ul>;
                            },
                            ol({ children }: any) {
                              return <ol className="list-decimal list-inside mb-2 space-y-1 text-sm">{children}</ol>;
                            },
                            li({ children }: any) {
                              return <li className="text-sm">{children}</li>;
                            },
                            blockquote({ children }: any) {
                              return (
                                <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-muted-foreground italic text-sm">
                                  {children}
                                </blockquote>
                              );
                            },
                            a({ href, children }: any) {
                              return (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                                >
                                  {children}
                                </a>
                              );
                            },
                            strong({ children }: any) {
                              return <strong className="font-semibold">{children}</strong>;
                            },
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                        {isLastAssistant && (
                          <div className="inline-flex items-center gap-1 mt-2">
                            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse rounded-sm" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-4 animate-fade-in">
              <Avatar className="h-10 w-10 rounded-xl border-2 border-accent/20 bg-gradient-to-br from-accent/20 to-accent/10">
                <AvatarFallback className="text-accent font-medium">
                  <Bot size={16} />
                </AvatarFallback>
              </Avatar>
              <div className="bg-surface border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin" size={14} />
                  <span>Thinking...</span>
                </div>
                <TypingIndicator />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border/50 bg-gradient-to-t from-background to-background/80 backdrop-blur-md px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-end gap-3 bg-surface border border-border/50 rounded-2xl px-4 py-3 shadow-lg shadow-sm transition-all duration-200 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 focus-within:shadow-xl">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={hasNoKey ? "Enter API key in settings first..." : "Message Agent Web... (Shift+Enter for new line)"}
              disabled={isLoading || hasNoKey}
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm max-h-48 min-h-[24px] placeholder:text-muted-foreground/60 disabled:opacity-50 w-full leading-relaxed"
            />
            <div className="flex items-center gap-2 shrink-0">
              {input.trim() && !isLoading && (
                <div className="text-[10px] text-muted-foreground hidden sm:block">
                  {input.length} chars
                </div>
              )}
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim() || hasNoKey}
                size="icon"
                className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-accent" />
              AI-powered
            </span>
            <span className="opacity-50">•</span>
            <span>Press Enter to send</span>
            <span className="opacity-50">•</span>
            <span>Shift + Enter for new line</span>
          </div>
        </div>
      </div>

      <ToolApprovalModal
        pendingApproval={pendingApprovals[0] || null}
        onApprove={handleApproval}
        onClose={() => {
          if (pendingApprovals.length > 0) {
            removePendingApproval(pendingApprovals[0].id);
          }
        }}
      />
    </div>
  );
}
