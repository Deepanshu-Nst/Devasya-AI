'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useAuthStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BookOpen, CheckSquare, LogOut, Sparkles, Menu, X } from 'lucide-react';
import Link from 'next/link';

const MotionDiv = motion.div as any;

const NAV_ITEMS = [
  { name: 'Chat', href: '/dashboard/chat', icon: MessageSquare, description: 'Intelligence' },
  { name: 'Memory', href: '/dashboard/memory', icon: BookOpen, description: 'Knowledge' },
  { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare, description: 'Execution' },
];

const PAGE_TITLES: Record<string, string> = {
  chat: 'Chat',
  memory: 'Memory',
  tasks: 'Tasks',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: supabaseUser, isLoading } = useAuth();
  const { user: storeUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !supabaseUser) router.push('/auth');
  }, [supabaseUser, isLoading, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try { await supabase.auth.signOut({ scope: 'global' }); } catch (err) {}
    finally {
      const { logout } = useAuthStore.getState();
      logout();
      router.push('/auth');
    }
  };

  const currentSection = pathname.split('/').pop() || 'workspace';
  const pageTitle = PAGE_TITLES[currentSection] || 'Workspace';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Sparkles className="w-5 h-5 animate-pulse" style={{ color: 'oklch(0.65 0.20 250)' }} />
      </div>
    );
  }

  if (!supabaseUser) return null;

  const displayName = storeUser?.full_name || supabaseUser?.user_metadata?.full_name || supabaseUser?.email?.split('@')[0] || 'User';

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-background">
      {/* Minimal Logo Area */}
      <div className="px-6 pt-8 pb-8">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4" style={{ color: 'oklch(0.65 0.20 250)' }} />
          <span className="font-semibold text-sm tracking-tight" style={{ color: 'oklch(0.95 0 0)' }}>
            Devasya
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-4 space-y-2 flex-1 mt-6">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.name} href={item.href}>
              <div
                className="relative flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition-all duration-150 group cursor-pointer"
                style={{
                  background: 'transparent',
                  color: isActive ? 'oklch(0.95 0 0)' : 'oklch(0.40 0 0)',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0 0)';
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = 'oklch(0.40 0 0)';
                }}
              >
                {/* Active Indicator — Diffuse ambient glow */}
                {isActive && (
                  <MotionDiv
                    layoutId="activeNav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-full blur-[12px]"
                    style={{ background: 'oklch(0.65 0.20 250)', opacity: 0.3 }}
                    initial={false}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}

                <item.icon
                  className={`w-[16px] h-[16px] shrink-0 transition-all duration-150 ${isActive ? 'animate-pulse-glow opacity-100' : 'opacity-40 group-hover:opacity-100'}`}
                  style={{ color: isActive ? 'oklch(0.65 0.20 250)' : 'inherit' }}
                />
                <span className="text-[13px] font-medium leading-none tracking-wide" style={{ color: 'inherit' }}>
                  {item.name}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Area */}
      <div className="px-4 pb-6 mt-auto">
        <div className="px-3 py-3 flex items-center justify-between group">
          <span className="text-[12px] font-medium truncate transition-colors duration-150" style={{ color: 'oklch(0.40 0 0)' }}>
            {displayName}
          </span>
          <button
            onClick={handleLogout}
            className="opacity-0 group-hover:opacity-100 transition-all duration-150"
            title="Sign Out"
            style={{ color: 'oklch(0.30 0 0)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0 0)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'oklch(0.30 0 0)';
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Matte noise texture */}
      <div className="bg-noise" />

      {/* ─── Desktop Sidebar ─── */}
      <aside
        className="hidden md:flex w-56 shrink-0 flex-col sticky top-0 h-screen z-10"
        style={{ borderRight: '1px solid oklch(0.13 0 0)' }}
      >
        <SidebarContent />
      </aside>

      {/* ─── Mobile Sidebar ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <MotionDiv
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'oklch(0 0 0 / 0.8)' }}
              onClick={() => setMobileOpen(false)}
            />
            <MotionDiv
              key="drawer"
              initial={{ x: -224 }}
              animate={{ x: 0 }}
              exit={{ x: -224 }}
              transition={{ type: 'spring', stiffness: 300, damping: 35 }}
              className="fixed left-0 top-0 h-full w-56 z-50 md:hidden"
            >
              <SidebarContent />
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        
        {/* Subtle Ambient Glow for the entire dashboard — breathing */}
        <div 
          className="pointer-events-none absolute top-0 right-0 w-[600px] h-[400px] rounded-full blur-[140px] z-0 animate-breathe" 
          style={{ background: 'oklch(0.65 0.20 250)', opacity: 0.03 }} 
        />

        {/* Header */}
        <header className="h-14 shrink-0 flex items-center px-6 gap-3 z-30">
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 -ml-2"
            style={{ color: 'oklch(0.60 0 0)' }}
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          
          {/* Sparse breadcrumb */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] tracking-wide uppercase font-semibold" style={{ color: 'oklch(0.40 0 0)' }}>
              {pageTitle}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden relative z-10">
          <AnimatePresence mode="wait">
            <MotionDiv
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'linear' }}
              className="h-full"
            >
              {children}
            </MotionDiv>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
