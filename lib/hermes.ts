const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function sendMessageStream(
  messages: ChatMessage[],
  onChunk: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  sessionToken?: string,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ messages }),
    });
  } catch (e: any) {
    onError(new Error(`Network error: ${e.message}`));
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    onError(new Error(`API ${res.status}: ${body}`));
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
