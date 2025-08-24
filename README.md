# 🚗 Courtesy Inspection - Digital Vehicle Inspection Platform

> **Status**: In Development (Week 4 of 6) | **Progress**: ~5% Functional | **Target**: MVP in 2-3 weeks

## ⚠️ Current State Warning

**This project is NOT production-ready**. Critical features are broken:
- 40% of screens crash due to useAuth hook error
- Profile API returns 500 errors
- Navigation doesn't work
- Forms are non-functional

See [CURRENT_STATUS.md](CURRENT_STATUS.md) for detailed testing results.

## 🎯 Project Overview

Digital vehicle inspection platform for automotive shops to conduct courtesy inspections, capture photos/voice notes, and send SMS updates to customers.

### Tech Stack
- **Frontend**: React Native (Expo) - iOS/Android/Web
- **Backend**: Node.js (Express) + PostgreSQL
- **Infrastructure**: Railway (hosting + database)
- **SMS**: Telnyx (Phase 2)

### Live URLs
- **App**: https://app.courtesyinspection.com (partially working)
- **API**: https://api.courtesyinspection.com (backend operational)

## 🚀 Quick Start

### Prerequisites
```bash
node >= 20.0.0
npm >= 10.0.0
railway CLI (logged in)
```

### Local Development

1. **Clone and Install**
```bash
git clone https://github.com/yourusername/courtesy-inspection.git
cd courtesy-inspection
```

2. **Backend Setup**
```bash
cd server
cp .env.example .env
# Edit .env with your DATABASE_URL from Railway
npm install
npm run dev  # Runs on http://localhost:8847
```

3. **Frontend Setup**
```bash
cd app
npm install
npx expo start  # Opens Expo developer tools
```

4. **Database Setup**
```bash
railway run psql  # Connect to Railway PostgreSQL
# Migrations already run in production
```

### Test Credentials
```
Email: admin@shop.com
Password: password123
Role: Shop Manager
```

## 📊 Feature Status

### What Works ✅
- Basic authentication (login only)
- Dashboard displays (with mock data)
- Database schema created

### What's Broken 🚧
- Inspections screen (crashes)
- VIN Scanner (crashes)
- Profile API (500 error)
- Navigation (doesn't work)
- All forms (non-functional)

### Not Started ❌
- Photo capture
- Voice recording
- SMS sending
- Customer portal
- 90% of features

See [FEATURES.md](FEATURES.md) for complete feature matrix.

## 📁 Project Structure

```
courtesy-inspection/
├── app/                    # Expo React Native app
│   ├── src/
│   │   ├── screens/       # App screens (many broken)
│   │   ├── services/      # API client
│   │   ├── hooks/         # React hooks (useAuth broken)
│   │   └── constants/     # App constants
│   └── package.json
│
├── server/                 # Express backend
│   ├── config.js          # Centralized config
│   ├── server.js          # Main server file
│   ├── migrations/        # Database migrations
│   ├── tests/             # Jest tests
│   └── package.json
│
├── docs/                   # Documentation
│   └── mvp/               # MVP specifications
│
├── CONFIGURATION.md       # ⭐ Single source of truth for config
├── CURRENT_STATUS.md      # ⭐ Actual working state
├── FEATURES.md           # ⭐ Realistic feature tracking
├── ROADMAP_UPDATED.md    # ⭐ Recovery plan
└── README.md             # This file
```

## 🔧 Configuration

See [CONFIGURATION.md](CONFIGURATION.md) for complete setup guide.

**Key Points**:
- Backend uses Railway PostgreSQL (not Supabase)
- Frontend uses Expo for cross-platform
- Authentication uses JWT tokens
- File storage uses Railway volumes

## 🐛 Known Critical Issues

1. **useAuth Hook Error** (CRITICAL)
   - Blocks 40% of app functionality
   - TypeError in production build
   - Affects Inspections and VIN Scanner screens

2. **Profile API 500 Error** (HIGH)
   - Breaks session management
   - `/api/auth/profile` endpoint failing

3. **Navigation Broken** (MEDIUM)
   - Click handlers don't navigate
   - Can't access detail screens

See [CURRENT_STATUS.md](CURRENT_STATUS.md) for full issue list.

## 📈 Development Roadmap

### Immediate Priority (This Week)
1. Fix useAuth hook export issue
2. Fix profile API endpoint
3. Implement navigation handlers
4. Complete inspection creation flow

### Next Week
1. Add photo capture
2. Implement voice recording
3. Connect forms to backend
4. Basic SMS wireframe

### Week 6
1. Customer portal
2. Testing & bug fixes
3. Production deployment

See [ROADMAP_UPDATED.md](ROADMAP_UPDATED.md) for detailed timeline.

## 🧪 Testing

```bash
# Backend tests
cd server
npm test  # 2 auth tests pass

# Frontend tests
cd app
npm test  # No tests yet

# E2E Testing
# Use Playwright to test the live app
```

## 🚀 Deployment

Currently deployed on Railway:

```bash
# Backend deployment
cd server
git push railway main  # Auto-deploys

# Frontend deployment
cd app
git push railway-frontend main  # Auto-deploys
```

## 📝 Documentation

### Essential Documents
- [CONFIGURATION.md](CONFIGURATION.md) - Setup and config guide
- [CURRENT_STATUS.md](CURRENT_STATUS.md) - What actually works
- [FEATURES.md](FEATURES.md) - Feature tracking (realistic)
- [ROADMAP_UPDATED.md](ROADMAP_UPDATED.md) - Development plan

### API Documentation
- Backend API: See server routes in `/server/server.js`
- No OpenAPI spec yet (planned)

## 🤝 Contributing

This project is in early development. Not ready for external contributions.

## 📄 License

Private project - not for distribution.

## 🆘 Support

For development issues:
- Check [CURRENT_STATUS.md](CURRENT_STATUS.md) for known issues
- Railway Discord for hosting issues
- Expo Discord for React Native issues

## 👥 Credits

Based on an original concept by the Courtesy Inspection Team  
Digital platform & Voice-Controlled Co-Pilot System™ by Mr.E  
Built with ❤️ to rescue friends from bad dev experiences  
August 2025

## ⚠️ Disclaimer

**This is an MVP in development with critical issues.**
- Only ~5% of features actually work
- Major functionality is broken
- Not suitable for production use
- Requires 2-3 weeks of development to reach MVP

---

*Last Updated: August 24, 2025*
*Based on comprehensive Playwright testing*
*Previous documentation was heavily outdated*