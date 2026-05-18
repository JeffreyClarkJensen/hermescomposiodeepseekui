const HERMES_URL = process.env.EXPO_PUBLIC_HERMES_URL ?? 'http://localhost:8642';
const HERMES_API_KEY = process.env.EXPO_PUBLIC_HERMES_API_KEY ?? '';

const SYSTEM_PROMPT = 'You are a helpful AI assistant. Respond in plain conversational text only — no markdown, no bullet points, no bold or italic formatting, no headers. Just natural prose.';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function sendMessageStream(
  messages: ChatMessage[],
  onChunk: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${HERMES_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HERMES_API_KEY ? { Authorization: `Bearer ${HERMES_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: process.env.EXPO_PUBLIC_HERMES_MODEL ?? 'deepseek-v4-flash',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });
  } catch (e: any) {
    onError(new Error(`Network error: ${e.message}`));
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    onError(new Error(`Hermes ${res.status}: ${body}`));
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) { onError(new Error('No response body')); return; }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { onDone(); return; }
        try {
          const chunk = JSON.parse(data);
          const token = chunk.choices?.[0]?.delta?.content ?? '';
          if (token) onChunk(token);
        } catch {
          // malformed chunk — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  onDone();
}
