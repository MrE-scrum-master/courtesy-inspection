# Environment Configuration - Supabase & Railway Edition

## The Only .env File You Need

```bash
# =============================================================================
# COURTESY INSPECTION - ULTRA SIMPLE MVP
# =============================================================================

# Supabase (Replaces Database, Auth, Storage, Realtime)
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... # Public key (safe for frontend)
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # Backend only (keep secret!)

# Railway (Auto-injected)
PORT=3000                             # Railway sets this
RAILWAY_ENVIRONMENT=production       # Railway sets this

# Telnyx SMS (The only external service we need)
TELNYX_API_KEY=KEY...
TELNYX_PHONE_NUMBER=+1234567890

# Stripe (Phase 2 - commented out for now)
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_PUBLISHABLE_KEY=pk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# App Config
APP_NAME="Courtesy Inspection"
APP_URL=https://courtesy-inspection.com
API_URL=https://api.railway.app       # Your Railway URL

# That's it. Seriously.
```

## What We DON'T Need Anymore

### ❌ REMOVED - Supabase Handles These:
```bash
# Database - Supabase provides PostgreSQL
# DATABASE_URL=postgresql://...       # ❌ Not needed

# Auth - Supabase Auth handles everything  
# JWT_SECRET=...                      # ❌ Not needed
# JWT_REFRESH_SECRET=...              # ❌ Not needed
# OAUTH_GOOGLE_CLIENT_ID=...          # ❌ Not needed (Supabase has OAuth)

# File Storage - Supabase Storage
# AWS_ACCESS_KEY_ID=...               # ❌ Not needed
# AWS_SECRET_ACCESS_KEY=...           # ❌ Not needed
# AWS_S3_BUCKET=...                   # ❌ Not needed

# Redis/Caching - Not needed for MVP
# REDIS_URL=...                       # ❌ Not needed

# Email - We don't send emails!
# SENDGRID_API_KEY=...                # ❌ Not needed
# EMAIL_FROM=...                      # ❌ Not needed
```

### ❌ REMOVED - Too Complex for MVP:
```bash
# VIN Decoder - Manual entry for MVP
# VIN_API_PRIMARY_KEY=...             # ❌ Not needed

# Monitoring - Use platform tools
# SENTRY_DSN=...                      # ❌ Not needed
# DATADOG_API_KEY=...                 # ❌ Not needed

# Complex Features
# OPENAI_API_KEY=...                  # ❌ Not needed
# FEATURE_AI_ANALYSIS=...             # ❌ Not needed
```

## Environment Files by Component

### Mobile App (Expo)
```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_API_URL=https://api.railway.app
```

### Backend API (Railway)
```bash
# Railway Environment Variables (set in dashboard)
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TELNYX_API_KEY=KEY...
TELNYX_PHONE_NUMBER=+1234567890
```

### Web Components (Railway - same as API)
```bash
# Environment variables (set in Railway dashboard)
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
# Note: Web components are served from same Railway API server
```

## Validation Script (Simplified)

```javascript
// validate-env.js
const required = {
  mobile: [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  ],
  backend: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'TELNYX_API_KEY'
  ],
  web: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]
};

function validate(component) {
  const missing = required[component].filter(key => !process.env[key]);
  
  if (missing.length) {
    console.error('❌ Missing:', missing.join(', '));
    process.exit(1);
  }
  
  console.log('✅ Environment ready');
}

validate(process.env.COMPONENT || 'backend');
```

## Setup Instructions (10 Minutes)

### 1. Supabase (3 minutes)
```bash
1. Go to supabase.com
2. Create new project
3. Copy URL and anon key from Settings > API
4. Enable Authentication
```

### 2. Railway (2 minutes)
```bash
1. Go to railway.app
2. New Project > Deploy from GitHub
3. Add environment variables:
   - SUPABASE_SERVICE_ROLE_KEY
   - TELNYX_API_KEY
   - TELNYX_PHONE_NUMBER
```

### 3. Telnyx (3 minutes)
```bash
1. Sign up at telnyx.com
2. Add $10 credit
3. Get phone number
4. Copy API key
```

### 4. Local Development (2 minutes)
```bash
# Create .env file
cp .env.example .env

# Add your keys
nano .env

# Start developing
npm run dev
```

## Security Notes

### Public Keys (Safe to expose)
- `NEXT_PUBLIC_*` - Next.js public
- `EXPO_PUBLIC_*` - Expo public
- Supabase anon key - Has RLS protection

### Secret Keys (Keep private!)
- `SUPABASE_SERVICE_ROLE_KEY` - Full database access
- `TELNYX_API_KEY` - Can send SMS
- Future: `STRIPE_SECRET_KEY` - Can charge cards

### Best Practices
1. Never commit `.env` files
2. Use platform environment variables
3. Rotate keys if exposed
4. Enable RLS on all Supabase tables

## Platform-Specific Setup

### Railway
- Auto-deploys from GitHub
- Provides PORT automatically
- SSL included
- Zero config needed

### Railway (Full-Stack)
- Auto-deploys from GitHub
- Handles both API and web components
- Environment variables in dashboard
- Built-in SSL and custom domains

### Expo
- Use EAS Build for production
- Secrets in `eas.json`
- Environment variables in build

## Cost Tracking

### Free Tier Limits (Aug 2025)
```
Supabase Free:
- 500MB database ✓
- 1GB storage ✓
- 2GB bandwidth ✓
- 50K MAU ✓

Railway Free:
- $5 credit ✓
- 500 hours ✓
- Handles both API and web ✓

Total: $0/month for MVP
```

### When to Upgrade
```
Supabase Pro ($25/mo) when:
- Database > 400MB
- Storage > 800MB
- Need point-in-time recovery

Railway Hobby ($5/mo) when:
- Free credits exhausted
- Need more resources

Telnyx Pay-as-you-go when:
- Sending > 1000 SMS/month
```

## Migration from Old Config

```bash
# Old (complex) → New (simple)

# Database
DATABASE_URL=... → Use Supabase URL

# Auth
JWT_SECRET=... → Delete (Supabase handles)
OAUTH_* → Delete (Supabase has OAuth)

# Storage
AWS_* → Delete (Supabase Storage)

# Email
SENDGRID_* → Delete (No email in MVP)

# Redis
REDIS_URL → Delete (Not needed)

# The entire old .env (200+ lines) becomes 10 lines
```

## Emergency Contacts

- Supabase Status: status.supabase.com
- Railway Status: status.railway.app
- Telnyx Status: status.telnyx.com

## Remember

**Old way**: 200+ environment variables, complex setup, $100+/month
**New way**: 10 environment variables, 10-minute setup, $0/month

This is the way.