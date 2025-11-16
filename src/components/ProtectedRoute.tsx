import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserFromStorage } from '../lib/auth-storage';
import { redirectToAuth } from '../lib/auth-redirect';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Check storage directly as a fallback (in case context hasn't updated yet)
  const storageUser = getUserFromStorage();
  const hasUserInStorage = !!storageUser;
  const actuallyAuthenticated = isAuthenticated || hasUserInStorage;

  // Debug logging in development
  if (import.meta.env.DEV) {
    console.log('🔒 ProtectedRoute check:', {
      loading,
      isAuthenticated,
      actuallyAuthenticated,
      hasUserInStorage,
      pathname: location.pathname,
      storageUser,
    });
  }

  useEffect(() => {
    if (!loading && !actuallyAuthenticated) {
      // Redirect to auth.usekplr.com with current URL as redirect_uri
      redirectToAuth(location.pathname);
    }
  }, [loading, actuallyAuthenticated, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
        <style>{`
          .spinner {
            border: 3px solid #e5e7eb;
            border-top: 3px solid #000;
            border-radius: 50%;
            width: 48px;
            height: 48px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!actuallyAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

