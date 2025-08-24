# ⚙️ Courtesy Inspection - Configuration Guide (SINGLE SOURCE OF TRUTH)

> Last Updated: Aug 24, 2025
> Stack: Railway + PostgreSQL + Express + React Native (Expo)

## 🚨 IMPORTANT: This is the ONLY configuration document. All others are outdated.

## 🔧 Environment Variables

### Backend (.env)
```bash
# Server Configuration
NODE_ENV=production
PORT=8847

# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://postgres:PASSWORD@HOST.railway.app:PORT/railway
# Get from Railway dashboard: railway.app → Project → Variables

# JWT Authentication
JWT_SECRET=your-very-long-random-string-here
JWT_REFRESH_SECRET=another-very-long-random-string-here
JWT_EXPIRE_TIME=15m
JWT_REFRESH_EXPIRE_TIME=7d

# API URLs
API_URL=https://api.courtesyinspection.com/api
FRONTEND_URL=https://app.courtesyinspection.com

# File Storage (Railway Volumes)
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=5242880

# SMS (Telnyx - Phase 2)
# TELNYX_API_KEY=not-needed-for-mvp
# TELNYX_PHONE_NUMBER=not-needed-for-mvp
```

### Frontend (app/.env)
```bash
# API Configuration
EXPO_PUBLIC_API_URL=https://api.courtesyinspection.com/api

# Environment
EXPO_PUBLIC_ENV=production

# Storage Keys (used internally)
EXPO_PUBLIC_STORAGE_PREFIX=@courtesy
```

## 📁 File Structure

### Backend (`/server`)
```
server/
├── config.js           # ✅ Centralized configuration (SINGLE SOURCE)
├── server.js           # Express server
├── migrations/         # Database migrations
├── uploads/           # Railway volume mount point
├── tests/             # Jest tests
└── package.json       # Dependencies
```

### Frontend (`/app`)
```
app/
├── src/
│   ├── config/
│   │   └── environment.ts  # ✅ Frontend config (imports from constants)
│   ├── constants/
│   │   ├── index.ts       # Re-exports all constants
│   │   ├── api.ts         # API endpoints (NO /api prefix!)
│   │   └── theme.ts       # UI constants
│   ├── services/
│   │   └── ApiClient.ts   # HTTP client (adds /api to base URL)
│   └── hooks/
│       └── useAuth.ts     # 🚧 BROKEN - export issue
├── app.json              # Expo configuration
└── package.json         # Dependencies
```

## 🚀 Railway Deployment Configuration

### Backend Service
```yaml
Service Name: courtesy-backend
Build Command: npm ci
Start Command: npm start
Port: 8847
Health Check Path: /health
Environment Variables: Set in Railway dashboard
```

### Frontend Service
```yaml
Service Name: courtesy-frontend
Build Command: npm ci && npx expo export --platform web
Start Command: npx serve dist -l 3000
Port: 3000
Environment Variables: Set in Railway dashboard
```

### PostgreSQL Database
```yaml
Service: PostgreSQL (Railway addon)
Version: 17
Connection: Via DATABASE_URL environment variable
Migrations: Run automatically on deploy
```

### Volume Configuration (Photo Storage)
```yaml
Mount Path: /app/uploads
Size: 1GB (MVP)
Persistence: Yes
Service: courtesy-backend
```

## 🔑 Authentication Configuration

### JWT Settings
- **Access Token**: 15 minutes expiry
- **Refresh Token**: 7 days expiry
- **Algorithm**: HS256
- **Storage**: LocalStorage (web), AsyncStorage (mobile)

### Session Management
- Tokens stored in AsyncStorage with prefix `@courtesy`
- Automatic refresh on 401 responses
- Profile endpoint for session validation (currently broken)

## 🌐 API Configuration

### Base URLs
- **Production API**: https://api.courtesyinspection.com/api
- **Production App**: https://app.courtesyinspection.com
- **Local API**: http://localhost:8847/api
- **Local App**: http://localhost:8081

### CORS Settings
```javascript
// Production
origins: [
  'https://app.courtesyinspection.com',
  'https://courtesyinspection.com'
]

// Development
origins: [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000'
]
```

## 🐛 Known Configuration Issues

### Critical Issues
1. **useAuth Hook**: Export issue in production build
2. **Profile Endpoint**: Returns 500 error
3. **API URL**: Was duplicated (fixed in bb14305)

### Configuration Gotchas
1. **Don't add `/api` to endpoint definitions** - ApiClient adds it
2. **Railway volumes** need explicit mount path
3. **Environment variables** must start with `EXPO_PUBLIC_` for frontend

## 🔧 Local Development Setup

### Prerequisites
```bash
# Required versions
node --version  # v20.0.0 or higher
npm --version   # v10.0.0 or higher
railway --version  # Latest
```

### Backend Setup
```bash
cd server
cp .env.example .env
# Edit .env with your values
npm install
npm run dev
```

### Frontend Setup
```bash
cd app
cp .env.example .env
# Set EXPO_PUBLIC_API_URL=http://localhost:8847/api
npm install
npx expo start
```

### Database Setup
```bash
# Connect to Railway PostgreSQL
railway run psql

# Or use connection string
psql $DATABASE_URL

# Run migrations
cd server/migrations
psql $DATABASE_URL -f 001_initial_schema.sql
psql $DATABASE_URL -f 002_add_photos_table.sql
# etc...
```

## 📝 Configuration Checklist

### Before Development
- [ ] Railway CLI installed and logged in
- [ ] PostgreSQL database created
- [ ] Environment variables set in Railway
- [ ] Local .env files configured
- [ ] Database migrations run

### Before Deployment
- [ ] Production URLs verified
- [ ] JWT secrets are strong
- [ ] CORS origins updated
- [ ] Railway volumes configured
- [ ] Health checks passing

### After Deployment
- [ ] Frontend can reach API
- [ ] Authentication works
- [ ] Database queries work
- [ ] File uploads work (when implemented)
- [ ] Error tracking enabled

## 🚨 Emergency Configuration

If everything breaks, these are the minimal settings needed:

### Backend Minimal .env
```bash
PORT=8847
DATABASE_URL=<from-railway>
JWT_SECRET=any-long-string-for-testing
```

### Frontend Minimal .env
```bash
EXPO_PUBLIC_API_URL=https://api.courtesyinspection.com/api
```

---

*This document is the single source of truth for configuration.*
*All other configuration documents are outdated and should be ignored.*
*Last verified working: Aug 24, 2025*