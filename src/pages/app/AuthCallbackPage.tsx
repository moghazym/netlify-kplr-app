import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { checkUrlForAuth, getUserFromStorage } from '../../lib/auth-storage';

/**
 * Callback page that handles authentication redirects from the auth service
 * Expected URL format: /callback?code=...&auth=...
 */
export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    // Prevent multiple processing attempts
    if (processed) {
      return;
    }

    // Check for auth token in URL (from auth service redirect)
    const authToken = searchParams.get('auth');
    const code = searchParams.get('code');

    if (import.meta.env.DEV) {
      console.log('🔐 AuthCallbackPage:', {
        authToken: authToken ? 'present' : 'missing',
        code: code ? 'present' : 'missing',
        allParams: Object.fromEntries(searchParams.entries()),
        processed,
      });
    }

    // If we already have a user in storage and no auth token in URL, redirect immediately
    // This handles page refreshes after successful auth
    if (!authToken && !code) {
      const existingUser = getUserFromStorage();
      if (existingUser) {
        console.log('✅ User already authenticated, redirecting to dashboard');
        const originalPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
        sessionStorage.removeItem('auth_redirect_path');
        navigate(originalPath, { replace: true });
        setProcessed(true);
        return;
      }
    }

    if (authToken) {
      setProcessed(true);
      
      try {
        // Process the auth token
        const authProcessed = checkUrlForAuth();
        
        if (authProcessed) {
          // Get the user from storage (saved by checkUrlForAuth)
          const user = getUserFromStorage();
          
          if (user) {
            // Update auth context
            login(user);
            
            // Redirect to dashboard (or the originally intended page)
            const originalPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
            sessionStorage.removeItem('auth_redirect_path');
            sessionStorage.removeItem('auth_session_id'); // Clear session ID
            
            if (import.meta.env.DEV) {
              console.log('✅ Authentication successful, redirecting to:', originalPath);
            }
            
            navigate(originalPath, { replace: true });
          } else {
            console.error('❌ Failed to decode user from auth token');
            navigate('/dashboard', { replace: true });
          }
        } else {
          console.error('❌ Failed to process auth token');
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('❌ Error processing auth:', error);
        navigate('/dashboard', { replace: true });
      }
    } else if (code) {
      // If we have a code but no auth token, the backend might still be processing
      // Wait a bit and check again, or redirect to dashboard
      console.warn('⚠️ Received code but no auth token yet');
      // Don't set processed here, allow retry
      setTimeout(() => {
        if (!processed) {
          navigate('/dashboard', { replace: true });
        }
      }, 2000);
    } else {
      // No auth token or code, redirect to dashboard
      console.warn('⚠️ No auth token or code in callback URL');
      setProcessed(true);
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams, navigate, login, processed]);

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

