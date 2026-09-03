'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sourceBadges?: string[];
  providerUsed?: string;
  timestamp: string;
}

const EXAMPLE_PROMPTS = [
  'Do you have the mechanical keyboard in stock?',
  'What products do you have for working from home?',
  'Where is my order?',
  'What does PROCESSING mean?',
  'What is your return policy?',
];

export default function CustomerSupportPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        "Hello! I am your AI Support Assistant. I can help you with product availability, store shipping & return policies, or check your order status with valid session proof.",
      sourceBadges: ['Grounded Support Engine'],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOrderInputs, setShowOrderInputs] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
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
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          orderId: orderIdInput.trim() || undefined,
          sessionId: sessionIdInput.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          sourceBadges: data.sourceBadges,
          providerUsed: data.providerUsed,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: data.error || 'Sorry, an error occurred while processing your request.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Unable to connect to support server. Please check your network connection.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Store Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <Link href="/" className="font-black text-indigo-400 text-lg tracking-tight">
            E-COMMERCE STORE
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-sm font-bold text-white">AI Customer Support</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/products"
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Products Catalog
          </Link>
          <Link
            href="/admin/login"
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
          >
            Admin Console →
          </Link>
        </div>
      </header>

      {/* Main Support Workspace */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col space-y-4">
        {/* Title & Guidance Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>🤖</span>
              <span>Customer AI Support Assistant</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Grounded in live product inventory, store policies, and authorized order status lookups.
            </p>
          </div>

          <button
            onClick={() => setShowOrderInputs(!showOrderInputs)}
            className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-500/30 transition-colors flex items-center space-x-1.5"
          >
            <span>🔐</span>
            <span>{showOrderInputs ? 'Hide Order Verification' : 'Order Lookup Proof'}</span>
          </button>
        </div>

        {/* Optional Order Security Proof Panel */}
        {showOrderInputs && (
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 space-y-3 shadow-xl animate-fadeIn">
            <div className="text-xs font-bold text-indigo-300 flex items-center space-x-2">
              <span>🛡️ Order-Scoped Security Verification</span>
            </div>
            <p className="text-xs text-slate-400">
              Order lookup requires both your Order ID and Checkout Session ID for privacy protection.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Order ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. ord_12345678"
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Checkout Session ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. cs_test_a1b2c3d4..."
                  value={sessionIdInput}
                  onChange={(e) => setSessionIdInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Example Prompt Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 font-semibold">Try asking:</span>
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
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 overflow-y-auto space-y-4 min-h-[420px] max-h-[600px] shadow-inner">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  {msg.role === 'user' ? 'You' : 'AI Assistant'}
                </span>
                <span className="text-[10px] text-slate-600 font-mono">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-2xl rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-950 text-slate-200 border border-slate-800/80 rounded-tl-none space-y-2'
                }`}
              >
                {msg.content}

                {/* Grounding Source Badges */}
                {msg.sourceBadges && msg.sourceBadges.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                    {msg.sourceBadges.map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                      >
                        ✓ {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex flex-col items-start space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                AI Assistant
              </span>
              <div className="bg-slate-950 text-slate-400 border border-slate-800 rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <span>Retrieving grounded facts &amp; generating response...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            placeholder="Ask about products, policies, or order status..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={loading}
            maxLength={500}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-lg"
          />

          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </main>
    </div>
  );
}
