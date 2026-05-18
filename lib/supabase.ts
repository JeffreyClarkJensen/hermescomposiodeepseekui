// Supabase not used in this deployment — types only
export const supabase = null as any;

// ── database helpers ──

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  thread_id?: string;
};

export type MemoryThread = {
  id: string;
  title: string;
  preview: string;
  tag?: string;
  created_at: string;
  updated_at: string;
};

export type Tool = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  last_used?: string;
  call_count: number;
};

export type Contact = {
  id: string;
  name: string;
  company?: string;
  stage: 'new' | 'contacted' | 'qualified' | 'proposal' | 'closed';
  value?: number;
  notes?: string;
  created_at: string;
};

export type LogEntry = {
  id: string;
  type: 'tool_call' | 'memory_write' | 'agent_step' | 'error';
  summary: string;
  detail?: string;
  created_at: string;
};
