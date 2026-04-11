'use client';

import { useState, useEffect, useRef } from 'react';
import { notificationsAPI } from '@/lib/api';
import { socketService } from '@/lib/socket';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, Trash2, ExternalLink, Inbox } from 'lucide-react';
import { SHARED_UI } from '@/lib/ui-labels';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'task' | 'alert' | 'event';
  is_read: boolean;
  created_at: string;
  link?: string;
}

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsAPI.getAll();
      if (res.data.success) {
        setNotifications(res.data.data.notifications);
        setUnreadCount(res.data.data.unread_count);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Listen for real-time notifications
    const socket = socketService.getSocket();
    if (socket) {
      const handleNewNotification = (notification: Notification) => {
        setNotifications(prev => [notification, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
        
        // Browser notification if permitted
        if (Notification.permission === 'granted') {
          new Notification(notification.title, { body: notification.message });
        }
      };

      socket.on('notification:new', handleNewNotification);
      return () => {
        socket.off('notification:new', handleNewNotification);
      };
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task': return <Check className="w-4 h-4 text-emerald-500" />;
      case 'alert': return <Trash2 className="w-4 h-4 text-rose-500" />;
      case 'event': return <ExternalLink className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-xl glass-card hover:bg-white/10 dark:hover:bg-black/20 transition-all duration-300 group"
      >
        <Bell className={`w-5 h-5 transition-colors ${isOpen ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-500'}`} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full animate-pulse shadow-sm ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 glass-card rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-black/50 backdrop-blur-md">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Inbox className="w-4 h-4" />
              {SHARED_UI.notificationsHeading}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-white/30 dark:bg-black/30 backdrop-blur-sm">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-3"></div>
                <p className="text-sm">Synchronizing mission data...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No tactical updates at this time.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 transition-colors relative group ${notification.is_read ? 'opacity-70' : 'bg-blue-50/30 dark:bg-blue-900/10'}`}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    {!notification.is_read && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-full" />
                    )}
                    <div className="flex gap-3">
                      <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-lg glass-card flex items-center justify-center border-slate-200/50 dark:border-white/5">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className={`text-sm font-semibold truncate ${notification.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                            {notification.title}
                          </p>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed line-clamp-2 ${notification.is_read ? 'text-slate-500 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                          {notification.message}
                        </p>
                        {notification.link && (
                          <a
                            href={notification.link}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            GO TO TARGET <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-black/50 text-center">
            <button className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-wider">
              View Strategy Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
