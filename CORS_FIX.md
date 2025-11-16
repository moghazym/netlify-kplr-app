# CORS Error Fix for Backend

## Problem
The frontend is getting a CORS error when making requests to the backend:
- **Error**: `400 Bad Request` on OPTIONS preflight request
- **URL**: `https://kplr-backend-auihir4xka-ew.a.run.app/api/auth/google/callback`

## Root Cause
The backend is not properly handling CORS (Cross-Origin Resource Sharing) preflight requests. When a browser makes a cross-origin request with credentials, it first sends an OPTIONS request (preflight) to check if the server allows the actual request.

## Solution: Backend Configuration

The backend needs to be updated to handle OPTIONS requests and return proper CORS headers.

### Required Backend Changes

1. **Handle OPTIONS Preflight Requests**
   - The backend must accept and respond to OPTIONS requests
   - Return `200 OK` for OPTIONS requests (not 400)

2. **Return Proper CORS Headers**
   For all requests (especially OPTIONS), the backend must return:
   ```
   Access-Control-Allow-Origin: https://your-frontend-domain.com
   Access-Control-Allow-Methods: POST, OPTIONS, GET
   Access-Control-Allow-Headers: Content-Type, Accept, Authorization
   Access-Control-Allow-Credentials: true
   Access-Control-Max-Age: 3600
   ```

3. **Example Backend Code (Python/FastAPI)**
   ```python
   from fastapi.middleware.cors import CORSMiddleware
   
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["https://your-frontend-domain.com", "http://localhost:5173"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

4. **Example Backend Code (Node.js/Express)**
   ```javascript
   const cors = require('cors');
   
   app.use(cors({
     origin: ['https://your-frontend-domain.com', 'http://localhost:5173'],
     credentials: true,
     methods: ['GET', 'POST', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
   }));
   
   // Handle preflight requests
   app.options('*', cors());
   ```

5. **Example Backend Code (Go)**
   ```go
   func corsMiddleware(next http.Handler) http.Handler {
       return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
           origin := r.Header.Get("Origin")
           allowedOrigins := []string{"https://your-frontend-domain.com", "http://localhost:5173"}
           
           for _, allowedOrigin := range allowedOrigins {
               if origin == allowedOrigin {
                   w.Header().Set("Access-Control-Allow-Origin", origin)
                   w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET")
                   w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization")
                   w.Header().Set("Access-Control-Allow-Credentials", "true")
                   break
               }
           }
           
           if r.Method == "OPTIONS" {
               w.WriteHeader(http.StatusOK)
               return
           }
           
           next.ServeHTTP(w, r)
       })
   }
   ```

## Frontend Domain
Make sure to replace `https://your-frontend-domain.com` with your actual production frontend domain (e.g., `https://kplr.vercel.app` or your custom domain).

## Testing
After updating the backend:
1. Deploy the backend changes
2. Test the authentication flow from production
3. Check browser console for any remaining CORS errors
4. Verify the OPTIONS request returns `200 OK` instead of `400 Bad Request`

## Additional Notes
- The frontend is using `credentials: 'include'` which requires `Access-Control-Allow-Credentials: true`
- The frontend origin must be explicitly allowed (cannot use `*` when credentials are included)
- Preflight requests are cached by browsers, so changes may take a few minutes to take effect

