/**
 * Utility functions for subdomain detection and routing
 */

const isLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || 
         hostname === '127.0.0.1' ||
         hostname.includes('.localhost');
};

const getPort = (): string => {
  if (typeof window === 'undefined') return '';
  return window.location.port ? `:${window.location.port}` : '';
};

export const isAppSubdomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // Check for app subdomain in production
  if (hostname === 'app.usekplr.com') {
    return true;
  }
  
  // Check for app subdomain in local development
  if (hostname === 'app.localhost' || hostname.startsWith('app.localhost:')) {
    return true;
  }
  
  return false;
};

export const isAuthSubdomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // Check for auth subdomain in production
  if (hostname === 'auth.usekplr.com') {
    return true;
  }
  
  // Check for auth subdomain in local development
  if (hostname === 'auth.localhost' || hostname.startsWith('auth.localhost:')) {
    return true;
  }
  
  return false;
};

export const getAppBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  
  const hostname = window.location.hostname;
  const port = getPort();
  
  // In production, use app subdomain
  if (hostname === 'app.usekplr.com') {
    return 'https://app.usekplr.com';
  }
  
  // In development, use localhost (with port)
  if (isLocalhost()) {
    return `${window.location.protocol}//${hostname}${port}`;
  }
  
  // Fallback to production app subdomain
  return 'https://app.usekplr.com';
};

export const getAuthBaseUrl = (): string => {
  // Always use production auth service (even in dev)
  return 'https://auth.usekplr.com';
};

export const getLandingBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  
  if (isLocalhost()) {
    return `http://localhost${getPort()}`;
  }
  
  return 'https://usekplr.com';
};

/**
 * Generate authorization URL with query parameters
 */
export const buildAuthUrl = (params: {
  clientId?: string;
  redirectUri: string;
  authorizationSessionId?: string;
}): string => {
  const authBaseUrl = getAuthBaseUrl();
  const urlParams = new URLSearchParams();
  
  if (params.clientId) {
    urlParams.set('client_id', params.clientId);
  }
  urlParams.set('redirect_uri', params.redirectUri);
  if (params.authorizationSessionId) {
    urlParams.set('authorization_session_id', params.authorizationSessionId);
  }
  
  return `${authBaseUrl}/?${urlParams.toString()}`;
};

