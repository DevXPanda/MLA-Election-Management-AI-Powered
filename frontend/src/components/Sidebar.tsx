'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, MapPin, UsersRound, ListTodo,
  ClipboardList, Calendar, Vote, BarChart3, MessageSquare,
  Image, LogOut, Shield, ChevronLeft, ChevronRight, Menu, X,
  Zap
} from 'lucide-react';
import { useState, useMemo, createContext, useContext, useEffect } from 'react';

/**
 * ─── SIDEBAR CONTEXT (shared collapsed state) ───
 */
interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

/**
 * ─── CENTRALIZED SIDEBAR CONFIGURATION ───
 */
const NAV_CONFIG = [
  {
    title: 'Overview',
    items: [
      { 
        href: '/dashboard', 
        label: 'Dashboard', 
        icon: LayoutDashboard, 
        roles: ['super_admin', 'mla', 'campaign_manager', 'ward_head', 'booth_worker'] 
      },
    ],
  },
  {
    title: 'System Control',
    items: [
      { 
        href: '/dashboard/users', 
        label: 'Users', 
        icon: Users, 
        roles: ['super_admin'] 
      },
      { 
        href: '/dashboard/constituency', 
        label: 'Constituency', 
        icon: MapPin, 
        roles: ['super_admin', 'mla'] 
      },
    ],
  },
  {
    title: 'Field Operations',
    items: [
      { 
        href: '/dashboard/teams', 
        label: 'Teams', 
        icon: UsersRound, 
        roles: ['super_admin', 'campaign_manager', 'ward_head'] 
      },
      { 
        href: '/dashboard/voters', 
        label: 'Voters', 
        icon: Vote, 
        roles: ['super_admin', 'mla', 'campaign_manager', 'ward_head', 'booth_worker'] 
      },
      { 
        href: '/dashboard/tasks', 
        label: 'Tasks', 
        icon: ListTodo, 
        roles: ['super_admin', 'campaign_manager', 'ward_head', 'booth_worker'] 
      },
      { 
        href: '/dashboard/surveys', 
        label: 'Surveys', 
        icon: ClipboardList, 
        roles: ['super_admin', 'mla', 'campaign_manager', 'ward_head', 'booth_worker'] 
      },
    ],
  },
  {
    title: 'Mission Intelligence',
    items: [
      { 
        href: '/dashboard/events', 
        label: 'Events', 
        icon: Calendar, 
        roles: ['super_admin', 'mla', 'campaign_manager'] 
      },
      { 
        href: '/dashboard/reports', 
        label: 'Reports', 
        icon: BarChart3, 
        roles: ['super_admin', 'mla'] 
      },
      { 
        href: '/dashboard/messages', 
        label: 'Messages', 
        icon: MessageSquare, 
        roles: ['super_admin', 'mla'] 
      },
      { 
        href: '/dashboard/media', 
        label: 'Media Library', 
        icon: Image, 
        roles: ['super_admin', 'mla'] 
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const filteredNav = useMemo(() => {
    if (!user) return [];
    
    return NAV_CONFIG.map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(user.role_name))
    })).filter(section => section.items.length > 0);
  }, [user]);

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const desktopWidth = collapsed ? 76 : 272;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden transition-opacity" 
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-[18px] left-4 z-[45] lg:hidden w-10 h-10 rounded-lg bg-white dark:bg-dark-800 border border-dark-200 dark:border-white/10 flex items-center justify-center text-dark-600 dark:text-dark-300 shadow-lg hover:shadow-xl transition-all"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <aside 
        className={`
          fixed left-0 top-0 h-screen 
          bg-white/80 dark:bg-dark-950/80 backdrop-blur-2xl
          border-r border-dark-200/50 dark:border-white/[0.04] 
          z-[60] flex flex-col overflow-hidden
          transition-all duration-300 ease-in-out 
          ${mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
        `}
        style={{ width: desktopWidth }}
      >
        {/* Subtle gradient accent at top */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-saffron-500/40 to-transparent" />

        {/* ─── LOGO HEADER ─── */}
        <div className="h-[72px] px-5 border-b border-dark-100/80 dark:border-white/[0.04] flex items-center justify-between flex-shrink-0 relative">
          <div className="flex items-center gap-3.5 min-w-0 overflow-hidden">
            <div className="w-10 h-10 bg-gradient-to-br from-saffron-500 to-amber-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-saffron-500/25 relative group">
              <Shield className="w-5 h-5 text-white transition-transform duration-300 group-hover:scale-110" />
              {/* Subtle ring animation */}
              <div className="absolute inset-0 rounded-lg border-2 border-saffron-400/0 group-hover:border-saffron-400/30 transition-all duration-500 scale-100 group-hover:scale-110" />
            </div>
            {!collapsed && (
              <div className="flex flex-col justify-center min-w-0 animate-fade-in">
                <h2 className="text-[17px] font-extrabold text-dark-900 dark:text-white tracking-tight leading-none mb-0">MLA</h2>
                <p className="text-[8px] text-dark-400 dark:text-dark-500 uppercase tracking-[2px] font-bold mt-0.5 whitespace-nowrap">Election Management</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Close button for mobile */}
            <button 
              onClick={() => setMobileOpen(false)} 
              className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-white/5 text-dark-400 transition-colors lg:hidden"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {/* Collapse toggle for desktop */}
            <button 
              onClick={() => setCollapsed(!collapsed)} 
              className="hidden lg:flex w-7 h-7 rounded-lg hover:bg-dark-100 dark:hover:bg-white/[0.06] text-dark-400 dark:text-dark-500 transition-all items-center justify-center"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>

        {/* ─── NAVIGATION ─── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 custom-scrollbar">
          {filteredNav.map((section, sectionIndex) => (
            <div key={section.title} className={sectionIndex > 0 ? 'mt-6' : 'mt-1'}>
              {!collapsed && (
                <div className="px-3 pb-2 text-[9px] font-extrabold text-dark-400 dark:text-dark-600 uppercase tracking-[2px] select-none whitespace-nowrap flex items-center gap-2">
                  <div className="w-4 h-px bg-dark-200/60 dark:bg-white/[0.06]" />
                  {section.title}
                  <div className="flex-1 h-px bg-dark-200/40 dark:bg-white/[0.04]" />
                </div>
              )}
              {collapsed && sectionIndex > 0 && (
                <div className="h-px bg-dark-100 dark:bg-white/[0.04] mx-3 mb-3" />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        h-10 flex items-center gap-3 px-3 rounded-lg 
                        transition-all duration-200 group relative whitespace-nowrap
                        ${isActive 
                          ? 'bg-saffron-500/[0.08] dark:bg-saffron-500/[0.1] text-saffron-600 dark:text-saffron-400 font-semibold shadow-sm shadow-saffron-500/5' 
                          : 'text-dark-700 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-white/[0.03] hover:text-dark-900 dark:hover:text-dark-200'}
                        ${collapsed ? 'justify-center !px-0 mx-auto w-10' : ''}
                      `}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-all duration-200 ${isActive ? 'text-saffron-500' : 'group-hover:scale-105'}`} />
                      {!collapsed && <span className="font-semibold text-[13px] tracking-wide">{item.label}</span>}
                      {isActive && !collapsed && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-saffron-400 to-saffron-600 rounded-l-full shadow-lg shadow-saffron-500/40" />
                      )}
                      {isActive && collapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-saffron-400 to-saffron-600 rounded-r-full shadow-lg shadow-saffron-500/40" />
                      )}
                      {/* Tooltip for collapsed state */}
                      {collapsed && (
                        <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-dark-900 dark:bg-dark-800 text-white text-[11px] font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none shadow-xl z-50 border border-white/5">
                          {item.label}
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-dark-900 dark:bg-dark-800 rotate-45 border-l border-b border-white/5" />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ─── USER PROFILE FOOTER ─── */}
        <div className="p-3 border-t border-dark-100/80 dark:border-white/[0.04] flex-shrink-0 relative">
          {/* Subtle glow */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-12 bg-saffron-500/[0.03] dark:bg-saffron-500/[0.02] blur-2xl rounded-full pointer-events-none" />
          
          <div 
            onClick={() => collapsed && setCollapsed(false)}
            className={`
              flex items-center gap-3 p-2.5 rounded-lg 
              bg-dark-50/50 dark:bg-dark-800/20 
              hover:bg-dark-100/60 dark:hover:bg-dark-800/40 
              transition-all duration-200 
              border border-dark-100/60 dark:border-white/[0.04] 
              group cursor-pointer overflow-hidden relative
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-saffron-500 to-amber-700 flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 shadow-md shadow-saffron-500/15 group-hover:shadow-saffron-500/25 group-hover:scale-105 transition-all duration-200 relative">
              {getInitials(user?.name || '')}
              {/* Online indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-dark-950 shadow-sm" />
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-dark-900 dark:text-white truncate leading-tight">{user?.name}</div>
                  <div className="text-[9px] font-bold text-dark-600 dark:text-dark-500 uppercase tracking-[1px] mt-0.5 whitespace-nowrap flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-emerald-600" />
                    {user?.role_name?.replace(/_/g, ' ')}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); logout(); }}
                  className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-dark-400 flex-shrink-0"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
