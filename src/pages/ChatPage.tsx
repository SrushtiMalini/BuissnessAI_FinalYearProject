import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Bot, User, Trash2, Upload } from 'lucide-react';
import { storage } from '../lib/storage';
import { buildReportContext } from '../lib/reportGenerator';
import { callAI } from '../lib/aiClient';
import { Button, Card, EmptyState } from '../design-system/components';
import type { ChatMessage } from '../types';

const SUGGESTED = [
  'Which is my most profitable dish?',
  'What was my best day this week?',
  'Which dishes should I remove from the menu?',
  'How can I reduce food wastage?',
  'What is my average food cost percentage?',
  'Which meal period brings the most revenue?',
];

export default function ChatPage() {
  const billing = storage.getBilling();
  const menu = storage.getMenu();
  const restaurant = storage.getRestaurant();
  const [messages, setMessages] = useState<ChatMessage[]>(() => storage.getChat());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data yet"
          description="Upload billing data to chat with your AI analyst."
          action={<Link to="/upload"><Button>Upload Data</Button></Link>}
        />
      </div>
    );
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toISOString() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    storage.appendChat(userMsg);
    setInput('');
    setLoading(true);

    const context = buildReportContext(billing, menu);
    const systemPrompt = `You are a smart, friendly AI business analyst for "${restaurant?.name ?? 'this restaurant'}". You have access to the restaurant's actual business data below. Answer questions specifically using that data — give concrete numbers, specific dish names, and actionable advice. Keep answers concise (3-5 sentences max). Be warm but direct, like a trusted advisor.\n\nDATA:\n${context}`;

    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...updated.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const result = await callAI('/api/ai/chat', { context: systemPrompt, messages: aiMessages });

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: result.error ? `Sorry, I couldn't connect to the AI: ${result.error}` : result.text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    storage.appendChat(assistantMsg);
    setLoading(false);
  }

  function clearChat() {
    storage.clearChat();
    setMessages([]);
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 5rem)' }}>
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text-primary)]">AI Analyst</h1>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-0.5">
            Ask anything about {restaurant?.name ?? 'your restaurant'}'s data
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat}>
            <Trash2 size={13} /> Clear
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto mb-4 min-h-0 bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-lg)] p-5">
        {messages.length === 0 && (
          <div>
            <div className="flex items-start gap-3 mb-6">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-info-light)' }}>
                <Bot size={16} style={{ color: 'var(--color-unity)' }} />
              </div>
              <div className="bg-[var(--color-bg-primary)] rounded-[var(--radius-lg)] rounded-tl-sm px-4 py-3 max-w-lg">
                <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  Hi! I'm your AI business analyst. I have access to all of {restaurant?.name ?? 'your restaurant'}'s data.
                  Ask me anything — which dishes make the most profit, why revenue dropped last week, what to prepare tomorrow, or anything else.
                </p>
              </div>
            </div>
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-[var(--text-xs)] bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] px-3 py-1.5 rounded-full hover:border-[var(--color-unity)] hover:text-[var(--color-unity)] transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-[var(--color-info-light)]' : 'bg-[var(--color-bg-secondary)]'
              }`}>
                {msg.role === 'user'
                  ? <User size={15} style={{ color: 'var(--color-unity)' }} />
                  : <Bot size={15} style={{ color: 'var(--color-text-muted)' }} />}
              </div>
              <div className={`rounded-[var(--radius-lg)] px-4 py-3 max-w-lg text-[var(--text-sm)] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--color-unity)] text-[var(--color-text-inverse)] rounded-tr-sm'
                  : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[var(--color-bg-secondary)]">
                <Bot size={15} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <div className="bg-[var(--color-bg-primary)] rounded-[var(--radius-lg)] rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full animate-bounce bg-[var(--color-text-muted)]"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="Ask anything about your business..."
          disabled={loading}
          className="flex-1 bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-xl)] px-4 py-3 text-[var(--text-sm)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] placeholder:text-[var(--color-text-muted)] transition-colors"
        />
        <Button onClick={() => sendMessage(input)} disabled={!input.trim()} loading={loading} className="shrink-0">
          <Send size={15} />
        </Button>
      </div>
    </div>
  );
}
