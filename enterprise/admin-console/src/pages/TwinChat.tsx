import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Bot, User, Loader2, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface TwinInfo {
  empName: string;
  positionName: string;
  agentName: string;
  companyName: string;
}

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  ts: string;
}

function Warmup() {
  const [show, setShow] = useState(false);
  const [n, setN] = useState(8);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!show || n <= 0) return;
    const t = setInterval(() => setN(x => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [show, n]);
  if (!show) return <span className="text-sm text-gray-400">Thinking...</span>;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm text-amber-500">
        <Zap size={14} /> Starting up · ~{n}s
      </div>
      <div className="h-1 w-40 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full rounded-full bg-amber-400 transition-all duration-1000"
          style={{ width: `${Math.round((8 - n) / 8 * 100)}%` }} />
      </div>
    </div>
  );
}

export default function TwinChat() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<TwinInfo | null>(null);
  const [error, setError] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [warm, setWarm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load twin info
  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/public/twin/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        setInfo(d);
        setMsgs([{
          id: 0, role: 'assistant', ts: new Date().toLocaleTimeString(),
          text: `Hi! I'm **${d.empName}'s AI assistant** at ${d.companyName}.\n\n${d.empName} is currently unavailable, but I can help you with questions about their work and expertise as a **${d.positionName}**.\n\nWhat can I help you with?`,
        }]);
      })
      .catch(code => setError(code === 404 ? 'This digital twin link is no longer active.' : 'Failed to load. Please try again.'));
  }, [token]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !token) return;
    const userMsg: Msg = { id: Date.now(), role: 'user', text, ts: new Date().toLocaleTimeString() };
    setMsgs(m => [...m, userMsg]);
    setInput('');
    setSending(true);
    try {
      const r = await fetch(`/api/v1/public/twin/${token}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Error');
      setMsgs(m => [...m, { id: Date.now() + 1, role: 'assistant', text: d.reply, ts: new Date().toLocaleTimeString() }]);
      if (!warm) setWarm(true);
    } catch (e: any) {
      setMsgs(m => [...m, { id: Date.now() + 1, role: 'assistant', text: 'Sorry, I had trouble responding. Please try again.', ts: new Date().toLocaleTimeString() }]);
    }
    setSending(false);
  };

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🤖</div>
        <h1 className="text-lg font-semibold text-gray-800 mb-2">Twin Unavailable</h1>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    </div>
  );

  if (!info) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 shadow-sm flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-base font-bold shrink-0">
          {info.empName[0] || 'A'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{info.empName}'s Digital Twin</p>
          <p className="text-xs text-gray-500 truncate">{info.positionName} · {info.companyName}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs text-indigo-600 font-medium">AI</span>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto w-full">
        {msgs.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mt-1">
                <Bot size={16} />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none text-gray-800
                  [&_p]:my-1 [&_strong]:text-gray-900 [&_a]:text-indigo-600
                  [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded
                  [&_pre]:bg-gray-100 [&_pre]:p-2 [&_pre]:rounded [&_ul]:my-1 [&_li]:my-0.5">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}
              <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>{msg.ts}</p>
            </div>
            {msg.role === 'user' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 mt-1">
                <User size={15} />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mt-1">
              <Bot size={16} />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-100 px-4 py-3 shadow-sm">
              {warm ? (
                <div className="flex gap-1 py-1">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                </div>
              ) : <Warmup />}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <footer className="bg-white border-t border-gray-100 px-4 py-3 max-w-2xl mx-auto w-full">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={`Ask ${info.empName}'s AI anything...`}
            disabled={sending}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:bg-white disabled:opacity-50 transition-colors"
          />
          <button onClick={send} disabled={!input.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-center text-gray-400 mt-2">
          AI responses may not fully reflect {info.empName}'s current views · Powered by OpenClaw
        </p>
      </footer>
    </div>
  );
}
