"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { SettingsPanel } from "@/components/settings-panel";
import { useChatStore } from "@/lib/store";
import { PanelLeft } from "lucide-react";
import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { sidebarOpen, toggleSidebar } = useChatStore();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="flex h-dvh overflow-hidden bg-[var(--background)]">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-[var(--muted-foreground)] text-sm">
            Loading...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
          {/* Left: sidebar toggle (visible when collapsed) */}
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] animate-fade-in"
              aria-label="Open sidebar"
            >
              <PanelLeft size={18} />
            </button>
          )}
          <div className="flex-1" />
          {/* Right: settings */}
          <SettingsPanel />
        </header>

        {/* Chat */}
        <div id="main-content" className="flex-1 min-h-0">
          <ChatInterface />
        </div>
      </div>
    </main>
  );
}
