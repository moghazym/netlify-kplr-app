import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserFromStorage, saveUserToStorage, clearUserFromStorage } from '../lib/auth-storage';

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
        return storedUser;
      }
      // Create and save mock user for dev
      const mockUser = getMockUser();
      saveUserToStorage(mockUser);
      return mockUser;
    }

    // In production, get user from storage
    return getUserFromStorage();
  };

  const [user, setUser] = useState<User | null>(getInitialUser);
  const [loading] = useState(false); // Start as false since we read synchronously

  useEffect(() => {
    // In development mode, ensure we have a mock user
    if (import.meta.env.DEV) {
      const storedUser = getUserFromStorage();
      if (!storedUser) {
        const mockUser = getMockUser();
        saveUserToStorage(mockUser);
        setUser(mockUser);
      } else if (!user) {
        setUser(storedUser);
      }
      return;
    }

    // In production, check storage on mount (in case it was updated from another tab or after auth)
    const savedUser = getUserFromStorage();
    if (savedUser) {
      setUser(savedUser);
    }
  }, [user]);

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
