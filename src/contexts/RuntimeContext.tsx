import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { stopLiveSession } from '../lib/api-client';

interface ActiveRuntime {
  podInstanceId: string;
  suiteId: string;
  suiteName?: string;
  platform: "web" | "android";
  streamUrl: string;
  launchedAt: number; // timestamp
}

interface RuntimeContextType {
  activeRuntime: ActiveRuntime | null;
  setActiveRuntime: (runtime: ActiveRuntime | null) => void;
  clearRuntime: () => Promise<void>;
  hasRuntimeForSuite: (suiteId: string) => boolean;
  hasRuntimeForOtherSuite: (suiteId: string) => boolean;
}

const RuntimeContext = createContext<RuntimeContextType | undefined>(undefined);

const RUNTIME_STORAGE_KEY = 'kplr_active_runtime';

export const useRuntime = () => {
  const context = useContext(RuntimeContext);
  if (context === undefined) {
    throw new Error('useRuntime must be used within a RuntimeProvider');
  }
  return context;
};

interface RuntimeProviderProps {
  children: ReactNode;
}

export const RuntimeProvider: React.FC<RuntimeProviderProps> = ({ children }) => {
  const [activeRuntime, setActiveRuntimeState] = useState<ActiveRuntime | null>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(RUNTIME_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if runtime is stale (older than 15 minutes - beyond typical TTL)
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
        if (parsed.launchedAt && parsed.launchedAt > fifteenMinutesAgo) {
          return parsed;
        }
        // Clear stale runtime
        localStorage.removeItem(RUNTIME_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(RUNTIME_STORAGE_KEY);
    }
    return null;
  });

  // Persist to localStorage when runtime changes
  useEffect(() => {
    if (activeRuntime) {
      localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(activeRuntime));
    } else {
      localStorage.removeItem(RUNTIME_STORAGE_KEY);
    }
  }, [activeRuntime]);

  const setActiveRuntime = useCallback((runtime: ActiveRuntime | null) => {
    setActiveRuntimeState(runtime);
  }, []);

  const clearRuntime = useCallback(async () => {
    if (activeRuntime) {
      try {
        // Stop the live session on the backend
        await stopLiveSession(activeRuntime.podInstanceId);
      } catch (error) {
        console.error('Error stopping runtime:', error);
        // Continue clearing even if stop fails
      }
    }
    setActiveRuntimeState(null);
  }, [activeRuntime]);

  const hasRuntimeForSuite = useCallback((suiteId: string) => {
    return activeRuntime?.suiteId === suiteId;
  }, [activeRuntime]);

  const hasRuntimeForOtherSuite = useCallback((suiteId: string) => {
    return activeRuntime !== null && activeRuntime.suiteId !== suiteId;
  }, [activeRuntime]);

  const value: RuntimeContextType = {
    activeRuntime,
    setActiveRuntime,
    clearRuntime,
    hasRuntimeForSuite,
    hasRuntimeForOtherSuite,
  };

  return (
    <RuntimeContext.Provider value={value}>
      {children}
    </RuntimeContext.Provider>
  );
};
