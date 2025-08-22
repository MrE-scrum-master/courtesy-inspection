# Implementation Checklist - Courtesy Inspection MVP

**Status**: FINAL - LOCKED  
**Timeline**: 6 Weeks  
**Budget**: $25-55/month  
**Architecture**: Expo App → Railway API → Supabase  

---

## Pre-Flight Checklist (Before Day 1)

### Required Accounts
- [ ] GitHub account with repository created
- [ ] Supabase account (free tier)
- [ ] Railway account (free credits)
- [ ] Telnyx account for SMS ($10 initial credit)
- [ ] Expo account (free)
- [ ] Apple Developer account ($99/year - if deploying to App Store)
- [ ] Google Play Developer account ($25 one-time - if deploying to Play Store)

### Development Environment
- [ ] Node.js 24.0.0 installed (use fnm or nvm)
- [ ] pnpm 9.x installed globally
- [ ] Expo CLI installed (`pnpm add -g expo@52`)
- [ ] VS Code or preferred editor ready
- [ ] Git configured with SSH keys

### Domain & Services
- [ ] Register ci.link domain ($10/year) or similar short domain
- [ ] Telnyx phone number provisioned ($1-2/month)

---

## Week 1: Foundation (Days 1-7)

### Day 1: Project Setup (2-3 hours)
**Morning (1.5 hours)**
- [ ] Create Supabase project (10 min)
  - Project name: courtesy-inspection-prod
  - Region: Select closest to your users
  - Copy all credentials to .env file
- [ ] Create Railway project (5 min)
  - Project name: courtesy-inspection-api
  - Connect GitHub repository
  - Set up automatic deployments from main branch
- [ ] Initialize Expo app (15 min)
  ```bash
  npx create-expo-app courtesy-inspection --template
  cd courtesy-inspection
  pnpm install
  ```
- [ ] Test all connections (30 min)
  - Verify Supabase connection
  - Test Railway deployment
  - Run Expo app locally

**Afternoon (1.5 hours)**
- [ ] Set up project structure
  ```
  courtesy-inspection/
  ├── app/                 # Expo app
  ├── server/             # Railway API
  ├── supabase/           # Database files
  └── docs/               # Existing documentation
  ```
- [ ] Configure environment variables
- [ ] First git commit and push
- [ ] Verify Railway auto-deployment works

### Day 2: Database Schema (3-4 hours)
**Morning (2 hours)**
- [ ] Run schema.sql in Supabase SQL editor
- [ ] Create RLS policies for multi-tenancy
- [ ] Set up auth triggers
- [ ] Test database connections from local

**Afternoon (2 hours)**
- [ ] Create test data
  - 1 shop record
  - 3 user accounts (admin, manager, mechanic)
  - 5 test customers
  - 10 test vehicles
- [ ] Verify RLS policies work correctly
- [ ] Document database access patterns

### Day 3: Authentication System (4 hours)
**Morning (2 hours)**
- [ ] Implement Supabase Auth in Expo app
- [ ] Create login screen
- [ ] Create role-based navigation
- [ ] Test authentication flow

**Afternoon (2 hours)**
- [ ] Set up JWT refresh logic
- [ ] Implement logout functionality
- [ ] Add auth persistence
- [ ] Test on iOS simulator and Android emulator

### Day 4: Core Navigation (3 hours)
- [ ] Implement React Navigation structure
- [ ] Create bottom tab navigation for mechanics
- [ ] Create split-view layout for iPad
- [ ] Add responsive detection (phone vs tablet)
- [ ] Test navigation flows

### Day 5: Basic API Setup (3 hours)
- [ ] Create Express server in /server
- [ ] Set up basic endpoints
  - GET /health
  - POST /api/auth/verify
  - GET /api/inspections
- [ ] Deploy to Railway
- [ ] Test API from Expo app

### Day 6: Inspection List Screen (4 hours)
**Morning (2 hours)**
- [ ] Create inspection list component
- [ ] Implement pull-to-refresh
- [ ] Add status badges (colors)
- [ ] Connect to Supabase

**Afternoon (2 hours)**
- [ ] Add search/filter functionality
- [ ] Implement sorting
- [ ] Add loading states
- [ ] Test with various data sizes

### Day 7: Week 1 Review & Testing
- [ ] Complete end-to-end test of Week 1 features
- [ ] Fix any critical bugs
- [ ] Update documentation
- [ ] Prepare for Week 2

**Week 1 Success Criteria:**
✅ Auth works  
✅ Database connected  
✅ Basic API running  
✅ Can view inspection list  

---

## Week 2: Core Functionality (Days 8-14)

### Day 8: Create Inspection Flow (4 hours)
- [ ] Build "New Inspection" screen
- [ ] VIN input field (manual entry)
- [ ] Customer selection/creation
- [ ] Save to database
- [ ] Navigation to inspection detail

### Day 9: Inspection Detail Screen (5 hours)
- [ ] Create 7-stage inspection layout
- [ ] Implement stage navigation
- [ ] Add item status selection (green/yellow/red)
- [ ] Save progress to database
- [ ] Handle state management

### Day 10: Voice Input Integration (4 hours)
- [ ] Install expo-speech-recognition
- [ ] Implement voice button UI
- [ ] Create command parser (~50 lines)
- [ ] Add automotive vocabulary hints
- [ ] Test voice commands

### Day 11: Photo Capture (4 hours)
- [ ] Implement expo-camera
- [ ] Create photo capture UI
- [ ] Upload to Supabase Storage
- [ ] Link photos to inspection items
- [ ] Display photo thumbnails

### Day 12: Status Management (3 hours)
- [ ] Implement color-coded status system
- [ ] Create status change animations
- [ ] Add quick status buttons
- [ ] Persist status changes

### Day 13: Notes & Measurements (3 hours)
- [ ] Add text input for notes
- [ ] Create measurement input UI
- [ ] Voice-to-text for notes
- [ ] Save all data to database

### Day 14: Week 2 Testing
- [ ] Test complete inspection flow
- [ ] Verify voice input works
- [ ] Confirm photos upload
- [ ] Fix critical issues

**Week 2 Success Criteria:**
✅ Can create inspection  
✅ Voice input works  
✅ Photos upload successfully  
✅ Status tracking functional  

---

## Week 3: Shop Manager Features (Days 15-21)

### Day 15: iPad Layout Optimization (4 hours)
- [ ] Detect iPad vs phone
- [ ] Implement split-view layout
- [ ] Create conversation list sidebar
- [ ] Optimize touch targets for iPad

### Day 16: Review & Approval Screen (4 hours)
- [ ] Create inspection review interface
- [ ] Add approval workflow
- [ ] Implement state transitions
- [ ] Add validation rules

### Day 17: SMS Integration - Telnyx (5 hours)
- [ ] Set up Telnyx webhooks
- [ ] Implement send SMS endpoint
- [ ] Create message templates
- [ ] Test SMS delivery
- [ ] Handle delivery receipts

### Day 18: Short Link Service (4 hours)
- [ ] Create link shortener in Railway
- [ ] Implement ci.link/[code] redirects
- [ ] Generate unique codes
- [ ] Track link clicks
- [ ] Test redirection

### Day 19: HTML Report Generation (5 hours)
- [ ] Create HTML report template
- [ ] Add responsive CSS
- [ ] Include photos in reports
- [ ] Generate from inspection data
- [ ] Serve from Railway

### Day 20: Two-Way SMS (4 hours)
- [ ] Handle incoming SMS webhooks
- [ ] Parse customer responses
- [ ] Update conversation threads
- [ ] Implement 5-second polling
- [ ] Test two-way flow

### Day 21: Week 3 Testing
- [ ] Test SMS with real phone numbers
- [ ] Verify link shortener works
- [ ] Check HTML reports on mobile
- [ ] Test approval workflow

**Week 3 Success Criteria:**
✅ iPad interface optimized  
✅ SMS sending works  
✅ Short links functional  
✅ HTML reports display correctly  

---

## Week 4: Communication Features (Days 22-28)

### Day 22: Quick Action Buttons (3 hours)
- [ ] Implement 5 hardcoded quick actions
  1. Send Inspection Report
  2. Request Approval
  3. Inspection Ready
  4. Thank You
  5. Schedule Service
- [ ] Test each action

### Day 23: Conversation Management (4 hours)
- [ ] Create conversation list view
- [ ] Implement message threading
- [ ] Add unread indicators
- [ ] Search conversations
- [ ] Mark as read/unread

### Day 24: Customer Portal Links (4 hours)
- [ ] Create customer-facing pages
- [ ] Implement estimate view
- [ ] Add approval buttons
- [ ] Mobile-optimized design
- [ ] Test on various devices

### Day 25: Notification System (3 hours)
- [ ] Set up Expo push notifications
- [ ] Configure notification triggers
- [ ] Handle notification taps
- [ ] Test on real devices

### Day 26: SMS Templates (3 hours)
- [ ] Create professional message templates
- [ ] Ensure all under 160 characters
- [ ] Add variable substitution
- [ ] Test character counting

### Day 27: Workflow Automation (4 hours)
- [ ] Implement auto-send after delay
- [ ] Create workflow triggers
- [ ] Add business rules
- [ ] Test state transitions

### Day 28: Week 4 Testing
- [ ] End-to-end communication test
- [ ] Verify all SMS features
- [ ] Test customer experience
- [ ] Fix issues

**Week 4 Success Criteria:**
✅ Quick actions work  
✅ Two-way SMS functional  
✅ Customer can view/approve  
✅ Notifications working  

---

## Week 5: Polish & Performance (Days 29-35)

### Day 29: Performance Optimization (4 hours)
- [ ] Implement lazy loading
- [ ] Optimize image uploads
- [ ] Add caching strategies
- [ ] Reduce bundle size
- [ ] Test load times

### Day 30: Error Handling (4 hours)
- [ ] Add try-catch blocks
- [ ] Implement error boundaries
- [ ] Create user-friendly error messages
- [ ] Add retry logic
- [ ] Test failure scenarios

### Day 31: Offline Support (3 hours)
- [ ] Cache critical data
- [ ] Queue actions when offline
- [ ] Sync when connection restored
- [ ] Show offline indicators

### Day 32: UI Polish (4 hours)
- [ ] Refine animations
- [ ] Improve loading states
- [ ] Polish transitions
- [ ] Fix UI inconsistencies
- [ ] Enhance accessibility

### Day 33: Data Validation (3 hours)
- [ ] Add input validation
- [ ] Implement business rules
- [ ] Validate before submission
- [ ] Show validation errors

### Day 34: Security Hardening (3 hours)
- [ ] Review RLS policies
- [ ] Audit API endpoints
- [ ] Check authentication flows
- [ ] Validate permissions

### Day 35: Week 5 Testing
- [ ] Performance testing
- [ ] Security testing
- [ ] UI/UX review
- [ ] Bug fixes

**Week 5 Success Criteria:**
✅ App performs well  
✅ Errors handled gracefully  
✅ UI polished  
✅ Security validated  

---

## Week 6: Deployment & Launch (Days 36-42)

### Day 36: Production Environment (4 hours)
- [ ] Set up production Supabase
- [ ] Configure production Railway
- [ ] Update environment variables
- [ ] Test production deployments

### Day 37: App Store Preparation (5 hours)
- [ ] Create app store assets
- [ ] Write app descriptions
- [ ] Prepare screenshots
- [ ] Set up app store listings

### Day 38: Beta Testing Setup (3 hours)
- [ ] Deploy to TestFlight (iOS)
- [ ] Deploy to Play Console (Android)
- [ ] Invite beta testers
- [ ] Create feedback form

### Day 39: Documentation (3 hours)
- [ ] Create user guide
- [ ] Write deployment guide
- [ ] Document API
- [ ] Create FAQ

### Day 40: Load Testing (3 hours)
- [ ] Test with multiple concurrent users
- [ ] Verify SMS delivery at scale
- [ ] Check database performance
- [ ] Monitor Railway metrics

### Day 41: Final Fixes (4 hours)
- [ ] Address beta feedback
- [ ] Fix critical bugs
- [ ] Final UI tweaks
- [ ] Performance improvements

### Day 42: Launch! 🚀
- [ ] Submit to app stores
- [ ] Deploy production API
- [ ] Monitor systems
- [ ] Celebrate! 🎉

**Week 6 Success Criteria:**
✅ Apps submitted to stores  
✅ Production environment stable  
✅ Beta testers happy  
✅ Ready for first customer  

---

## Post-Launch Checklist

### Immediate (Day 43-45)
- [ ] Monitor error logs
- [ ] Track SMS delivery rates
- [ ] Gather user feedback
- [ ] Fix critical issues

### Week 7-8
- [ ] Onboard first 5 shops
- [ ] Gather feature requests
- [ ] Plan Phase 2 features
- [ ] Optimize based on usage

---

## Common Pitfalls to Avoid

1. **Don't overcomplicate**: Stick to Expo + Railway + Supabase
2. **Don't add Phase 2 features**: MVP means minimum
3. **Don't skip testing**: Test on real devices early
4. **Don't forget SMS costs**: Use links, not full content
5. **Don't delay deployment**: Ship weekly to Railway

---

## Success Metrics

### Technical Success
- ⚡ 30-minute inspections achieved
- 📱 95% uptime maintained
- 💬 2-second SMS delivery
- 🎙️ 90% voice recognition accuracy

### Business Success
- 👥 5+ shops using daily by Week 8
- 📈 25+ inspections per week
- 😊 4.5+ star rating from users
- 💰 $25-55/month infrastructure cost maintained

---

**This checklist represents exactly 6 weeks of focused development. Follow it step-by-step for guaranteed success.**