import { create } from "zustand";

// ===== Types =====
export interface ToolCallInfo {
  id: string;
  name: string;
  args: string;
  result?: string;
}

// Used by ToolCallBubble component
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: "pending" | "running" | "done";
  args: Record<string, unknown>;
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  timestamp: number;
  parentId?: string | null;
  branchRootId?: string | null;
  toolCalls?: ToolCallInfo[];
  displayContent?: string;
}

export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  projectId?: string | null;
  branchId?: string | null;
}

export interface DbProject {
  id: string;
  name: string;
  rootPath: string;
  createdAt: number;
  updatedAt: number;
}

// ===== Chat Store =====
interface ChatStore {
  // Projects
  projects: DbProject[];
  activeProjectId: string | null;

  // Sessions
  sessions: Session[];
  activeSessionId: string | null;
  hydrated: boolean;

  // UI State
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  isLoading: boolean;
  syncing: boolean;
  currentUser: { id: string; username: string } | null;

  // Skills
  selectedSkills: string[];

  // Settings
  provider: string;
  model: string;
  /** Truthy if an API key is available (from server DB or transient input). Not persisted to localStorage. */
  apiKey: string;
  hasApiKey: boolean;
  serverProviders: Record<string, boolean>;
  selectedModels: string[]; // for A/B comparison, max 2
  compareMode: boolean;

  // Skills
  skills: { name: string; description: string; path: string }[];
  enabledSkills: string[];

  // Hydration
  hydrate: () => Promise<void>;
  setCurrentUser: (user: { id: string; username: string } | null) => void;

  // Projects
  createProject: (name: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;
  renameProject: (id: string, name: string) => Promise<void>;

  // Sessions
  createSession: () => Promise<string>;
  deleteSession: (id: string) => Promise<void>;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, title: string) => Promise<void>;

  // Messages
  addMessage: (msg: ChatMessage) => Promise<void>;
  updateMessage: (id: string, content: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  truncateAfter: (timestamp: number, inclusive?: boolean) => Promise<void>;
  clearMessages: () => Promise<void>;

  // Local-only (no DB sync) helpers for streaming
  appendLocalMessage: (msg: ChatMessage) => void;
  patchLocalMessage: (id: string, content: string) => void;

  // UI
  commandPrefill: string | null;
  setCommandPrefill: (val: string | null) => void;
  directSend: string | null;
  setDirectSend: (val: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setContextPanelOpen: (open: boolean) => void;
  toggleContextPanel: () => void;
  setLoading: (v: boolean) => void;
  setSyncing: (v: boolean) => void;

  // Settings
  setConfig: (c: Partial<Pick<ChatStore, "provider" | "model" | "apiKey">>) => void;
  checkApiKeyStatus: () => Promise<void>;
  setSelectedModels: (models: string[]) => void;
  toggleSelectedModel: (model: string) => void;
  setCompareMode: (v: boolean) => void;

  // Skills
  fetchSkills: () => Promise<void>;
  toggleSkill: (name: string) => void;

  // API Keys
  saveKey: (provider: string, key: string) => Promise<void>;
  deleteKey: (provider: string) => Promise<void>;

  // Import/Export
  importFromJson: (json: string) => Promise<{ sessions: number; messages: number }>;

  // Branching
  branchFrom: (sessionId: string, messageId: string, content: string) => Promise<string>;

  // Obsidian Sync
  obsidianVaultPath: string | null;
  obsidianAutoSync: boolean;
  setObsidianVaultPath: (path: string | null) => void;
  setObsidianAutoSync: (enabled: boolean) => void;
  syncSessionToObsidian: (sessionId: string) => Promise<void>;
}

export function genId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

async function apiFetch(input: string, init?: RequestInit) {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const useChatStore = create<ChatStore>()((set, get) => ({
      projects: [],
      activeProjectId: null,
      sessions: [],
      activeSessionId: null,
      hydrated: false,
      sidebarOpen: true,
      contextPanelOpen: false,
      isLoading: false,
      syncing: false,
      currentUser: null,
      selectedSkills: [],
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      apiKey: "",
      hasApiKey: false,
      serverProviders: {},
      selectedModels: [],
      compareMode: false,
      skills: [],
      enabledSkills: [],
      commandPrefill: null,
      directSend: null,
      obsidianVaultPath: null,
      obsidianAutoSync: false,

      hydrate: async () => {
        try {
          const { sessions } = (await apiFetch("/api/sessions")) as {
            sessions: { id: string; title: string; createdAt: number; updatedAt: number; branchId: string | null }[];
          };
          const enriched: Session[] = sessions.map((s) => ({
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            branchId: s.branchId,
            messages: [],
          }));
          const activeId = get().activeSessionId || enriched[0]?.id || null;
          set({
            sessions: enriched,
            activeSessionId: activeId,
            hydrated: true,
          });
          if (activeId) {
            await loadSessionMessages(activeId);
          }
        } catch (e) {
          console.error("Failed to hydrate:", e);
          set({ hydrated: true });
        }
      },

    // ===== Project actions =====
    createProject: async (name: string) => {
        set({ syncing: true });
        try {
          const { project } = (await apiFetch("/api/projects", {
            method: "POST",
            body: JSON.stringify({ name }),
          })) as { project: DbProject };
          set((s) => ({
            projects: [project, ...s.projects],
            activeProjectId: project.id,
            syncing: false,
          }));
          return project.id;
        } catch (e) {
          console.error("Failed to create project:", e);
          set({ syncing: false });
          throw e;
        }
      },

      deleteProject: async (id: string) => {
        const deletedProject = get().projects.find((p) => p.id === id);
        const prevActiveProjectId = get().activeProjectId;
        const prevSessions = get().sessions;
        const prevActiveSessionId = get().activeSessionId;
        set({ syncing: true });
        try {
          await apiFetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        } catch (e) {
          console.error("Failed to delete project, rolling back:", e);
          if (deletedProject) {
            set((s) => {
              if (s.projects.some((x) => x.id === id)) return {};
              return {
                projects: [deletedProject, ...s.projects],
                activeProjectId: prevActiveProjectId,
                sessions: prevSessions,
                activeSessionId: prevActiveSessionId,
              };
            });
          }
          set({ syncing: false });
          return;
        } finally {
          set({ syncing: false });
        }
        set((s) => {
          const projects = s.projects.filter((p) => p.id !== id);
          return {
            projects,
            activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
            sessions: s.activeProjectId === id ? [] : s.sessions,
            activeSessionId: s.activeProjectId === id ? null : s.activeSessionId,
          };
        });
        // Re-hydrate if switching to default
        const next = get().activeProjectId;
        if (!next) {
          get().hydrate().catch(() => {});
        }
      },

      setActiveProject: (id: string | null) => {
        set({ activeProjectId: id, sessions: [], activeSessionId: null });
        get().hydrate().catch(() => {});
      },

      renameProject: async (id: string, name: string) => {
        const prevName = get().projects.find((p) => p.id === id)?.name ?? name;
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          ),
        }));
        set({ syncing: true });
        try {
          await apiFetch("/api/projects", {
            method: "PATCH",
            body: JSON.stringify({ id, name }),
          });
        } catch (e) {
          console.error("Failed to rename project, rolling back:", e);
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === id ? { ...p, name: prevName } : p
            ),
          }));
        } finally {
          set({ syncing: false });
        }
      },

      // ===== Session actions =====
      createSession: async () => {
        const id = genId();
        const now = Date.now();
        const projectId = get().activeProjectId;
        set({ syncing: true });
        try {
          await apiFetch("/api/sessions", {
            method: "POST",
            body: JSON.stringify({ id, projectId, title: "New Chat" }),
          });
          const session: Session = {
            id,
            title: "New Chat",
            messages: [],
            createdAt: now,
            updatedAt: now,
          };
          set((s) => ({
            sessions: [session, ...s.sessions],
            activeSessionId: id,
          }));
          return id;
        } catch (e) {
          console.error("Failed to create session:", e);
          throw new Error("Failed to create session. Please try again.");
        } finally {
          set({ syncing: false });
        }
      },

      deleteSession: async (id) => {
        const deletedSession = get().sessions.find((s) => s.id === id);
        const prevActiveId = get().activeSessionId;
        set({ syncing: true });
        try {
          await apiFetch(`/api/sessions?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
        } catch (e) {
          console.error("Failed to delete session, rolling back:", e);
          // Restore the deleted session
          if (deletedSession) {
            set((s) => {
              if (s.sessions.some((x) => x.id === id)) return {};
              return {
                sessions: [deletedSession, ...s.sessions],
                activeSessionId: prevActiveId,
              };
            });
          }
          set({ syncing: false });
          return;
        } finally {
          set({ syncing: false });
        }
        set((s) => {
          const sessions = s.sessions.filter((ses) => ses.id !== id);
          const activeSessionId =
            s.activeSessionId === id
              ? sessions[0]?.id ?? null
              : s.activeSessionId;
          return { sessions, activeSessionId };
        });
        const next = get().activeSessionId;
        if (next) {
          loadSessionMessages(next).catch(() => {});
        }
        // Also delete the vault file on session deletion
        const { obsidianAutoSync, obsidianVaultPath } = get();
        if (obsidianVaultPath) {
          fetch(`/api/obsidian/sync?sessionId=${encodeURIComponent(id)}`, {
            method: "DELETE",
          }).catch(() => {});
        }
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id });
        loadSessionMessages(id).catch(() => {});
      },

      renameSession: async (id, title) => {
        const prevTitle = get().sessions.find((s) => s.id === id)?.title ?? title;
        set((s) => ({
          sessions: s.sessions.map((ses) =>
            ses.id === id ? { ...ses, title, updatedAt: Date.now() } : ses
          ),
        }));
        set({ syncing: true });
        try {
          await apiFetch("/api/sessions", {
            method: "PATCH",
            body: JSON.stringify({ id, title }),
          });
        } catch (e) {
          console.error("Failed to rename session, rolling back:", e);
          // Rollback: restore previous title
          set((s) => ({
            sessions: s.sessions.map((ses) =>
              ses.id === id ? { ...ses, title: prevTitle } : ses
            ),
          }));
        } finally {
          set({ syncing: false });
        }
        // Re-sync if title changed (file rename)
        get().syncSessionToObsidian(id).catch(() => {});
      },

      addMessage: async (msg) => {
        let sessionId = get().activeSessionId;
        if (!sessionId) {
          sessionId = await get().createSession();
        }
        const snap = snapshotSessions();
        // Optimistic local insert
        set((s) => ({
          sessions: s.sessions.map((ses) => {
            if (ses.id !== sessionId) return ses;
            const messages = [...ses.messages, msg];
            const title =
              ses.title === "New Chat" && msg.role === "user"
                ? msg.content.slice(0, 40) + (msg.content.length > 40 ? "..." : "")
                : ses.title;
            return { ...ses, messages, title, updatedAt: msg.timestamp };
          }),
        }));
        // Persist to DB
        set({ syncing: true });
        try {
          await apiFetch(
            `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
            {
              method: "POST",
              body: JSON.stringify({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                model: msg.model,
                timestamp: msg.timestamp,
              }),
            }
          );
          // If we renamed locally, persist the title
          const ses = get().sessions.find((x) => x.id === sessionId);
          if (ses && ses.title !== "New Chat") {
            await apiFetch("/api/sessions", {
              method: "PATCH",
              body: JSON.stringify({ id: sessionId, title: ses.title }),
            }).catch(() => {});
          }
        } catch (e) {
          console.error("Failed to persist message, rolling back:", e);
          rollbackSessions(snap);
        } finally {
          set({ syncing: false });
        }
        // Trigger Obsidian sync after successful persistence
        get().syncSessionToObsidian(sessionId).catch(() => {});
      },

      updateMessage: async (id, content) => {
        const sessionId = get().activeSessionId;
        if (!sessionId) return;
        const snap = snapshotSessions();
        set((s) => ({
          sessions: s.sessions.map((ses) => {
            if (ses.id !== sessionId) return ses;
            return {
              ...ses,
              messages: ses.messages.map((m) =>
                m.id === id ? { ...m, content } : m
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
        set({ syncing: true });
        try {
          await apiFetch(
            `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
            {
              method: "PATCH",
              body: JSON.stringify({ id, content }),
            }
          );
        } catch (e) {
          console.error("Failed to update message, rolling back:", e);
          rollbackSessions(snap);
        } finally {
          set({ syncing: false });
        }
      },

      deleteMessage: async (id) => {
        const sessionId = get().activeSessionId;
        if (!sessionId) return;
        const snap = snapshotSessions();
        set((s) => ({
          sessions: s.sessions.map((ses) => {
            if (ses.id !== sessionId) return ses;
            return {
              ...ses,
              messages: ses.messages.filter((m) => m.id !== id),
              updatedAt: Date.now(),
            };
          }),
        }));
        set({ syncing: true });
        try {
          await apiFetch(
            `/api/sessions/${encodeURIComponent(sessionId)}/messages?messageId=${encodeURIComponent(id)}`,
            { method: "DELETE" }
          );
        } catch (e) {
          console.error("Failed to delete message, rolling back:", e);
          rollbackSessions(snap);
        } finally {
          set({ syncing: false });
        }
      },

      truncateAfter: async (timestamp, inclusive = false) => {
        const sessionId = get().activeSessionId;
        if (!sessionId) return;
        const snap = snapshotSessions();
        set((s) => ({
          sessions: s.sessions.map((ses) => {
            if (ses.id !== sessionId) return ses;
            return {
              ...ses,
              messages: ses.messages.filter((m) =>
                inclusive ? m.timestamp < timestamp : m.timestamp <= timestamp
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
        set({ syncing: true });
        try {
          await apiFetch(
            `/api/sessions/${encodeURIComponent(sessionId)}/messages?afterTimestamp=${timestamp}&inclusive=${inclusive}`,
            { method: "DELETE" }
          );
        } catch (e) {
          console.error("Failed to truncate messages, rolling back:", e);
          rollbackSessions(snap);
        } finally {
          set({ syncing: false });
        }
      },

      clearMessages: async () => {
        const sessionId = get().activeSessionId;
        if (!sessionId) return;
        const snap = snapshotSessions();
        set((s) => ({
          sessions: s.sessions.map((ses) => {
            if (ses.id !== sessionId) return ses;
            return { ...ses, messages: [], title: "New Chat", updatedAt: Date.now() };
          }),
        }));
        set({ syncing: true });
        try {
          await apiFetch(
            `/api/sessions/${encodeURIComponent(sessionId)}/messages?clear=true`,
            { method: "DELETE" }
          );
          await apiFetch("/api/sessions", {
            method: "PATCH",
            body: JSON.stringify({ id: sessionId, title: "New Chat" }),
          });
        } catch (e) {
          console.error("Failed to clear messages, rolling back:", e);
          rollbackSessions(snap);
        } finally {
          set({ syncing: false });
        }
      },

      appendLocalMessage: (msg) =>
        set((s) => ({
          sessions: s.sessions.map((ses) => {
            if (ses.id !== s.activeSessionId) return ses;
            return {
              ...ses,
              messages: [...ses.messages, msg],
              updatedAt: msg.timestamp,
            };
          }),
        })),

      patchLocalMessage: (id, content) => {
        // Batch streaming updates: coalesce multiple per-token calls into
        // a single React state write per animation frame to avoid 50+ re-renders/sec.
        const state = useChatStore.getState() as ChatStore & { _pendingPatches?: Map<string, string>; _patchRaf?: number };
        if (!state._pendingPatches) state._pendingPatches = new Map();
        state._pendingPatches.set(id, content);

        if (!state._patchRaf) {
          state._patchRaf = requestAnimationFrame(() => {
            const s2 = useChatStore.getState() as ChatStore & { _pendingPatches?: Map<string, string>; _patchRaf?: number };
            const patches = s2._pendingPatches;
            s2._pendingPatches = new Map();
            s2._patchRaf = undefined;
            if (!patches || patches.size === 0) return;
            set((s) => ({
              sessions: s.sessions.map((ses) => {
                if (ses.id !== s.activeSessionId) return ses;
                return {
                  ...ses,
                  messages: ses.messages.map((m) =>
                    patches.has(m.id) ? { ...m, content: patches.get(m.id)! } : m
                  ),
                };
              }),
            }));
          }) as unknown as number;
        }
      },

      setCommandPrefill: (val) => set({ commandPrefill: val }),
      setDirectSend: (val) => set({ directSend: val }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setContextPanelOpen: (open) => set({ contextPanelOpen: open }),
      toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),
      setLoading: (v) => set({ isLoading: v }),
      setSyncing: (v) => set({ syncing: v }),
      setCurrentUser: (user) => set({ currentUser: user }),

      setConfig: (c) => set((s) => ({ ...s, ...c })),

      checkApiKeyStatus: async () => {
        try {
          const data = (await apiFetch("/api/config/status")) as {
            providers: Record<string, boolean>;
          };
          const hasAny = Object.values(data.providers).some(Boolean);
          set({ serverProviders: data.providers, hasApiKey: hasAny });
        } catch {
          set({ serverProviders: {}, hasApiKey: false });
        }
      },

      setSelectedModels: (models) =>
        set({ selectedModels: models.slice(0, 2), compareMode: models.length > 1 }),

      toggleSelectedModel: (model) =>
        set((s) => {
          const exists = s.selectedModels.includes(model);
          let next: string[];
          if (exists) {
            next = s.selectedModels.filter((m) => m !== model);
          } else {
            if (s.selectedModels.length >= 2) {
              next = [s.selectedModels[1], model];
            } else {
              next = [...s.selectedModels, model];
            }
          }
          return { selectedModels: next, compareMode: next.length > 1 };
        }),

      setCompareMode: (v) =>
        set((s) => ({
          compareMode: v && s.selectedModels.length > 1,
        })),

      fetchSkills: async () => {
        try {
          const res = await fetch("/api/skills");
          const data = (await res.json()) as {
            name: string;
            description: string;
            path: string;
          }[];
          set({ skills: Array.isArray(data) ? data : [] });
        } catch {
          set({ skills: [] });
        }
      },

      toggleSkill: (name) =>
        set((s) => {
          const exists = s.enabledSkills.includes(name);
          return {
            enabledSkills: exists
              ? s.enabledSkills.filter((n) => n !== name)
              : [...s.enabledSkills, name],
          };
        }),

      saveKey: async (provider, key) => {
        try {
          await apiFetch("/api/keys", {
            method: "POST",
            body: JSON.stringify({ provider, key }),
          });
        } catch (e) {
          console.error("Failed to save API key:", e);
        }
      },

      deleteKey: async (provider) => {
        try {
          await apiFetch("/api/keys", {
            method: "DELETE",
            body: JSON.stringify({ provider }),
          });
        } catch (e) {
          console.error("Failed to delete API key:", e);
        }
      },

      importFromJson: async (json) => {
        const payload = JSON.parse(json);
        const result = (await apiFetch("/api/sessions/import", {
          method: "POST",
          body: JSON.stringify(payload),
        })) as { sessions: number; messages: number };
        await get().hydrate();
        return result;
      },

      branchFrom: async (sessionId, messageId, content) => {
        set({ syncing: true });
        try {
          const { session } = (await fetch(
            `/api/sessions/${encodeURIComponent(sessionId)}/branch?messageId=${encodeURIComponent(messageId)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            }
          ).then((r) => r.json())) as {
            session: {
              id: string;
              title: string;
              createdAt: number;
              updatedAt: number;
              branchId: string;
              projectId: string | null;
            };
          };

          const newSession: Session = {
            id: session.id,
            title: session.title,
            messages: [],
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            projectId: session.projectId,
            branchId: session.branchId,
          };

          set((s) => ({
            sessions: [newSession, ...s.sessions],
            activeSessionId: session.id,
          }));

          return session.id;
        } catch (e) {
          console.error("Failed to branch session:", e);
          throw e;
        } finally {
          set({ syncing: false });
        }
      },

      setObsidianVaultPath: (path) => set({ obsidianVaultPath: path }),
      setObsidianAutoSync: (enabled) => set({ obsidianAutoSync: enabled }),
      syncSessionToObsidian: async (_sessionId) => {
        // No-op by default; Obsidian sync is handled server-side
      },
  })
);

function snapshotSessions() {
  return useChatStore.getState().sessions;
}

export function rollbackSessions(snapshot: Session[]) {
  useChatStore.setState(() => ({
    sessions: snapshot,
  }));
}

async function loadSessionMessages(sessionId: string) {
  try {
    const { messages } = (await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages`
    ).then((r) => r.json())) as {
      messages: {
        id: string;
        role: "user" | "assistant" | "system";
        content: string;
        model: string | null;
        parentId: string | null;
        branchRootId: string | null;
        timestamp: number;
      }[];
    };
    useChatStore.setState((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === sessionId
          ? {
              ...ses,
              messages: messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                model: m.model ?? undefined,
                parentId: m.parentId,
                branchRootId: m.branchRootId,
                timestamp: m.timestamp,
              })),
            }
          : ses
      ),
    }));
  } catch (e) {
    console.error("Failed to load messages:", e);
  }
}

// Selectors
export const useActiveSession = () =>
  useChatStore((s) => s.sessions.find((ses) => ses.id === s.activeSessionId));

const EMPTY_MESSAGES: ChatMessage[] = [];

export const useActiveMessages = () =>
  useChatStore(
    (s) =>
      s.sessions.find((ses) => ses.id === s.activeSessionId)?.messages ?? EMPTY_MESSAGES
  );

export const useIsEmptySession = () =>
  useChatStore((s) => {
    const ses = s.sessions.find((ses) => ses.id === s.activeSessionId);
    return ses ? ses.messages.length === 0 : true;
  });

export const useMessageCount = () =>
  useChatStore((s) => {
    const ses = s.sessions.find((ses) => ses.id === s.activeSessionId);
    return ses ? ses.messages.length : 0;
  });
