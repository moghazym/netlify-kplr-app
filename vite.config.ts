import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // Allow external connections
    port: 5173,
    // Support both localhost and app.localhost
    strictPort: false,
    // Proxy API requests to avoid CORS issues in development
    proxy: {
      '/api': {
        target: 'https://api.usekplr.com',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: 'localhost', // Rewrite cookie domain to localhost
        cookiePathRewrite: '/', // Rewrite cookie path
        // Forward cookies and Authorization header for authentication
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Forward cookies from the browser
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            // Forward Authorization header (Bearer token)
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
          });
          
          // Handle Set-Cookie headers from backend and rewrite domain
          proxy.on('proxyRes', (proxyRes, req, res) => {
            const setCookieHeaders = proxyRes.headers['set-cookie'];
            if (setCookieHeaders) {
              // Rewrite cookie domain to localhost so browser accepts them
              proxyRes.headers['set-cookie'] = setCookieHeaders.map((cookie: string) => {
                return cookie
                  .replace(/Domain=[^;]+/gi, 'Domain=localhost')
                  .replace(/SameSite=None/gi, 'SameSite=Lax'); // Lax works better for localhost
              });
            }
          });
        },
      },
    },
  },
});
