import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { apiRequest } from '@/lib/api-client';

interface User {
  id: number;
  username: string;
  full_name?: string | null;
  email: string;
  avatar_url?: string | null;
}

interface RegisterPayload {
  email: string;
  username: string;
  full_name?: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (userData: User) => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiRequest<User>('/api/auth/me');
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const tokenResponse = await apiRequest<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (tokenResponse?.access_token) {
      localStorage.setItem('access_token', tokenResponse.access_token);
      sessionStorage.setItem('access_token', tokenResponse.access_token);
    }

    await refreshUser();
  }, [refreshUser]);

  const registerWithPassword = useCallback(async (payload: RegisterPayload) => {
    await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    await loginWithPassword(payload.email, payload.password);
  }, [loginWithPassword]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors; we still clear local state.
    }

    localStorage.removeItem('access_token');
    sessionStorage.removeItem('access_token');
    setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: Boolean(user),
    login,
    loginWithPassword,
    registerWithPassword,
    logout,
    loading,
  }), [user, login, loginWithPassword, registerWithPassword, logout, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
