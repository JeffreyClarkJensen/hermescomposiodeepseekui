import { create } from 'zustand';
import type { Message, LogEntry } from './supabase';

interface AppState {
  // chat
  messages: Message[];
  isThinking: boolean;
  addMessage: (m: Message) => void;
  setThinking: (v: boolean) => void;
  clearMessages: () => void;

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
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setThinking: (v) => set({ isThinking: v }),
  clearMessages: () => set({ messages: [] }),

  logsOpen: false,
  logs: [],
  setLogsOpen: (v) => set({ logsOpen: v }),
  addLog: (l) => set((s) => ({ logs: [l, ...s.logs].slice(0, 100) })),

  isRecording: false,
  setRecording: (v) => set({ isRecording: v }),
}));
