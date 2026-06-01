'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/auth'];
const isPublicRoute = (path: string) =>
  PUBLIC_ROUTES.some((r) => path === r || path.startsWith('/auth'));

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const initialized = useRef(false);

  const { setAuth, logout } = useAuthStore();

  const syncSession = (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);

    if (newSession?.user) {
      setAuth(
        {
          id: newSession.user.id,
          email: newSession.user.email ?? '',
          full_name:
            newSession.user.user_metadata?.full_name ||
            newSession.user.user_metadata?.name ||
            newSession.user.email?.split('@')[0] ||
            'User',
          avatar_url:
            newSession.user.user_metadata?.avatar_url ||
            newSession.user.user_metadata?.picture ||
            null,
        },
        newSession.access_token
      );
    } else {
      logout();
    }
  };

  // ── ONE-TIME initialization on mount ────────────────────────────────────
  // Do NOT depend on `pathname` here — that caused initAuth() to re-run on
  // every navigation, creating race conditions and stale-state redirects.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;
        syncSession(session);
      } catch (error) {
        console.error('Auth init error:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Real-time auth state listener — fires on login / logout / token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      syncSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Route protection — runs whenever pathname or auth state changes ──────
  // This is a SEPARATE effect so it doesn't trigger re-initialization.
  useEffect(() => {
    if (isLoading) return; // Wait until we know auth state

    if (!session && !isPublicRoute(pathname)) {
      // Protected route accessed without session → redirect to sign-in
      router.push('/auth');
    } else if (session && pathname === '/auth') {
      // Already signed in and landed on sign-in page → redirect to app
      router.push('/dashboard/chat');
    }
  }, [session, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="text-muted-foreground text-[13px] font-mono tracking-widest uppercase">
            reconstructing thread
            <span className="animate-cursor ml-1 text-primary">▍</span>
          </div>
          <div className="h-0.5 w-24 bg-primary/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary/40 rounded-full animate-pulse w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
