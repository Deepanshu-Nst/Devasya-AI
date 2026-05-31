'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useAuthStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BookOpen, CheckSquare, LogOut, User, Sparkles, Menu, X } from 'lucide-react';
import Link from 'next/link';

const MotionDiv = motion.div as any;

const NAV_ITEMS = [
  {
    name: 'Chat',
    href: '/dashboard/chat',
    icon: MessageSquare,
    description: 'Context-aware conversations',
  },
  {
    name: 'Memory',
    href: '/dashboard/memory',
    icon: BookOpen,
    description: 'Notes & knowledge base',
  },
  {
    name: 'Tasks',
    href: '/dashboard/tasks',
    icon: CheckSquare,
    description: 'Structured task board',
  },
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
    if (!isLoading && !supabaseUser) {
      router.push('/auth');
    }
  }, [supabaseUser, isLoading, router]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.error('Sign out error (non-fatal):', err);
    } finally {
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
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'oklch(0.62 0.20 265 / 0.15)' }}
          >
            <Sparkles className="w-4 h-4" style={{ color: 'oklch(0.75 0.16 265)' }} />
          </div>
          <p className="text-sm" style={{ color: 'oklch(0.50 0 0)' }}>
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!supabaseUser) return null;

  const displayName =
    storeUser?.full_name ||
    supabaseUser?.user_metadata?.full_name ||
    supabaseUser?.email?.split('@')[0] ||
    'User';
  const displayEmail = supabaseUser?.email || '';
  const avatarUrl = supabaseUser?.user_metadata?.avatar_url;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'oklch(0.62 0.20 265 / 0.18)',
              border: '1px solid oklch(0.62 0.20 265 / 0.25)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'oklch(0.75 0.16 265)' }} />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight" style={{ color: 'oklch(0.90 0 0)' }}>
              Devasya AI
            </div>
            <div className="text-label" style={{ color: 'oklch(0.42 0 0)', fontSize: '10px' }}>
              AI Workspace
            </div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="mx-5 mb-4" style={{ height: '1px', background: 'oklch(0.22 0 0)' }} />

      {/* Nav section label */}
      <div className="px-5 mb-2">
        <span className="text-label" style={{ color: 'oklch(0.38 0 0)' }}>
          Workspace
        </span>
      </div>

      {/* Navigation */}
      <nav className="px-3 space-y-0.5 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.name} href={item.href}>
              <div
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group cursor-pointer"
                style={{
                  background: isActive ? 'oklch(0.62 0.20 265 / 0.10)' : 'transparent',
                  color: isActive ? 'oklch(0.88 0 0)' : 'oklch(0.52 0 0)',
                }}
                onMouseEnter={e => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0 0)';
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.color = 'oklch(0.78 0 0)';
                }}
                onMouseLeave={e => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.color = 'oklch(0.52 0 0)';
                }}
              >
                {/* Active left accent bar */}
                {isActive && (
                  <MotionDiv
                    layoutId="activeBar"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                    style={{ background: 'oklch(0.75 0.16 265)' }}
                    initial={false}
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  />
                )}

                <item.icon
                  className="w-[18px] h-[18px] shrink-0 transition-transform duration-150"
                  style={{
                    color: isActive ? 'oklch(0.75 0.16 265)' : 'inherit',
                  }}
                />

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate leading-tight"
                    style={{ color: 'inherit' }}
                  >
                    {item.name}
                  </p>
                  {isActive && (
                    <p
                      className="text-[11px] truncate mt-0.5"
                      style={{ color: 'oklch(0.48 0 0)' }}
                    >
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom user section */}
      <div className="px-3 pb-4">
        <div className="mx-2 mb-3" style={{ height: '1px', background: 'oklch(0.20 0 0)' }} />

        {/* User info */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
          style={{ background: 'oklch(0.18 0 0)' }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-7 h-7 rounded-full shrink-0"
              style={{ border: '1px solid oklch(0.28 0 0)' }}
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
              style={{
                background: 'oklch(0.62 0.20 265 / 0.18)',
                color: 'oklch(0.75 0.16 265)',
                border: '1px solid oklch(0.62 0.20 265 / 0.25)',
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] font-medium truncate leading-tight"
              style={{ color: 'oklch(0.82 0 0)' }}
            >
              {displayName}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'oklch(0.44 0 0)' }}>
              {displayEmail}
            </p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
          style={{ color: 'oklch(0.55 0.15 25)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'oklch(0.52 0.20 25 / 0.10)';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.18 25)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.55 0.15 25)';
          }}
        >
          <LogOut className="w-[16px] h-[16px] shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="flex min-h-screen"
      style={{ background: 'oklch(0.115 0 0)' }}
    >
      {/* ─── Desktop Sidebar ─── */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col sticky top-0 h-screen"
        style={{
          background: 'oklch(0.14 0 0)',
          borderRight: '1px solid oklch(0.20 0 0)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* ─── Mobile Sidebar Overlay ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <MotionDiv
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'oklch(0 0 0 / 0.6)' }}
              onClick={() => setMobileOpen(false)}
            />
            <MotionDiv
              key="drawer"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 340, damping: 36 }}
              className="fixed left-0 top-0 h-full w-60 z-50 md:hidden"
              style={{
                background: 'oklch(0.14 0 0)',
                borderRight: '1px solid oklch(0.20 0 0)',
              }}
            >
              <SidebarContent />
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* ─── Main area ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top header */}
        <header
          className="h-14 shrink-0 flex items-center px-5 gap-3 z-30"
          style={{
            background: 'oklch(0.115 0 0 / 0.9)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid oklch(0.20 0 0)',
          }}
        >
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: 'oklch(0.55 0 0)' }}
            onClick={() => setMobileOpen(v => !v)}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0 0)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[13px] font-semibold" style={{ color: 'oklch(0.78 0 0)' }}>
              {pageTitle}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <MotionDiv
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
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
