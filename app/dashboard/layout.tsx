'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useAuthStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Database, Sparkles, LogOut, User, CheckSquare } from 'lucide-react';
import Link from 'next/link';

const MotionDiv = motion.div as any;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Bug 1 Fix: Use real Supabase session from AuthProvider, not stale Zustand state
  const { user: supabaseUser, isLoading } = useAuth();
  // Keep Zustand for user display data (it's already synced by AuthProvider)
  const { user: storeUser } = useAuthStore();

  useEffect(() => {
    // Bug 1 Fix: Re-enabled auth guard — redirect to /auth if no Supabase session
    if (!isLoading && !supabaseUser) {
      router.push('/auth');
    }
  }, [supabaseUser, isLoading, router]);

  const handleLogout = async () => {
    try {
      // 'global' scope revokes the refresh token server-side so this session
      // cannot be silently restored from any tab or device.
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.error('Sign out error (non-fatal):', err);
    } finally {
      // Explicitly clear in-memory store regardless of signOut outcome
      const { logout } = useAuthStore.getState();
      logout();
      router.push('/auth');
    }
  };

  const navItems = [
    { name: 'Chat', href: '/dashboard/chat', icon: MessageSquare, description: 'Fluid Thinking' },
    { name: 'Memory', href: '/dashboard/memory', icon: Database, description: 'Knowledge Base' },
    { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare, description: 'Structured Tasks' },
  ];

  // Show loading state while auth is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-primary/20 rounded-full mb-4"></div>
          <div className="text-muted-foreground text-sm font-medium">Loading workspace...</div>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated (redirect will happen via useEffect)
  if (!supabaseUser) {
    return null;
  }

  return (
    <div className="flex bg-background min-h-screen text-foreground overflow-hidden selection:bg-primary/20">
      {/* Sidebar */}
      <aside className="w-16 md:w-64 border-r border-border/50 bg-card/30 backdrop-blur-3xl flex flex-col justify-between py-6 sticky top-0 h-screen transition-all duration-300">
        <div>
          <div className="px-4 md:px-6 mb-8 flex items-center md:items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold shadow-[0_0_15px_rgba(var(--primary),0.3)]">
              D
            </div>
            <div className="hidden md:block">
              <h1 className="font-semibold text-lg tracking-tight">Devasya AI</h1>
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Personal Brain</span>
            </div>
          </div>

          <nav className="space-y-2 px-2 md:px-4">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href}>
                  <div className={`relative px-3 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 group overflow-hidden ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                    {isActive && (
                      <MotionDiv
                        layoutId="activeTab"
                        className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <item.icon className={`w-5 h-5 relative z-10 ${isActive ? 'text-primary' : 'group-hover:scale-110 transition-transform'}`} />
                    <div className="hidden md:block relative z-10">
                      <p className="font-medium text-sm">{item.name}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-2 md:px-4 space-y-2">
          <div className="p-3 rounded-xl flex items-center gap-3 text-muted-foreground transition-colors">
            {supabaseUser?.user_metadata?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={supabaseUser.user_metadata.avatar_url}
                alt="avatar"
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <User className="w-5 h-5" />
            )}
            <div className="hidden md:block truncate text-sm">
              {storeUser?.full_name || supabaseUser?.email || 'User Profile'}
            </div>
          </div>
          {/* Bug 3 Fix: Logout now properly calls supabase.auth.signOut() */}
          <div
            onClick={handleLogout}
            className="p-3 rounded-xl flex items-center gap-3 text-red-500/70 hover:text-red-500 cursor-pointer transition-colors hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5" />
            <div className="hidden md:block text-sm font-medium">
              Disconnect
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-screen max-w-full overflow-hidden">
        {/* Subtle dynamic background lighting */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        
        <header className="h-16 border-b border-border/40 bg-background/50 backdrop-blur-md flex items-center px-8 z-10 w-full justify-between">
          <div className="flex-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground capitalize">
              {pathname.split('/').pop() || 'Workspace'}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-grid-white/[0.02] relative">
          <AnimatePresence mode="wait">
            <MotionDiv
              key={pathname}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-full"
            >
              {children}
            </MotionDiv>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
