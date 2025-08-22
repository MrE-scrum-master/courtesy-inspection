# Courtesy Inspection MVP - 6-Week Single Codebase Build Plan

## The Reality Check: One App, All Platforms

### What We're Actually Building
- **One Expo App** that works on iPhone (mechanics), iPad (shop managers), and web browsers (fallback)
- **One Railway API** serving REST endpoints + short links + HTML reports
- **One Supabase Backend** handling database + auth + file storage
- **Total Complexity**: ~3,000 lines of code (not 12,000!)
- **Timeline**: 6 weeks (not 12 weeks!)
- **Cost**: $25-55/month (not $200+/month)

---

## Week 1-2: Foundation & Core Mobile App

### 1.1 Project Setup (Day 1-2)
```bash
# Initialize Expo project with TypeScript
npx create-expo-app --template
cd courtesy-inspection
npm install expo-router zustand @supabase/supabase-js

# Set up Supabase backend
# - Create project at supabase.com (free tier)
# - Set up authentication
# - Create database schema
```

### 1.2 Authentication & Navigation (Day 3-4)
```javascript
// Supabase Auth setup (not custom JWT!)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Role-based navigation
const AppNavigator = () => {
  const user = useUser()
  
  if (user.role === 'mechanic') return <MechanicTabs />
  if (user.role === 'shop_manager') return <ShopManagerTabs />
}
```

### 1.3 Basic Inspection Flow (Day 5-8)
1. **Inspection List Screen** (mechanics see assigned, managers see all)
2. **Inspection Detail Screen** with photo capture
3. **Voice Input Integration** (expo-speech)
4. **Status Updates** (Green/Yellow/Red with one tap)

### 1.4 Database Schema Setup (Day 9-10)
```sql
-- Simple Supabase schema
CREATE TABLE shops (id uuid, name text, ...);
CREATE TABLE users (id uuid, shop_id uuid, role text, ...);
CREATE TABLE inspections (id uuid, status text, ...);
CREATE TABLE inspection_items (id uuid, inspection_id uuid, ...);
```

**⚠️ Week 1-2 Success Criteria:**
- [ ] Expo app builds and runs
- [ ] Supabase auth working
- [ ] Basic inspection flow functional
- [ ] Photo capture working
- [ ] Real device testing completed

---

## Week 3-4: Inspection Workflow & Data

### 3.1 Complete Inspection Interface (Day 11-14)
1. **Inspection Templates** based on vehicle type
2. **Photo Management** with Supabase Storage
3. **Voice Notes** with simple transcription
4. **Completion Validation** (required fields, photos)
5. **State Management** (AWAITING_SERVICE → AWAITING_REVIEW)

### 3.2 Shop Manager Review Interface (Day 15-18)
```javascript
// Same app, different view based on role
const InspectionReview = () => {
  const { user } = useAuth()
  const isManager = user.role === 'shop_manager'
  
  return (
    <View>
      <InspectionDetails />
      {isManager && (
        <>
          <ApprovalControls />
          <SMSPreview />
          <SendToCustomerButton />
        </>
      )}
    </View>
  )
}
```

### 3.3 Customer & Vehicle Management (Day 19-20)
- Simple CRUD for customers and vehicles
- VIN scanner using expo-barcode-scanner
- Link inspections to customers/vehicles

**⚠️ Week 3-4 Success Criteria:**
- [ ] Full inspection workflow working
- [ ] Shop manager can review and approve
- [ ] Customer/vehicle management functional
- [ ] Data persists correctly in Supabase
- [ ] State transitions working properly

---

## Week 5: iPad Optimization & Responsive Design

### 5.1 Responsive Layout System (Day 21-23)
```javascript
// Platform-aware layouts
import { Platform } from 'react-native'
import { useDeviceType } from '@react-native-community/hooks'

const ConversationScreen = () => {
  const isTablet = useDeviceType() === 'tablet'
  const isWeb = Platform.OS === 'web'
  
  if (isTablet || isWeb) {
    return <SplitViewLayout />  // iPad/Web: Side-by-side conversations
  } else {
    return <StackLayout />     // Phone: Full-screen navigation
  }
}
```

### 5.2 iPad Split-View SMS Interface (Day 24-25)
```javascript
const iPadSMSCenter = () => (
  <View style={{ flexDirection: 'row', height: '100%' }}>
    <ConversationList style={{ width: '35%' }} />
    <ActiveConversation style={{ width: '65%' }} />
  </View>
)
```

### 5.3 Expo Web Export Setup (Day 26-28)
```bash
# Configure for web
npm install @expo/webpack-config react-dom react-native-web
expo install expo-font

# Build for web
npx expo export --platform web
# Serves static files that work in any browser
```

**⚠️ Week 5 Success Criteria:**
- [ ] iPad interface optimized with split-view
- [ ] Web version functional (same UI in browser)
- [ ] Copy/paste works for estimates
- [ ] Keyboard shortcuts work on web
- [ ] Responsive design tested on all screen sizes

---

## Week 6: SMS + Railway Deployment

### 6.1 Railway API Setup (Day 29-30)
```bash
# Create Railway project
npm init -y
npm install express cors dotenv
npm install @supabase/supabase-js telnyx

# Simple server structure
server/
├── server.js          # Express API
├── routes/            # API endpoints
├── templates/         # HTML report templates
└── package.json
```

### 6.2 Short Link Service (Day 31-32)
```javascript
// In Railway server
const express = require('express')
const app = express()

// Short link creator
app.post('/api/links/create', async (req, res) => {
  const code = generateShortCode() // e.g., "x7k9"
  const { data } = await supabase
    .from('short_links')
    .insert({ code, url: req.body.url })
  
  res.json({ shortUrl: `https://ci.link/${code}` })
})

// Short link redirect
app.get('/:code', async (req, res) => {
  const { data } = await supabase
    .from('short_links')
    .select('url')
    .eq('code', req.params.code)
    .single()
  
  res.redirect(data.url)
})
```

### 6.3 SMS Integration with Links (Day 33-34)
```javascript
// Telnyx SMS with link strategy
const sendInspectionComplete = async (customer, inspection) => {
  // Create short link to beautiful HTML report
  const { shortUrl } = await createShortLink({
    url: `/report/${inspection.id}`
  })
  
  // Send short SMS (under 160 chars = 1 segment)
  const message = `Inspection complete ✓\nView: ${shortUrl}\nReply YES to approve`
  
  await telnyx.messages.create({
    to: customer.phone,
    text: message
  })
}
```

### 6.4 HTML Report Templates (Day 35-36)
```javascript
// Beautiful responsive HTML served from Railway
app.get('/report/:id', async (req, res) => {
  const inspection = await getInspectionReport(req.params.id)
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Inspection Report</title>
      <style>
        /* Mobile-first responsive CSS */
        body { font-family: system-ui; padding: 20px; }
        .item { border-left: 4px solid; padding: 10px; margin: 10px 0; }
        .green { border-color: #4CAF50; background: #f1f8f4; }
        .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .approve-btn { 
          display: block; width: 100%; padding: 15px; 
          background: #4CAF50; color: white; text-align: center;
        }
      </style>
    </head>
    <body>
      <h1>${inspection.shop_name}</h1>
      <h2>${inspection.vehicle_info}</h2>
      
      ${inspection.items.map(item => `
        <div class="item ${item.status}">
          <h4>${item.name}</h4>
          <p>${item.notes}</p>
          ${item.photos.length ? `
            <div class="photos">
              ${item.photos.map(p => `<img src="${p}" style="width:100%"/>`).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
      
      <a href="sms:${inspection.shop_phone}?body=YES" class="approve-btn">
        Approve Repairs - $${inspection.estimate_total}
      </a>
    </body>
    </html>
  `)
})
```

**⚠️ Week 6 Success Criteria:**
- [ ] Railway API deployed and functional
- [ ] Short link service working (ci.link/xyz)
- [ ] SMS integration sending links (not content)
- [ ] HTML reports look great on mobile
- [ ] Full workflow: inspection → review → SMS → customer sees report
- [ ] SMS costs under $0.004 per message (single segment)

---

## Critical Success Factors

### What Makes This Work
1. **One Codebase**: Expo handles iOS/Android/Web from single source
2. **Supabase Everything**: Database, auth, storage - no complex setup
3. **Railway Simplicity**: Git push to deploy, no Docker/K8s
4. **SMS Links Strategy**: 66% cost savings vs sending content
5. **iPad-First Design**: Perfect for shop managers' real workflow

### Quality Gates (Test Every Friday)
- [ ] **Week 2**: Basic inspection flow on real devices
- [ ] **Week 4**: Complete workflow with real data
- [ ] **Week 5**: iPad interface tested with shop managers
- [ ] **Week 6**: Full SMS workflow with real phone numbers

### Performance Requirements
- [ ] Expo app starts in <3 seconds
- [ ] Photo upload completes in <10 seconds
- [ ] SMS delivers in <30 seconds
- [ ] HTML reports load in <2 seconds
- [ ] Works reliably on 3G networks

### Emergency Scope Reduction (If Behind)
**Week 1-2 behind**: Skip voice input, manual text only
**Week 3-4 behind**: Simplify inspection templates, basic workflows only
**Week 5 behind**: Skip web export, iPad app only
**Week 6 behind**: Manual SMS sending instead of automated

---

## Deployment Strategy

### Development Environment
```bash
# Local development
expo start --tunnel  # Test on real devices
supabase start       # Local Supabase instance
```

### Production Deployment
```bash
# Mobile app
npx eas build --platform all
npx eas submit --platform all

# Railway API
git push origin main  # Auto-deploys to Railway

# Domain setup
# Point ci.link domain to Railway app
```

### Go-Live Checklist
- [ ] Supabase project configured with production settings
- [ ] Railway app deployed with custom domain
- [ ] Telnyx account set up with phone number
- [ ] SMS templates tested with real phones
- [ ] First shop onboarded with training
- [ ] Monitoring and error tracking enabled

---

## The Bottom Line

**Total Development Time**: 6 weeks (240 hours)
**Total Code**: ~3,000 lines (not 12,000)
**Monthly Cost**: $25-55 (not $200+)
**Complexity**: Simple (not enterprise-level)

### File Structure (Final)
```
courtesy-inspection/
├── app/                     # Expo React Native app
│   ├── (auth)/             # Auth screens
│   ├── (mechanic)/         # Mechanic-specific screens
│   ├── (manager)/          # Manager-specific screens
│   ├── components/         # Shared components
│   └── lib/               # Utilities & Supabase client
├── server/                 # Railway Express API
│   ├── server.js          # Main server file
│   ├── routes/            # API routes
│   └── templates/         # HTML report templates
└── supabase/              # Database schema & config
    └── migrations/
```

### What We're NOT Building
- ❌ Separate Next.js web dashboard
- ❌ Complex microservices architecture
- ❌ Custom authentication system
- ❌ Real-time WebSocket connections
- ❌ Advanced SMS editor
- ❌ Docker containers
- ❌ Kubernetes orchestration
- ❌ CDN setup
- ❌ Complex CI/CD pipelines

### What We ARE Building
- ✅ One Expo app (phone + iPad + web)
- ✅ Simple Railway API (REST + HTML + links)
- ✅ Supabase backend (database + auth + storage)
- ✅ SMS with links (66% cost savings)
- ✅ Beautiful HTML reports
- ✅ 6-week timeline
- ✅ ~3,000 lines of code

**This is the way. Simple. Effective. Ships in 6 weeks.** 🚀