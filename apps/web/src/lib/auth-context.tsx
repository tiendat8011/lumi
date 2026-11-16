'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setTokens, clearTokens, loadTokens, getAccessToken } from './api';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'TEACHER' | 'STUDENT' | 'ADMIN';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string, role: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    loadTokens();
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const data = await api<User>('/auth/me');
      setUser(data);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const data = await api<{ accessToken: string; refreshToken: string; user: User }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const loginWithGoogle = async (credential: string, role: string) => {
    const data = await api<{ accessToken: string; refreshToken: string; user: User }>(
      '/auth/google',
      { method: 'POST', body: JSON.stringify({ credential, role }) },
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const register = async (email: string, password: string, displayName: string, role: string) => {
    const data = await api<{ accessToken: string; refreshToken: string; user: User }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, displayName, role }) },
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
