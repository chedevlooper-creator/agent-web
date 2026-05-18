"use client";

import { WorkshopSidebar } from "@/components/layout/sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { MobileMenuButton } from "@/components/mobile-menu-button";
import { SettingsPanel } from "@/components/settings-panel";
import { useChatStore, useActiveMessages } from "@/lib/store";
import { useMemo } from "react";
import { ShareButton } from "@/components/share-button";

export default function Home() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
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
            <MobileMenuButton />
            <div className="wk-crumb">
              <span className="hidden sm:inline">agent-web</span>
              <span className="wk-crumb-sep hidden sm:inline">/</span>
              <span className="hidden sm:inline">sohbet</span>
              <span className="wk-crumb-sep hidden sm:inline">/</span>
              <span className="wk-crumb-curr max-w-[100px] sm:max-w-none">
                {lastUserMsg
                  ? lastUserMsg.slice(0, 50) + (lastUserMsg.length > 50 ? "…" : "")
                  : "yeni sohbet"}
              </span>
            </div>
          </div>
          <div className="wk-top-right">
            <button className="wk-iconbtn hidden sm:flex" title="Dallandır">⌥</button>
            <ShareButton />
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
