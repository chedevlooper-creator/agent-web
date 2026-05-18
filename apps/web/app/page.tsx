"use client";

import { WorkshopSidebar } from "@/components/layout/sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { SettingsPanel } from "@/components/settings-panel";
import { useChatStore, useActiveMessages } from "@/lib/store";
import { useMemo } from "react";

export default function Home() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const messages = useActiveMessages();

  const lastUserMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content;
    }
    return null;
  }, [messages]);

  return (
    <main className="wk-app">
      {sidebarOpen && (
        <div
          className="wk-sidebar-overlay md:hidden"
          onClick={toggleSidebar}
        />
      )}
      <WorkshopSidebar />

      <div className="wk-main">
        {/* Top bar */}
        <header className="wk-top">
          <div className="wk-top-left">
            <div className="wk-crumb">
              <span>agent-web</span>
              <span className="wk-crumb-sep">/</span>
              <span>sohbet</span>
              <span className="wk-crumb-sep">/</span>
              <span className="wk-crumb-curr">
                {lastUserMsg
                  ? lastUserMsg.slice(0, 50) + (lastUserMsg.length > 50 ? "…" : "")
                  : "yeni sohbet"}
              </span>
            </div>
          </div>
          <div className="wk-top-right">
            <button className="wk-model">
              <span className="wk-model-led" />
              <span>{provider} · {model}</span>
              <span style={{ opacity: 0.5 }}>▾</span>
            </button>
            <button className="wk-iconbtn" title="Dallandır">⌥</button>
            <button className="wk-iconbtn" title="Paylaş">↗</button>
            <SettingsPanel />
          </div>
        </header>

        {/* Main chat area */}
        <div id="main-content" className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <ChatInterface />
        </div>
      </div>
    </main>
  );
}
