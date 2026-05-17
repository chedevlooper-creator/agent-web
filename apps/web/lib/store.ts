import { create } from "zustand";
import type { ChatMessageData, SessionData } from "@agent-web/core";

// ===== Types =====
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: string;
  state: "pending" | "result";
}

export interface ChatMessage extends ChatMessageData {
  displayContent?: string;
  toolInvocations?: ToolInvocation[];
}

export interface Session extends Omit<SessionData, "messages"> {
  messages: ChatMessage[];
  projectId?: string | null;
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

  // Skills
  selectedSkills: string[];
  toggleSkill: (name: string) => void;

  // Settings
  provider: string;
  model: string;
  /** Truthy if an API key is available (from server DB or transient input). Not persisted to localStorage. */
  apiKey: string;
  /** Providers that have keys stored on the server (loaded during hydrate). */
  savedProviders: string[];
  selectedModels: string[]; // for A/B comparison, max 2
  compareMode: boolean;

  // Hydration
  hydrate: () => Promise<void>;

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
  /** Save an API key to the server. Returns the key preview on success. */
  saveKey: (provider: string, key: string) => Promise<string | null>;
  /** Delete an API key from the server. */
  deleteKey: (provider: string) => Promise<void>;
  /** Load saved providers from the server. Called during hydrate. */
  loadApiKeysFromServer: () => Promise<void>;
  setSelectedModels: (models: string[]) => void;
  toggleSelectedModel: (model: string) => void;
  setCompareMode: (v: boolean) => void;

  // Import/Export
  importFromJson: (json: string) => Promise<{ sessions: number; messages: number }>;
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

/** Snapshot sessions for rollback on DB failure. Exported for testing. */
export function snapshotSessions() {
  return useChatStore.getState().sessions.map((s) => ({
    ...s,
    messages: [...s.messages],
  }));
}

/** Rollback sessions to a prior snapshot. Exported for testing. */
export function rollbackSessions(snapshot: ReturnType<typeof snapshotSessions>) {
  useChatStore.setState(() => ({
    sessions: snapshot,
  }));
}

export const useChatStore = create<ChatStore>()((set, get) => {
  const store: ChatStore = {
    projects: [],
    activeProjectId: null,
    sessions: [],
    activeSessionId: null,
    hydrated: false,

    selectedSkills: [],

    sidebarOpen: true,
    commandPrefill: null,
    directSend: null,
    contextPanelOpen: false,
    isLoading: false,
    syncing: false,

    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    apiKey: "",
    savedProviders: [],
    selectedModels: [],
    compareMode: false,

    hydrate: async () => {
      try {
        // Load projects first
        const { projects } = (await apiFetch("/api/projects")) as {
          projects: { id: string; name: string; rootPath: string; createdAt: number; updatedAt: number }[];
        };

        const projectId = get().activeProjectId;
        const { sessions } = (await apiFetch(`/api/sessions${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`)) as {
          sessions: { id: string; projectId?: string | null; title: string; createdAt: number; updatedAt: number }[];
        };
        const enriched: Session[] = [];
        for (const s of sessions) {
          enriched.push({
            id: s.id,
            projectId: s.projectId,
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            messages: [],
          });
        }
        const activeId = get().activeSessionId || enriched[0]?.id || null;
        set({
          projects,
          sessions: enriched,
          activeSessionId: activeId,
          hydrated: true,
        });
        if (activeId) {
          await loadSessionMessages(activeId);
        }

        // Load saved API keys from server (not localStorage)
        store.loadApiKeysFromServer().catch(() => {});
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

      toggleSkill: (name) =>
        set((s) => {
          const exists = s.selectedSkills.includes(name);
          return {
            selectedSkills: exists
              ? s.selectedSkills.filter((n) => n !== name)
              : [...s.selectedSkills, name],
          };
        }),

      setConfig: (c) => set((s) => ({ ...s, ...c })),

      loadApiKeysFromServer: async () => {
        try {
          const { keys } = (await apiFetch("/api/keys")) as {
            keys: { provider: string; keyPreview: string }[];
          };
          const providers = keys.map((k) => k.provider);
          const currentProvider = get().provider;
          const hasCurrent = providers.includes(currentProvider);
          set({
            savedProviders: providers,
            apiKey: hasCurrent ? "stored" : "",
          });
        } catch (e) {
          console.error("Failed to load API keys from server:", e);
        }
      },

      saveKey: async (provider: string, key: string) => {
        try {
          const res = (await apiFetch("/api/keys", {
            method: "POST",
            body: JSON.stringify({ provider, key }),
          })) as { success: boolean; keyPreview: string };
          const state = get();
          const curProvider = get().provider;
          set({
            savedProviders: state.savedProviders.includes(provider.toLowerCase())
              ? state.savedProviders
              : [...state.savedProviders, provider.toLowerCase()],
            apiKey: curProvider === provider.toLowerCase() || curProvider === provider ? "stored" : state.apiKey,
          });
          return res.keyPreview;
        } catch (e) {
          console.error("Failed to save API key:", e);
          return null;
        }
      },

      deleteKey: async (provider: string) => {
        try {
          await apiFetch("/api/keys", {
            method: "DELETE",
            body: JSON.stringify({ provider }),
          });
          const state = get();
          const normalized = provider.toLowerCase();
          set({
            savedProviders: state.savedProviders.filter((p) => p !== normalized),
            apiKey:
              (state.provider === normalized || state.provider === provider)
                ? ""
                : state.apiKey,
          });
        } catch (e) {
          console.error("Failed to delete API key:", e);
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

      importFromJson: async (json) => {
        const payload = JSON.parse(json);
        const result = (await apiFetch("/api/sessions/import", {
          method: "POST",
          body: JSON.stringify(payload),
        })) as { sessions: number; messages: number };
        await get().hydrate();
        return result;
      },
    };
    return store;
  });

// Persist only UI preferences to localStorage — all data lives in DB
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("agent-web-ui-prefs");
  if (saved) {
    try {
      const prefs = JSON.parse(saved);
      if (prefs.sidebarOpen !== undefined) useChatStore.setState({ sidebarOpen: prefs.sidebarOpen });
      if (prefs.provider) useChatStore.setState({ provider: prefs.provider });
      if (prefs.model) useChatStore.setState({ model: prefs.model });
      if (prefs.selectedModels) useChatStore.setState({ selectedModels: prefs.selectedModels });
      if (prefs.compareMode !== undefined) useChatStore.setState({ compareMode: prefs.compareMode });
      if (prefs.activeProjectId !== undefined) useChatStore.setState({ activeProjectId: prefs.activeProjectId });
      if (prefs.activeSessionId !== undefined) useChatStore.setState({ activeSessionId: prefs.activeSessionId });
      if (prefs.selectedSkills) useChatStore.setState({ selectedSkills: prefs.selectedSkills });
    } catch {
      // ignore corrupt prefs
    }
  }

  // Subscribe to state changes and persist only UI prefs
  let prevPrefs = "";
  const unsub = useChatStore.subscribe((state) => {
    const prefs = {
      sidebarOpen: state.sidebarOpen,
      provider: state.provider,
      model: state.model,
      selectedModels: state.selectedModels,
      compareMode: state.compareMode,
      activeProjectId: state.activeProjectId,
      activeSessionId: state.activeSessionId,
      selectedSkills: state.selectedSkills,
    };
    const json = JSON.stringify(prefs);
    if (json !== prevPrefs) {
      prevPrefs = json;
      localStorage.setItem("agent-web-ui-prefs", json);
    }
  });

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => unsub());
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
