import { getAppBaseUrl, getAuthBaseUrl } from './subdomain';

/**
 * Redirect to auth.usekplr.com for sign in
 * This redirects unauthenticated users to the auth service
 * The redirect_uri will always point to /callback on the app domain
 * 
 * Flow:
 * 1. App redirects to auth with redirect_uri=http://localhost:5173/callback (dev) or https://app.usekplr.com/callback (prod)
 * 2. User authenticates with Google
 * 3. Google redirects to auth service /callback?code=...
 * 4. Auth service calls backend, then redirects to redirect_uri?code=...&auth=...
 * 5. App processes auth token and redirects to dashboard
 */
export const redirectToAuth = (currentPath?: string) => {
  // Store the current path so we can redirect back to it after auth
  const pathToReturnTo = currentPath || window.location.pathname;
  if (pathToReturnTo !== '/callback') {
    sessionStorage.setItem('auth_redirect_path', pathToReturnTo);
  }

  // Get the app base URL (localhost:port in dev, app.usekplr.com in prod)
  const appBaseUrl = getAppBaseUrl();
  // Always use /callback as the redirect_uri
  const redirectUri = `${appBaseUrl}/callback`;
  
  const clientId = import.meta.env.VITE_CLIENT_ID || 'kplr-client';
  
  // Use a single session ID stored in sessionStorage to avoid generating multiple IDs
  // Check if we already have a pending redirect
  const existingSessionId = sessionStorage.getItem('auth_session_id');
  let sessionId = existingSessionId;
  
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('auth_session_id', sessionId);
  }
  
  // Always use production auth service
  const authBaseUrl = getAuthBaseUrl();
  
  const urlParams = new URLSearchParams();
  urlParams.set('redirect_uri', redirectUri);
  // Only add client_id and authorization_session_id if your auth service expects them
  // Remove them if your auth service doesn't use them
  if (clientId) {
    urlParams.set('client_id', clientId);
  }
  if (sessionId) {
    urlParams.set('authorization_session_id', sessionId);
  }
  
  const authUrl = `${authBaseUrl}/?${urlParams.toString()}`;
  
  console.log('🚫 Redirecting to auth:', {
    authUrl,
    redirectUri,
    sessionId,
    pathToReturnTo,
    reusedSessionId: !!existingSessionId,
  });
  
  // Don't clear the session ID here - let it persist until auth completes
  // It will be cleared when the user successfully authenticates and returns
  
  window.location.href = authUrl;
};

