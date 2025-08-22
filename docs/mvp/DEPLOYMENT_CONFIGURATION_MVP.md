# DEPLOYMENT - MVP VERSION (iPad-First, Single Codebase)

## Overview

**Dead Simple Deployment** for Courtesy Inspection MVP using Railway + Supabase + Expo. Target: **Deploy in 15 minutes** - no Docker, no Kubernetes, no complexity.

## Table of Contents

1. [Quick Deploy Strategy](#1-quick-deploy-strategy)
2. [Railway Setup (API + Reports + Links)](#2-railway-setup-api--reports--links)
3. [Supabase Setup (Database + Auth + Storage)](#3-supabase-setup-database--auth--storage)
4. [Expo App Deployment](#4-expo-app-deployment)
5. [Domain & SMS Setup](#5-domain--sms-setup)
6. [Go-Live Checklist](#6-go-live-checklist)

---

## 1. Quick Deploy Strategy

### Unified Railway Deployment (Everything on ONE instance!)
```
┌─────────────────────────────────────┐
│          Customer's Phone           │
│     (Clicks domain.com/l/xyz)       │
│      66% SMS Cost Savings!          │
└─────────────────┬───────────────────┘
                  │
          ┌───────▼───────┐
          │    Railway    │ ◄── ONE instance serves everything
          │ ┌───────────┐ │
          │ │Landing /  │ │ ◄── Marketing page
          │ │App /app   │ │ ◄── Expo Web build
          │ │API /api/* │ │ ◄── REST endpoints
          │ │Links /l/* │ │ ◄── Short links
          │ │Reports    │ │ ◄── HTML reports
          │ └───────────┘ │
          └───────┬───────┘
                  │
          ┌───────▼───────┐
          │   Supabase    │
          │ ┌───────────┐ │
          │ │Database   │ │
          │ │Auth       │ │
          │ │Storage    │ │
          │ └───────────┘ │
          └───────┬───────┘
                  │
┌─────────────────▼───────────────────┐
│      Single Expo App                │
│  iPhone (Mechanics) + iPad (Shop    │
│   Mgrs) + Web at domain.com/app     │
│         ONE CODEBASE!               │
└─────────────────────────────────────┘
```

### Deployment Costs (Monthly) - NOT $200+!
- **Railway**: $0-5 (free tier covers MVP, scales automatically)
- **Supabase**: $0 (free tier: 500MB DB, 1GB storage, auth included)
- **Domain (ci.link)**: $10/year = $0.83/month  
- **Telnyx SMS**: $20-50 (with our link strategy saves 66%!)
- **Total**: **$25-55/month** (vs $200+ for complex architectures)

---

## 2. Railway Setup (API + Reports + Links)

### 2.1 One-Click Railway Deployment

```bash
# Connect GitHub repo to Railway
1. Go to railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Select your courtesy-inspection repo
5. Railway auto-detects Node.js and deploys
```

### 2.2 Unified Railway Project Structure
```
courtesy-inspection/
├── server.js             # Main Express server (unified routing)
├── package.json          # Railway reads this
├── public/               # Static assets
│   ├── landing.html      # Landing page (optional)
│   ├── favicon.ico       # Site favicon
│   └── assets/           # Images, CSS, etc.
├── web-build/            # Expo Web build output
│   ├── index.html        # Expo Web entry point
│   ├── static/           # JS, CSS bundles
│   └── manifest.json     # PWA manifest
└── templates/            # Email/report templates
    └── report-email.html # Optional email templates
```

### 2.3 Unified server.js (Everything in ONE file)
```javascript
const express = require('express')
const cors = require('cors')
const path = require('path')
const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// 1. API Routes (highest priority)
app.post('/api/sms/send', sendSMS)
app.get('/api/reports/:id', getReport)
app.post('/api/reports/generate', generateReport)
app.get('/health', healthCheck)

// 2. Short links (/l/ for "link")
app.get('/l/:code', redirectShortLink)

// 3. Expo Web App at /app
app.use('/app', express.static(path.join(__dirname, 'web-build')))
app.get('/app/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web-build', 'index.html'))
})

// 4. Landing page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'))
})

// 5. Static assets
app.use(express.static('public'))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Unified server running on port ${PORT}`)
  console.log(`📱 App: ${process.env.PUBLIC_URL}/app`)
  console.log(`🔗 API: ${process.env.PUBLIC_URL}/api`)
})
```

### 2.4 Unified Deployment Environment Variables
```bash
# Set in Railway dashboard
NODE_ENV=production

# Unified domain configuration
PUBLIC_URL=https://courtesyinspection.com
APP_URL=https://courtesyinspection.com/app
API_URL=https://courtesyinspection.com/api
LINKS_URL=https://courtesyinspection.com/l

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# SMS Provider (Telnyx or Twilio)
TELNYX_API_KEY=your-telnyx-key
TELNYX_PHONE_NUMBER=+1234567890
# OR
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
```

### 2.5 Railway Deployment
```bash
# Automatic deployment on git push
git add .
git commit -m "Deploy to Railway"  
git push origin main

# Railway automatically:
# 1. Detects Node.js
# 2. Runs npm install
# 3. Starts with npm start
# 4. Provides https://your-app.railway.app URL
```

---

## 3. Supabase Setup (Database + Auth + Storage)

### 3.1 Create Supabase Project
```bash
1. Go to supabase.com
2. Create new project (free tier)
3. Choose region (closest to your users)
4. Wait for project to initialize (~2 minutes)
5. Copy Project URL and anon key
```

### 3.2 Database Schema (Run in Supabase SQL Editor)
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core tables
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT auth.uid(), -- Links to Supabase Auth
    shop_id UUID REFERENCES shops(id),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'mechanic', -- 'mechanic' or 'shop_manager'
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id),
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    make TEXT,
    model TEXT,
    year INTEGER,
    vin TEXT,
    license_plate TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id),
    vehicle_id UUID REFERENCES vehicles(id),
    mechanic_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'awaiting_service',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE inspection_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID REFERENCES inspections(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'good', 'attention', 'urgent'
    notes TEXT,
    photos TEXT[] DEFAULT '{}' -- Array of photo URLs
);

CREATE TABLE short_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL, -- e.g., "x7k9"
    url TEXT NOT NULL,
    inspection_id UUID REFERENCES inspections(id),
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies (users can only see data from their shop)
CREATE POLICY "Users can see their shop's data" ON inspections
    FOR ALL USING (
        shop_id IN (
            SELECT shop_id FROM users WHERE id = auth.uid()
        )
    );
-- (Add similar policies for other tables)

-- Indexes for performance
CREATE INDEX idx_inspections_shop_id ON inspections(shop_id);
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_short_links_code ON short_links(code);
```

### 3.3 Supabase Auth Setup
```javascript
// In your Expo app - lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://your-project.supabase.co'
const supabaseAnonKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Simple auth functions
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}
```

### 3.4 Supabase Storage Setup
```sql
-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', true);

-- Allow authenticated users to upload/view photos
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow public viewing" ON storage.objects
  FOR SELECT USING (bucket_id = 'inspection-photos');
```

---

## 4. Expo App Deployment

### 4.1 Build Configuration (app.json)
```json
{
  "expo": {
    "name": "Courtesy Inspection",
    "slug": "courtesy-inspection",
    "version": "1.0.0",
    "platforms": ["ios", "android", "web"],
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "updates": {
      "fallbackToCacheTimeout": 0
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.courtesyinspection.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.courtesyinspection.app"
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    }
  }
}
```

### 4.2 EAS Build Setup
```bash
# Install EAS CLI
npm install -g @expo/cli

# Configure builds
eas build:configure

# Build for all platforms
eas build --platform all

# Submit to app stores
eas submit --platform ios    # Requires Apple Developer account
eas submit --platform android
```

### 4.3 Web Deployment (Unified with Railway)
```bash
# Build web version
npx expo export --platform web

# The web-build/ folder is now served at /app by Railway
# No separate hosting needed - everything unified!

# Deploy process:
1. expo export --platform web  # Creates web-build/
2. git add web-build/           # Include in repository
3. git commit -m "Deploy web app"
4. git push origin main         # Railway auto-deploys
5. Visit domain.com/app         # Expo Web app is live!
```

---

## 5. Domain & SMS Setup

### 5.1 Custom Domain (Unified Setup)
```bash
1. Buy domain (courtesyinspection.com) - $10-15/year
2. In Railway dashboard:
   - Go to your project settings
   - Add custom domain: courtesyinspection.com
   - Point DNS: courtesyinspection.com CNAME your-app.railway.app
3. Railway handles SSL automatically
4. All routes work on same domain:
   ✅ courtesyinspection.com/     # Landing
   ✅ courtesyinspection.com/app  # Expo Web
   ✅ courtesyinspection.com/api  # REST API
   ✅ courtesyinspection.com/l/xyz # Short links
```

### 5.2 SMS Setup (Unified Domain)
```bash
1. Create Telnyx account
2. Purchase phone number ($1-2/month)
3. Set webhook URL: https://courtesyinspection.com/api/sms/webhook
4. Add API key to Railway environment variables
5. SMS links use same domain: courtesyinspection.com/l/xyz
```

### 5.3 SMS Integration (in Railway server)
```javascript
// routes/sms.js
const telnyx = require('telnyx')(process.env.TELNYX_API_KEY)

// Send SMS with short link
app.post('/api/sms/send', async (req, res) => {
  const { to, message, inspectionId } = req.body
  
  try {
    await telnyx.messages.create({
      from: process.env.TELNYX_PHONE_NUMBER,
      to: to,
      text: message
    })
    
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Receive SMS webhook
app.post('/api/sms/webhook', async (req, res) => {
  const { data } = req.body
  
  if (data.event_type === 'message.received') {
    // Handle customer response
    const customerMessage = data.payload.text
    const customerPhone = data.payload.from.phone_number
    
    // Process customer response (YES, questions, etc.)
    await handleCustomerResponse(customerPhone, customerMessage)
  }
  
  res.sendStatus(200)
})
```

---

## 6. Go-Live Checklist

### 6.1 Pre-Deployment Testing
```bash
# Test locally first
cd server && npm start                    # Railway API
expo start                               # Expo app
supabase start                          # Local Supabase

# Test SMS integration
# Use ngrok for webhook testing: ngrok http 3000
```

### 6.2 Deployment Steps (15 minutes)
```bash
# 1. Deploy Railway API (2 minutes)
git push origin main  # Auto-deploys

# 2. Configure Supabase (5 minutes)  
# Run SQL schema in Supabase dashboard
# Set environment variables

# 3. Build Expo apps (5 minutes)
eas build --platform all

# 4. Setup domain & SMS (3 minutes)
# Point ci.link to Railway
# Configure Telnyx webhook
```

### 6.3 Unified Deployment Verification
- [ ] Landing page: https://courtesyinspection.com/
- [ ] Web app: https://courtesyinspection.com/app
- [ ] API health: https://courtesyinspection.com/api/health
- [ ] Short links: https://courtesyinspection.com/l/test
- [ ] Supabase connection working
- [ ] Expo mobile apps build and install
- [ ] SMS sending with unified domain links
- [ ] HTML reports display properly on mobile

### 6.4 First Shop Onboarding
```bash
# Create demo data in Supabase
INSERT INTO shops (name, email, phone) VALUES ('Demo Auto Shop', 'demo@shop.com', '+1234567890');
INSERT INTO users (email, role, shop_id) VALUES ('manager@shop.com', 'shop_manager', [shop-id]);

# Test complete workflow:
1. Manager logs into Expo app
2. Creates inspection
3. Mechanic completes inspection
4. Manager reviews and sends SMS
5. Customer receives ci.link/xyz
6. Customer views beautiful HTML report
```

---

## Monitoring & Maintenance

### Railway Monitoring (Built-in)
- **Metrics**: CPU, memory, response times
- **Logs**: Real-time application logs  
- **Alerts**: Email notifications for downtime
- **Scaling**: Automatic scaling based on usage

### Supabase Monitoring (Built-in)
- **Database**: Query performance, storage usage
- **Auth**: Login success rates, user activity
- **Storage**: File upload success, bandwidth usage
- **API**: Request rates, error rates

### Custom Health Checks
```javascript
// In Railway server - comprehensive health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {}
  }
  
  try {
    // Test Supabase connection
    const { data } = await supabase.from('shops').select('count').single()
    health.services.supabase = 'connected'
  } catch (error) {
    health.services.supabase = 'error'
    health.status = 'degraded'
  }
  
  try {
    // Test Telnyx (simple check)
    health.services.telnyx = process.env.TELNYX_API_KEY ? 'configured' : 'not configured'
  } catch (error) {
    health.services.telnyx = 'error'
  }
  
  res.json(health)
})
```

---

## The Bottom Line

**Deployment Time**: 15 minutes (once set up)
**Monthly Cost**: $25-55 total  
**Complexity**: Minimal
**Maintenance**: Railway + Supabase handle 95% of ops

### What We Deployed (Unified Strategy)
```
✅ ONE Railway instance serving everything:
   - Landing page at /
   - Expo Web app at /app  
   - REST API at /api/*
   - Short links at /l/*
   - HTML reports embedded
✅ One Supabase backend (DB + auth + storage)  
✅ One Expo codebase (iPhone + iPad + web)
✅ One domain (courtesyinspection.com)
✅ One SMS number (Telnyx/Twilio)

Total: 5 things to manage, ONE deployment
```

### What We Avoided
```
❌ Docker containers
❌ Kubernetes clusters  
❌ Load balancers
❌ CDN setup
❌ Complex CI/CD
❌ Database management
❌ SSL certificate management
❌ Server maintenance
❌ Scaling configuration
❌ Monitoring setup

Railway and Supabase handle all of this!
```

**This is deployment done right. Simple. Reliable. Scales automatically.** 🚀