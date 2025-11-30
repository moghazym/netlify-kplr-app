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
  // Initialize user from storage synchronously to avoid race conditions
  const getInitialUser = (): User | null => {
    // Check for auth token in URL (e.g., after OAuth redirect)

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
      try {
        // Check if we have a token before making the API call
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        logAuth('Token in storage:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

        logAuth('Fetching /api/auth/me for session hydration');
        const me = await apiGet<User>('/api/auth/me');
        if (me && isMounted) {
          saveUserToStorage(me);
          setUser(me);
          logAuth('Hydrated authenticated user from backend', me);
        }
      } catch (err) {
        logAuth('Failed to hydrate session - will redirect to auth', err);

        // Check if we have cached user data
        const cachedUser = getUserFromStorage();
        if (cachedUser) {
          logAuth('⚠️ API call failed but found cached user, clearing it:', cachedUser);
        }

        if (isMounted) {
          setUser(null);
          clearUserFromStorage();
          // Don't redirect here - let ProtectedRoute handle it
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
