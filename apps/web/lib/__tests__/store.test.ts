import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, genId } from "../store";

// Reset store before each test
beforeEach(() => {
  useChatStore.setState({
    sessions: [],
    activeSessionId: null,
    hydrated: true,
    syncing: false,
    isLoading: false,
    sidebarOpen: true,
    contextPanelOpen: false,
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    apiKey: "sk-test",
    selectedModels: [],
    compareMode: false,
  });
});

describe("genId", () => {
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => genId()));
    expect(ids.size).toBe(100);
  });

  it("returns non-empty string", () => {
    expect(genId().length).toBeGreaterThan(0);
  });
});

describe("useChatStore — sessions", () => {
  it("starts with empty sessions", () => {
    const { sessions } = useChatStore.getState();
    expect(sessions).toEqual([]);
  });

  it("sets active session", () => {
    useChatStore.setState({
      sessions: [
        { id: "s1", title: "Chat 1", messages: [], createdAt: 1, updatedAt: 1 },
      ],
    });
    useChatStore.getState().setActiveSession("s1");
    expect(useChatStore.getState().activeSessionId).toBe("s1");
  });

  it("toggles sidebar", () => {
    const initial = useChatStore.getState().sidebarOpen;
    useChatStore.getState().toggleSidebar();
    expect(useChatStore.getState().sidebarOpen).toBe(!initial);
  });

  it("toggles compare mode", () => {
    useChatStore.getState().setSelectedModels(["m1", "m2"]);
    expect(useChatStore.getState().compareMode).toBe(true);
    expect(useChatStore.getState().selectedModels).toEqual(["m1", "m2"]);
  });

  it("caps selectedModels at 2", () => {
    useChatStore.getState().setSelectedModels(["m1", "m2", "m3"]);
    expect(useChatStore.getState().selectedModels).toHaveLength(2);
  });
});

describe("useChatStore — local messages", () => {
  it("appendLocalMessage adds message to active session", () => {
    useChatStore.setState({
      sessions: [
        { id: "s1", title: "Chat", messages: [], createdAt: 1, updatedAt: 1 },
      ],
      activeSessionId: "s1",
    });
    const msg = { id: "m1", role: "user" as const, content: "hi", timestamp: Date.now() };
    useChatStore.getState().appendLocalMessage(msg);
    const session = useChatStore.getState().sessions.find((s) => s.id === "s1");
    expect(session?.messages).toHaveLength(1);
    expect(session?.messages[0].content).toBe("hi");
  });

  it("patchLocalMessage updates content via requestAnimationFrame", async () => {
    useChatStore.setState({
      sessions: [
        {
          id: "s1",
          title: "Chat",
          messages: [
            { id: "m1", role: "assistant" as const, content: "old", timestamp: Date.now() },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeSessionId: "s1",
    });
    useChatStore.getState().patchLocalMessage("m1", "new");
    // patchLocalMessage batches via requestAnimationFrame
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        const session = useChatStore.getState().sessions.find((s) => s.id === "s1");
        expect(session?.messages[0].content).toBe("new");
        resolve();
      });
    });
  });

  it("setConfig updates multiple settings", () => {
    useChatStore.getState().setConfig({ provider: "openai", model: "gpt-4" });
    const state = useChatStore.getState();
    expect(state.provider).toBe("openai");
    expect(state.model).toBe("gpt-4");
  });
});
