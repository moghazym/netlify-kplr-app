/**
 * Redirect to auth.usekplr.com for sign in
 * This redirects unauthenticated users to the auth service
 */
export const redirectToAuth = (currentPath?: string) => {
  const currentUrl = currentPath 
    ? `${window.location.protocol}//${window.location.host}${currentPath}`
    : window.location.href;
  
  const clientId = import.meta.env.VITE_CLIENT_ID || 'kplr-client';
  const sessionId = crypto.randomUUID();
  
  // Determine auth URL based on environment
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.includes('.localhost');
  
  const authBaseUrl = isLocalhost 
    ? `http://auth.localhost${window.location.port ? `:${window.location.port}` : ''}`
    : 'https://auth.usekplr.com';
  
  const urlParams = new URLSearchParams();
  urlParams.set('client_id', clientId);
  urlParams.set('redirect_uri', currentUrl);
  urlParams.set('authorization_session_id', sessionId);
  
  const authUrl = `${authBaseUrl}/?${urlParams.toString()}`;
  
  console.log('🚫 Redirecting to auth:', authUrl);
  window.location.href = authUrl;
};

