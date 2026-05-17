const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY ?? '';
const MODEL = 'claude-sonnet-4-6';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function sendMessage(
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt ?? SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

const SYSTEM_PROMPT = `You are Jarvis, a personal knowledge management agent.
You have access to the user's memory, tools, and CRM data.
Be concise, direct, and smart. When you perform an action (write to memory, call a tool, update CRM), say so briefly.
Format key facts as bullet points. Keep replies under 150 words unless detail is needed.`;
