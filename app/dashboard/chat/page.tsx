'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowUp,
  BrainCircuit,
  FileText,
  ChevronRight,
  Plus,
  ChevronDown,
  Zap,
  Brain,
  Trash2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { queryApi, memoryApi } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

const MotionDiv = motion.div as any;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  source?: string;
  connections?: string;
  actions?: string;
  context?: string[];
  isDeep?: boolean;
}

export default function ChatMode() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; title: string; created_at: string }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [hasMemory, setHasMemory] = useState<boolean | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [isDeepThinking, setIsDeepThinking] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<number[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const savedSessionId = localStorage.getItem('devasya_session_id');
    const saved = localStorage.getItem('devasya_chat');
    if (savedSessionId) setCurrentSessionId(savedSessionId);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch (e) {}
    }
    setLoading(true);
    loadSessions().finally(() => setLoading(false));
  }, []);

  const loadSessions = async () => {
    try {
      const res = await queryApi.sessions();
      if (res.status === 200 && res.data) {
        setSessions((res.data as any).sessions || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem('devasya_chat', JSON.stringify(messages));
    if (currentSessionId) {
      localStorage.setItem('devasya_session_id', currentSessionId);
    } else {
      localStorage.removeItem('devasya_session_id');
    }
  }, [messages, currentSessionId]);

  const loadSession = async (id: string) => {
    if (id === currentSessionId) return;
    setCurrentSessionId(id);
    setLoading(true);
    setMessages([]);
    setSendError(null);
    try {
      const res = await queryApi.history(0, 100, id);
      if (res.status === 200 && res.data) {
        const rawMessages = (res.data as any).interactions || [];
        const formatted: Message[] = rawMessages.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content || '',
        }));
        setMessages(formatted);
      }
    } catch (e) {}
    setLoading(false);
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setSendError(null);
    localStorage.removeItem('devasya_chat');
    localStorage.removeItem('devasya_session_id');
    inputRef.current?.focus();
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await queryApi.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) startNewChat();
    } catch (e) {}
  };

  useEffect(() => {
    const checkMemories = async () => {
      try {
        const res = await memoryApi.list(0, 1);
        if (res.status === 200 && res.data) {
          const count = (res.data as any).total || 0;
          setHasMemory(count > 0);
          if (count === 0) setShowEmptyState(true);
        } else {
          setHasMemory(true);
        }
      } catch (e) {
        setHasMemory(true);
      }
    };
    checkMemories();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showEmptyState, expandedThinking, loading]);

  useEffect(() => {
    if (!loading && hasMemory !== null && !showEmptyState) {
      inputRef.current?.focus();
    }
  }, [loading, hasMemory, showEmptyState]);

  const toggleThinking = (index: number) => {
    setExpandedThinking(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    if (showEmptyState) setShowEmptyState(false);
    setSendError(null);

    const userMessage: Message = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const response = await queryApi.ask(userMessage.content, true, currentSessionId || undefined);
      if (response.status === 200 && response.data) {
        const resData = response.data as any;
        const answerText =
          resData.response || resData.insights || "I processed your request but couldn't generate a response.";
        if (!currentSessionId && resData.session_id) {
          setCurrentSessionId(resData.session_id);
          loadSessions();
        }
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: answerText,
            connections: resData.connections,
            actions: resData.actions,
            context: resData.context_used,
            isDeep: isDeepThinking,
          },
        ]);
      } else {
        const errMsg = response.error || 'Failed to get a response from the server.';
        setSendError(errMsg);
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }]);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network error — check your connection and try again.';
      setSendError(errMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group sessions by Today / Earlier
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => new Date(s.created_at).toDateString() === today);
  const earlierSessions = sessions.filter(s => new Date(s.created_at).toDateString() !== today);

  const SessionItem = ({ s }: { s: { id: string; title: string; created_at: string } }) => (
    <div
      className="w-full group flex items-center justify-between rounded-lg transition-colors duration-150"
      style={{
        background: currentSessionId === s.id ? 'oklch(0.62 0.20 265 / 0.10)' : 'transparent',
        color: currentSessionId === s.id ? 'oklch(0.85 0 0)' : 'oklch(0.52 0 0)',
      }}
      onMouseEnter={e => {
        if (currentSessionId !== s.id) {
          (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0 0)';
          (e.currentTarget as HTMLElement).style.color = 'oklch(0.75 0 0)';
        }
      }}
      onMouseLeave={e => {
        if (currentSessionId !== s.id) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'oklch(0.52 0 0)';
        }
      }}
    >
      <button
        onClick={() => loadSession(s.id)}
        className="flex-1 text-left px-3 py-2 text-[13px] truncate"
        style={{ color: 'inherit' }}
      >
        {s.title || 'Untitled conversation'}
      </button>
      <button
        onClick={e => handleDeleteSession(e, s.id)}
        className="p-2 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'oklch(0.55 0.15 25)' }}
        title="Delete session"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ─── Sessions Sidebar ─── */}
      <div
        className="hidden md:flex w-56 shrink-0 flex-col h-full"
        style={{ borderRight: '1px solid oklch(0.20 0 0)' }}
      >
        {/* New chat button */}
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[13px] font-medium transition-colors duration-150"
            style={{ background: 'oklch(0.62 0.20 265 / 0.12)', color: 'oklch(0.75 0.16 265)' }}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLElement).style.background = 'oklch(0.62 0.20 265 / 0.18)')
            }
            onMouseLeave={e =>
              ((e.currentTarget as HTMLElement).style.background = 'oklch(0.62 0.20 265 / 0.12)')
            }
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 no-scrollbar">
          {loading && sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'oklch(0.62 0.20 265)', borderTopColor: 'transparent' }}
              />
              <p className="text-[11px]" style={{ color: 'oklch(0.42 0 0)' }}>
                Waking up AI...
              </p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-1.5 px-3 text-center">
              <MessageSquare className="w-5 h-5" style={{ color: 'oklch(0.30 0 0)' }} />
              <p className="text-[12px]" style={{ color: 'oklch(0.42 0 0)' }}>
                No conversations yet
              </p>
            </div>
          ) : (
            <>
              {todaySessions.length > 0 && (
                <>
                  <div className="px-3 py-2">
                    <span className="text-label" style={{ color: 'oklch(0.36 0 0)' }}>
                      Today
                    </span>
                  </div>
                  {todaySessions.map(s => <SessionItem key={s.id} s={s} />)}
                </>
              )}
              {earlierSessions.length > 0 && (
                <>
                  <div className="px-3 py-2 mt-2">
                    <span className="text-label" style={{ color: 'oklch(0.36 0 0)' }}>
                      Earlier
                    </span>
                  </div>
                  {earlierSessions.map(s => <SessionItem key={s.id} s={s} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Main Chat Area ─── */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Error banner */}
        <AnimatePresence>
          {sendError && (
            <MotionDiv
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm max-w-md w-full mx-4"
              style={{
                background: 'oklch(0.52 0.20 25 / 0.12)',
                border: '1px solid oklch(0.52 0.20 25 / 0.30)',
                color: 'oklch(0.75 0.18 25)',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate flex-1">{sendError}</span>
              <button
                onClick={() => setSendError(null)}
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto styled-scrollbar">
          <div className="max-w-2xl mx-auto px-4 py-8 pb-48 space-y-6">
            <AnimatePresence mode="wait">
              {hasMemory === null ? (
                <MotionDiv
                  key="checking"
                  className="flex justify-center items-center h-40"
                >
                  <Sparkles
                    className="w-5 h-5 animate-pulse"
                    style={{ color: 'oklch(0.62 0.20 265)' }}
                  />
                </MotionDiv>
              ) : showEmptyState ? (
                <MotionDiv
                  key="empty"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center justify-center pt-24 pb-8 text-center"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: 'oklch(0.62 0.20 265 / 0.12)', border: '1px solid oklch(0.62 0.20 265 / 0.20)' }}
                  >
                    <BrainCircuit className="w-7 h-7" style={{ color: 'oklch(0.70 0.18 265)' }} />
                  </div>
                  <h2
                    className="text-2xl font-semibold tracking-tight mb-2"
                    style={{ color: 'oklch(0.88 0 0)' }}
                  >
                    Build your intelligence
                  </h2>
                  <p
                    className="text-[15px] mb-8 max-w-sm leading-relaxed"
                    style={{ color: 'oklch(0.50 0 0)' }}
                  >
                    Add notes about yourself, your work, or upload documents to give Devasya context.
                  </p>
                  <div className="flex gap-3 w-full max-w-xs">
                    <button
                      onClick={() => router.push('/dashboard/memory')}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[13px] font-semibold transition-all duration-150"
                      style={{ background: 'oklch(0.62 0.20 265)', color: 'oklch(0.98 0 0)' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.88')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                    >
                      <Plus className="w-4 h-4" /> Add Memory
                    </button>
                    <button
                      onClick={() => setShowEmptyState(false)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[13px] font-medium transition-all duration-150"
                      style={{
                        background: 'oklch(0.20 0 0)',
                        border: '1px solid oklch(0.28 0 0)',
                        color: 'oklch(0.70 0 0)',
                      }}
                      onMouseEnter={e =>
                        ((e.currentTarget as HTMLElement).style.background = 'oklch(0.24 0 0)')
                      }
                      onMouseLeave={e =>
                        ((e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0 0)')
                      }
                    >
                      Ask Anyway <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </MotionDiv>
              ) : (
                <MotionDiv key="chat" className="space-y-6">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center pt-24 pb-8 text-center">
                      <Sparkles
                        className="w-6 h-6 mb-3"
                        style={{ color: 'oklch(0.40 0 0)' }}
                      />
                      <p className="text-[15px] font-medium" style={{ color: 'oklch(0.42 0 0)' }}>
                        How can I help you think today?
                      </p>
                    </div>
                  )}

                  {messages.map((m, idx) => (
                    <MotionDiv
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* Avatar */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={
                          m.role === 'user'
                            ? {
                                background: 'oklch(0.62 0.20 265 / 0.15)',
                                border: '1px solid oklch(0.62 0.20 265 / 0.25)',
                              }
                            : {
                                background: 'oklch(0.18 0 0)',
                                border: '1px solid oklch(0.24 0 0)',
                              }
                        }
                      >
                        {m.role === 'user' ? (
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: 'oklch(0.75 0.16 265)' }}
                          >
                            U
                          </span>
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" style={{ color: 'oklch(0.62 0.20 265)' }} />
                        )}
                      </div>

                      <div
                        className={`flex flex-col gap-2 max-w-[88%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        {/* Bubble */}
                        <div
                          className="px-4 py-3 rounded-2xl leading-relaxed text-[15px]"
                          style={
                            m.role === 'user'
                              ? {
                                  background: 'oklch(0.62 0.20 265 / 0.14)',
                                  border: '1px solid oklch(0.62 0.20 265 / 0.20)',
                                  color: 'oklch(0.90 0 0)',
                                  borderTopRightRadius: '6px',
                                }
                              : {
                                  color: 'oklch(0.82 0 0)',
                                }
                          }
                        >
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        </div>

                        {/* Thinking toggle */}
                        {m.role === 'assistant' &&
                          (m.connections || m.actions || (m.context && m.context.length > 0)) && (
                            <button
                              onClick={() => toggleThinking(idx)}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-medium transition-colors duration-150"
                              style={{ color: 'oklch(0.42 0 0)' }}
                              onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0 0)';
                                (e.currentTarget as HTMLElement).style.color = 'oklch(0.62 0 0)';
                              }}
                              onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                (e.currentTarget as HTMLElement).style.color = 'oklch(0.42 0 0)';
                              }}
                            >
                              <ChevronDown
                                className={`w-3 h-3 transition-transform duration-200 ${
                                  expandedThinking.includes(idx) ? 'rotate-180' : ''
                                }`}
                              />
                              Show reasoning
                            </button>
                          )}

                        {/* Thinking panel */}
                        <AnimatePresence>
                          {m.role === 'assistant' && expandedThinking.includes(idx) && (
                            <MotionDiv
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="w-full rounded-xl p-4 overflow-hidden text-[13px] space-y-3"
                              style={{
                                background: 'oklch(0.17 0 0)',
                                border: '1px solid oklch(0.24 0 0)',
                              }}
                            >
                              {m.context && m.context.length > 0 && (
                                <div
                                  className="flex items-center gap-2"
                                  style={{ color: 'oklch(0.62 0.20 265)' }}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span className="text-[12px] font-medium">{m.context[0]}</span>
                                </div>
                              )}
                              {m.connections && (
                                <div>
                                  <div
                                    className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                                    style={{ color: 'oklch(0.45 0 0)' }}
                                  >
                                    <BrainCircuit className="w-3.5 h-3.5" /> Key Insight
                                  </div>
                                  <p
                                    className="leading-relaxed line-clamp-4"
                                    style={{ color: 'oklch(0.68 0 0)' }}
                                  >
                                    {m.connections}
                                  </p>
                                </div>
                              )}
                              {m.actions && (
                                <div>
                                  <div
                                    className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                                    style={{ color: 'oklch(0.45 0 0)' }}
                                  >
                                    Suggested Action
                                  </div>
                                  <p
                                    className="leading-relaxed line-clamp-3"
                                    style={{ color: 'oklch(0.68 0 0)' }}
                                  >
                                    {m.actions}
                                  </p>
                                </div>
                              )}
                            </MotionDiv>
                          )}
                        </AnimatePresence>
                      </div>
                    </MotionDiv>
                  ))}

                  {/* Loading indicator */}
                  {loading && (
                    <MotionDiv
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: 'oklch(0.18 0 0)',
                          border: '1px solid oklch(0.24 0 0)',
                        }}
                      >
                        <Sparkles
                          className="w-3.5 h-3.5 animate-pulse"
                          style={{ color: 'oklch(0.62 0.20 265)' }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 py-3">
                        {[0, 150, 300].map(delay => (
                          <div
                            key={delay}
                            className="w-1.5 h-1.5 rounded-full animate-bounce"
                            style={{
                              background: 'oklch(0.62 0.20 265 / 0.5)',
                              animationDelay: `${delay}ms`,
                            }}
                          />
                        ))}
                      </div>
                    </MotionDiv>
                  )}

                  <div ref={endRef} />
                </MotionDiv>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ─── Input Composer ─── */}
        {hasMemory !== null && !showEmptyState && (
          <div
            className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-4"
            style={{
              background: 'linear-gradient(to top, oklch(0.115 0 0) 70%, transparent)',
            }}
          >
            <div className="max-w-2xl mx-auto">
              {/* Mode toggle */}
              <div className="flex gap-0 mb-3 w-max">
                <button
                  onClick={() => setIsDeepThinking(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-[12px] font-semibold transition-all duration-150"
                  style={{
                    background: !isDeepThinking ? 'oklch(0.22 0 0)' : 'transparent',
                    border: '1px solid oklch(0.24 0 0)',
                    borderRight: !isDeepThinking ? '1px solid oklch(0.24 0 0)' : '1px solid transparent',
                    color: !isDeepThinking ? 'oklch(0.85 0 0)' : 'oklch(0.44 0 0)',
                  }}
                >
                  <Zap className="w-3 h-3" /> Quick
                </button>
                <button
                  onClick={() => setIsDeepThinking(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-r-lg text-[12px] font-semibold transition-all duration-150"
                  style={{
                    background: isDeepThinking ? 'oklch(0.62 0.20 265 / 0.15)' : 'transparent',
                    border: '1px solid oklch(0.24 0 0)',
                    borderLeft: isDeepThinking ? '1px solid oklch(0.62 0.20 265 / 0.3)' : '1px solid oklch(0.20 0 0)',
                    color: isDeepThinking ? 'oklch(0.75 0.16 265)' : 'oklch(0.44 0 0)',
                  }}
                >
                  <Brain className="w-3 h-3" /> Deep
                </button>
              </div>

              {/* Composer */}
              <div
                className="relative flex items-end gap-3 rounded-2xl transition-all duration-150 p-3"
                style={{
                  background: 'oklch(0.17 0 0)',
                  border: '1px solid oklch(0.26 0 0)',
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="Ask anything..."
                  rows={1}
                  className="flex-1 bg-transparent text-[15px] resize-none outline-none leading-relaxed placeholder:text-[oklch(0.38_0_0)] disabled:opacity-50"
                  style={{
                    color: 'oklch(0.88 0 0)',
                    maxHeight: '160px',
                    overflowY: 'auto',
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30"
                  style={{ background: 'oklch(0.62 0.20 265)' }}
                  onMouseEnter={e => {
                    if (!(!input.trim() || loading))
                      (e.currentTarget as HTMLElement).style.opacity = '0.85';
                  }}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                >
                  <ArrowUp className="w-4 h-4" style={{ color: 'oklch(0.98 0 0)' }} />
                </button>
              </div>

              <p
                className="text-center text-[11px] mt-2"
                style={{ color: 'oklch(0.35 0 0)' }}
              >
                ↵ to send · Shift+↵ for new line
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
