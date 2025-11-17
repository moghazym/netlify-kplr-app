# Authentication Setup Guide

This document explains how the authentication flow works for both development and production environments.

## Authentication Flow

1. **User accesses app** → `app.usekplr.com` (or `app.localhost` in dev)
2. **If not authenticated** → Redirects to `auth.usekplr.com?redirect_uri=https://app.usekplr.com/callback`
3. **User authenticates with Google** → Google redirects to auth service `/callback?code=...`
4. **Auth service processes** → Calls backend, then redirects to `redirect_uri?code=...&auth=...`
5. **App processes auth token** → Extracts user data, saves to storage, redirects to dashboard

## Development Setup

### Local Development

No special setup needed! Just use regular `localhost`:

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Access the app at:
   - `http://localhost:5173` (or whatever port Vite uses)

3. The app will automatically redirect to `auth.usekplr.com` for authentication

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_CLIENT_ID=kplr-client
```

### Testing the Flow

1. Start the app: `npm run dev`
2. Access `http://localhost:5173/dashboard`
3. You should be redirected to `https://auth.usekplr.com?redirect_uri=http://localhost:5173/callback`
4. After authentication, you'll be redirected back to `http://localhost:5173/callback?code=...&auth=...`
5. The app processes the auth token and redirects to `/dashboard`

## Production Setup

### Domain Configuration

- **App Domain**: `app.usekplr.com` → Points to this repository
- **Auth Domain**: `auth.usekplr.com` → Points to your auth service

### Environment Variables

Set these in your deployment platform (Vercel, etc.):

```env
VITE_CLIENT_ID=kplr-client
```

### Flow in Production

1. User accesses `https://app.usekplr.com/dashboard`
2. If not authenticated → Redirects to `https://auth.usekplr.com?redirect_uri=https://app.usekplr.com/callback`
3. User authenticates → Auth service redirects to `https://app.usekplr.com/callback?code=...&auth=...`
4. App processes auth → Redirects to dashboard

## Key Files

- **`src/lib/auth-redirect.ts`**: Handles redirecting to auth service
- **`src/pages/app/AuthCallbackPage.tsx`**: Processes the callback from auth service
- **`src/lib/auth-storage.ts`**: Manages user data in localStorage/sessionStorage
- **`src/components/ProtectedRoute.tsx`**: Protects routes and redirects unauthenticated users
- **`src/lib/subdomain.ts`**: Detects and handles subdomain logic

## Troubleshooting

### Multiple Session IDs Generated

- The app now stores session IDs in `sessionStorage` to prevent multiple generations
- Session ID is cleared after successful authentication

### Redirect Loops

- The app checks if it's already on the auth subdomain before redirecting
- Uses a `useRef` flag to prevent multiple redirects

### Callback Not Working

- Ensure `/callback` route is accessible (it's not protected)
- Check browser console for auth token processing logs
- Verify the `auth` parameter is present in the callback URL

### Localhost Issues

- Make sure you're accessing `http://localhost:5173` (or your dev server port)
- Clear browser cache and cookies
- Try accessing in incognito mode
- Check that the redirect is going to `auth.usekplr.com` (not `auth.localhost`)

## Notes

- The `redirect_uri` always points to `/callback` on the app subdomain
- The original path the user was trying to access is stored in `sessionStorage` and restored after auth
- Session IDs are reused during the auth flow to prevent multiple generations
- Auth tokens are base64-encoded user data passed via URL parameter

