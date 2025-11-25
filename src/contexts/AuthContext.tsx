import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserFromStorage, saveUserToStorage, clearUserFromStorage, checkUrlForAuth } from '../lib/auth-storage';
import { apiGet } from '../lib/api-client';

interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (userData: User) => void;
  logout: () => void;
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

const logAuth = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log('%c[AuthContext]', 'color:#8b5cf6;font-weight:bold;', ...args);
  } else {
    console.log('[AuthContext]', ...args);
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Mock user for development mode
  const getMockUser = (): User => ({
    id: 'dev-user-123',
    name: 'Dev User',
    email: 'dev@usekplr.com',
    picture: undefined,
  });

  // Initialize user from storage synchronously to avoid race conditions
  const getInitialUser = (): User | null => {
    // In development mode, skip auth and use mock user
    if (import.meta.env.DEV) {
      const storedUser = getUserFromStorage();
      if (storedUser) {
        logAuth('Restored mock user from storage');
        return storedUser;
      }
      // Create and save mock user for dev
      const mockUser = getMockUser();
      saveUserToStorage(mockUser);
        logAuth('Created mock user for dev mode');
      return mockUser;
    }

    // In production, check for auth token
    if (typeof window !== 'undefined') {
      const foundAuth = checkUrlForAuth();
      logAuth('Checked URL for auth payload', { foundAuth });
    }
    const restored = getUserFromStorage();
    if (restored) {
      logAuth('Restored cached user from storage', restored);
    }
    return restored;
  };

  const [user, setUser] = useState<User | null>(getInitialUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      if (import.meta.env.DEV) {
        const storedUser = getUserFromStorage();
        if (!storedUser) {
          const mockUser = getMockUser();
          saveUserToStorage(mockUser);
          if (isMounted) setUser(mockUser);
        } else if (!user) {
          setUser(storedUser);
        }
        setLoading(false);
        return;
      }

      try {
        logAuth('Fetching /api/auth/me for session hydration');
        const me = await apiGet<User>('/api/auth/me');
        if (me && isMounted) {
          saveUserToStorage(me);
          setUser(me);
          logAuth('Hydrated authenticated user from backend', me);
        }
      } catch (err) {
        logAuth('Failed to hydrate session', err);
        if (isMounted) {
          setUser(null);
          clearUserFromStorage();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initAuth();
    return () => { isMounted = false; };
  }, []);

  const login = (userData: User) => {
    logAuth('login() invoked', userData);
    setUser(userData);
    saveUserToStorage(userData);
  };

  const logout = async () => {
    logAuth('logout() invoked');
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('[AuthContext] Logout failed', error);
    } finally {
      setUser(null);
      clearUserFromStorage();
      logAuth('Local session cleared');
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
