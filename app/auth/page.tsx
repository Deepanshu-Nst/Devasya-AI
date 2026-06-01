'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const MotionDiv = motion.div as any;

export default function AuthPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard/chat');
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard/chat`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden text-foreground">
      {/* Cinematic noise texture */}
      <div className="cinematic-grain" />

      {/* Ambient background glow — cinematic and sparse */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden flex items-center justify-center">
        <div
          className="w-[800px] h-[600px] rounded-full blur-[160px] opacity-20 animate-breathe"
          style={{ background: 'oklch(0.65 0.20 250)' }}
        />
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="flex flex-col items-center">
          {/* Logo mark */}
          <div className="mb-10 text-center">
            <MotionDiv 
              initial={{ filter: 'blur(10px)', opacity: 0 }}
              animate={{ filter: 'blur(0px)', opacity: 1 }}
              transition={{ delay: 1, duration: 2.5, ease: 'easeOut' }}
              className="flex items-center justify-center mb-6"
            >
              <Sparkles className="w-8 h-8" style={{ color: 'oklch(0.65 0.20 250)' }} />
            </MotionDiv>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Devasya AI</h1>
            <p className="text-[11px] tracking-[0.18em] opacity-50 uppercase font-medium">Intelligence System</p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="w-full mb-6 px-4 py-3 rounded-md text-sm text-center"
              style={{
                color: 'oklch(0.70 0.18 25)',
                border: '1px solid oklch(0.55 0.20 25 / 0.3)',
                background: 'oklch(0.55 0.20 25 / 0.1)',
              }}
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-6 relative z-10 w-full">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="group relative w-full flex justify-between items-center py-4 px-2 bg-transparent outline-none transition-all duration-500 disabled:opacity-50 border-b border-[oklch(0.20_0_0)]"
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLElement).style.borderBottomColor = 'oklch(0.65 0.20 250 / 0.5)';
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  (e.currentTarget as HTMLElement).style.borderBottomColor = 'oklch(0.20 0 0)';
                }
              }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(to right, transparent, oklch(0.65 0.20 250))' }} />
              
              <span className="text-[14px] font-medium transition-colors duration-500 group-hover:text-[oklch(0.95_0_0)]" style={{ color: 'oklch(0.70 0 0)' }}>
                {loading ? 'Authenticating...' : 'Continue with Google'}
              </span>
              
              <div className="flex items-center gap-3">
                {!loading && (
                  <svg className="w-[18px] h-[18px] opacity-40 group-hover:opacity-100 transition-opacity duration-500" viewBox="0 0 24 24" style={{ fill: 'oklch(0.95 0 0)' }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
              </div>
            </button>
            <p className="text-[11px] text-center" style={{ color: 'oklch(0.40 0 0)' }}>
              Secure access via Supabase identity.
            </p>
          </div>
        </div>
      </MotionDiv>
    </div>
  );
}
