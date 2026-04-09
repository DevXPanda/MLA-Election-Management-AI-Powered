'use client';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import NotificationDropdown from './NotificationDropdown';
import { Bell, Search, Sun, Moon, Command, LogOut, ChevronRight, Sparkles, Shield, User, Menu } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useSidebar } from './Sidebar';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { setMobileOpen } = useSidebar();
  const [searchFocused, setSearchFocused] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'super_admin': return 'from-red-500/20 to-orange-500/20 text-red-400 border-red-500/20';
      case 'mla': return 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/20';
      case 'campaign_manager': return 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/20';
      case 'ward_head': return 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/20';
      case 'booth_worker': return 'from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/20';
      default: return 'from-gray-500/20 to-slate-500/20 text-gray-400 border-gray-500/20';
    }
  };

  const formatRole = (role?: string) => {
    return role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'User';
  };

  return (
    <header className="h-14 bg-white/70 dark:bg-dark-950/60 backdrop-blur-2xl border-b border-dark-200/40 dark:border-white/[0.06] flex items-center justify-between px-3 lg:px-8 sticky top-0 z-40 transition-all duration-300">
      
      {/* Mobile Menu Button - integrated into header */}
      <button
        onClick={() => setMobileOpen(true)}
        className="flex lg:hidden w-8 h-8 items-center justify-center text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800/40 rounded-lg transition-colors mr-1 flex-shrink-0"
        aria-label="Toggle Menu"
      >
        <Menu size={18} />
      </button>

      {/* Left: Breadcrumb-style title */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Accent icon */}
        <div className="hidden md:flex w-8 h-8 rounded-lg bg-gradient-to-br from-saffron-500/10 to-amber-500/10 dark:from-saffron-500/20 dark:to-amber-500/10 items-center justify-center flex-shrink-0 border border-saffron-500/10 dark:border-saffron-500/15 shadow-sm shadow-saffron-500/5">
          <Sparkles className="w-3.5 h-3.5 text-saffron-500" />
        </div>
        {/* Title + breadcrumb */}
        <div className="flex flex-col justify-center min-w-0">
          <h1 className="text-[15px] sm:text-[17px] lg:text-[19px] font-medium text-dark-900 dark:text-dark-50 tracking-tight leading-none truncate mb-0">{title}</h1>
          <div className="flex items-center gap-2 mt-1 h-3.5">
            {subtitle ? (
              <p className="text-[10px] sm:text-[11px] font-medium text-dark-500 dark:text-dark-400 tracking-wide line-clamp-1 truncate">{subtitle}</p>
            ) : (
              <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r ${getRoleBadgeColor(user?.role_name)} border border-dark-100 dark:border-white/10 text-[7px] sm:text-[8px] font-medium uppercase tracking-[1px] text-dark-700 dark:text-dark-100`}>
                <Shield className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                {formatRole(user?.role_name)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0 ml-2">
        
        {/* Search bar */}
        <div className={`relative hidden md:block transition-all duration-300 ${searchFocused ? 'w-64 lg:w-80' : 'w-48 lg:w-60'}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 dark:text-dark-500 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full pl-9 pr-10 py-2 bg-dark-50/80 dark:bg-dark-800/30 border border-dark-200/50 dark:border-white/[0.06] rounded-lg text-sm text-dark-900 dark:text-dark-100 outline-none transition-all duration-300 focus:border-saffron-500/40 dark:focus:border-saffron-500/30 focus:ring-2 focus:ring-saffron-500/10 focus:bg-white dark:focus:bg-dark-800/50 placeholder:text-dark-400 dark:placeholder:text-dark-500 font-medium"
          />
        </div>

        {/* Mobile Search Button */}
        <button className="flex md:hidden w-8 h-8 rounded-lg bg-dark-50/80 dark:bg-dark-800/30 border border-dark-200/50 dark:border-white/[0.06] text-dark-500 dark:text-dark-400 items-center justify-center hover:bg-dark-100 dark:hover:bg-dark-700/50">
          <Search size={16} />
        </button>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-dark-200/50 dark:bg-white/[0.06] mx-0.5" />

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg bg-dark-50/80 dark:bg-dark-800/30 border border-dark-200/50 dark:border-white/[0.06] text-dark-500 dark:text-dark-400 flex items-center justify-center hover:bg-dark-100 dark:hover:bg-dark-700/50 transition-all duration-200 group"
        >
          {theme === 'light' 
            ? <Moon size={16} /> 
            : <Sun size={16} />
          }
        </button>

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Profile */}
        <div className="relative ml-0.5" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-all duration-200 group border border-transparent"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-saffron-500 to-amber-600 flex items-center justify-center text-white text-[10px] font-extrabold shadow-md shadow-saffron-500/20 group-hover:scale-105 transition-all duration-200 flex-shrink-0">
              {getInitials(user?.name || '')}
            </div>
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-dark-900 rounded-lg border border-dark-200/60 dark:border-white/[0.06] shadow-2xl shadow-black/10 dark:shadow-black/40 p-2 animate-fade-in z-50">
              {/* User info */}
              <div className="px-3 py-3 border-b border-dark-100 dark:border-white/[0.06] mb-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-saffron-500 to-amber-600 flex items-center justify-center text-white text-sm font-extrabold shadow-lg shadow-saffron-500/20">
                    {getInitials(user?.name || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-dark-900 dark:text-white truncate">{user?.name}</div>
                    <div className="text-[10px] font-medium text-dark-600 dark:text-dark-500 uppercase tracking-[1px]">{formatRole(user?.role_name)}</div>
                  </div>
                </div>
              </div>
              {/* Logout */}
              <button
                onClick={() => { setProfileOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 text-sm font-semibold group"
              >
                <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
