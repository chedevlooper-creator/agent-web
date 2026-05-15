"use client";

import { useEffect } from "react";
import { useChatStore } from "@/lib/store";
import { getShortcutKeys, matchAnyShortcut } from "@/lib/shortcuts-config";
import { SessionSidebar } from "@/components/session-sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { SettingsPanel } from "@/components/settings-panel";
import { ContextPanel } from "@/components/context-panel";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { PanelLeft, Bot, PanelRight, Sparkles } from "lucide-react";

export default function Home() {
  const { sidebarCollapsed, toggleSidebar, contextPanelOpen, showShortcuts, setShowShortcuts, setConfig, setContextPanelOpen } = useChatStore();

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.ninerouter?.keyConfigured) {
          setConfig({
            provider: "9router",
            baseUrl: data.ninerouter.baseUrl,
            model: "ag/gemini-3-flash",
          });
        }
      })
      .catch(() => {});
  }, [setConfig]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useChatStore.getState();
      const isInputting = e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;

      // Toggle shortcuts help
      if (
        matchAnyShortcut(e, getShortcutKeys("toggle-shortcuts", state.shortcutOverrides)) &&
        !isInputting
      ) {
        e.preventDefault();
        state.setShowShortcuts(!state.showShortcuts);
        return;
      }

      // Esc : close shortcuts help (if open)
      if (state.showShortcuts && matchAnyShortcut(e, getShortcutKeys("close-shortcuts", state.shortcutOverrides))) {
        e.preventDefault();
        state.setShowShortcuts(false);
        return;
      }

      // Toggle context panel
      if (
        matchAnyShortcut(e, getShortcutKeys("toggle-context-panel", state.shortcutOverrides)) &&
        !isInputting
      ) {
        e.preventDefault();
        state.setContextPanelOpen(!state.contextPanelOpen);
        return;
      }

      // Toggle settings panel
      if (
        matchAnyShortcut(e, getShortcutKeys("toggle-settings", state.shortcutOverrides)) &&
        !isInputting
      ) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("toggle-settings"));
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []); // Empty deps: handler reads fresh state via getState()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <SessionSidebar />

      <div className="flex flex-col flex-1 min-w-0 transition-all duration-300">
        <header className="h-14 border-b flex items-center justify-between px-4 shrink-0 bg-background/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-surface-muted transition-all duration-200"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft size={18} className="text-muted-foreground" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="bg-gradient-to-br from-primary to-accent p-2 rounded-xl shadow-lg shadow-primary/20">
                  <Bot size={18} className="text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-background" />
              </div>
              <div className="flex flex-col">
                <h1 className="font-semibold text-sm tracking-tight leading-none">Agent Web</h1>
                <span className="text-[10px] text-muted-foreground mt-0.5">AI Assistant</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-muted text-xs text-muted-foreground mr-1">
              <Sparkles size={12} className="text-accent" />
              <span>Pro Mode</span>
            </div>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-xl transition-all duration-200 ${
                contextPanelOpen
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "hover:bg-surface-muted text-muted-foreground"
              }`}
              onClick={() => setContextPanelOpen(!contextPanelOpen)}
              title="Toggle context panel (Ctrl+B)"
            >
              <PanelRight size={16} />
            </Button>
            <SettingsPanel />
          </div>
        </header>

        <main className="flex-1 min-h-0">
          <ChatInterface />
        </main>
      </div>

      <ContextPanel />
      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
