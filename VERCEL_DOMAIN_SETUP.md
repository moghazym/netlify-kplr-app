# Vercel Domain Configuration Guide

## Issue: DEPLOYMENT_NOT_FOUND for Subdomains

If you're getting a `404: NOT_FOUND` error with code `DEPLOYMENT_NOT_FOUND` for `app.usekplr.com` and `auth.usekplr.com`, this means the domains are not properly configured in your Vercel project.

## Solution: Configure Domains in Vercel

### Step 1: Add Domains to Your Vercel Project

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project (`kplr-landing` or your project name)
3. Navigate to **Settings** → **Domains**
4. Add the following domains:
   - `usekplr.com` (main domain)
   - `app.usekplr.com` (app subdomain)
   - `auth.usekplr.com` (auth subdomain)

### Step 2: Configure DNS Records

For each subdomain, you need to add DNS records pointing to Vercel:

#### Option A: Using CNAME Records (Recommended)

Add these CNAME records in your DNS provider (where you manage `usekplr.com`):

```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
TTL: 3600 (or Auto)

Type: CNAME
Name: auth
Value: cname.vercel-dns.com
TTL: 3600 (or Auto)
```

#### Option B: Using A Records (If CNAME not supported)

If your DNS provider doesn't support CNAME for root/subdomains, use A records:

```
Type: A
Name: app
Value: 76.76.21.21
TTL: 3600

Type: A
Name: auth
Value: 76.76.21.21
TTL: 3600
```

**Note**: Vercel's IP addresses may change. Check Vercel's documentation for current IPs or use CNAME if possible.

### Step 3: Verify Domain Configuration

1. After adding domains in Vercel, Vercel will show you the DNS records to add
2. Add the DNS records in your DNS provider
3. Wait for DNS propagation (can take a few minutes to 48 hours)
4. Vercel will automatically verify the domains once DNS is configured

### Step 4: Deploy

After domains are configured:

1. Make sure your latest code is deployed to Vercel
2. The subdomains should now work automatically
3. All three domains (`usekplr.com`, `app.usekplr.com`, `auth.usekplr.com`) will point to the same deployment

## How It Works

- All three domains point to the same Vercel deployment
- The React app detects which subdomain is being accessed via `window.location.hostname`
- Based on the subdomain, it renders different routes:
  - `usekplr.com` → Landing page routes
  - `app.usekplr.com` → App routes (dashboard, test suites, etc.)
  - `auth.usekplr.com` → Auth routes (sign in, callback)

## Troubleshooting

### Still getting 404 errors?

1. **Check DNS propagation**: Use `dig app.usekplr.com` or `nslookup app.usekplr.com` to verify DNS is pointing to Vercel
2. **Verify in Vercel**: Go to Settings → Domains and ensure all three domains show as "Valid" or "Valid Configuration"
3. **Check deployment**: Ensure you have at least one successful deployment
4. **Clear cache**: Try accessing the domains in an incognito window

### Domain shows as "Invalid Configuration"

- Double-check your DNS records match what Vercel shows
- Ensure TTL is set correctly
- Wait for DNS propagation (can take up to 48 hours)

### Need to use different projects for different subdomains?

If you want separate deployments for each subdomain, you'll need to:
1. Create separate Vercel projects
2. Configure each project with its respective domain
3. Deploy each project separately

However, the current setup uses a single deployment with client-side routing, which is more efficient.

## Additional Notes

- The `vercel.json` file handles all routing client-side (SPA mode)
- All routes are rewritten to `/index.html` so React Router can handle them
- The subdomain detection happens in `src/lib/subdomain.ts`
- No server-side changes are needed - everything is handled client-side

