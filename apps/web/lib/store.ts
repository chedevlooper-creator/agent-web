import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  provider: string;
  model: string;
  apiKey: string;
  addMessage: (msg: ChatMessage) => void;
  setLoading: (v: boolean) => void;
  setConfig: (c: Partial<Pick<ChatStore, "provider" | "model" | "apiKey">>) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      isLoading: false,
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      apiKey: "",
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      setLoading: (v) => set({ isLoading: v }),
      setConfig: (c) => set((s) => ({ ...s, ...c })),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: "agent-web-settings",
      partialize: (state) => ({
        provider: state.provider,
        model: state.model,
        apiKey: state.apiKey,
      }),
    }
  )
);
