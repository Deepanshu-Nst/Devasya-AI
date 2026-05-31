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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[140px] opacity-30"
          style={{ background: 'oklch(0.62 0.20 265 / 0.35)' }}
        />
        <div
          className="absolute bottom-[-5%] right-[-10%] w-[400px] h-[400px] rounded-full blur-[120px] opacity-20"
          style={{ background: 'oklch(0.70 0.18 300 / 0.3)' }}
        />
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Glass card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'oklch(0.155 0 0 / 0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid oklch(0.28 0 0)',
            boxShadow: '0 24px 64px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.62 0.20 265 / 0.08) inset',
          }}
        >
          {/* Logo mark */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{
                background: 'oklch(0.62 0.20 265 / 0.15)',
                border: '1px solid oklch(0.62 0.20 265 / 0.25)',
              }}
            >
              <Sparkles className="w-5 h-5" style={{ color: 'oklch(0.75 0.16 265)' }} />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight mb-1"
              style={{ color: 'oklch(0.93 0 0)' }}
            >
              Devasya AI
            </h1>
            <p className="text-sm text-center" style={{ color: 'oklch(0.55 0 0)' }}>
              Memory-driven intelligence system
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-lg text-sm"
              style={{
                background: 'oklch(0.52 0.20 25 / 0.12)',
                border: '1px solid oklch(0.52 0.20 25 / 0.3)',
                color: 'oklch(0.75 0.18 25)',
              }}
            >
              {error}
            </div>
          )}

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: loading ? 'oklch(0.22 0 0)' : 'oklch(0.22 0 0)',
              border: '1px solid oklch(0.30 0 0)',
              color: 'oklch(0.88 0 0)',
            }}
            onMouseEnter={e => {
              if (!loading) (e.currentTarget as HTMLElement).style.background = 'oklch(0.26 0 0)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'oklch(0.22 0 0)';
            }}
          >
            {loading ? (
              <>
                <div
                  className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'oklch(0.62 0.20 265)', borderTopColor: 'transparent' }}
                />
                Connecting...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18px" height="18px">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs" style={{ color: 'oklch(0.42 0 0)' }}>
            By continuing, you agree to our{' '}
            <span className="underline underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity">
              Terms
            </span>{' '}
            and{' '}
            <span className="underline underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity">
              Privacy Policy
            </span>
            .
          </p>
        </div>
      </MotionDiv>
    </div>
  );
}
