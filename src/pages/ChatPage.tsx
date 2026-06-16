import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Bot, User, Trash2, Upload } from 'lucide-react';
import { storage } from '../lib/storage';
import { buildReportContext } from '../lib/reportGenerator';
import { callAI } from '../lib/aiClient';
import { Button, Card, PageHeader } from '../components/ui';
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
      <div className="max-w-lg mx-auto text-center py-20">
        <Upload size={48} className="text-gray-600 mx-auto mb-4" />
        <h2 className="text-white font-semibold text-xl mb-2">No data yet</h2>
        <p className="text-gray-400 mb-6">Upload billing data to chat with your AI analyst.</p>
        <Link to="/upload" className="bg-[#4ADE80] text-[#0D1117] px-5 py-2 rounded-lg font-medium text-sm">Upload Data</Link>
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

    const result = await callAI('/api/ai/chat', {
      context: systemPrompt,
      messages: aiMessages,
    });

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
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="AI Analyst"
          subtitle={`Ask anything about ${restaurant?.name ?? 'your restaurant'}'s data`}
        />
        {messages.length > 0 && (
          <Button variant="danger" size="sm" onClick={clearChat}>
            <Trash2 size={13} /> Clear
          </Button>
        )}
      </div>

      <Card className="flex-1 overflow-y-auto mb-4 min-h-0">
        {messages.length === 0 && (
          <div>
            <div className="flex items-start gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#4ADE80]/10 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-[#4ADE80]" />
              </div>
              <div className="bg-[#0D1117] rounded-xl rounded-tl-sm px-4 py-3 max-w-lg">
                <p className="text-gray-300 text-sm">
                  Hi! I'm your AI business analyst. I have access to all of {restaurant?.name ?? 'your restaurant'}'s data.
                  Ask me anything — which dishes make the most profit, why revenue dropped last week, what to prepare tomorrow, or anything else.
                </p>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-3">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs bg-[#0D1117] border border-[#30363D] text-gray-300 px-3 py-1.5 rounded-full hover:border-[#4ADE80] hover:text-[#4ADE80] transition-colors"
                  >
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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[#4ADE80]/10' : 'bg-[#60A5FA]/10'}`}>
                {msg.role === 'user' ? <User size={15} className="text-[#4ADE80]" /> : <Bot size={15} className="text-[#60A5FA]" />}
              </div>
              <div className={`rounded-xl px-4 py-3 max-w-lg text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#4ADE80]/10 text-white rounded-tr-sm'
                  : 'bg-[#0D1117] text-gray-300 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#60A5FA]/10 flex items-center justify-center shrink-0">
                <Bot size={15} className="text-[#60A5FA]" />
              </div>
              <div className="bg-[#0D1117] rounded-xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </Card>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="Ask anything about your business..."
          className="flex-1 bg-[#161B22] border border-[#30363D] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#4ADE80] placeholder-gray-600"
          disabled={loading}
        />
        <Button onClick={() => sendMessage(input)} disabled={!input.trim()} loading={loading} className="shrink-0">
          <Send size={15} />
        </Button>
      </div>
    </div>
  );
}
