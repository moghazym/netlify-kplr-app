import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserFromStorage, saveUserToStorage, clearUserFromStorage, checkUrlForAuth } from '../lib/auth-storage';

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Initialize user from storage synchronously to avoid race conditions
  const getInitialUser = (): User | null => {
    // First check URL for auth token (for cross-subdomain auth)
    if (typeof window !== 'undefined') {
      checkUrlForAuth();
    }
    return getUserFromStorage();
  };

  const [user, setUser] = useState<User | null>(getInitialUser);
  const [loading] = useState(false); // Start as false since we read synchronously

  useEffect(() => {
    // Check URL for auth token on mount (for cross-subdomain redirects)
    if (checkUrlForAuth()) {
      const savedUser = getUserFromStorage();
      if (savedUser) {
        setUser(savedUser);
      }
    } else {
      // Double-check storage on mount (in case it was updated from another tab)
      const savedUser = getUserFromStorage();
      if (savedUser) {
        setUser(savedUser);
      }
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    saveUserToStorage(userData);
  };

  const logout = () => {
    setUser(null);
    clearUserFromStorage();
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
