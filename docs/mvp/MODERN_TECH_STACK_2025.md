# Modern Tech Stack - August 2025 LTS Versions

## Core Technologies & Versions

### Runtime & Languages
- **Node.js**: v24.0.0 (Active LTS through April 2028)
  - v22 LTS ends October 2025 (only 2 months left!)
  - v24 is the smart choice for new projects
- **TypeScript**: 5.5.x
- **Python**: 3.12.x (for any ML/data processing)

### Mobile Development (Expo/React Native)
- **Expo SDK**: 52.0.0 (Aug 2025 release)
- **React Native**: 0.75.x (Expo SDK 52 compatible)
- **React**: 18.3.x
- **Expo Router**: v4.x (file-based routing)

### Web Development
- **Next.js**: 15.0.x (App Router stable)
- **React**: 18.3.x
- **Tailwind CSS**: 4.0.x (with oxide engine)
- **TypeScript**: 5.5.x

### Backend & Database
- **Supabase**: Latest (auto-updated SaaS)
  - PostgreSQL 16.x under the hood
  - PostgREST 12.x
  - Realtime 2.x
  - Storage API 1.x
- **Railway**: Latest platform features
- **Express**: 5.x (if needed for custom endpoints)

### Payment & Communication
- **Stripe**: 
  - Node SDK: 16.x
  - Stripe Checkout: Latest hosted version
  - Payment Element: Latest
- **Telnyx**: 
  - Node SDK: 2.x
  - Or use Twilio SDK 5.x (Telnyx is compatible)

### Development Tools
- **Vite**: 6.x (for any web tooling)
- **ESLint**: 9.x
- **Prettier**: 3.3.x
- **pnpm**: 9.x (faster than npm/yarn)

### Notable Changes from Original Docs

#### REMOVED/REPLACED:
- ❌ Neon PostgreSQL → ✅ Supabase (includes PostgreSQL)
- ❌ Custom JWT auth → ✅ Supabase Auth
- ❌ Email service (any) → ✅ None needed
- ❌ Redis caching → ✅ Not needed for MVP
- ❌ Docker/K8s → ✅ Railway handles this
- ❌ Custom file storage → ✅ Supabase Storage

#### SIMPLIFIED:
- ❌ Redux/Zustand → ✅ Supabase client (handles state)
- ❌ NextAuth.js → ✅ Supabase Auth helpers
- ❌ Complex CI/CD → ✅ Push to deploy

## Package.json Examples

### Mobile App (Expo)
```json
{
  "name": "courtesy-inspection-mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "android": "expo run:android"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-speech": "~12.0.0",
    "expo-camera": "~15.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-notifications": "~0.28.0",
    "@supabase/supabase-js": "^2.45.0",
    "react": "18.3.1",
    "react-native": "0.75.2"
  },
  "devDependencies": {
    "@types/react": "~18.3.0",
    "typescript": "~5.5.0"
  }
}
```

### Backend API (Railway)
```json
{
  "name": "courtesy-inspection-api",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "express": "^5.0.0",
    "twilio": "^5.2.0",
    "stripe": "^16.0.0",
    "cors": "^2.8.5"
  }
}
```

### Web Components (served from Railway)
For MVP, web components are simple HTML served directly from Railway API:
```json
{
  "name": "courtesy-inspection-api",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "express": "^5.0.0",
    "twilio": "^5.2.0",
    "stripe": "^16.0.0",
    "cors": "^2.8.5"
  }
}
```
*Note: For Phase 2, use Next.js hosted on Railway for complex dashboard needs.*

## Environment Variables (Modern Setup)

### Supabase (Free Tier Limits)
```env
# August 2025 Free Tier:
# - 500MB database
# - 1GB file storage  
# - 2GB bandwidth
# - 50,000 monthly active users
# - 200,000 requests/month
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Backend only
```

### Railway 
```env
# Auto-injected by Railway:
PORT=3000
RAILWAY_ENVIRONMENT=production
DATABASE_URL=postgresql://... # If using Railway PG instead
```

### Services
```env
# Telnyx
TELNYX_API_KEY=KEY...
TELNYX_PHONE_NUMBER=+1234567890
TELNYX_PUBLIC_KEY=... # For number verification

# Stripe (Minimal - use Checkout)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## What's NOT Needed Anymore (YAGNI)

### Auth/Security (Supabase handles):
- JWT_SECRET
- BCRYPT_ROUNDS  
- SESSION_SECRET
- REFRESH_TOKEN_SECRET
- AUTH0_* variables
- COGNITO_* variables

### Infrastructure (Platform handles):
- REDIS_URL
- ELASTICSEARCH_URL
- RABBITMQ_URL
- MEMCACHED_SERVERS
- CDN_URL
- CLOUDFRONT_DISTRIBUTION

### Monitoring (Use platform tools):
- SENTRY_DSN (Phase 2)
- DATADOG_API_KEY
- NEW_RELIC_LICENSE_KEY
- LOGGLY_TOKEN

### Email (Not needed):
- SENDGRID_API_KEY
- MAILGUN_*
- AWS_SES_*
- POSTMARK_*
- RESEND_API_KEY

## Browser/Platform Support (Aug 2025)

### Mobile
- iOS 16+ (covers 95% of iPhones)
- Android 10+ (API 29+, covers 90% of devices)

### Web
- Chrome 120+
- Safari 17+
- Firefox 120+
- Edge 120+

### Progressive Web App
- Service Workers supported on all platforms
- Web Push supported (except iOS Safari)
- File System Access API available

## Quick Migration Commands

### From Old Stack to New (Aug 2025)
```bash
# Remove old auth packages
pnpm remove jsonwebtoken bcryptjs passport express-session

# Remove email packages  
pnpm remove @sendgrid/mail nodemailer

# Remove unneeded infrastructure
pnpm remove redis ioredis bull

# Add Supabase (one package replaces many!)
pnpm add @supabase/supabase-js

# Node 24 LTS install (Aug 2025)
curl -fsSL https://github.com/Schniz/fnm/raw/master/.ci/install.sh | bash
fnm use 24

# Expo SDK 52 upgrade
expo upgrade 52
```

## The Beautiful Simplicity

Old package.json: 45+ dependencies
New package.json: ~10 dependencies

Old deployment: Complex CI/CD pipeline
New deployment: `git push main`

Old auth system: 500+ lines of code
New auth system: 5 lines of code

**This is the way.**