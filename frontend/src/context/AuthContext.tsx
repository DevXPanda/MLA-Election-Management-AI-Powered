'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { User } from '@/types';
import { socketService } from '@/lib/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const router = useRouter();

  const initializeAuth = async () => {
    try {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (savedToken) {
        setToken(savedToken);
        
        // If we have a user object in storage, use it immediately for responsive UI
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser) as User;
            setUser(userData);
            
            // Connect socket immediately
            socketService.connect();
            if (userData.organization_id) {
              socketService.joinOrganization(userData.organization_id);
            }
          } catch (e) {
            console.error('[Auth] Failed to parse saved user', e);
          }
        }

        // Always fetch fresh profile from server to ensure latest roles/permissions
        try {
          const res = await authAPI.getProfile();
          if (res.data.success) {
            const freshUser = res.data.data;
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          }
        } catch (err: any) {
          console.error('[Auth] Profile verification failed:', err);
          // If server explicitly says token is invalid (401), log out
          if (err.response?.status === 401) {
            logout();
          }
        }
      }
    } catch (error) {
      console.error('[Auth] Initialization error:', error);
    } finally {
      setLoading(false);
      initialized.current = true;
    }
  };

  useEffect(() => {
    if (!initialized.current) {
      initializeAuth();
    }
    return () => {
      // Don't disconnect socket on every re-render, only on full unmount if necessary
    };
  }, []);

  const refreshProfile = async () => {
    try {
      const res = await authAPI.getProfile();
      if (res.data.success) {
        setUser(res.data.data);
        localStorage.setItem('user', JSON.stringify(res.data.data));
      }
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await authAPI.login(email, password);
      if (res.data.success) {
        const { token: newToken, user: userData } = res.data.data;
        
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        
        socketService.connect();
        socketService.joinOrganization(userData.organization_id);
        
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    socketService.disconnect();
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
