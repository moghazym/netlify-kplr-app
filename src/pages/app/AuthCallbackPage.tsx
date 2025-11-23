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
      
      try {
        console.log('🔐 Processing auth token...');
        
        // Process the auth token
        const authProcessed = checkUrlForAuth();
        console.log('🔐 Auth processed:', authProcessed);
        
        if (authProcessed) {
          // Get the user from storage (saved by checkUrlForAuth)
          const user = getUserFromStorage();
          console.log('🔐 User from storage:', user ? 'found' : 'not found');
          
          // Get the original path before clearing
          const originalPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
          
          // Clear session data
          sessionStorage.removeItem('auth_redirect_path');
          sessionStorage.removeItem('auth_session_id');
          
          if (user) {
            // Update auth context
            login(user);
            console.log('✅ Authentication successful, redirecting to:', originalPath);
          } else {
            console.warn('⚠️ No user data found, but auth token was processed. Redirecting anyway.');
          }
          
          // Always redirect, even if user data is missing (token is stored)
          clearTimeout(fallbackTimeout);
          // Use both navigate and window.location as fallback
          navigate(originalPath, { replace: true });
          // Fallback: force navigation if React Router doesn't work
          setTimeout(() => {
            if (window.location.pathname === '/callback') {
              console.warn('⚠️ React Router navigation failed, using window.location');
              window.location.href = originalPath;
            }
          }, 100);
        } else {
          console.error('❌ Failed to process auth token');
          clearTimeout(fallbackTimeout);
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('❌ Error processing auth:', error);
        clearTimeout(fallbackTimeout);
        navigate('/dashboard', { replace: true });
      }
    } else if (code) {
      // If we have a code but no auth token, the auth service might still be processing
      // Poll the URL to check if the auth token appears (auth service might do client-side redirect)
      console.warn('⚠️ Received code but no auth token yet, polling for auth token...');
      
      let pollCount = 0;
      const maxPolls = 20; // Poll for up to 10 seconds (20 * 500ms)
      
      pollInterval = setInterval(() => {
        pollCount++;
        
        // Check the current URL directly (not just searchParams, which might not update)
        const currentUrl = new URL(window.location.href);
        const authParam = currentUrl.searchParams.get('auth');
        
        console.log(`🔍 Polling attempt ${pollCount}/${maxPolls}, auth token:`, authParam ? 'found!' : 'not found');
        
        if (authParam) {
          // Auth token appeared! Process it
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          clearTimeout(fallbackTimeout);
          
          console.log('✅ Auth token appeared, processing...');
          
          try {
            const authProcessed = checkUrlForAuth();
            if (authProcessed) {
              const user = getUserFromStorage();
              const originalPath = sessionStorage.getItem('auth_redirect_path') || '/dashboard';
              sessionStorage.removeItem('auth_redirect_path');
              sessionStorage.removeItem('auth_session_id');
              
              if (user) {
                login(user);
              }
              
              console.log('✅ Authentication successful, redirecting to:', originalPath);
              navigate(originalPath, { replace: true });
            } else {
              console.error('❌ Failed to process auth token after polling');
              navigate('/dashboard', { replace: true });
            }
          } catch (error) {
            console.error('❌ Error processing auth after polling:', error);
            navigate('/dashboard', { replace: true });
          }
          
          setProcessed(true);
        } else if (pollCount >= maxPolls) {
          // Max polls reached, give up
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          clearTimeout(fallbackTimeout);
          console.warn('⚠️ Max polling attempts reached, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
          setProcessed(true);
        }
      }, 500); // Poll every 500ms
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

