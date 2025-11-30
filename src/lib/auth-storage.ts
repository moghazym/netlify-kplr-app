/**
 * Auth storage utilities that work across subdomains
 * For localhost subdomains, we pass auth via URL params since localStorage is origin-specific
 */

interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

export const saveUserToStorage = (user: User): void => {
  if (typeof window === 'undefined') return;

  // Save to localStorage (for same-origin access)
  localStorage.setItem('user', JSON.stringify(user));

  // Also save to sessionStorage as backup
  sessionStorage.setItem('user', JSON.stringify(user));
};

export const getUserFromStorage = (): User | null => {
  if (typeof window === 'undefined') return null;

  try {
    // Try localStorage first
    const localUser = localStorage.getItem('user');
    if (localUser) {
      return JSON.parse(localUser);
    }

    // Fallback to sessionStorage
    const sessionUser = sessionStorage.getItem('user');
    if (sessionUser) {
      return JSON.parse(sessionUser);
    }
  } catch (error) {
    console.error('Error reading user from storage:', error);
  }

  return null;
};

export const clearUserFromStorage = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
  // Also clear auth tokens
  localStorage.removeItem('access_token');
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('auth_token');
};

/**
 * Encode user data for URL parameter
 */
export const encodeUserForUrl = (user: User): string => {
  return btoa(JSON.stringify(user));
};

/**
 * Decode user data from URL parameter
 */
export const decodeUserFromUrl = (encoded: string): User | null => {
  try {
    const decoded = atob(encoded);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding user from URL:', error);
    return null;
  }
};

/**
 * Check if a string looks like a JWT token
 */
const isJWT = (token: string): boolean => {
  // JWT tokens have 3 parts separated by dots: header.payload.signature
  const parts = token.split('.');
  return parts.length === 3;
};

/**
 * Check URL for auth token and save it to storage
 * Returns true if auth was found and saved
 * 
 * The auth parameter can be either:
 * 1. Base64-encoded user data (legacy format)
 * 2. JWT token (new format)
 */
export const checkUrlForAuth = (): boolean => {
  if (typeof window === 'undefined') return false;

  const urlParams = new URLSearchParams(window.location.search);
  const authToken = urlParams.get('auth');

  if (!authToken) {
    console.log('🔐 No auth token found in URL');
    return false;
  }

  console.log('🔐 Processing auth token, isJWT:', isJWT(authToken));

  // Check if it's a JWT token
  if (isJWT(authToken)) {
    console.log('🔐 Detected JWT token, storing...');

    // Store JWT token for API calls
    localStorage.setItem('access_token', authToken);
    sessionStorage.setItem('access_token', authToken);
    console.log('🔐 Stored token in localStorage and sessionStorage');

    // Try to decode JWT to get user info (JWT payload is base64 encoded JSON)
    try {
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      console.log('🔐 JWT payload:', payload);

      if (payload.sub || payload.email || payload.user_id || payload.id) {
        const user: User = {
          id: String(payload.sub || payload.user_id || payload.id || 'unknown'),
          name: payload.name || payload.full_name || payload.username || 'User',
          email: payload.email || '',
          picture: payload.picture || payload.avatar_url || undefined,
        };
        console.log('🔐 Extracted user from JWT:', user);
        saveUserToStorage(user);
      } else {
        console.warn('⚠️ JWT payload does not contain user identifiers:', Object.keys(payload));
      }
    } catch (error) {
      console.warn('⚠️ Could not decode JWT payload for user info:', error);
      // Still save the token even if we can't decode user info
    }

    // Clear the auth session ID since authentication is complete
    sessionStorage.removeItem('auth_session_id');

    // Clean up URL by removing auth parameter
    urlParams.delete('auth');
    const newUrl = window.location.pathname +
      (urlParams.toString() ? '?' + urlParams.toString() : '') +
      window.location.hash;
    window.history.replaceState({}, '', newUrl);

    console.log('✅ JWT token processed and stored');
    return true;
  } else {
    // Try to decode as base64-encoded user data (legacy format)
    console.log('🔐 Trying to decode as base64 user data...');
    const user = decodeUserFromUrl(authToken);
    if (user) {
      console.log('🔐 Decoded user from base64:', user);
      console.warn('⚠️ Auth service sent user data but NO JWT token!');
      console.warn('⚠️ This means API calls will fail with 401 because we have no access_token');
      console.warn('⚠️ The auth service should send a JWT token in the ?auth= parameter');

      saveUserToStorage(user);

      // Clear the auth session ID since authentication is complete
      sessionStorage.removeItem('auth_session_id');

      // Clean up URL by removing auth parameter
      urlParams.delete('auth');
      const newUrl = window.location.pathname +
        (urlParams.toString() ? '?' + urlParams.toString() : '') +
        window.location.hash;
      window.history.replaceState({}, '', newUrl);

      console.log('✅ Base64 user data processed and stored (but NO TOKEN)');
      return true;
    } else {
      console.error('❌ Failed to decode auth token as either JWT or base64 user data');
    }
  }

  return false;
};


