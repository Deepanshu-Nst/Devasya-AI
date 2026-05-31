'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowUpRight, BrainCircuit, FileText, ChevronRight, Plus, ChevronDown, Zap, Brain, Trash2, AlertCircle } from 'lucide-react';
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
  const [sessions, setSessions] = useState<{id: string, title: string, created_at: string}[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [hasMemory, setHasMemory] = useState<boolean | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [isDeepThinking, setIsDeepThinking] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<number[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedSessionId = localStorage.getItem('devasya_session_id');
    const saved = localStorage.getItem('devasya_chat');
    if (savedSessionId) setCurrentSessionId(savedSessionId);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {}
    }
    
    // Load sessions from API with a clear UI indication that the server might be cold-starting
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
    if (messages.length > 0) {
      localStorage.setItem('devasya_chat', JSON.stringify(messages));
    }
    if (currentSessionId) {
      localStorage.setItem('devasya_session_id', currentSessionId);
    } else {
      localStorage.removeItem('devasya_session_id');
    }
  }, [messages, currentSessionId]);

  // Bug 8 Fix: Correctly map ChatMessage fields (p.role, p.content) from the backend
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
          // Backend returns ChatMessage with `content` field, not nested response.insights
          content: msg.content || '',
        }));
        setMessages(formatted);
      }
    } catch(e) {
      console.error('Failed to load session:', e);
    }
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
      if (currentSessionId === id) {
        startNewChat();
      }
    } catch(e) {}
  };

  useEffect(() => {
    // Check if user has any memories
    const checkMemories = async () => {
      try {
        const res = await memoryApi.list(0, 1);
        if (res.status === 200 && res.data) {
          const count = (res.data as any).total || 0;
          setHasMemory(count > 0);
          if (count === 0) {
             setShowEmptyState(true);
          }
        } else {
          // If we can't check (network error etc.), allow chat anyway
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
    if (expandedThinking.includes(index)) {
      setExpandedThinking(expandedThinking.filter(i => i !== index));
    } else {
      setExpandedThinking([...expandedThinking, index]);
    }
  };

  const handleSend = async (e?: React.FormEvent, directInput?: string) => {
    if (e) e.preventDefault();
    const query = directInput || input;
    if (!query.trim() || loading) return;

    if (showEmptyState) setShowEmptyState(false);
    setSendError(null);

    const userMessage: Message = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await queryApi.ask(userMessage.content, true, currentSessionId || undefined);

      if (response.status === 200 && response.data) {
        const resData = response.data as any;
        
        // Bug 5 Fix: API QueryResponse has field `response` (not `insights`)
        // The orchestrator returns `insights` mapped to `response` in query.py
        const answerText = resData.response || resData.insights || "I processed your request but couldn't generate a response.";
        
        // If it's a new session, backend generated an ID for it
        if (!currentSessionId && resData.session_id) {
           setCurrentSessionId(resData.session_id);
           // Refresh session list
           loadSessions();
        }

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: answerText,
          connections: resData.connections,
          actions: resData.actions,
          context: resData.context_used,
          isDeep: isDeepThinking
        }]);
      } else {
        // Show the actual error from the server if available
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

  return (
    <div className="flex h-full w-full relative">
      {/* Sessions Sidebar */}
      <div className="w-64 border-r border-white/5 bg-card/30 backdrop-blur-md hidden md:flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-white/5">
          <button 
             onClick={startNewChat}
             className="w-full flex items-center gap-2 justify-center py-2.5 px-4 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl font-medium transition-colors"
          >
             <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar">
          {loading && sessions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground animate-pulse flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4"></div>
                <p className="text-sm">Waking up AI Core...</p>
                <p className="text-xs opacity-60 mt-1">First load may take 30-60s on free tier</p>
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm px-4 text-center">
              No previous threads
            </div>
          ) : sessions.map(s => (
             <div 
               key={s.id}
               className={`w-full group flex items-center justify-between rounded-lg transition-colors ${currentSessionId === s.id ? 'bg-white/10 text-foreground font-medium' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
             >
               <button 
                 onClick={() => loadSession(s.id)} 
                 className="flex-1 text-left truncate px-3 py-2.5 text-sm"
               >
                 {s.title || 'Conversation'}
               </button>
               <button
                 onClick={(e) => handleDeleteSession(e, s.id)}
                 className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
               >
                 <Trash2 className="w-3.5 h-3.5" />
               </button>
             </div>
          ))}
        </div>
      </div>

      {/* Dynamic Main Area */}
      <div className="flex-1 flex flex-col relative max-w-4xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-8 no-scrollbar pb-40">
        <AnimatePresence mode="wait">
          {hasMemory === null ? (
            <MotionDiv key="loading" className="flex justify-center items-center h-full">
               <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            </MotionDiv>
          ) : showEmptyState ? (
            <MotionDiv 
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              className="flex flex-col items-center justify-center h-[70vh] text-center max-w-lg mx-auto"
            >
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-primary/20">
                <BrainCircuit className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3 text-foreground/90">Let&apos;s build your intelligence system</h1>
              <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
                Start by adding something about you, your work, or uploading your documents.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button
                  onClick={() => router.push('/dashboard/memory')}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-4 rounded-2xl font-medium flex items-center justify-center gap-2 shadow-sm transition-transform hover:scale-[1.02]"
                >
                  <Plus className="w-5 h-5" /> Add Memory
                </button>
                <button
                  onClick={() => setShowEmptyState(false)}
                  className="flex-1 bg-card border border-white/5 hover:bg-white/5 px-6 py-4 rounded-2xl font-medium flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                >
                  Ask Anyway <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </MotionDiv>
          ) : (
            <MotionDiv key="chat" className="space-y-8">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-50">
                  <Sparkles className="w-8 h-8 mb-4" />
                  <p className="text-lg font-medium">How can I help you think today?</p>
                </div>
              )}
              {messages.map((m, idx) => (
                <MotionDiv
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={idx}
                  className={`flex gap-4 max-w-3xl ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-card border border-white/5'}`}>
                    {m.role === 'user' ? <span className="text-xs font-bold font-mono">U</span> : <Sparkles className="w-4 h-4 text-primary" />}
                  </div>
                  <div className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-6 py-4 rounded-3xl ${m.role === 'user' ? 'bg-white/10 text-foreground rounded-tr-md' : 'bg-transparent text-foreground/90'}`}>
                      <div className="leading-relaxed whitespace-pre-wrap text-[16px]">
                        {m.content}
                      </div>
                    </div>
                    
                    {/* Assistant Metadata / Collapsible Thinking */}
                    {m.role === 'assistant' && (m.connections || m.actions || (m.context && m.context.length > 0)) && (
                      <div className="w-full flex justify-start pl-2">
                        <button 
                          onClick={() => toggleThinking(idx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/5"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedThinking.includes(idx) ? 'rotate-180' : ''}`} />
                          Show Thinking
                        </button>
                      </div>
                    )}

                    {m.role === 'assistant' && expandedThinking.includes(idx) && (
                      <MotionDiv 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="w-full max-w-2xl bg-card/30 border border-white/5 rounded-2xl p-5 mt-2 space-y-5 text-sm backdrop-blur-md overflow-hidden"
                      >
                        {m.context && m.context.length > 0 && (
                          <div className="flex items-center gap-2 text-primary/80 mb-2">
                            <FileText className="w-4 h-4" />
                            <span className="text-xs font-semibold">{m.context[0]}</span>
                          </div>
                        )}
                        {m.connections && (
                          <div>
                            <h4 className="font-semibold text-muted-foreground mb-1 flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Key Insight</h4>
                            <p className="text-foreground/80 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 line-clamp-3">{m.connections}</p>
                          </div>
                        )}
                        {m.actions && (
                          <div className="mt-4">
                            <h4 className="font-semibold text-muted-foreground mb-1">Suggested Action</h4>
                            <p className="text-foreground/80 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 line-clamp-3">{m.actions}</p>
                          </div>
                        )}
                      </MotionDiv>
                    )}
                  </div>
                </MotionDiv>
              ))}
              {loading && (
                <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 max-w-3xl">
                  <div className="w-8 h-8 rounded-full bg-card border border-white/5 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <div className="px-5 py-4 flex gap-2 items-center text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </MotionDiv>
              )}
              <div ref={endRef} />
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>

      {/* Error Banner */}
      {sendError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-2 rounded-xl max-w-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{sendError}</span>
          <button onClick={() => setSendError(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Input */}
      {hasMemory !== null && !showEmptyState && (
        <MotionDiv 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/80 to-transparent p-4 md:p-6 pb-6"
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-3">
            {/* Quick / Deep Toggle */}
            <div className="flex gap-2 w-max bg-card/60 backdrop-blur-md p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setIsDeepThinking(false)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!isDeepThinking ? 'bg-white/10 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Zap className="w-3.5 h-3.5" /> Quick Answer
              </button>
              <button 
                onClick={() => setIsDeepThinking(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isDeepThinking ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Brain className="w-3.5 h-3.5" /> Deep Thinking
              </button>
            </div>

            <form onSubmit={(e) => handleSend(e)} className="relative group flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
                placeholder="Ask anything..."
                className="w-full bg-card/80 backdrop-blur-2xl border border-white/10 py-4 pl-6 pr-14 rounded-2xl shadow-xl focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all text-[16px] placeholder:text-muted-foreground/50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="absolute right-3 p-2 bg-primary text-primary-foreground rounded-xl flex items-center justify-center disabled:opacity-50 transition-transform"
              >
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </MotionDiv>
      )}
      </div>
    </div>
  );
}
