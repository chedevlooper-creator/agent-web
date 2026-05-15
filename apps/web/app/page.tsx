"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { SettingsPanel } from "@/components/settings-panel";
import { useChatStore } from "@/lib/store";
import { PanelLeft } from "lucide-react";

export default function Home() {
  const { sidebarOpen, toggleSidebar } = useChatStore();

  return (
    <main className="signal-shell">
      <div className="signal-frame">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 relative bg-[var(--background)]">
          <header className="signal-topbar">
            <span className="signal-topbar-label select-none">Agent Web</span>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSidebar}
                className="signal-button"
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                <PanelLeft size={12} />
                <span className="hidden sm:inline">Toggle Sidebar</span>
              </button>
              <SettingsPanel />
            </div>
          </header>

          <div id="main-content" className="flex-1 min-h-0">
            <ChatInterface />
          </div>
        </div>
      </div>
    </main>
  );
}
