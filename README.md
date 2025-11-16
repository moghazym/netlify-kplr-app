# KplrAI Landing Page

## <a href="https://ui.shadcn.com/" target="_blank">ShadcnUI</a> + <a href="https://react.dev/" target="_blank">React</a> + <a href="https://www.typescriptlang.org/" target="_blank">TypeScript</a> + <a href="https://tailwindcss.com/" target="_blank">Tailwind</a> + <a href="https://developers.google.com/identity" target="_blank">Google OAuth</a>

![kplr-landing-page](https://github.com/leoMirandaa/shadcn-landing-page/assets/61714687/3ba7b51f-9589-4541-800a-5ab7cecad1b5)

A modern, fully responsive landing page for KplrAI with Google authentication integration. Features a beautiful signup page with Chatbase-style UI design and seamless user authentication flow.

## Sections

- [x] Navbar
- [x] Sidebar(mobile)
- [x] Hero
- [x] Sponsors
- [x] About
- [x] Stats
- [x] How It Works
- [x] Features
- [x] Services
- [x] Call-to-Action (CTA)
- [x] Testimonials
- [x] Team
- [x] Pricing
- [x] Newsletter
- [x] Frequently Asked Questions(FAQ)
- [x] Footer
- [x] **Signup Page** (New!)
- [x] **Dashboard Page** (New!)
- [x] **Google OAuth Integration** (New!)

## Features

- [x] Fully Responsive Design
- [x] User Friendly Navigation
- [x] Dark Mode
- [x] Meta tags
- [x] **Google OAuth Authentication**
- [x] **Client-side Routing** (React Router)
- [x] **Authentication Context** (Global State Management)
- [x] **Modern Signup UI** (Chatbase-style Design)
- [x] **Protected Dashboard**
- [x] **Seamless Button Navigation**

## Prerequisites

Before running this project, make sure you have:
- Node.js (v16 or higher)
- npm or yarn
- A Google Cloud Console account (for OAuth setup)

## Environment Setup

1. **Create a `.env` file** in the root directory:

```bash
touch .env
```

2. **Add your Google OAuth credentials** to the `.env` file:

```env
# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here

# Optional: Add other environment variables as needed
# VITE_API_URL=your-api-url
# VITE_APP_NAME=KplrAI
```

3. **Get Google OAuth Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Set application type to "Web application"
   - Add authorized origins: `http://localhost:5173`, `http://localhost:5174`
   - Copy the Client ID and paste it in your `.env` file

> **Note**: For detailed Google OAuth setup instructions, see [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)

## Installation & Setup

1. **Clone this repository**:

```bash
git clone https://github.com/your-username/kplr-landing.git
cd kplr-landing
```

2. **Install dependencies**:

```bash
npm install
```

3. **Set up environment variables**:
   - Copy the example environment file: `cp .env.example .env` (if available)
   - Or create a new `.env` file with the variables mentioned above
   - Add your Google OAuth Client ID

4. **Set up localhost subdomains** (for testing app and auth subdomains locally):
   
   On macOS/Linux, add these lines to your `/etc/hosts` file:
   ```bash
   sudo nano /etc/hosts
   ```
   
   Add these lines:
   ```
   127.0.0.1 app.localhost
   127.0.0.1 auth.localhost
   ```
   
   On Windows, edit `C:\Windows\System32\drivers\etc\hosts` (as Administrator) and add:
   ```
   127.0.0.1 app.localhost
   127.0.0.1 auth.localhost
   ```

5. **Run the development server**:

```bash
npm run dev
```

6. **Open your browser** and navigate to:
   - Main site: `http://localhost:5173` (or the port shown in terminal)
   - App subdomain: `http://app.localhost:5173` (after authentication)
   - Auth subdomain: `http://auth.localhost:5173` (authentication page)

## Authentication Flow

The application uses a dedicated auth subdomain pattern:

1. **User tries to access `app.domain`** → If not authenticated, redirects to `auth.domain` with query parameters:
   - `client_id`: Client identifier
   - `redirect_uri`: Where to redirect after authentication
   - `authorization_session_id`: Session tracking ID

2. **User authenticates on `auth.domain`** → After successful authentication, redirects back to `redirect_uri` with auth token

3. **User is authenticated on `app.domain`** → Can access protected routes

### Example Flow:
```
User → app.localhost:5173/dashboard
  ↓ (not authenticated)
auth.localhost:5173/?client_id=kplr-client&redirect_uri=http://app.localhost:5173/dashboard&authorization_session_id=xxx
  ↓ (authenticate)
auth.localhost:5173/callback
  ↓ (success)
app.localhost:5173/dashboard?auth=<token>
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Shadcn/UI components
│   └── ...             # Page-specific components
├── contexts/           # React contexts (Auth, Theme, etc.)
├── pages/              # Page components
│   ├── Home.tsx        # Landing page
│   ├── SignUp.tsx      # Authentication page
│   └── Dashboard.tsx   # Protected dashboard
├── assets/             # Static assets
└── lib/                # Utility functions
```

## Authentication Flow

1. User clicks "Start Free Trial" on any page
2. Redirects to `/signup` page
3. User can sign up with Google OAuth or email/password
4. Upon successful authentication, redirects to `/dashboard`
5. User data is stored in authentication context

## Troubleshooting

### Common Issues

1. **White page on localhost**:
   - Check if all dependencies are installed: `npm install`
   - Verify your `.env` file has the correct `VITE_GOOGLE_CLIENT_ID`
   - Check browser console for errors

2. **Google OAuth not working**:
   - Verify your Client ID is correct in `.env`
   - Check that your domain is added to authorized origins in Google Console
   - Ensure you're using `http://localhost:5173` or `http://localhost:5174`

3. **Build errors**:
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check that all environment variables are prefixed with `VITE_`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
