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
        },
      },
    },
  },
});
