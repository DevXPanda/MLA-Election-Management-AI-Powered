'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Initialize Auth
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      const userData = JSON.parse(savedUser) as User;
      setToken(savedToken);
      setUser(userData);
      
      // Connect socket and join organization room
      const socket = socketService.connect();
      if (userData.organization_id) {
        socketService.joinOrganization(userData.organization_id);
      }
    }
    setLoading(false);

    return () => {
      socketService.disconnect();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await authAPI.login(email, password);
      if (res.data.success) {
        const { token: newToken, user: userData } = res.data.data;
        
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Connect socket on login
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
    
    // Disconnect socket on logout
    socketService.disconnect();
    
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
