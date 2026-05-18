import { create } from 'zustand';
import type { Message, LogEntry } from './supabase';

interface AppState {
  // chat
  messages: Message[];
  isThinking: boolean;
  streamingId: string | null;
  addMessage: (m: Message) => void;
  setThinking: (v: boolean) => void;
  clearMessages: () => void;
  appendToLastMessage: (token: string) => void;
  setStreamingId: (id: string | null) => void;

  // logs drawer
  logsOpen: boolean;
  logs: LogEntry[];
  setLogsOpen: (v: boolean) => void;
  addLog: (l: LogEntry) => void;

  // voice
  isRecording: boolean;
  setRecording: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  messages: [],
  isThinking: false,
  streamingId: null,
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setThinking: (v) => set({ isThinking: v }),
  clearMessages: () => set({ messages: [] }),
  appendToLastMessage: (token) =>
    set((s) => {
      if (!s.messages.length) return s;
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      msgs[msgs.length - 1] = { ...last, content: last.content + token };
      return { messages: msgs };
    }),
  setStreamingId: (id) => set({ streamingId: id }),

  logsOpen: false,
  logs: [],
  setLogsOpen: (v) => set({ logsOpen: v }),
  addLog: (l) => set((s) => ({ logs: [l, ...s.logs].slice(0, 100) })),

  isRecording: false,
  setRecording: (v) => set({ isRecording: v }),
}));
