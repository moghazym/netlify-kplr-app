# Redirect URI Mismatch Fix

## Problem

When clicking sign in, you're getting:
```
Failed to exchange authorization code: (redirect_uri_mismatch) Bad Request
redirect_uri: "https://auth.usekplr.com/auth/callback"
```

But the app is correctly sending:
```
redirect_uri: "https://app.usekplr.com/callback"
```

## Root Cause

The auth service (`auth.usekplr.com`) is **not properly forwarding** the `redirect_uri` parameter to Google OAuth. Instead, it's using its own callback URL (`https://auth.usekplr.com/auth/callback`) when initiating the Google OAuth flow.

## Expected Flow

1. **App redirects to auth service:**
   ```
   https://auth.usekplr.com/?redirect_uri=https://app.usekplr.com/callback&client_id=kplr-client
   ```

2. **Auth service should:**
   - Receive the `redirect_uri` parameter
   - Use this `redirect_uri` when calling Google OAuth (not its own callback URL)
   - Google OAuth redirects back to auth service: `https://auth.usekplr.com/auth/callback?code=...`
   - Auth service processes the code and calls backend
   - Auth service redirects to the original `redirect_uri`: `https://app.usekplr.com/callback?code=...&auth=...`

3. **App processes auth token** and redirects to dashboard

## Backend Fix Required

The auth service backend needs to be updated to:

### 1. Accept and Store the redirect_uri Parameter

When the auth service receives the initial request:
```
GET /?redirect_uri=https://app.usekplr.com/callback&client_id=kplr-client
```

It should:
- Extract and store the `redirect_uri` parameter (in session or state)
- Use this `redirect_uri` when initiating Google OAuth

### 2. Use redirect_uri in Google OAuth Call

When calling Google OAuth, the auth service should use the `redirect_uri` from the request, not its own callback URL:

```python
# WRONG (current behavior):
google_oauth_url = f"https://accounts.google.com/o/oauth2/v2/auth?...&redirect_uri=https://auth.usekplr.com/auth/callback"

# CORRECT (what it should be):
google_oauth_url = f"https://accounts.google.com/o/oauth2/v2/auth?...&redirect_uri={redirect_uri_from_request}"
```

### 3. Google OAuth Console Configuration

In Google Cloud Console, you need to add **both** redirect URIs as authorized:

1. `https://auth.usekplr.com/auth/callback` (for auth service's internal callback)
2. `https://app.usekplr.com/callback` (for the app's callback)

**OR** configure the auth service to use the app's callback URL directly.

### 4. After Google Callback

After Google redirects back to the auth service with the code:
```
GET /auth/callback?code=...
```

The auth service should:
- Exchange the code for tokens
- Call your backend API to create/login user
- Redirect to the stored `redirect_uri` with the auth token:
```
https://app.usekplr.com/callback?code=...&auth=<jwt_token>
```

## Frontend Status

The frontend is correctly:
- ✅ Sending `redirect_uri=https://app.usekplr.com/callback`
- ✅ URL encoding the parameter
- ✅ Handling the callback at `/callback`
- ✅ Processing the auth token

## Testing

After the backend fix:

1. Click sign in from `app.usekplr.com`
2. Check browser console - should see:
   ```
   🚫 Redirecting to auth service:
   redirectUri: "https://app.usekplr.com/callback"
   ```
3. After Google auth, should redirect to:
   ```
   https://app.usekplr.com/callback?code=...&auth=...
   ```
4. Should successfully authenticate and redirect to dashboard

## Debugging

If issues persist, check:

1. **Network tab**: Verify the initial request to auth service includes `redirect_uri=https://app.usekplr.com/callback`
2. **Auth service logs**: Verify it's receiving and storing the `redirect_uri`
3. **Google OAuth request**: Verify the auth service is using the correct `redirect_uri` when calling Google
4. **Google Console**: Verify both redirect URIs are authorized

