# Google Authentication Setup

This application now includes Google OAuth authentication. Follow these steps to set it up:

## 1. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set the application type to "Web application"
6. Add authorized JavaScript origins:
   - `http://localhost:5173` (for development)
   - `https://yourdomain.com` (for production)
7. Copy the generated Client ID

## 2. Environment Configuration

Create a `.env` file in the root directory and add your Google Client ID:

```env
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id-here
```

## 3. How It Works

1. **Start Free Trial Button**: When clicked, it navigates to `/signup`
2. **Sign Up Page**: Users can sign in with Google using the Google OAuth button
3. **Authentication**: Upon successful Google login, user data is stored in context and localStorage
4. **Dashboard**: After authentication, users are redirected to `/dashboard` with their profile information

## 4. Features Implemented

- ✅ Google OAuth integration using `@react-oauth/google`
- ✅ React Router for navigation between pages
- ✅ Authentication context for state management
- ✅ Protected dashboard route
- ✅ User profile display with avatar
- ✅ Logout functionality
- ✅ Persistent login state (localStorage)

## 5. File Structure

```
src/
├── contexts/
│   └── AuthContext.tsx          # Authentication state management
├── pages/
│   ├── Home.tsx                 # Landing page
│   ├── SignUp.tsx              # Google OAuth sign-up page
│   └── Dashboard.tsx           # Authenticated user dashboard
├── components/
│   └── Hero.tsx                # Updated with navigation to sign-up
└── App.tsx                     # Updated with routing and OAuth provider
```

## 6. Testing

1. Run `npm run dev`
2. Click "Start Free Trial" on the homepage
3. You'll be redirected to the sign-up page
4. Click the Google sign-in button
5. Complete Google authentication
6. You'll be redirected to the dashboard

## 7. Production Deployment

Make sure to:
1. Update the Google OAuth client ID with your production domain
2. Set the correct environment variable in your production environment
3. Update the authorized origins in Google Cloud Console
