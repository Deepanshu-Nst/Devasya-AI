'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowUpRight, Brain, Zap, Shield, Sparkles } from 'lucide-react';

const MotionDiv = motion.div as any;

export default function Home() {
  const router = useRouter();
  // Use real Supabase session — avoids stale localStorage race condition
  const { user, isLoading } = useAuth();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard/chat');
    }
  }, [user, isLoading, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // In a real flow, you could pass this query to local storage or query params
    // and let the chat page auto-fill it once logged in.
    router.push('/auth');
  };

  const features = [
    {
      icon: Brain,
      title: 'Contextual Memory',
      description: 'Never repeat yourself. Devasya remembers your past thoughts and documents.',
    },
    {
      icon: Zap,
      title: 'Actionable Intelligence',
      description: 'Get pointed, specific answers instead of generic AI chatter.',
    },
    {
      icon: Shield,
      title: 'Private Workspace',
      description: 'Your thoughts, your data. Secured locally or via enterprise cloud.',
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">Devasya AI</h1>
          </div>
          <Button onClick={() => router.push('/auth')} variant="ghost" className="font-semibold">
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 text-center">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8 mb-16"
        >
          <h2 className="text-5xl md:text-7xl font-bold text-foreground text-balance tracking-tight leading-tight">
            Your AI that <span className="text-primary italic">remembers</span>, understands, and improves your thinking.
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Stop starting from scratch. Build a second brain that actively connects your ideas and gives you sharp, context-aware answers.
          </p>

          <MotionDiv
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex justify-center max-w-2xl mx-auto mt-10"
          >
            <form onSubmit={handleSearch} className="w-full relative group shadow-2xl shadow-primary/5 rounded-full">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything..."
                autoFocus
                className="w-full bg-card/80 backdrop-blur-xl border border-white/10 py-5 pl-8 pr-16 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-lg"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="absolute right-3 top-3 bottom-3 aspect-square bg-primary text-primary-foreground rounded-full flex items-center justify-center disabled:opacity-50 hover:scale-105 transition-transform"
              >
                <ArrowUpRight className="w-6 h-6" />
              </button>
            </form>
          </MotionDiv>
        </MotionDiv>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-24 max-w-5xl mx-auto text-left">
          {features.map((feature, idx) => (
            <MotionDiv
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + (0.1 * idx), duration: 0.6 }}
              className="p-8 rounded-3xl border border-white/5 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed font-medium text-[15px]">
                {feature.description}
              </p>
            </MotionDiv>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 text-center relative z-10">
        <p className="text-muted-foreground text-sm font-medium">Devasya AI — Your personal intelligence system.</p>
      </footer>
    </div>
  );
}
