# Unified Railway Deployment Guide

**ONE Railway instance serves everything. No separate deployments. No complexity.**

## The Simple Truth

Instead of managing multiple services, domains, and deployments, **everything runs from ONE Railway instance** with intelligent routing.

## URL Structure

Your domain serves different content based on the path:

```
https://courtesyinspection.com/
├── /                    → Landing page (marketing/info)
├── /app                 → Expo Web application
│   ├── /app/inspections → Inspections screen
│   ├── /app/customers   → Customer management
│   └── /app/settings    → Shop settings
├── /api/                → REST API endpoints
│   ├── /api/sms/send    → Send SMS messages
│   ├── /api/reports/    → Generate/view reports
│   └── /api/auth/       → Authentication
└── /l/xyz               → Short links (for SMS)
```

## How It Works

### 1. Single Express Server
One `server.js` file handles ALL routing:

```javascript
// 1. API endpoints (highest priority)
app.post('/api/sms/send', sendSMS);
app.get('/api/reports/:id', getReport);

// 2. Short links for SMS
app.get('/l/:code', redirectShortLink);

// 3. Expo Web app at /app
app.use('/app', express.static('web-build'));
app.get('/app/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web-build', 'index.html'));
});

// 4. Landing page at root
app.get('/', serveLandingPage);
```

### 2. File Structure
```
server-directory/
├── server.js           # Main server with unified routing
├── package.json        # Dependencies
├── public/             # Static assets
│   └── landing.html    # Landing page (optional)
├── web-build/          # Expo Web build output
│   ├── index.html      # Expo Web entry point
│   └── static/         # JS/CSS bundles
└── templates/          # Email/report templates
```

## Deployment Process

### 1. Build Expo Web
```bash
# In your Expo project directory
expo export --platform web
# This creates web-build/ folder
```

### 2. Copy Web Build to Server
```bash
# Copy web-build to your server directory
cp -r app/web-build/ server/web-build/
```

### 3. Deploy to Railway
```bash
# Add, commit, and push
git add .
git commit -m "Deploy unified app"
git push origin main
# Railway auto-deploys everything
```

### 4. Verify Routes
- ✅ `https://your-domain.com/` → Landing page
- ✅ `https://your-domain.com/app` → Expo Web app
- ✅ `https://your-domain.com/api/health` → API status
- ✅ `https://your-domain.com/l/test` → Short link test

## Environment Variables

```bash
# Unified domain configuration
PUBLIC_URL=https://courtesyinspection.com
APP_URL=https://courtesyinspection.com/app
API_URL=https://courtesyinspection.com/api
LINKS_URL=https://courtesyinspection.com/l

# Backend services (same as before)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
```

## Benefits of Unified Deployment

### Simplified Management
- **One domain** to manage
- **One SSL certificate** (automatic)
- **One set of logs** to monitor
- **One deployment** to worry about

### Cost Savings
- **No separate hosting** for web app
- **No additional domains** needed
- **No CDN complexity** for small scale
- **No subdomain management**

### Technical Advantages
- **Simplified CORS** (same origin)
- **Shared authentication** state
- **Unified error handling**
- **Single monitoring setup**

### SMS Cost Optimization
Links use same domain, keeping SMS messages short:
```
Instead of: "View report: https://reports.company.com/inspection/abc-123-def"
Send this:  "View report: https://company.com/l/x7k9"
```

## Troubleshooting

### App Not Loading at /app
```bash
# Check if web-build exists
ls -la web-build/
# If missing, rebuild
expo export --platform web
```

### API Routes Not Working
```bash
# Check server logs
railway logs
# Verify middleware order in server.js
```

### Short Links Not Redirecting
```bash
# Test short link creation
curl -X POST https://your-domain.com/api/reports/generate
# Check database for short_links table
```

### Landing Page Not Found
```bash
# Check if public/landing.html exists
# Or server will serve fallback HTML
```

## Best Practices

### 1. Route Order Matters
API routes must come before static file serving to avoid conflicts.

### 2. Cache Headers
Set appropriate cache headers for different content types:
- Static assets (JS/CSS): Long cache (1 year)
- HTML files: Short cache (1 hour)
- API responses: No cache

### 3. Error Handling
Implement proper 404 handling for unknown routes:
```javascript
app.get('*', (req, res) => {
  if (req.path.startsWith('/app')) {
    // SPA routing - serve index.html
    res.sendFile(path.join(__dirname, 'web-build', 'index.html'));
  } else {
    // Unknown route - 404
    res.status(404).send('Not Found');
  }
});
```

### 4. Health Monitoring
Implement comprehensive health checks:
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    services: {
      database: await checkDatabase(),
      sms: await checkSMSService(),
      storage: await checkStorage()
    }
  };
  res.json(health);
});
```

## Migration from Separate Deployments

If you previously had separate deployments:

1. **Identify all URLs** currently in use
2. **Set up redirects** for old URLs
3. **Update DNS** to point to unified Railway instance
4. **Test all functionality** end-to-end
5. **Update documentation** and team knowledge
6. **Monitor** for any broken links or issues

## Summary

The unified Railway deployment eliminates complexity while maintaining all functionality:

- ✅ **Simpler** - One deployment instead of multiple
- ✅ **Cheaper** - No additional hosting costs
- ✅ **Faster** - Same origin, no CORS overhead
- ✅ **Reliable** - Fewer moving parts, fewer failure points
- ✅ **Maintainable** - One codebase, one server, one domain

**This is deployment done right for MVPs and small-to-medium applications.**