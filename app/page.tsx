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
    <div className="min-h-screen relative overflow-hidden bg-[oklch(0.11_0_0)] text-foreground">
      {/* Ambient Depth Layer */}
      <div className="absolute inset-0 ambient-field pointer-events-none z-0" />

      {/* Atmospheric Depth Layering - Multi-stop gradient for vignette falloff */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'radial-gradient(circle at 50% 0%, oklch(0.65 0.20 250 / 0.08) 0%, transparent 60%)'
        }} 
      />
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'radial-gradient(ellipse at 50% 100%, oklch(0.11 0 0) 40%, transparent 100%)'
        }} 
      />

      {/* Ambient Breathing Light */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full blur-[140px] pointer-events-none animate-breathe" style={{ background: 'oklch(0.65 0.20 250)', opacity: 0.05 }} />

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
            className="flex justify-center max-w-2xl mx-auto mt-32 relative z-20"
          >
            <form onSubmit={handleSearch} className="w-full relative group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything..."
                autoFocus
                className="w-full bg-[oklch(0.08_0_0)] py-5 pl-8 pr-16 rounded-full focus:outline-none transition-all duration-150 text-lg placeholder-[oklch(0.40_0_0)] text-[oklch(0.95_0_0)]"
                style={{
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                }}
                onFocus={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 0 12px oklch(0.65 0.20 250 / 0.15), inset 0 2px 4px rgba(0,0,0,0.5)';
                }}
                onBlur={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.5)';
                }}
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="absolute right-2 top-2 bottom-2 aspect-square rounded-full flex items-center justify-center disabled:opacity-30 transition-all duration-200"
                style={{ color: query.trim() ? 'oklch(0.65 0.20 250)' : 'oklch(0.40 0 0)' }}
                onMouseEnter={e => {
                  if (query.trim()) {
                    (e.currentTarget as HTMLElement).style.filter = 'drop-shadow(0 0 8px oklch(0.65 0.20 250 / 0.6))';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.filter = 'none';
                }}
              >
                <ArrowUpRight className="w-6 h-6" />
              </button>
            </form>
          </MotionDiv>
        </MotionDiv>
        {/* Floating Asymmetric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-24 relative z-10">
          {features.map((feature, index) => {
            // Restrained asymmetric spacing
            const mtClass = index === 0 ? 'mt-0' : index === 1 ? 'mt-12 md:mt-16' : 'mt-6 md:mt-8';
            const paddingClass = index === 0 ? 'p-8 md:p-10' : 'p-6 md:p-8';
            const titleClass = index === 0 ? 'text-lg md:text-xl' : 'text-base md:text-lg';
            
            return (
              <MotionDiv
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1, duration: 0.8 }}
                className={`flex flex-col relative group ${mtClass} ${paddingClass} rounded-3xl transition-all duration-500`}
                style={{
                  background: index === 0 ? 'oklch(0.13 0 0)' : 'transparent',
                  borderTop: index !== 0 ? '1px solid oklch(0.18 0 0)' : 'none',
                }}
              >
                {/* Micro-tonal hover separation */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" style={{ background: 'oklch(0.14 0 0)' }} />
                
                <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                  <feature.icon className="w-5 h-5" style={{ color: index === 0 ? 'oklch(0.65 0.20 250)' : 'oklch(0.50 0 0)' }} />
                  <div>
                    <h3 className={`font-semibold tracking-tight text-[oklch(0.95_0_0)] mb-3 ${titleClass}`}>
                      {feature.title}
                    </h3>
                    <p className="text-[oklch(0.60_0_0)] leading-relaxed text-[14px]">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </MotionDiv>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 text-center relative z-10">
        <p className="text-muted-foreground text-sm font-medium">Devasya AI — Your personal intelligence system.</p>
      </footer>
    </div>
  );
}
