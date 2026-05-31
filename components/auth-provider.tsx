'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Zustand store actions — kept in sync with Supabase
  const { setAuth, logout } = useAuthStore();

  const syncSession = (session: Session | null) => {
    setSession(session);
    setUser(session?.user ?? null);

    if (session?.user) {
      // Sync into Zustand store so dashboard layout & home page read consistent auth state
      setAuth(
        {
          id: session.user.id,
          email: session.user.email ?? '',
          full_name:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email?.split('@')[0] ||
            'User',
          avatar_url:
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture ||
            null,
        },
        session.access_token
      );
    } else {
      // Clear Zustand store on sign-out
      logout();
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;

        syncSession(session);

        // Redirect unauthenticated users away from protected routes
        const isPublic = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith('/auth'));
        if (!session && !isPublic) {
          router.push('/auth');
        }
      } catch (error) {
        console.error('Error fetching session:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);

      const isPublic = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith('/auth'));

      if (!session && !isPublic) {
        router.push('/auth');
      } else if (session && pathname === '/auth') {
        router.push('/dashboard/chat');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-primary/20 rounded-full mb-4"></div>
          <div className="text-muted-foreground text-sm font-medium">Loading session...</div>
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
