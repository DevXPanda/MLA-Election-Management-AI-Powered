'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar, { SidebarProvider, useSidebar } from '@/components/Sidebar';

import MobileBottomNav from '@/components/MobileBottomNav';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkWidth = () => setIsDesktop(window.innerWidth >= 1024);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const sidebarMargin = isDesktop ? (collapsed ? 76 : 272) : 0;

  return (
    <div className="flex min-h-screen bg-white dark:bg-dark-950 transition-colors duration-300 overflow-x-hidden relative">
      {/* Decorative top border accent for premium feel */}
      <div className="fixed top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-saffron-500/20 to-transparent z-[100] pointer-events-none" />
      
      <Sidebar />

      {/* Main content - dynamically adjusts to sidebar width */}
      <main 
        className="flex-1 min-w-0 relative transition-[margin] duration-300 ease-in-out pb-24 lg:pb-0"
        style={{ marginLeft: sidebarMargin }}
      >
        {/* Subtle gradient background - enhanced for depth */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[20%] w-[800px] h-[600px] bg-saffron-500/[0.03] dark:bg-saffron-500/[0.02] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[-10%] right-[10%] w-[700px] h-[500px] bg-blue-500/[0.03] dark:bg-blue-500/[0.02] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '12s' }} />
        </div>

        <div className="relative z-10 min-h-screen">
          {children}
        </div>

        <MobileBottomNav />
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if we are sure initialization is done and no session exists
    if (!loading) {
      if (!user) {
        // Double check localStorage in case of a race condition with context state
        const hasStoredToken = typeof window !== 'undefined' && !!localStorage.getItem('token');
        if (!hasStoredToken) {
          console.log('[Auth] No session found, redirecting to login');
          router.push('/login');
        } else {
          console.warn('[Auth] Stored token found but user object missing from state. Re-verification might be needed.');
        }
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-950 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 border-[3px] border-dark-100 dark:border-white/[0.05] border-t-saffron-500 rounded-full animate-spin" />
            <div className="absolute inset-0 w-14 h-14 border border-saffron-500/20 rounded-full animate-pulse" />
          </div>
          <p className="text-xs font-black text-dark-400 dark:text-dark-500 uppercase tracking-[3px] animate-pulse">Initializing System</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
