# SHOP MANAGER INTERFACE - MVP VERSION (iPad-First)

## Single Expo App: Phone + iPad + Web - MVP

### Document Information
- **Version**: 1.0 MVP
- **Date**: 2025-01-21
- **Status**: MVP Specification
- **Target Platforms**: iPhone (Mechanics), iPad (Shop Managers), Web Browser (Fallback)

---

## 1. Executive Summary

The Courtesy Inspection MVP uses a **single Expo codebase** that provides optimized experiences across all devices. Mechanics use phones for inspections, Shop Managers use iPads for SMS/communications, and web browser access is available as a fallback. This unified approach eliminates the complexity of multiple codebases while delivering platform-optimized experiences.

### 1.1 MVP Key Features (Single App, Multiple Experiences)
- **Phone Interface** (Mechanics): Streamlined inspection workflow
- **iPad Interface** (Shop Managers): SMS center with split-view conversations
- **Web Interface** (Shop Managers): Same iPad UI in browser
- **SMS with Links Strategy**: Send ci.link/xyz instead of full content (66% cost savings)
- **Universal Features**: Inspection review, customer management, quick actions

---

## 2. User Roles and Permissions (MVP)

### 2.1 Shop Manager (MVP)
**Access Level**: Full shop operational access
**Permissions**:
- Basic shop configuration 
- Create and manage mechanic accounts
- Review and approve inspections
- SMS customer communication with quick action buttons
- Create basic estimates
- Basic customer and vehicle management
- VIN scanning via mobile app (optional)

### 2.2 Mechanic (MVP)
**Access Level**: Mobile app only (NO web interface access)
**Permissions**:
- Access mobile app for inspections
- Complete assigned inspections
- Upload photos and inspection data
- Update inspection status via mobile

### 2.3 Permission Matrix (MVP)

| Feature | Shop Manager | Mechanic |
|---------|-------------|----------|
| Shop Settings | ✅ (Basic) | ❌ |
| User Management | ✅ (Mechanics Only) | ❌ |
| Inspection Queue | ✅ | Mobile App Only |
| Review/Approve Inspections | ✅ | ❌ |
| Customer Communication | ✅ (SMS Only) | ❌ |
| Basic Estimates | ✅ | ❌ |
| Customer Database | ✅ (Basic) | ❌ |
| Mobile App Access | ✅ (VIN Scanning) | ✅ (Full Inspection) |

---

## 3. System Architecture (MVP) - Single Expo Codebase

### 3.1 Unified Tech Stack

**Single Frontend** (All Platforms):
- **Framework**: Expo (React Native) - runs on iOS, Android, and Web
- **Styling**: NativeWind (Tailwind for React Native)
- **State Management**: Zustand
- **Updates**: Simple HTTP polling every 30 seconds
- **Navigation**: React Navigation with responsive layouts
- **UI Components**: React Native + platform-specific optimizations

**Backend Integration**:
- **API**: Railway (Node.js/Express) serving API + HTML reports + short links
- **Authentication**: Supabase Auth (JWT)
- **SMS**: Telnyx with short link strategy (ci.link/xyz)
- **File Storage**: Supabase Storage
- **Database**: Supabase (PostgreSQL)

### 3.2 Performance Requirements (MVP)

| Metric | Target |
|--------|--------|
| Initial Page Load | < 3s |
| Navigation | < 1s |
| Message Updates | < 10s polling |
| Image Loading | < 2s |
| API Response | < 500ms |

---

## 4. Responsive Navigation (MVP) - Adaptive to Device

### 4.1 Phone Layout (Mechanics)
```
Mechanic App (Phone)
├── My Inspections
├── Start Inspection
├── Inspection Detail
│   ├── Voice Input
│   ├── Photo Capture
│   └── Quick Status (🟢🟡🔴)
└── Profile
```

### 4.2 iPad Layout (Shop Managers) - Split View
```
iPad Interface (Shop Managers)
├── Split View SMS Center
│   ├── Conversations (Left) 
│   └── Active Chat (Right)
├── Inspection Queue
├── Review & Approve
├── Customer Database
└── Shop Settings
```

### 4.3 Web Layout (Desktop Fallback)
```
Same iPad interface in browser
- Slightly clunky but fully functional
- Copy/paste from AllData works
- Multiple browser tabs supported
```

---

## 5. Dashboard Design (MVP)

### 5.1 Simple Dashboard Layout
```
[Welcome Header]
[Quick Stats - 3 cards]
[Inspection Queue - Simple List]
[Recent Messages - Basic List]
[Quick Actions]
```

### 5.2 Dashboard Components (MVP)

#### 5.2.1 Quick Stats Cards (3 cards)
1. **Inspections Today**
   - Total count
   - Basic status breakdown

2. **Pending Reviews**
   - Count of inspections awaiting review
   - Priority indicator

3. **Active Messages**
   - Unread customer messages
   - Quick response needed

#### 5.2.2 Inspection Queue Widget (MVP)
- Simple list view (no advanced filtering)
- Customer name and vehicle
- Basic status with color coding
- Time information
- **Quick action buttons**: Review, Approve, Send SMS

#### 5.2.3 Recent Messages (MVP)
- Simple list of customer SMS messages
- **SMS quick action buttons** for common responses
- Basic timestamp display

#### 5.2.4 Quick Actions Bar (MVP)
- "New Inspection" button
- "Message Customer" button (SMS)
- "Add Customer" button

---

## 6. Inspection Management Interface (MVP)

### 6.1 Simple Inspection Queue

#### 6.1.1 Basic Filter Options
- Status: All, Awaiting Review, Ready to Send, Sent
- Date: Today, This Week
- Simple text search

#### 6.1.2 Inspection List (MVP)
**Simple Card Design**:
- Customer name and phone
- Vehicle info (Year Make Model)
- Basic status badge
- Assigned mechanic
- Simple action buttons: View, Approve, Send SMS

### 6.2 Basic Inspection Review

#### 6.2.1 Simple Layout
```
[Customer/Vehicle Header]
[Inspection Items - Simple List]
[Photos - Basic Grid]
[Action Buttons]
```

#### 6.2.2 Review Features (MVP)
- View inspection items with basic status
- Photo viewing (simple lightbox)
- Basic notes editing
- Simple approve/reject workflow

---

## 7. SMS Communication Interface (MVP) - Links, Not Essays!

### 7.1 iPad Split-View SMS Center (Primary Interface)

#### 7.1.1 iPad Layout
```
[Conversation List] | [Active Conversation]
      (35%)         |        (65%)
```

#### 7.1.2 **SMS with Short Links Strategy** (66% Cost Savings!)
**Instead of sending full content, send links**:
- "Inspection complete ✓\nView: ci.link/x7k9\nReply YES to approve" (65 chars)
- "Estimate ready: $434\nDetails: ci.link/m8n2\nReply YES to approve" (68 chars)
- "Ready for pickup!\nInvoice: ci.link/p5t3\nWe close at 6pm" (62 chars)

**Why Links Work Better**:
- **Cost**: 1 SMS segment vs 3-4 segments (66% savings)
- **Rich Content**: Beautiful HTML reports with photos
- **Shareability**: Customer can forward to family
- **Analytics**: Track clicks and engagement

#### 7.1.3 Quick Action Buttons (All Under 160 Characters)
- Pre-configured short messages with links
- Custom templates with variables
- One-tap sending with automatic link generation
- Copy/paste from AllData with auto-shortening

---

## 8. Basic Estimate Builder (MVP)

### 8.1 Simple Estimate Creation

#### 8.1.1 Basic Workflow
1. Select customer and vehicle
2. Add items from inspection
3. Enter basic pricing
4. Send to customer

#### 8.1.2 Simple Interface
- Basic item list
- Simple labor and parts entry
- Basic total calculation
- Send via SMS option

---

## 9. Customer Management (MVP)

### 9.1 Basic Customer Database

#### 9.1.1 Simple Customer List
- Customer name
- Phone number (click to text)
- Last visit
- Basic search

#### 9.1.2 Basic Customer Profile
- Contact information
- Vehicle list
- Basic service history
- SMS message history

---

## 10. Shop Settings (MVP)

### 10.1 Basic Shop Configuration

#### 10.1.1 Essential Settings
- Shop name and contact info
- Basic SMS settings
- Simple user management
- Basic mechanic accounts

#### 10.1.2 SMS Quick Action Management
- Create/edit quick action buttons
- Basic message templates
- Simple variable substitution

---

## 11. Simple Updates (MVP)

### 11.1 Basic Polling
- Simple 5-second polling for new data
- Basic notification system
- Simple status updates
- Basic SMS message notifications

---

## 12. Authentication (MVP)

### 12.1 Basic Login
- Simple username/password
- Basic session management
- Password reset via email

---

## 13. Mobile Integration (MVP)

### 13.1 Basic Sync
- Simple API integration with mobile app
- Basic data synchronization
- Simple inspection assignment

---

## 14. MVP Success Criteria

### 14.1 Core Functionality
- Shop Managers can review and approve inspections
- **SMS quick action buttons work reliably** 
- Basic customer communication via SMS
- Simple estimate creation and sending
- Basic mechanic management
- Essential shop operations

### 14.2 Performance Targets (MVP)
- System loads in under 3 seconds
- SMS quick actions send within 2 seconds
- Basic inspection workflow completed in under 5 minutes
- 99% uptime during business hours

---

## MVP Implementation Priority

### 6-Week Single Codebase Development Plan

### Week 1-4: Core Expo App
1. **Phone interface for mechanics** (inspection workflow)
2. **iPad interface for shop managers** (split-view SMS)
3. **Authentication and user management** (Supabase)
4. **Customer and inspection database**

### Week 5: iPad/Web Optimization
1. **Responsive layouts** for iPad vs phone
2. **Expo Web export** for browser fallback
3. **Split-view SMS interface refinement**
4. **Copy/paste integration** for estimates

### Week 6: SMS + Deployment
1. **Short link service** (ci.link/xyz)
2. **HTML report templates** served from Railway
3. **Telnyx SMS integration** with link strategy
4. **Railway deployment** with Supabase backend

---

**MVP Focus**: Single Expo codebase that works perfectly on phones (mechanics), iPads (shop managers), and web browsers (fallback). SMS with links saves 66% on costs while providing richer customer experience.

## The Bottom Line Architecture

```
One Expo App → Phone + iPad + Web
One Railway API → API + HTML Reports + Short Links  
One Supabase → Database + Auth + Storage
One SMS Strategy → Links, Not Content

Total: ~3,000 lines of code
Cost: $25-55/month
Time: 6 weeks
```

**No Next.js. No separate web dashboard. No complex architecture.**

**Just one app that works everywhere. This is the way.**