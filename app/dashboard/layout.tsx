'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Database, Sparkles, LogOut, User } from 'lucide-react';
import Link from 'next/link';

const MotionDiv = motion.div as any;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (!user) {
      // router.push('/auth');
    }
  }, [user, router]);

  const navItems = [
    { name: 'Chat', href: '/dashboard/chat', icon: MessageSquare, description: 'Fluid Thinking' },
    { name: 'Memory', href: '/dashboard/memory', icon: Database, description: 'Knowledge Base' },
  ];

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
          <div className="p-3 rounded-xl flex items-center gap-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors hover:bg-muted/50">
            <User className="w-5 h-5" />
            <div className="hidden md:block truncate text-sm">
              {user?.full_name || 'User Profile'}
            </div>
          </div>
          <div 
            onClick={() => {
              logout();
              router.push('/auth');
            }}
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
