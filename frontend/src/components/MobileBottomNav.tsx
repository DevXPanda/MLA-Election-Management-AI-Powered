'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListTodo, ClipboardCheck, Users, Menu } from 'lucide-react';
import { useSidebar } from '@/components/Sidebar';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebar();

  const navItems = [
    { label: 'Dash', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Tasks', icon: ListTodo, href: '/dashboard/tasks' },
    { label: 'Surveys', icon: ClipboardCheck, href: '/dashboard/surveys' },
    { label: 'Voters', icon: Users, href: '/dashboard/voters' },
  ];

  return (
    <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[50] w-[90%] max-w-[400px] transition-all duration-300 mobile-nav-container">
      <div className="bg-white/90 dark:bg-dark-900/90 backdrop-blur-xl border border-dark-200/50 dark:border-white/[0.08] rounded-2xl shadow-2xl shadow-black/20 p-2 flex items-center justify-around translate-y-0 group">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-saffron-500 text-dark-950 scale-110 shadow-lg shadow-saffron-500/20' 
                  : 'text-dark-400 dark:text-dark-500 hover:text-saffron-500'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className={`text-[9px] font-medium uppercase tracking-tighter ${isActive ? 'text-dark-950' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-dark-400 dark:text-dark-500 hover:text-saffron-500 transition-all"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-medium uppercase tracking-tighter">More</span>
        </button>
      </div>
    </div>
  );
}
