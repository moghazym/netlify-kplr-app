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
 * Check URL for auth token and save it to storage
 * Returns true if auth was found and saved
 */
export const checkUrlForAuth = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const urlParams = new URLSearchParams(window.location.search);
  const authToken = urlParams.get('auth');
  
  if (authToken) {
    const user = decodeUserFromUrl(authToken);
    if (user) {
      saveUserToStorage(user);
      
      // Clear the auth session ID since authentication is complete
      sessionStorage.removeItem('auth_session_id');
      
      // Clean up URL by removing auth parameter
      urlParams.delete('auth');
      const newUrl = window.location.pathname + 
        (urlParams.toString() ? '?' + urlParams.toString() : '') + 
        window.location.hash;
      window.history.replaceState({}, '', newUrl);
      
      return true;
    }
  }
  
  return false;
};

