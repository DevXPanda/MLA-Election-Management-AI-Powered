'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { aiAPI } from '@/lib/api';
import Header from '@/components/Header';
import { MODULE_HEADER } from '@/lib/ui-labels';
import {
  Bot, Send, Plus, Trash2, Copy, Check, Loader2, Sparkles,
  MessageSquare, ArrowDown, User, Clock, ChevronLeft,
  MoreHorizontal, X
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

// ── Types ──────────────────────────────────────────────────────
interface ChatMessage {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  charts?: AIChartPayload[];
  timestamp: Date;
}

interface PredictionDataPoint {
  label: string;
  value: number;
}

interface AIChartPayload {
  chartType: 'line' | 'bar' | 'pie';
  title: string;
  labels: string[];
  data: number[];
}

interface ChatSession {
  id: number;
  title: string;
  last_message: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

// ── Markdown renderer ──────────────────────────────────────────
function renderMarkdown(text: string) {
  const parts: Array<{ type: 'code' | 'text'; content: string; lang?: string }> = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2].trim(), lang: match[1] || 'code' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.map((part, i) => {
    if (part.type === 'code') {
      return (
        <div key={i} className="my-3 rounded-xl overflow-hidden border border-dark-200 dark:border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-2 bg-dark-50 dark:bg-dark-800/60 border-b border-dark-100 dark:border-white/[0.04]">
            <span className="text-[10px] font-medium uppercase tracking-widest text-dark-400">{part.lang}</span>
            <CopyButton text={part.content} size="sm" />
          </div>
          <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed bg-dark-50/50 dark:bg-dark-950/60">
            <code className="text-dark-800 dark:text-emerald-300/90 font-mono">{part.content}</code>
          </pre>
        </div>
      );
    }

    return (
      <span key={i}>
        {part.content.split('\n').map((line, j) => {
          let processed: React.ReactNode = line;

          // Bold
          const boldParts = line.split(/\*\*(.*?)\*\*/g);
          if (boldParts.length > 1) {
            processed = boldParts.map((bp, k) =>
              k % 2 === 1 ? <strong key={k} className="font-medium text-dark-900 dark:text-white">{bp}</strong> : bp
            );
          }

          // Inline code
          if (typeof processed === 'string') {
            const codeParts = processed.split(/`([^`]+)`/g);
            if (codeParts.length > 1) {
              processed = codeParts.map((cp, k) =>
                k % 2 === 1 ? (
                  <code key={k} className="px-1.5 py-0.5 bg-dark-100 dark:bg-dark-800/80 rounded-md text-[12px] text-saffron-600 dark:text-saffron-300 font-mono border border-dark-200 dark:border-white/[0.06]">{cp}</code>
                ) : cp
              );
            }
          }

          // Bullet points
          const bulletMatch = line.match(/^(\s*)[*-]\s(.+)/);
          if (bulletMatch) {
            return (
              <div key={j} className="flex gap-2 py-0.5 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-saffron-400/60 mt-2 flex-shrink-0" />
                <span>{typeof processed === 'string' ? bulletMatch[2] : processed}</span>
              </div>
            );
          }

          // Numbered lists
          const numMatch = line.match(/^(\d+)\.\s(.+)/);
          if (numMatch) {
            return (
              <div key={j} className="flex gap-2.5 py-0.5 pl-1">
                <span className="text-saffron-500 font-medium text-xs mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-saffron-500/10 flex items-center justify-center">{numMatch[1]}</span>
                <span className="flex-1">{typeof processed === 'string' ? numMatch[2] : processed}</span>
              </div>
            );
          }

          // Headers
          if (line.startsWith('### ')) return <h4 key={j} className="text-sm font-medium text-dark-900 dark:text-white mt-3 mb-1.5">{line.slice(4)}</h4>;
          if (line.startsWith('## ')) return <h3 key={j} className="text-base font-medium text-dark-900 dark:text-white mt-3 mb-1.5">{line.slice(3)}</h3>;
          if (line.startsWith('# ')) return <h2 key={j} className="text-lg font-medium text-dark-900 dark:text-white mt-3 mb-1.5">{line.slice(2)}</h2>;

          if (line.trim() === '') return <div key={j} className="h-2" />;
          return <div key={j} className="leading-[1.8]">{processed}</div>;
        })}
      </span>
    );
  });
}

// ── Copy Button ─────────────────────────────────────────────────
function CopyButton({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };
  return (
    <button onClick={handleCopy} className={`${size === 'sm' ? 'p-1' : 'p-1.5'} rounded-lg hover:bg-dark-100 dark:hover:bg-white/10 transition-all group`} title="Copy">
      {copied ? <Check size={size === 'sm' ? 12 : 14} className="text-emerald-500" /> : <Copy size={size === 'sm' ? 12 : 14} className="text-dark-400 group-hover:text-dark-600 dark:group-hover:text-dark-200 transition-colors" />}
    </button>
  );
}

// ── Typing indicator ────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 max-w-[85%]">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-saffron-500 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-saffron-500/20">
        <Bot size={14} className="text-white" />
      </div>
      <div className="bg-white dark:bg-dark-800/60 border border-dark-100 dark:border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-saffron-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }} />
          <div className="w-2 h-2 rounded-full bg-saffron-400 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }} />
          <div className="w-2 h-2 rounded-full bg-saffron-400 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ chart }: { chart: AIChartPayload }) {
  const palette = ['#F97316', '#3B82F6', '#10B981', '#A855F7', '#EF4444', '#EAB308', '#14B8A6', '#EC4899'];
  const pieBackground = (chart.labels || []).map((_, idx) => `${palette[idx % palette.length]}CC`);
  const pieBorder = (chart.labels || []).map((_, idx) => palette[idx % palette.length]);

  const data = {
    labels: chart.labels || [],
    datasets: [{
      label: chart.title || 'Series',
      data: Array.isArray(chart.data) ? chart.data : [],
      borderColor: chart.chartType === 'pie' ? pieBorder : '#F97316',
      backgroundColor: chart.chartType === 'pie' ? pieBackground : 'rgba(249, 115, 22, 0.35)',
      tension: 0.3,
      fill: chart.chartType !== 'bar',
      borderWidth: 2,
      pointBackgroundColor: '#F97316',
      pointBorderColor: '#FFFFFF',
      pointRadius: 4,
      pointHoverRadius: 6,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#334155',
          boxWidth: 14,
          usePointStyle: true,
          pointStyle: 'rectRounded' as const,
          padding: 14,
        },
      },
      title: {
        display: !!chart.title,
        text: chart.title,
        color: '#0F172A',
        font: { size: 14, weight: 600 },
        padding: { bottom: 8 },
      },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#FFFFFF',
        bodyColor: '#E2E8F0',
        borderColor: '#334155',
        borderWidth: 1,
      },
    },
    scales: chart.chartType === 'pie' ? undefined : {
      y: {
        beginAtZero: true,
        ticks: { color: '#475569' },
        grid: { color: 'rgba(148, 163, 184, 0.25)' },
      },
      x: {
        ticks: { color: '#475569' },
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
      },
    },
  };

  return (
    <div className="mt-3 rounded-xl border border-saffron-200/70 dark:border-white/[0.1] bg-gradient-to-br from-white to-orange-50/60 dark:from-dark-900/50 dark:to-dark-800/20 p-3 shadow-sm">
      <p className="text-[11px] font-semibold text-dark-700 dark:text-dark-200 mb-2">{chart.title}</p>
      <div className="h-56">
        {chart.chartType === 'bar' ? <Bar data={data} options={options} /> : null}
        {chart.chartType === 'pie' ? <Pie data={data} options={options} /> : null}
        {chart.chartType === 'line' ? <Line data={data} options={options} /> : null}
      </div>
    </div>
  );
}

// ── Welcome ─────────────────────────────────────────────────────
function WelcomeScreen({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const suggestions = [
    { icon: '🗳️', title: 'Voter Strategy', prompt: 'How can I increase voter turnout in the primary booths of our constituency?' },
    { icon: '📊', title: 'Data Analysis', prompt: 'Compare voter demographics and suggest where we should focus our outreach efforts.' },
    { icon: '📢', title: 'Speech Writing', prompt: 'Draft a short, impactful speech focusing on local development for a small community rally.' },
    { icon: '🤝', title: 'Volunteer Help', prompt: 'Create a simple training guide for booth-level workers for the upcoming election day.' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-saffron-500 to-amber-600 flex items-center justify-center shadow-xl shadow-saffron-500/25">
          <Bot size={30} className="text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-white dark:border-dark-950 flex items-center justify-center">
          <Sparkles size={8} className="text-white" />
        </div>
      </div>
      <h2 className="text-xl md:text-2xl font-medium text-dark-900 dark:text-white mb-2 tracking-tight">AI Assistant</h2>
      <p className="text-dark-400 dark:text-dark-500 text-sm mb-8 text-center max-w-md leading-relaxed">
        Ask me anything — campaign strategy, voter research, speech writing, or general management. I&apos;m here to help you win.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => onSuggestion(s.prompt)}
            className="group text-left p-3.5 rounded-xl bg-white dark:bg-dark-800/40 hover:bg-dark-50 dark:hover:bg-dark-800/70 border border-dark-100 dark:border-white/[0.04] hover:border-saffron-500/20 dark:hover:border-saffron-500/10 transition-all duration-300 hover:shadow-md hover:shadow-saffron-500/5"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">{s.icon}</span>
              <div>
                <h3 className="text-xs font-medium text-dark-700 dark:text-dark-200 group-hover:text-saffron-600 dark:group-hover:text-saffron-400 transition-colors mb-0.5">{s.title}</h3>
                <p className="text-[11px] text-dark-400 dark:text-dark-500 leading-relaxed line-clamp-2">{s.prompt}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-8 flex items-center gap-2 text-[11px] text-dark-400 dark:text-dark-600">
        <Sparkles size={10} className="text-saffron-400" />
        <span>Powered by XPanda</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function AIAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Access control ──────────────────────────────────────────
  const allowedRoles = ['super_admin', 'mla'];
  const isAllowed = user ? allowedRoles.includes(user.role_name) : false;

  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const res = await aiAPI.getSessions();
      if (res.data.success) {
        setSessions(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // ── Load sessions ───────────────────────────────────────────
  useEffect(() => {
    if (isAllowed) {
      loadSessions();
    }
  }, [isAllowed, loadSessions]);

  // ── Load session messages ──────────────────────────────────
  const loadSessionMessages = async (sessionId: number) => {
    try {
      setMessages([]);
      setActiveSessionId(sessionId);
      setError(null);
      setMobileHistoryOpen(false);

      const res = await aiAPI.getSessionMessages(sessionId);
      if (res.data.success) {
        const msgs: ChatMessage[] = res.data.data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
        }));
        setMessages(msgs);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load chat history.');
    }
  };

  // ── Delete session ─────────────────────────────────────────
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation();
    showToast.confirm(
      'Delete Chat',
      'Are you sure you want to delete this conversation? This cannot be undone.',
      async () => {
        try {
          await aiAPI.deleteSession(sessionId);
          setSessions(prev => prev.filter(s => s.id !== sessionId));
          if (activeSessionId === sessionId) {
            setActiveSessionId(null);
            setMessages([]);
          }
          toast.success('Chat deleted successfully');
        } catch (err) {
          console.error('Failed to delete session:', err);
          showToast.error('Failed to delete chat session.');
        }
      },
      'Delete'
    );
  };

  // ── Auto-scroll ─────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Auto-resize textarea ───────────────────────────────────
  useEffect(() => {
    const ta = inputRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  if (!isAllowed) {
    return (
      <>
        <Header title={MODULE_HEADER.aiAssistant.title} subtitle={MODULE_HEADER.aiAssistantRestricted.subtitle} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center glass-card p-10 max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Bot size={24} className="text-red-400" />
            </div>
            <h2 className="text-lg font-medium text-dark-900 dark:text-white mb-2">Access Restricted</h2>
            <p className="text-dark-400 text-sm">AI Assistant is available for Super Admin and MLA roles only.</p>
          </div>
        </div>
      </>
    );
  }

  // ── Send message ────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isLoading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      const history = [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await aiAPI.chat(messageText, history, activeSessionId || undefined, user?.id);

      if (res.data.success && res.data.reply) {
        // Update active session
        if (!activeSessionId && res.data.session_id) {
          setActiveSessionId(res.data.session_id);
        }

        const aiResponse = res.data.ai_response;
        const predictionCharts: AIChartPayload[] =
          aiResponse?.type === 'prediction' && Array.isArray(aiResponse?.data)
            ? [{
              chartType: aiResponse.chartType === 'pie' ? 'pie' : 'pie',
              title: aiResponse?.title || 'Prediction Distribution',
              labels: aiResponse.data.map((d: PredictionDataPoint) => d.label),
              data: aiResponse.data.map((d: PredictionDataPoint) => Number(d.value) || 0),
            }]
            : [];

        const genericCharts: AIChartPayload[] = Array.isArray(aiResponse?.charts) ? aiResponse.charts : [];
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: aiResponse?.insight || aiResponse?.text || res.data.reply,
          charts: predictionCharts.length > 0 ? predictionCharts : genericCharts,
          timestamp: new Date(res.data.timestamp || Date.now()),
        };
        setMessages(prev => [...prev, aiMsg]);

        // Refresh session list
        loadSessions();
      } else {
        setError(res.data.message || 'Failed to get response.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to connect to AI service.');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
    setInput('');
    setMobileHistoryOpen(false);
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  };

  const formatSessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <Header title={MODULE_HEADER.aiAssistant.title} subtitle={MODULE_HEADER.aiAssistant.subtitle} />

      <div className="dashboard-container">
        <div className="glass-card overflow-hidden flex h-[calc(100vh-160px)] sm:h-[calc(100vh-140px)]">

          {/* ── SIDEBAR: Chat History ─────────────────────────── */}
          <div className={`
            flex-shrink-0 border-r border-dark-100 dark:border-white/[0.04] flex flex-col bg-dark-50/50 dark:bg-dark-900/30
            transition-all duration-300
            ${sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden'}
            max-lg:hidden
          `}>
            {/* Sidebar header */}
            <div className="p-3 border-b border-dark-100 dark:border-white/[0.04] flex items-center gap-2">
              <button onClick={handleNewChat}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-br from-saffron-500 to-amber-600 text-white text-xs font-medium shadow-md shadow-saffron-500/20 hover:shadow-saffron-500/30 transition-all active:scale-[0.98]"
              >
                <Plus size={14} /> New Chat
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
              {sessionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-saffron-400" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="w-8 h-8 text-dark-300 dark:text-dark-600 mx-auto mb-2" />
                  <p className="text-xs text-dark-400 dark:text-dark-500">No chats yet</p>
                </div>
              ) : (
                sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => loadSessionMessages(s.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 group relative ${activeSessionId === s.id
                      ? 'bg-saffron-500/[0.08] dark:bg-saffron-500/[0.1] border border-saffron-500/20'
                      : 'hover:bg-dark-100/60 dark:hover:bg-white/[0.03] border border-transparent'
                      }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <MessageSquare size={14} className={`mt-0.5 flex-shrink-0 ${activeSessionId === s.id ? 'text-saffron-500' : 'text-dark-400 dark:text-dark-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate mb-0.5 ${activeSessionId === s.id ? 'text-saffron-600 dark:text-saffron-400' : 'text-dark-700 dark:text-dark-300'
                          }`}>{s.title}</p>
                        <p className="text-[10px] text-dark-400 dark:text-dark-500 truncate">{s.last_message || 'Empty chat'}</p>
                        <p className="text-[9px] text-dark-300 dark:text-dark-600 mt-1">{formatSessionDate(s.updated_at)}</p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-dark-400 hover:text-red-500 transition-all flex-shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Mobile History Overlay ──────────────────────────── */}
          {mobileHistoryOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileHistoryOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-white dark:bg-dark-900 border-r border-dark-100 dark:border-white/[0.04] flex flex-col animate-slide-in-right z-10">
                <div className="p-3 border-b border-dark-100 dark:border-white/[0.04] flex items-center justify-between">
                  <h3 className="text-sm font-medium text-dark-900 dark:text-white">Chat History</h3>
                  <button onClick={() => setMobileHistoryOpen(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800">
                    <X size={16} className="text-dark-400" />
                  </button>
                </div>
                <div className="p-3 border-b border-dark-100 dark:border-white/[0.04]">
                  <button onClick={handleNewChat}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-br from-saffron-500 to-amber-600 text-white text-xs font-medium shadow-md shadow-saffron-500/20 active:scale-[0.98] transition-all"
                  >
                    <Plus size={14} /> New Chat
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
                  {sessions.map(s => (
                    <button key={s.id} onClick={() => loadSessionMessages(s.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all group ${activeSessionId === s.id ? 'bg-saffron-500/10 border border-saffron-500/20' : 'hover:bg-dark-50 dark:hover:bg-dark-800/40 border border-transparent'
                        }`}>
                      <p className={`text-xs font-medium truncate mb-0.5 ${activeSessionId === s.id ? 'text-saffron-600' : 'text-dark-700 dark:text-dark-300'}`}>{s.title}</p>
                      <p className="text-[10px] text-dark-400 truncate">{s.last_message || 'Empty chat'}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── MAIN CHAT AREA ──────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Chat header */}
            <div className="flex-shrink-0 h-12 px-4 flex items-center justify-between border-b border-dark-100 dark:border-white/[0.04] bg-white/50 dark:bg-dark-900/30">
              <div className="flex items-center gap-2.5">
                <button onClick={() => setMobileHistoryOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800">
                  <MessageSquare size={16} className="text-dark-400" />
                </button>
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden lg:flex p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800">
                  <ChevronLeft size={16} className={`text-dark-400 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-saffron-500 to-amber-600 flex items-center justify-center shadow-md shadow-saffron-500/15">
                  <Bot size={13} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-dark-900 dark:text-white leading-tight">AI Assistant</p>
                  <p className="text-[9px] text-dark-400 dark:text-dark-500">
                    {isLoading ? 'Typing...' : 'Online • OpenAI'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={handleNewChat}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-400 hover:text-dark-600 dark:hover:text-dark-200 text-[11px] font-medium transition-all"
                  >
                    <Plus size={13} /> New
                  </button>
                )}
              </div>
            </div>

            {/* ── Messages ──────────────────────────────────── */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar relative">
              {messages.length === 0 ? (
                <WelcomeScreen onSuggestion={(text) => sendMessage(text)} />
              ) : (
                <div className="max-w-3xl mx-auto py-5 px-4 space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`group max-w-[80%] ${msg.role === 'user' ? 'max-w-[75%]' : ''}`}>
                        {/* Bubble */}
                        <div className={`
                          px-4 py-3 text-[13.5px] leading-[1.75] whitespace-pre-wrap break-words
                          ${msg.role === 'user'
                            ? 'bg-gradient-to-br from-saffron-500 to-amber-600 text-white rounded-2xl rounded-br-md shadow-md shadow-saffron-500/20'
                            : 'bg-white dark:bg-dark-800/60 text-dark-700 dark:text-dark-300 border border-dark-100 dark:border-white/[0.06] rounded-2xl rounded-bl-md shadow-sm'
                          }
                        `}>
                          {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                          {msg.role === 'assistant' && Array.isArray(msg.charts) && msg.charts.length > 0
                            ? msg.charts.map((chart, idx) => <ChartCard key={`${msg.id}-chart-${idx}`} chart={chart} />)
                            : null}
                        </div>

                        {/* Copy action for AI messages */}
                        {msg.role === 'assistant' && (
                          <div className="flex items-center mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <CopyButton text={msg.content} size="sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <TypingIndicator />
                    </div>
                  )}

                  {error && (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-500/10 max-w-md">
                        <span className="text-xs text-red-400">{error}</span>
                        <button onClick={() => { setError(null); if (messages.length) sendMessage(messages.filter(m => m.role === 'user').pop()?.content); }}
                          className="text-[10px] text-red-400 hover:text-red-300 underline underline-offset-2 whitespace-nowrap"
                        >Retry</button>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}

              {showScrollBtn && (
                <button onClick={scrollToBottom}
                  className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-white dark:bg-dark-800 border border-dark-100 dark:border-white/[0.08] shadow-lg flex items-center justify-center hover:bg-dark-50 dark:hover:bg-dark-700 transition-all z-20"
                >
                  <ArrowDown size={14} className="text-dark-400" />
                </button>
              )}
            </div>

            {/* ── INPUT ─────────────────────────────────────── */}
            <div className="flex-shrink-0 border-t border-dark-100 dark:border-white/[0.04] bg-white/60 dark:bg-dark-900/40 px-4 py-3">
              <div className="max-w-3xl mx-auto">
                <div className={`flex items-end gap-2.5 bg-white dark:bg-dark-800/60 rounded-2xl border transition-all duration-300 p-1.5 pl-4 ${isLoading
                  ? 'border-saffron-500/40 shadow-md shadow-saffron-500/10'
                  : 'border-dark-200 dark:border-white/[0.06] focus-within:border-saffron-500/30 focus-within:shadow-md focus-within:shadow-saffron-500/5'
                  }`}>
                  {isLoading && (
                    <div className="absolute top-0 left-4 right-4 h-[1.5px] overflow-hidden rounded-full">
                      <div className="h-full bg-gradient-to-r from-transparent via-saffron-500 to-transparent w-full animate-shimmer"
                        style={{ backgroundSize: '200% 100%' }} />
                    </div>
                  )}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 bg-transparent resize-none outline-none text-sm text-dark-900 dark:text-dark-100 placeholder-dark-400 dark:placeholder-dark-500 py-2 max-h-[160px] custom-scrollbar leading-relaxed"
                    id="ai-chat-input"
                  />
                  <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
                    className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${input.trim() && !isLoading
                      ? 'bg-gradient-to-br from-saffron-500 to-amber-600 text-white shadow-md shadow-saffron-500/20 hover:shadow-saffron-500/35 hover:scale-105 active:scale-95'
                      : isLoading
                        ? 'bg-saffron-500/10 text-saffron-500'
                        : 'bg-dark-100 dark:bg-dark-700/50 text-dark-400 dark:text-dark-500 cursor-not-allowed'
                      }`}
                    id="ai-chat-send"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-dark-300 dark:text-dark-600 mt-1.5 px-1 flex items-center gap-1.5">
                  <Sparkles size={9} className="text-saffron-400/60" />
                  AI responses may not always be accurate. Verify important info.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
