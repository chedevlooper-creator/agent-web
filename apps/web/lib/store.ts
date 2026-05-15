import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: any[];
  toolResults?: any[];
  timestamp?: string;
}

export interface SessionItem {
  id: string;
  title: string;
  model: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  pinned?: boolean;
  tags?: string[];
}

export interface ToolInfo {
  name: string;
  description: string;
  toolset: string;
  enabled: boolean;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  content?: string;
  category: string;
  version: string;
  usageCount: number;
  enabled: boolean;
  trustLevel: string;
}

export interface SubagentItem {
  id: string;
  goal: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  model?: string;
  provider?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CronJobItem {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  result?: string;
}

export interface ToolCallEntry {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "running" | "success" | "error";
  duration?: number;
  startTime?: number;
}

export interface PendingApproval {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  isDangerous: boolean;
  reason?: string;
}

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  currentSessionId: string | null;
  sessions: SessionItem[];
  sidebarCollapsed: boolean;

  toolsets: Record<string, boolean>;
  tools: ToolInfo[];

  memoryMd: string;
  userMd: string;
  memoryUsage: number;
  memoryLimit: number;
  userMdUsage: number;
  userMdLimit: number;

  skills: SkillInfo[];

  subagents: SubagentItem[];

  cronJobs: CronJobItem[];

  contextPanelOpen: boolean;
  contextPanelTab: string;
  showShortcuts: boolean;
  shortcutOverrides: Record<string, string[]>;

  streamingTokens: number;
  streamingStart: number | null;

  toolExecutions: ToolCallEntry[];
  pendingApprovals: PendingApproval[];

  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setLoading: (v: boolean) => void;
  setConfig: (c: Partial<Pick<ChatStore, "provider" | "model" | "apiKey" | "baseUrl">>) => void;
  clearMessages: () => void;
  setCurrentSession: (id: string | null) => void;
  setSessions: (sessions: SessionItem[]) => void;
  updateSessionTitle: (id: string, title: string) => void;
  toggleSidebar: () => void;

  setTools: (tools: ToolInfo[]) => void;
  setToolsets: (toolsets: Record<string, boolean>) => void;
  toggleToolset: (toolset: string) => void;
  toggleTool: (name: string) => void;
  setMemoryData: (data: { memoryMd: string; userMd: string; memoryUsage: number; userMdUsage: number }) => void;
  setSkills: (skills: SkillInfo[]) => void;
  setSubagents: (subagents: SubagentItem[]) => void;
  setCronJobs: (jobs: CronJobItem[]) => void;
  setContextPanelOpen: (open: boolean) => void;
  setContextPanelTab: (tab: string) => void;
  setShowShortcuts: (open: boolean) => void;
  updateShortcut: (id: string, keys: string[]) => void;
  resetShortcut: (id: string) => void;
  setStreamingTokens: (count: number) => void;
  startStreaming: () => void;
  stopStreaming: () => void;

  addToolExecution: (tool: ToolCallEntry) => void;
  updateToolExecution: (id: string, updates: Partial<ToolCallEntry>) => void;
  removeToolExecution: (id: string) => void;
  clearToolExecutions: () => void;

  addPendingApproval: (approval: PendingApproval) => void;
  removePendingApproval: (id: string) => void;
  clearPendingApprovals: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      isLoading: false,
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      baseUrl: "",
      apiKey: "", // Deprecated: API keys should be managed server-side via environment variables
      currentSessionId: null,
      sessions: [],
      sidebarCollapsed: false,

      toolsets: {
        terminal: true,
        file: true,
        web: true,
        code_execution: true,
        browser: true,
        vision: true,
        todo: true,
        memory: true,
        delegate: true,
      },
      tools: [],

      memoryMd: "",
      userMd: "",
      memoryUsage: 0,
      memoryLimit: 2200,
      userMdUsage: 0,
      userMdLimit: 1375,

      skills: [],
      subagents: [],
      cronJobs: [],

      contextPanelOpen: false,
      contextPanelTab: "tools",
      showShortcuts: false,
      shortcutOverrides: {},

      streamingTokens: 0,
      streamingStart: null,

      toolExecutions: [],
      pendingApprovals: [],

      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      setMessages: (msgs) => set({ messages: msgs }),
      setLoading: (v) => set({ isLoading: v }),
      setConfig: (c) => set((s) => ({ ...s, ...c })),
      clearMessages: () => set({ messages: [], currentSessionId: null }),
      setCurrentSession: (id) => set({ currentSessionId: id }),
      setSessions: (sessions) => set({ sessions }),
      updateSessionTitle: (id, title) =>
        set((s) => ({
          sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, title } : sess)),
        })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setTools: (tools) => set({ tools }),
      setToolsets: (toolsets) => set({ toolsets }),
      toggleToolset: (toolset) =>
        set((s) => ({
          toolsets: { ...s.toolsets, [toolset]: !s.toolsets[toolset] },
        })),
      toggleTool: (name) =>
        set((s) => ({
          tools: s.tools.map((t) => (t.name === name ? { ...t, enabled: !t.enabled } : t)),
        })),
      setMemoryData: (data) => set(data),
      setSkills: (skills) => set({ skills }),
      setSubagents: (subagents) => set({ subagents }),
      setCronJobs: (cronJobs) => set({ cronJobs }),
      setContextPanelOpen: (contextPanelOpen) => set({ contextPanelOpen }),
      setContextPanelTab: (contextPanelTab) => set({ contextPanelTab }),
      setShowShortcuts: (showShortcuts) => set({ showShortcuts }),
      updateShortcut: (id, keys) =>
        set((s) => ({
          shortcutOverrides: { ...s.shortcutOverrides, [id]: keys },
        })),
      resetShortcut: (id) =>
        set((s) => {
          const next = { ...s.shortcutOverrides };
          delete next[id];
          return { shortcutOverrides: next };
        }),
      setStreamingTokens: (streamingTokens) => set({ streamingTokens }),
      startStreaming: () => set({ streamingTokens: 0, streamingStart: Date.now() }),
      stopStreaming: () => set({ streamingTokens: 0, streamingStart: null }),

      addToolExecution: (tool) =>
        set((s) => ({ toolExecutions: [...s.toolExecutions, tool] })),
      updateToolExecution: (id, updates) =>
        set((s) => ({
          toolExecutions: s.toolExecutions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      removeToolExecution: (id) =>
        set((s) => ({ toolExecutions: s.toolExecutions.filter((t) => t.id !== id) })),
      clearToolExecutions: () => set({ toolExecutions: [] }),

      addPendingApproval: (approval) =>
        set((s) => ({ pendingApprovals: [...s.pendingApprovals, approval] })),
      removePendingApproval: (id) =>
        set((s) => ({ pendingApprovals: s.pendingApprovals.filter((a) => a.id !== id) })),
      clearPendingApprovals: () => set({ pendingApprovals: [] }),
    }),
    {
      name: "agent-web-settings",
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as Partial<ChatStore>;
        if (version < 2) {
          if (s.provider === "9router") {
            return {
              ...s,
              model: "openai/gpt-4o-mini",
              baseUrl: "",
            };
          }
        }
        return s;
      },
      partialize: (state) => ({
        provider: state.provider,
        model: state.model,
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        toolsets: state.toolsets,
        contextPanelOpen: state.contextPanelOpen,
        contextPanelTab: state.contextPanelTab,
        shortcutOverrides: state.shortcutOverrides,
      }),
    }
  )
);
