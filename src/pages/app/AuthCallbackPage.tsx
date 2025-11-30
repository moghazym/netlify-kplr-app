import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { checkUrlForAuth } from '../../lib/auth-storage';
import { redirectToAuth } from '../../lib/auth-redirect';

/**
 * Callback page that handles authentication redirects from the auth service
 * Expected URL format: /callback?auth=...
 * Processes the auth token and fetches user from backend
 */
export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const completeAuth = async () => {
      try {
        console.log('[AuthCallback] Processing authentication callback');

        // Check if there's an auth token in the URL and process it
        // The auth service sends back ?auth=... which needs to be stored
        const foundAuth = checkUrlForAuth();
        console.log('[AuthCallback] Auth token in URL:', foundAuth);

        // AuthContext will handle fetching user data via /api/auth/me
        // No need to call it again here

        const redirectPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
        sessionStorage.removeItem('auth_redirect_path');
        sessionStorage.removeItem('auth_session_id');
        console.log('[AuthCallback] Redirecting user to', redirectPath);
        navigate(redirectPath, { replace: true });
      } catch (error) {
        console.error('[AuthCallback] Auth callback failed', error);
        // If auth processing fails, redirect back to auth flow
        console.log('[AuthCallback] Redirecting to auth flow due to error');
        redirectToAuth(window.location.pathname);
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
