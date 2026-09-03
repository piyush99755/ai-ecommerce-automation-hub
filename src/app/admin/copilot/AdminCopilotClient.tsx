'use client';

import { useState, useRef, useEffect } from 'react';
import { AdminRole } from '@/lib/admin-rbac';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sourceBadges?: string[];
  providerUsed?: string;
  executedTool?: string;
  timestamp: string;
}

const EXAMPLE_PROMPTS = [
  'What failed in the last 24 hours?',
  'Which products are low stock?',
  'Show me orders currently processing.',
  'How much paid revenue did we have in the last 30 days?',
  'Who are our highest-LTV customers?',
  'Which order statuses need attention?',
];

export function AdminCopilotClient({ adminRole }: { adminRole: AdminRole }) {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `Welcome to the Admin AI Operations Copilot (${adminRole}). Ask me about system failures, inventory stock levels, order statuses, or business analytics.`,
      sourceBadges: ['Read-Only Operational Assistant'],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: CopilotMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        const assistantMsg: CopilotMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          sourceBadges: data.sourceBadges,
          providerUsed: data.providerUsed,
          executedTool: data.executedTool,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: CopilotMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: data.error || 'An error occurred while communicating with the Admin Copilot.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: CopilotMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Unable to connect to Copilot server API.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Example Prompt Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 font-semibold">Suggested Operational Queries:</span>
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSendMessage(prompt)}
            disabled={loading}
            className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-full border border-slate-800 transition-colors text-left"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat History Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 overflow-y-auto space-y-4 min-h-[440px] max-h-[620px] shadow-inner">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                {msg.role === 'user' ? 'You' : `Copilot (${adminRole})`}
              </span>
              <span className="text-[10px] text-slate-600 font-mono">{msg.timestamp}</span>
            </div>

            <div
              className={`max-w-3xl rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-tr-none'
                  : 'bg-slate-950 text-slate-200 border border-slate-800/80 rounded-tl-none space-y-2'
              }`}
            >
              {msg.content}

              {/* Badges */}
              {msg.sourceBadges && msg.sourceBadges.length > 0 && (
                <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                  {msg.sourceBadges.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20"
                    >
                      🛡️ {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start space-y-1">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Admin Copilot
            </span>
            <div className="bg-slate-950 text-slate-400 border border-slate-800 rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span>Routing query to authorized read-only tool &amp; analyzing evidence...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center space-x-2"
      >
        <input
          type="text"
          placeholder="Ask Copilot about failures, inventory health, orders, or business metrics..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={loading}
          maxLength={500}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 shadow-lg"
        />

        <button
          type="submit"
          disabled={loading || !inputMessage.trim()}
          className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed"
        >
          {loading ? 'Analyzing...' : 'Ask Copilot'}
        </button>
      </form>
    </div>
  );
}
