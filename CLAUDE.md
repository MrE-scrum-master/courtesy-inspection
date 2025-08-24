# Courtesy Inspection - SuperClaude Project Configuration

## 🎯 Project Context
**Project**: Courtesy Inspection MVP - Digital Vehicle Inspection Platform  
**Status**: Build-Ready (95% documentation complete)  
**Timeline**: 6 weeks starting NOW  
**Budget**: $25-55/month  
**Stack**: Expo + Railway PostgreSQL + Telnyx SMS  

## 🚀 SuperClaude Activation

### Primary Mode
```bash
# Use these for maximum effectiveness:
/sc:build --wave-mode --delegate --concurrency 7
/sc:implement --seq --c7 --magic --validate
/sc:analyze --ultrathink --focus implementation
```

### Active Personas
- **Primary**: `--persona-architect` for system decisions
- **Frontend**: `--persona-frontend` for Expo/React Native
- **Backend**: `--persona-backend` for Railway/PostgreSQL
- **Quality**: `--persona-qa` for testing strategies

### MCP Servers
- **Sequential**: Complex logic and problem-solving
- **Context7**: React Native and Expo documentation
- **Magic**: UI component generation
- **Playwright**: E2E testing (Week 5-6)

## 📂 Project Structure
```
courtesy-inspection/
├── app/                  # Expo app (phone/iPad/web)
├── server/              # Railway API with PostgreSQL
├── templates/           # Ready-to-use code templates
├── docs/mvp/           # Complete documentation
├── PORTS.md            # 🔥 CANONICAL PORTS (9545-9549)
└── CLAUDE.md           # This file
```

## 🔌 Port Configuration
**See [PORTS.md](./PORTS.md) for canonical ports**
- API Server: `9547`
- Expo Dev: `9545`
- Expo Web: `9546`

## 🗄️ Database Configuration
- **Provider**: Railway PostgreSQL 17.6
- **URL**: See server/.env
- **Schema**: Already initialized with 9 tables
- **Test Data**: 3 users, 3 customers ready
- **Migration Path**: To Supabase when needed (documented)

## ⚡ Quick Commands

### Start Development
```bash
./start-dev.sh  # Starts everything!
```

### Database Management
```bash
railway run psql  # Connect to PostgreSQL
railway logs -f   # View logs
railway up        # Deploy to production
```

### Testing Credentials
- admin@shop.com / password123 (Shop Manager)
- mike@shop.com / password123 (Mechanic)
- sarah@shop.com / password123 (Shop Manager)

## 📋 Current Implementation Status

### ✅ Completed
- [x] Railway PostgreSQL setup and schema
- [x] Authentication templates (JWT)
- [x] File upload templates (Railway volumes)
- [x] Database abstraction layer
- [x] Environment configuration
- [x] Test data seeded
- [x] Development scripts

### 🔄 Ready to Build (Week 1)
- [ ] Basic Express server
- [ ] Authentication endpoints
- [ ] Inspection CRUD
- [ ] Expo app initialization
- [ ] Basic navigation

### 📅 Week-by-Week Focus
- **Week 1**: Foundation (Auth, Database, Basic API)
- **Week 2**: Core Features (Inspections, Voice, Photos)
- **Week 3**: iPad Interface & SMS
- **Week 4**: Customer Communication
- **Week 5**: Polish & Testing
- **Week 6**: Deployment

## 🎯 Key Principles for This Build

### Architecture (LOCKED)
```
Expo App (iOS/Android/Web)
    ↓
Railway API (Express + PostgreSQL)
    ↓
Telnyx SMS (Links only, not content)
```

### Non-Negotiables
- **6-week timeline** - No scope creep
- **$25-55/month** - No expensive services
- **One codebase** - Expo for everything
- **Railway PostgreSQL** - Already paid for
- **SMS links** - 66% cost savings

### What We're NOT Building
- ❌ Separate web dashboard
- ❌ Complex microservices
- ❌ Docker/Kubernetes
- ❌ Email services
- ❌ Payment processing (MVP)
- ❌ VIN decoder (manual entry)

## 🚨 Common Pitfalls to Avoid

1. **Over-engineering**: Keep it simple, ship it
2. **Perfect voice recognition**: 80% accuracy is fine for MVP
3. **Complex UI**: iPad split-view is enough
4. **Real-time sync**: Polling every 5 seconds works
5. **Offline mode**: Require internet for MVP

## 📊 Success Metrics

### Technical
- [ ] 30-minute inspection completion
- [ ] <2 second API response
- [ ] <5 second SMS delivery
- [ ] 95% uptime

### Business
- [ ] 1 shop using daily by Week 6
- [ ] 10 inspections completed
- [ ] Positive feedback from mechanics

## 🔧 Development Preferences

### Code Style
- **Comments**: Minimal, code should be self-documenting
- **Functions**: Small, single responsibility
- **Files**: <200 lines each
- **Testing**: Critical paths only for MVP

### Git Workflow
```bash
# Feature branches
git checkout -b feature/auth-system

# Commit frequently
git add .
git commit -m "Add JWT authentication"

# Push to Railway staging
git push railway-staging feature/auth-system

# When ready, merge to main
git checkout main
git merge feature/auth-system
git push railway main  # Auto-deploys
```

## 🆘 When Stuck

### Quick Fixes
1. **Database issues**: `railway run psql` to debug
2. **Auth problems**: Check JWT_SECRET in .env
3. **SMS not sending**: Verify Telnyx credentials
4. **Expo issues**: Clear cache with `expo start -c`

### Get Help
- **Railway Discord**: https://discord.gg/railway
- **Expo Discord**: https://discord.gg/expo
- **Stack Overflow**: Tag with [react-native] [expo]

## 🎬 Ready to Build Checklist

### Environment
- [x] Node.js 24.0.0 installed
- [x] Railway CLI installed and logged in
- [x] PostgreSQL database initialized
- [x] Test data seeded
- [x] .env configured

### Documentation
- [x] IMPLEMENTATION_CHECKLIST.md ready
- [x] BUILD_DAILY_PLAN.md ready
- [x] All templates created
- [x] Migration path documented

### Confidence Check
- [x] Architecture is clear and locked
- [x] Timeline is realistic (6 weeks)
- [x] Costs are confirmed ($25-55/month)
- [x] Tech stack is familiar enough
- [x] Support resources identified

## 📝 Attribution Guidelines
- Don't add "Generated with Claude Code" to commits
- Violations counter: 1 (as of commit 67a98f5)

## 💪 You've Got This!

Everything is ready. The database is live. The templates work. The plan is clear.

**Next Step**: 
```bash
cd server
npm init -y
npm install express pg dotenv
# Create server.js
# Make /api/health work
# Build from there!
```

---

**Remember**: Done is better than perfect. Ship weekly. Get feedback. Iterate.

**SuperClaude Mode**: ACTIVATED 🚀