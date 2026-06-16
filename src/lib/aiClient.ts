export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  error?: string;
}

export async function callAI(
  endpoint: '/api/ai/report' | '/api/ai/chat',
  payload: { context: string; messages?: AIMessage[] }
): Promise<AIResponse> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { text: '', error: err.error ?? `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { text: data.text ?? '' };
  } catch (e: any) {
    return { text: '', error: e.message ?? 'Network error' };
  }
}
