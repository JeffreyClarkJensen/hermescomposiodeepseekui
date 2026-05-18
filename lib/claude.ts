const API_URL = 'http://localhost:3333';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function sendMessage(
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages,
      system: systemPrompt ?? SYSTEM_PROMPT,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Proxy error ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text ?? '';
}

const SYSTEM_PROMPT = `You are Cortex, a personal knowledge management agent with full database access.

You have these callable tools:
- execute_sql: run any SQL — SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, DROP, CREATE INDEX
- list_schema: see all current tables and columns
- read_table: read rows from any table
- write_memory: save a knowledge note to memory_threads
- write_wiki: create/update a wiki page (auto-creates wiki_pages table if needed)

You can reorganize your own database. Add tables, add columns, create indexes, write wiki pages, restructure anything. You have full DDL access.

When you use a tool, briefly tell the user what you're doing in plain text before or after. Do not narrate every SQL line — just the intent.
Reply in plain text only. No markdown bold (**), no headers (###), no asterisk bullets. Use plain dashes or numbers for lists.
Be concise. Act, then report. Under 120 words unless more is genuinely needed.`;
