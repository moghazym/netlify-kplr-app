import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { saveUserToStorage } from '../../lib/auth-storage';
import { apiGet } from '../../lib/api-client';

/**
 * Callback page that handles authentication redirects from the auth service
 * Expected URL format: /callback?code=...&auth=...
 */
export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const completeAuth = async () => {
      try {
        console.log('[AuthCallback] Attempting to fetch authenticated user');
        const me = await apiGet('/api/auth/me');
        if (me) {
          saveUserToStorage(me);
          login(me);
          console.log('[AuthCallback] User hydrated from backend', me);
        }
        const redirectPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
        sessionStorage.removeItem('auth_redirect_path');
        console.log('[AuthCallback] Redirecting user to', redirectPath);
        navigate(redirectPath, { replace: true });
      } catch (error) {
        console.error('[AuthCallback] Auth callback failed', error);
        const fallback = sessionStorage.getItem('auth_redirect_path') || '/';
        sessionStorage.removeItem('auth_redirect_path');
        console.log('[AuthCallback] Redirecting user to fallback', fallback);
        navigate(fallback, { replace: true });
      }
    };
    completeAuth();
  }, [navigate, login]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
        <style>{`
          .spinner {
            border: 3px solid #e5e7eb;
            border-top: 3px solid #000;
            border-radius: 50%;
            width: 48px;
            height: 48px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};
