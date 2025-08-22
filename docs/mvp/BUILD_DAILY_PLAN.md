# BUILD_DAILY_PLAN.md - Week 1 Hour-by-Hour Implementation

## Overview
This plan breaks down the first week of MVP development into focused hour-by-hour sessions. Each section includes specific commands, expected outcomes, and troubleshooting tips.

## Day 1 - Monday: Foundation Setup (8 hours)

### Hour 1: Environment Setup
**Goal**: Set up development environment and accounts

```bash
# Install Node.js 24 if not installed
node --version  # Should be v24.x
npm --version   # Should be 10.x

# Install global tools
npm install -g @expo/cli@latest
npm install -g @supabase/cli
```

**Expected Outcome**: All tools installed and ready
**Troubleshooting**: 
- If Node.js wrong version: Use nvm to install Node 24
- If permission errors: Use npm config set prefix ~/.npm-global

### Hour 2: Supabase Setup
**Goal**: Create and configure Supabase project

```bash
# Create new Supabase project at dashboard.supabase.com
# Copy the database schema from templates/supabase-schema.sql
# Paste into SQL Editor and run
```

**Commands**:
1. Go to supabase.com → New Project
2. Copy `templates/supabase-schema.sql` content
3. Paste into SQL Editor → Run
4. Go to Authentication → Providers → Enable Email
5. Copy Project URL and anon key

**Expected Outcome**: Database created with all tables and RLS policies
**Troubleshooting**: 
- If SQL errors: Run each table creation separately
- If RLS errors: Check user permissions

### Hour 3: Railway Server Setup
**Goal**: Deploy backend server to Railway

```bash
# Create new directory for server
mkdir courtesy-inspection-server
cd courtesy-inspection-server

# Copy templates
cp ../templates/package-server.json package.json
cp ../templates/railway-server.js index.js
cp ../templates/.env.example .env

# Install dependencies
npm install
```

**Commands**:
1. Copy templates to server directory
2. Edit .env with Supabase credentials
3. Test locally: `npm start`
4. Connect to Railway: railway.app → New Project → Deploy from GitHub
5. Add environment variables in Railway dashboard

**Expected Outcome**: Server running locally and deployed to Railway
**Troubleshooting**:
- If Railway deployment fails: Check package.json engines field
- If database connection fails: Verify Supabase URL and key

### Hour 4: Expo App Initialization
**Goal**: Create React Native app with Expo

```bash
# Create Expo app
npx create-expo-app@latest courtesy-inspection-app --template blank-typescript

cd courtesy-inspection-app

# Replace default config
cp ../templates/expo-app.json app.json
cp ../templates/package-expo.json package.json

# Install dependencies
npm install
```

**Expected Outcome**: Expo app created and configured
**Troubleshooting**:
- If Expo CLI issues: Update to latest version
- If TypeScript errors: Check tsconfig.json

### Hour 5: Core Navigation Setup
**Goal**: Implement basic navigation structure

```bash
# Install navigation dependencies
npm install @react-navigation/native @react-navigation/stack
npx expo install react-native-screens react-native-safe-area-context

# Create basic screens
mkdir src/screens
touch src/screens/HomeScreen.tsx
touch src/screens/LoginScreen.tsx
touch src/screens/InspectionScreen.tsx
```

**Expected Outcome**: Navigation working between screens
**Troubleshooting**:
- If navigation errors: Check React Navigation documentation
- If TypeScript errors: Add proper type definitions

### Hour 6: Authentication Implementation
**Goal**: Implement Supabase authentication

```bash
# Install Supabase client
npm install @supabase/supabase-js

# Create auth service
mkdir src/services
touch src/services/supabase.ts
touch src/services/auth.ts
```

**Code to implement**:
- Supabase client configuration
- Login/logout functions
- Auth state management

**Expected Outcome**: Users can log in/out successfully
**Troubleshooting**:
- If auth errors: Check Supabase RLS policies
- If redirect issues: Verify app deep linking setup

### Hour 7: Basic UI Components
**Goal**: Create reusable UI components

```bash
# Create components directory
mkdir src/components
touch src/components/Button.tsx
touch src/components/Input.tsx
touch src/components/Card.tsx
```

**Expected Outcome**: Basic UI components ready for use
**Troubleshooting**:
- If styling issues: Check React Native styling docs
- If component errors: Verify prop types

### Hour 8: Testing & Debugging
**Goal**: Test all Day 1 implementations

```bash
# Run app on device/simulator
npm start
# Press 'i' for iOS or 'a' for Android

# Test authentication flow
# Test navigation between screens
# Check console for errors
```

**Expected Outcome**: App runs without critical errors
**Troubleshooting**:
- If app won't start: Check Metro bundler logs
- If device issues: Restart Expo CLI and device

## Day 2 - Tuesday: Core Features (8 hours)

### Hour 9: Database Connection
**Goal**: Connect app to Supabase database

```bash
# Test database connection
# Implement CRUD operations for inspections
# Add error handling
```

**Expected Outcome**: App can read/write to database
**Troubleshooting**:
- If connection fails: Check network and credentials
- If RLS errors: Verify user permissions

### Hour 10: Inspection Form (Part 1)
**Goal**: Create basic inspection form

```bash
# Create form components
touch src/components/InspectionForm.tsx
touch src/components/ChecklistItem.tsx
```

**Expected Outcome**: Form renders with basic fields
**Troubleshooting**:
- If form doesn't submit: Check validation logic
- If styling issues: Use React Native debugging tools

### Hour 11: Inspection Form (Part 2)
**Goal**: Complete inspection form with validation

**Expected Outcome**: Form validates and saves data
**Troubleshooting**:
- If validation fails: Check form library documentation
- If save errors: Verify database schema matches form data

### Hour 12: Photo Upload
**Goal**: Implement camera and photo upload

```bash
# Install camera dependencies
npx expo install expo-camera expo-image-picker
```

**Expected Outcome**: Users can take/upload photos
**Troubleshooting**:
- If camera permission issues: Check app.json permissions
- If upload fails: Verify Supabase storage setup

### Hour 13: Report Generation (Backend)
**Goal**: Create PDF report generation on server

**Expected Outcome**: Server can generate PDF reports
**Troubleshooting**:
- If PDF generation fails: Check puppeteer installation
- If Railway memory issues: Optimize PDF generation

### Hour 14: Report Viewing (Frontend)
**Goal**: Display generated reports in app

**Expected Outcome**: Users can view PDF reports
**Troubleshooting**:
- If PDF won't load: Check file URL and permissions
- If rendering issues: Test with different PDF viewers

### Hour 15: SMS Integration (Backend)
**Goal**: Implement SMS sending with Twilio

**Expected Outcome**: App can send SMS notifications
**Troubleshooting**:
- If SMS fails: Check Twilio credentials and phone numbers
- If rate limiting: Implement proper error handling

### Hour 16: Day 2 Testing
**Goal**: Test all Day 2 features

**Expected Outcome**: All core features working
**Troubleshooting**:
- Create test checklist
- Document any issues for Day 3

## Day 3 - Wednesday: Integration & Polish (8 hours)

### Hour 17-20: Feature Integration
**Goals**:
- Connect all features together
- Implement proper error handling
- Add loading states
- Improve user experience

### Hour 21-24: Testing & Bug Fixes
**Goals**:
- End-to-end testing
- Fix critical bugs
- Performance optimization
- Prepare for deployment

## Day 4 - Thursday: Deployment (8 hours)

### Hour 25-28: App Store Preparation
**Goals**:
- Configure app for production
- Create app store assets
- Test on real devices

### Hour 29-32: Final Deployment
**Goals**:
- Deploy to app stores
- Final testing
- Documentation

## Daily Success Metrics

### Day 1 Success Criteria
- [ ] Supabase database created and accessible
- [ ] Railway server deployed and responding
- [ ] Expo app running on device
- [ ] Basic authentication working
- [ ] Navigation between screens functional

### Day 2 Success Criteria
- [ ] Database CRUD operations working
- [ ] Inspection form saves data
- [ ] Photos can be uploaded
- [ ] PDF reports generate
- [ ] SMS notifications send

### Day 3 Success Criteria
- [ ] All features integrated seamlessly
- [ ] Error handling implemented
- [ ] User experience polished
- [ ] Performance acceptable

### Day 4 Success Criteria
- [ ] App deployed to stores
- [ ] All features tested end-to-end
- [ ] Documentation complete
- [ ] Ready for user feedback

## Common Issues & Solutions

### Authentication Issues
- **Problem**: Users can't log in
- **Solution**: Check Supabase RLS policies and auth provider settings

### Database Connection Issues
- **Problem**: Can't connect to database
- **Solution**: Verify Supabase URL, key, and network connection

### Railway Deployment Issues
- **Problem**: Server won't deploy
- **Solution**: Check package.json engines field and environment variables

### Expo Build Issues
- **Problem**: App won't build
- **Solution**: Clear cache with `npm start -- --clear`, check dependencies

### SMS Issues
- **Problem**: SMS not sending
- **Solution**: Verify Twilio credentials, phone number format, and account balance

## Emergency Contacts & Resources

### Documentation Links
- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev)
- [Railway Docs](https://docs.railway.app)
- [React Navigation](https://reactnavigation.org/docs/getting-started)

### Troubleshooting Commands
```bash
# Clear Expo cache
npm start -- --clear

# Reset Metro bundler
npx react-native start --reset-cache

# Check Supabase connection
curl -X GET 'YOUR_SUPABASE_URL/rest/v1/inspections' -H "apikey: YOUR_ANON_KEY"

# Test Railway deployment
curl https://your-app.up.railway.app/health
```

This plan provides a realistic hour-by-hour breakdown with specific commands, expected outcomes, and troubleshooting tips for each session.