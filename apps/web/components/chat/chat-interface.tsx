"use client";

import { useChatStore } from "@/lib/store";
import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Trash2, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";

function genId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

export function ChatInterface() {
  const { messages, isLoading, addMessage, setLoading, provider, model, apiKey, clearMessages } = useChatStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !apiKey) return;

    const userMsg = { id: genId(), role: "user" as const, content: input.trim() };
    addMessage(userMsg);
    setInput("");
    setLoading(true);

    const msgs = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, provider, model, apiKey }),
      });

      if (!res.ok || !res.body) throw new Error("Failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      const assistantId = genId();

      addMessage({ id: assistantId, role: "assistant", content: "" });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Vercel AI SDK data stream format:
          // 0: text delta
          // 3: error
          // 8: tool call
          // d: done
          if (trimmed.startsWith("0:")) {
            try {
              const text = JSON.parse(trimmed.slice(2));
              if (typeof text === "string") assistantText += text;
            } catch {}
          } else if (trimmed.startsWith('3:')) {
            try {
              const err = JSON.parse(trimmed.slice(2));
              assistantText += "\n\n[Error: " + (err || "Unknown error") + "]";
            } catch {
              assistantText += "\n\n[Error: " + trimmed.slice(2) + "]";
            }
          }
        }
        useChatStore.setState((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, content: assistantText } : m
          ),
        }));
      }
    } catch (e) {
      addMessage({ id: genId(), role: "assistant", content: "Error: " + (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [input, isLoading, apiKey, messages, provider, model, addMessage, setLoading]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bot size={24} /> Agent Web
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{provider}</Badge>
            <Badge variant="secondary">{model}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={clearMessages} title="Clear chat">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 border rounded-lg p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-20">
              Enter your API key below and start chatting.
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <Avatar className="h-8 w-8"><AvatarFallback><Bot size={16} /></AvatarFallback></Avatar>
              )}
              <Card className={`max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                <CardContent className="p-3 text-sm prose dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="bg-muted px-1 py-0.5 rounded text-xs" {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </CardContent>
              </Card>
              {msg.role === "user" && (
                <Avatar className="h-8 w-8"><AvatarFallback><User size={16} /></AvatarFallback></Avatar>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 items-center text-muted-foreground text-sm">
              <Loader2 className="animate-spin" size={16} /> Thinking...
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={apiKey ? "Type a message..." : "Enter API key in settings first"}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={isLoading || !apiKey}
        />
        <Button onClick={handleSend} disabled={isLoading || !input.trim() || !apiKey}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
