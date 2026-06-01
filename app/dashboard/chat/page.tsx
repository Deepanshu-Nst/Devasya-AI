'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowUp,
  BrainCircuit,
  FileText,
  ChevronDown,
  Zap,
  Brain,
  Trash2,
  AlertCircle,
  Plus,
  User,
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
        const errMsg = response.error || 'Failed to get a response.';
        setSendError(errMsg);
        setMessages(prev => [...prev, { role: 'assistant', content: `[Error] ${errMsg}` }]);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network error.';
      setSendError(errMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: `[Network Error] ${errMsg}` }]);
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

  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => new Date(s.created_at).toDateString() === today);
  const earlierSessions = sessions.filter(s => new Date(s.created_at).toDateString() !== today);

  const SessionItem = ({ s }: { s: { id: string; title: string; created_at: string } }) => (
    <div
      className="group flex items-center justify-between transition-colors duration-150 cursor-pointer"
      onClick={() => loadSession(s.id)}
      style={{
        color: currentSessionId === s.id ? 'oklch(0.95 0 0)' : 'oklch(0.50 0 0)',
      }}
      onMouseEnter={e => {
        if (currentSessionId !== s.id) (e.currentTarget as HTMLElement).style.color = 'oklch(0.80 0 0)';
      }}
      onMouseLeave={e => {
        if (currentSessionId !== s.id) (e.currentTarget as HTMLElement).style.color = 'oklch(0.50 0 0)';
      }}
    >
      <div className="flex-1 text-[13px] truncate py-1.5">{s.title || 'Conversation'}</div>
      <button
        onClick={e => handleDeleteSession(e, s.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity pl-2"
        style={{ color: 'oklch(0.40 0 0)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.20 25)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.40 0 0)')}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* ─── Sessions Sidebar (Sparse) ─── */}
      <div className="hidden md:flex w-56 shrink-0 flex-col h-full pl-6 pt-6 pb-6">
        <button
          onClick={startNewChat}
          className="flex items-center gap-2 text-[13px] font-medium transition-colors mb-6"
          style={{ color: 'oklch(0.65 0.20 250)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.75 0.20 250)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.65 0.20 250)')}
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        <div className="flex-1 overflow-y-auto no-scrollbar pr-4">
          {loading && sessions.length === 0 ? (
            <div className="text-[12px] animate-pulse" style={{ color: 'oklch(0.40 0 0)' }}>retrieving history...</div>
          ) : sessions.length === 0 ? (
            <div className="text-[12px]" style={{ color: 'oklch(0.40 0 0)' }}>No history</div>
          ) : (
            <div className="space-y-6">
              {todaySessions.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'oklch(0.30 0 0)' }}>
                    Today
                  </div>
                  <div className="space-y-0.5">
                    {todaySessions.map(s => <SessionItem key={s.id} s={s} />)}
                  </div>
                </div>
              )}
              {earlierSessions.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'oklch(0.30 0 0)' }}>
                    Earlier
                  </div>
                  <div className="space-y-0.5">
                    {earlierSessions.map(s => <SessionItem key={s.id} s={s} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Chat Area ─── */}
      <div className="flex-1 flex flex-col h-full relative">
        <AnimatePresence>
          {sendError && (
            <MotionDiv
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 text-sm"
              style={{ color: 'oklch(0.70 0.18 25)' }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{sendError}</span>
            </MotionDiv>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto styled-scrollbar px-4 sm:px-8">
          <div className="max-w-3xl mx-auto py-12 pb-48 space-y-8">
            <AnimatePresence mode="wait">
              {hasMemory === null ? (
                <MotionDiv key="checking" className="flex justify-center h-20">
                  <Sparkles className="w-5 h-5 animate-pulse" style={{ color: 'oklch(0.65 0.20 250)' }} />
                </MotionDiv>
              ) : showEmptyState ? (
                <MotionDiv
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center pt-20 text-center"
                >
                  <BrainCircuit className="w-10 h-10 mb-6" style={{ color: 'oklch(0.20 0 0)' }} />
                  <h2 className="text-2xl font-semibold tracking-tight mb-3">Intelligence Core</h2>
                  <p className="text-[15px] mb-8 max-w-md" style={{ color: 'oklch(0.50 0 0)' }}>
                    Devasya requires context. Feed it documents or write notes about your work to create a functional workspace.
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => router.push('/dashboard/memory')}
                      className="text-[13px] font-medium transition-colors"
                      style={{ color: 'oklch(0.65 0.20 250)' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.75 0.20 250)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.65 0.20 250)')}
                    >
                      Initialize Memory →
                    </button>
                  </div>
                </MotionDiv>
              ) : (
                <MotionDiv
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  className="flex flex-col space-y-24"
                >
                  {messages.map((m, idx) => (
                    <MotionDiv
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex gap-5 relative group cognitive-surface p-4 rounded-2xl -mx-4"
                    >
                      {/* Active Conversational Emphasis */}
                      {idx === messages.length - 1 && m.role === 'assistant' && !loading && (
                        <div className="absolute inset-y-[-32px] inset-x-[-32px] conversational-lane opacity-[0.05] pointer-events-none" />
                      )}
                      
                      {/* Avatar */}
                      <div className="shrink-0 mt-1 relative z-10">
                        {m.role === 'user' ? (
                          <div className="w-6 h-6 flex items-center justify-center">
                            <User className="w-4 h-4" style={{ color: 'oklch(0.50 0 0)' }} />
                          </div>
                        ) : (
                          <>
                            {idx === messages.length - 1 && loading && (
                              <div className="absolute inset-0 bg-[oklch(0.65_0.20_250)] rounded-full blur-[8px] animate-breathe opacity-50 pointer-events-none" />
                            )}
                            <Sparkles 
                              className={`w-6 h-6 relative z-10 ${idx === messages.length - 1 && loading ? 'animate-pulse-glow' : ''}`} 
                              style={{ color: 'oklch(0.65 0.20 250)' }} 
                            />
                          </>
                        )}
                      </div>

                      {/* Content — completely borderless, letting typography breathe */}
                      <div className="flex-1 min-w-0 flex flex-col gap-4 pt-0.5">
                        <div
                          className="leading-relaxed text-[15px] whitespace-pre-wrap font-medium max-w-[55ch]"
                          style={{ color: m.role === 'user' ? 'oklch(0.95 0 0)' : 'oklch(0.85 0 0)' }}
                        >
                          {m.content}
                          {m.role === 'assistant' && loading && idx === messages.length - 1 && (
                            <span className="animate-cursor ml-1 text-[15px]" style={{ color: 'oklch(0.65 0.20 250)' }}>▍</span>
                          )}
                        </div>

                        {/* Reasoning block */}
                        {m.role === 'assistant' && (m.connections || m.actions || (m.context && m.context.length > 0)) && (
                          <div className="max-w-[60ch]">
                            <button
                              onClick={() => toggleThinking(idx)}
                              className="flex items-center gap-1.5 text-[12px] transition-colors duration-150"
                              style={{ color: 'oklch(0.40 0 0)' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.65 0.20 250)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'oklch(0.40 0 0)')}
                            >
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-150 ${expandedThinking.includes(idx) ? 'rotate-180' : ''}`}
                              />
                              {expandedThinking.includes(idx) ? 'Hide reasoning' : 'Show reasoning'}
                            </button>

                            <AnimatePresence>
                              {expandedThinking.includes(idx) && (
                                <MotionDiv
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden mt-4"
                                >
                                  <div
                                    className="pl-4 space-y-4 py-2"
                                    style={{ borderLeft: '1px solid oklch(0.20 0 0)' }}
                                  >
                                    {Array.isArray(m.context) && m.context.length > 0 && (
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5" style={{ color: 'oklch(0.65 0.20 250)' }} />
                                        <span className="text-[12px]" style={{ color: 'oklch(0.50 0 0)' }}>{m.context[0]}</span>
                                      </div>
                                    )}
                                    {m.connections && (
                                      <div>
                                        <div className="text-[11px] font-mono mb-1.5" style={{ color: 'oklch(0.35 0 0)' }}>[INSIGHT]</div>
                                        <p className="text-[13px] leading-relaxed" style={{ color: 'oklch(0.60 0 0)' }}>{m.connections}</p>
                                      </div>
                                    )}
                                    {m.actions && (
                                      <div>
                                        <div className="text-[11px] font-mono mb-1.5" style={{ color: 'oklch(0.35 0 0)' }}>[ACTION]</div>
                                        <p className="text-[13px] leading-relaxed" style={{ color: 'oklch(0.60 0 0)' }}>{m.actions}</p>
                                      </div>
                                    )}
                                  </div>
                                </MotionDiv>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* Follow-up actions (only on AI messages) */}
                        {m.role === 'assistant' && Array.isArray(m.actions) && m.actions.length > 0 && (
                          <div className="mt-8 flex flex-wrap gap-2 max-w-[65ch]">
                            {m.actions.map((action: string) => (
                              <button
                                key={action}
                                onClick={() => handleActionClick(action)}
                                disabled={loading}
                                className="px-3 py-1.5 text-[12px] font-medium border rounded-md transition-all duration-150 disabled:opacity-50"
                                style={{
                                  borderColor: 'oklch(0.18 0 0)',
                                  color: 'oklch(0.55 0 0)',
                                }}
                                onMouseEnter={e => {
                                  if (!loading) {
                                    (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.65 0.20 250 / 0.4)';
                                    (e.currentTarget as HTMLElement).style.color = 'oklch(0.65 0.20 250)';
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (!loading) {
                                    (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.18 0 0)';
                                    (e.currentTarget as HTMLElement).style.color = 'oklch(0.55 0 0)';
                                  }
                                }}
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </MotionDiv>
                  ))}

                  {/* Ambient Skeleton Loading State */}
                  {loading && !messages[messages.length - 1]?.content && (
                    <MotionDiv
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-5 relative p-4"
                    >
                      <div className="absolute inset-y-[-24px] inset-x-[-32px] conversational-lane opacity-[0.05] animate-breathe pointer-events-none" />
                      <div className="shrink-0 mt-1 relative z-10">
                        <Sparkles className="w-5 h-5 opacity-40" style={{ color: 'oklch(0.65 0.20 250)' }} />
                      </div>
                      <div className="flex-1 space-y-3 pt-2 max-w-[60ch]">
                        <div className="h-1.5 w-2/3 bg-[oklch(0.18_0_0)] rounded-full animate-breathe opacity-20" />
                        <div className="h-1.5 w-1/2 bg-[oklch(0.18_0_0)] rounded-full animate-breathe opacity-20" />
                        <div className="h-1.5 w-5/6 bg-[oklch(0.18_0_0)] rounded-full animate-breathe opacity-20" />
                      </div>
                    </MotionDiv>
                  )}
                  <div ref={endRef} />
                </MotionDiv>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ─── Composer (Dark Glass in Darkness) ─── */}
        {hasMemory !== null && !showEmptyState && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-16 bg-transparent">
            {/* Subtle gradient to obscure content behind the composer, but deeply feathered */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, oklch(0.11 0 0) 40%, transparent)' }} />
            
            <div className="max-w-2xl mx-auto flex flex-col items-center relative z-10">
              <div
                className="w-full flex items-end gap-3 px-5 py-3 transition-all duration-150 group cognitive-surface rounded-2xl"
                style={{ 
                  background: 'oklch(0.11 0 0 / 0.55)',
                  backdropFilter: 'blur(16px)'
                }}
                onFocus={e => {
                  (e.currentTarget as HTMLElement).style.background = 'oklch(0.12 0 0 / 0.85)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 0 24px oklch(0.14 0 0 / 0.5)';
                }}
                onBlur={e => {
                  (e.currentTarget as HTMLElement).style.background = 'oklch(0.11 0 0 / 0.55)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div className="flex flex-col justify-end pb-2">
                  <button
                    onClick={() => setIsDeepThinking(!isDeepThinking)}
                    className="w-6 h-6 flex items-center justify-center transition-all duration-150 rounded-full"
                    title={isDeepThinking ? "Deep Thinking: ON" : "Deep Thinking: OFF"}
                    style={{ color: isDeepThinking ? 'oklch(0.65 0.20 250)' : 'oklch(0.40 0 0)' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.color = 'oklch(0.65 0.20 250)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = isDeepThinking ? 'oklch(0.65 0.20 250)' : 'oklch(0.40 0 0)';
                    }}
                  >
                    {isDeepThinking ? <Brain className="w-4 h-4 animate-pulse-glow" /> : <Zap className="w-4 h-4" />}
                  </button>
                </div>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="Ask anything..."
                  rows={1}
                  className="flex-1 bg-transparent text-[15px] resize-none outline-none py-2 leading-relaxed disabled:opacity-50 transition-all font-medium"
                  style={{ color: 'oklch(0.95 0 0)', maxHeight: '200px' }}
                />

                <div className="flex flex-col justify-end pb-1.5">
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    className="w-8 h-8 flex items-center justify-center transition-all duration-150 disabled:opacity-20"
                    style={{ color: 'oklch(0.95 0 0)' }}
                    onMouseEnter={e => {
                      if (!(!input.trim() || loading)) {
                        (e.currentTarget as HTMLElement).style.color = 'oklch(0.65 0.20 250)';
                      }
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = 'oklch(0.95 0 0)';
                    }}
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
