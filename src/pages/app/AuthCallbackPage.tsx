import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { checkUrlForAuth, getUserFromStorage, saveUserToStorage } from '../../lib/auth-storage';
import { exchangeGoogleCode } from '../../lib/api-client';

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

    // Fallback: Always redirect after 10 seconds to prevent getting stuck
    const fallbackTimeout = setTimeout(() => {
      if (!processed) {
        console.warn('⚠️ Fallback: Redirecting after timeout');
        const originalPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
        sessionStorage.removeItem('auth_redirect_path');
        navigate(originalPath, { replace: true });
        setProcessed(true);
      }
    }, 10000);

    let pollInterval: NodeJS.Timeout | null = null;

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
      clearTimeout(fallbackTimeout); // Clear fallback since we're processing
      
      console.log('🔐 Auth token detected, processing...', {
        authTokenLength: authToken.length,
        hasCode: !!code,
      });
      
      try {
        // Process the auth token
        const authProcessed = checkUrlForAuth();
        console.log('🔐 Auth processed:', authProcessed);
        
        // Get the original path before clearing
        const originalPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
        
        // Clear session data
        sessionStorage.removeItem('auth_redirect_path');
        sessionStorage.removeItem('auth_session_id');
        
        if (authProcessed) {
          // Get the user from storage (saved by checkUrlForAuth)
          const user = getUserFromStorage();
          console.log('🔐 User from storage:', user ? 'found' : 'not found', user);
          
          if (user) {
            // Update auth context
            login(user);
            console.log('✅ User logged in, redirecting to:', originalPath);
          } else {
            console.warn('⚠️ No user data found, but auth token was processed. Token stored, redirecting anyway.');
          }
          
          // Always redirect, even if user data is missing (token is stored)
          console.log('🔄 Navigating to:', originalPath);
          
          // Use window.location immediately for more reliable redirect
          // React Router navigate as backup
          window.location.href = originalPath;
          
          // Also try React Router navigate (in case window.location is blocked)
          setTimeout(() => {
            navigate(originalPath, { replace: true });
          }, 50);
        } else {
          console.error('❌ Failed to process auth token, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('❌ Error processing auth:', error);
        const originalPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
        sessionStorage.removeItem('auth_redirect_path');
        navigate(originalPath, { replace: true });
      }
    } else if (code) {
      // If we have a code but no auth token, exchange the code for tokens via API
      console.log('🔐 Received code, exchanging for tokens...');
      setProcessed(true);
      
      exchangeGoogleCode(code)
        .then((response) => {
          console.log('✅ Code exchanged successfully:', response);
          
          // Store the access token
          if (response.access_token) {
            localStorage.setItem('access_token', response.access_token);
            sessionStorage.setItem('access_token', response.access_token);
          }
          
          if (response.refresh_token) {
            localStorage.setItem('refresh_token', response.refresh_token);
            sessionStorage.setItem('refresh_token', response.refresh_token);
          }
          
          // Extract user info from response or token
          let user = null;
          if (response.user) {
            user = {
              id: String(response.user.id),
              name: response.user.name || response.user.email || 'User',
              email: response.user.email || '',
              picture: response.user.picture,
            };
          } else if (response.access_token) {
            // Try to decode user from JWT token
            try {
              const payload = JSON.parse(atob(response.access_token.split('.')[1]));
              user = {
                id: String(payload.sub || payload.user_id || payload.id || 'unknown'),
                name: payload.name || payload.full_name || payload.username || payload.email || 'User',
                email: payload.email || '',
                picture: payload.picture || payload.avatar_url,
              };
            } catch (error) {
              console.warn('⚠️ Could not decode user from token:', error);
            }
          }
          
          if (user) {
            saveUserToStorage(user);
            login(user);
          }
          
          // Clear session data
          const originalPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
          sessionStorage.removeItem('auth_redirect_path');
          sessionStorage.removeItem('auth_session_id');
          
          console.log('✅ Authentication successful, redirecting to:', originalPath);
          clearTimeout(fallbackTimeout);
          navigate(originalPath, { replace: true });
        })
        .catch((error) => {
          console.error('❌ Failed to exchange code for tokens:', error);
          clearTimeout(fallbackTimeout);
          // Still redirect to dashboard, user can try again
          navigate('/dashboard', { replace: true });
        });
    } else {
      // No auth token or code, redirect to dashboard
      console.warn('⚠️ No auth token or code in callback URL');
      setProcessed(true);
      clearTimeout(fallbackTimeout);
      navigate('/dashboard', { replace: true });
    }

    // Single cleanup function for all cases
    return () => {
      clearTimeout(fallbackTimeout);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
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

