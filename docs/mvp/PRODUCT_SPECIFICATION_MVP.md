# Courtesy Inspection™ MVP Product Specification
## Core Digital Vehicle Inspection & Customer Communication Platform

**Version 1.0 MVP | January 2025**

---

## Executive Summary

Courtesy Inspection MVP is a focused Digital Vehicle Inspection (DVI) platform that transforms auto repair shops into transparent, customer-focused businesses. Our MVP combines intelligent vehicle inspection workflows with two-way customer communication and automated estimate generation to create the essential foundation for automotive service transparency.

### Key MVP Differentiators
- **30-Minute Promise**: Complete thorough inspections in under 30 minutes
- **Two-Way Communication**: Simple SMS texting between shops and customers
- **Intelligent Templates**: VIN-based automatic template selection for precision
- **Complete Workflow**: From inspection to estimate approval to service scheduling
- **Customer Portal**: Essential service history and self-service capabilities

---

## 1. Product Vision & Mission

### Vision Statement
To become the essential tool for automotive service transparency, transforming every vehicle inspection into a trust-building opportunity between shops and customers.

### Mission
Empower auto repair shops with a focused platform that streamlines inspections, enables real-time customer communication, and automates estimate processes through transparent, educational automotive service experiences.

### Core Values
1. **Transparency First**: Radical honesty about vehicle conditions
2. **Time is Money**: Respect mechanics' need for efficiency (30-minute target)
3. **Education Matters**: Clear explanations for mechanics and customers
4. **Trust Through Communication**: Near real-time, two-way dialogue builds relationships
5. **Simplicity Wins**: Complex problems, simple solutions

---

## 2. Market Analysis & Opportunity

### Market Size
- **Total Addressable Market (TAM)**: $4.2B globally (200,000+ auto repair shops)
- **Serviceable Addressable Market (SAM)**: $1.8B (independent shops in North America)
- **Serviceable Obtainable Market (SOM)**: $180M (10% market share in 5 years)

### Target Customer Segments

#### Primary Segment: Independent Auto Repair Shops
- 1-10 bay operations
- $500K-$5M annual revenue
- Currently using paper or basic digital tools
- Price-conscious but value-driven

#### Secondary Segment: Multi-Location Shop Groups
- 2-20 locations
- Standardization needs
- Central reporting requirements

---

## 3. User Personas

### 🔧 Mike the Mechanic
**Age**: 32 | **Experience**: 8 years | **Tech Comfort**: Medium

**Goals**:
- Complete inspections quickly
- Avoid comeback jobs
- Learn about new vehicle systems

**Pain Points**:
- Current tools are too complex
- Typing with greasy hands
- Remembering all inspection points

**How We Help**:
- Voice-to-text notes
- Guided workflow
- Large touch targets

### 👔 Sarah the Service Advisor
**Age**: 28 | **Experience**: 4 years | **Tech Comfort**: High

**Goals**:
- Communicate clearly with customers
- Increase service sales
- Reduce customer complaints

**Pain Points**:
- Explaining technical issues
- Building customer trust
- Juggling multiple customers

**How We Help**:
- Visual reports
- Near real-time updates
- Customer portal links

### 🚗 Carlos the Customer
**Age**: 45 | **Experience**: Non-technical | **Tech Comfort**: Medium

**Goals**:
- Understand vehicle needs
- Avoid unnecessary repairs
- Budget for maintenance

**Pain Points**:
- Doesn't trust shops
- Confused by technical terms
- Worried about costs

**How We Help**:
- Photo evidence
- Plain language
- Transparent pricing

---

## 4. MVP Features & Functionality

### 4.1 Core Platform Architecture

#### Workflow State Management
The platform operates through four primary workflow states:

1. **AWAITING_SERVICE**: Inspection scheduled, vehicle checked in
2. **AWAITING_REVIEW**: Inspection complete, awaiting service advisor review
3. **READY_TO_SEND**: Approved by advisor, ready for customer communication
4. **SENT**: Report and estimates delivered to customer via two-way texting

#### Progressive 7-Stage Inspection Process

**Stage 1: Vehicle Intake & Photos**
- VIN scanner for instant vehicle identification with automatic template selection
- 4-corner exterior photos
- Odometer reading with history tracking
- Customer concern documentation via two-way texting integration

**Stage 2: Interior Check**
- Dashboard warning lights (photo capture)
- Safety systems (horn, wipers, lights)
- HVAC functionality
- Seat and restraint condition

**Stage 3: Short Test Drive**
- Noise detection checklist
- Handling assessment
- Brake performance
- Transmission behavior

**Stage 4: Light Check**
- Comprehensive exterior lighting
- Smart bulb identification
- Regulatory compliance check

**Stage 5: Under Hood Inspection**
- Fluid levels with visual indicators
- Belt and hose condition
- Battery health assessment
- Leak detection mapping

**Stage 6: Mid-Point Inspection (Partially Lifted)**
- Tire tread depth measurement
- Brake pad life percentage
- Suspension component check
- Wheel bearing assessment

**Stage 7: Fully Elevated Inspection**
- Comprehensive undercarriage review
- Exhaust system evaluation
- Drivetrain component check
- Frame and structural assessment

### 4.2 MVP Platform Features

#### 🤖 Essential Intelligence
- **VIN-Based Template Selection**: Automatic inspection protocol selection based on vehicle specifications
- **Voice Commands**: Hands-free operation for mechanics
- **Basic Photo Analysis**: Simple issue flagging from images
- **Natural Language Notes**: Convert technical speak to customer language

#### 📱 SMS with Links Strategy (66% Cost Savings)
- **Short Link Messages**: Send ci.link/xyz instead of full content (saves 66% on SMS costs)
- **Rich HTML Reports**: Beautiful responsive pages at the link destination
- **Quick SMS Templates**: All under 160 characters for single-segment pricing
- **iPad SMS Center**: Split-view interface perfect for managing multiple conversations
- **Two-Way Communication**: Customer replies, shop responds - all through simple SMS

#### 📱 Shop Manager Interface (Same Expo App - iPad-Optimized)
- **iPad Split-View SMS Center**: Perfect for managing customer conversations with split-screen layout
- **Inspection Review & Approval**: Review mechanic findings with full iPad keyboard support
- **SMS with Links Strategy**: Send ci.link/xyz instead of full content (66% cost savings)
- **Workflow State Management**: Move inspections through states efficiently
- **Expo Web Fallback**: Same iPad-optimized interface available in any browser

#### 📊 Estimate Generation & Approval System
- **Automated Estimate Creation**: Generate estimates based on inspection findings
- **Parts & Labor Integration**: Basic pricing from supplier databases
- **Customer Approval Workflow**: Digital estimate approval via text/portal
- **Payment Processing**: Basic payment collection

#### 👥 Customer Portal & Self-Service
- **Essential Service History**: Current and recent inspections
- **Document Access**: Reports, estimates, and communications
- **Vehicle Health Dashboard**: Track maintenance needs and history

#### 🔗 Essential Integrations
- **Shop Management Systems**: Basic API compatibility with Mitchell1, ShopWare, Tekmetric
- **Payment Processing**: Stripe integration
- **Telnyx Communication**: SMS/MMS messaging infrastructure

---

## 5. Technical Architecture

### 5.1 MVP System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Courtesy Inspection MVP                       │
│         One Expo App: Phone + iPad + Web                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Single Expo Codebase                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │iPhone    │ │iPad      │ │Expo Web  │            │   │
│  │  │(Mechanic)│ │(Shop Mgr)│ │(Fallback)│            │   │
│  │  │Quick     │ │SMS Center│ │Same iPad │            │   │
│  │  │Inspection│ │Split View│ │UI in     │            │   │
│  │  │Workflow  │ │Perfect!  │ │Browser   │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Railway API Server                     │   │
│  │  ┌─────────┐ ┌─────────────┐ ┌─────────────────┐   │   │
│  │  │REST API │ │Short Links  │ │HTML Reports     │   │   │
│  │  │for Expo │ │ci.link/xyz  │ │Beautiful Pages  │   │   │
│  │  │App      │ │SMS Cost     │ │with Photos      │   │   │
│  │  │         │ │Savings 66%  │ │& Estimates      │   │   │
│  │  │Node.js  │ │+ Telnyx     │ │+ Responsive     │   │   │
│  │  │Express  │ │SMS          │ │Mobile-First     │   │   │
│  │  └─────────┘ └─────────────┘ └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Railway PostgreSQL Backend             │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐     │   │
│  │  │PostgreSQL  │ │JWT Auth    │ │Railway     │     │   │
│  │  │Database    │ │(Custom)    │ │Volumes     │     │   │
│  │  │Everything  │ │Secure with │ │Photos &    │     │   │
│  │  │We Need     │ │bcrypt      │ │Files       │     │   │
│  │  └────────────┘ └────────────┘ └────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 MVP Technology Stack

#### Frontend (Single Expo Codebase)
- **Framework**: Expo (React Native) - ONE codebase for iOS, Android, and Web
- **Responsive Design**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand (lightweight and perfect for our needs)
- **Navigation**: React Navigation with responsive layouts (phone vs iPad)
- **iPad Optimization**: Split-view SMS center with full keyboard support
- **Web Export**: Expo Web - same iPad interface in any browser

#### Backend (Railway - Dead Simple)
- **Platform**: Railway (git push to deploy - that's it!)
- **Runtime**: Node.js with Express (simple and effective)
- **API**: RESTful endpoints for the Expo app
- **Short Links**: ci.link/xyz service (66% SMS cost savings!)
- **HTML Reports**: Beautiful mobile-first responsive pages
- **SMS Integration**: Telnyx with link-first strategy (not content)
- **Authentication**: Custom JWT authentication with bcrypt

#### Infrastructure (Stupidly Simple)
- **Everything**: Railway (API + Database) + Expo (app)
- **Deployment**: Git push to Railway = deployed
- **No Docker**: Railway figures it out
- **File Storage**: Railway volumes for photos
- **No Complex Setup**: Everything just works
- **Monitoring**: Built into Railway
- **Total Monthly Cost**: $25-55 (not $200+)

#### Data & Storage (Railway PostgreSQL)
- **Database**: Railway PostgreSQL 17.6
- **Authentication**: Custom JWT with bcrypt hashing
- **File Storage**: Railway volumes for photos and documents
- **Search**: PostgreSQL full-text search (built-in)
- **No Redis Needed**: Direct database queries for MVP

### 5.3 MVP Performance Requirements

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| API Response Time | <200ms p95 | <500ms p99 |
| Mobile App Launch | <2s cold start | <3s |
| Photo Upload | <5s per photo | <10s |
| Report Generation | <3s | <5s |
| Inspection Completion | <30 minutes | <45 minutes |
| SMS Delivery Time | <5s | <10s |
| Estimate Generation | <30s | <60s |
| Concurrent Users | 1,000+ | 2,500+ |
| Uptime SLA | 99.5% | 99.0% |

---

## 6. Business Model & Monetization

### 6.1 MVP Pricing Strategy (Simple)

| Package | Price | Features | Target Market |
|---------|-------|----------|---------------|
| **Essential** | $89/month | One Expo app (phone + iPad + web), SMS with links (66% savings), complete inspection workflow | Independent shops |
| **Professional** | $149/month | Everything in Essential + advanced templates, analytics, multi-mechanic support | Full-service shops |
| **Enterprise** | Custom | Multi-location, integrations, dedicated support | Shop chains |

#### Core Value Propositions  
- **One Codebase, All Platforms**: Single Expo app works perfectly on phone, iPad, and web
- **SMS Cost Revolution**: Send links, not content - save 66% on SMS costs
- **iPad SMS Perfection**: Split-view interface designed for shop managers
- **6-Week Implementation**: Expo + Railway PostgreSQL = simple, fast, effective

### 6.2 MVP Go-to-Market Strategy

#### Phase 1: MVP Launch (Weeks 1-6)
- Target: Build and deploy single Expo app
- Strategy: One codebase for all platforms
- Success Metric: Working app on phone, iPad, and web

#### Phase 2: Beta Launch (Weeks 7-12)
- Target: 25 beta shops in California
- Strategy: Direct sales, free pilot program
- Success Metric: 20 paying customers using iPad SMS center

#### Phase 3: Regional Growth (Months 4-6)
- Target: 100 shops using SMS link strategy
- Strategy: Word of mouth, 66% SMS cost savings as selling point
- Success Metric: $25K MRR

---

## 7. Implementation Roadmap

### 7.1 MVP Development Phases

#### Phase 1: Core Expo App (Weeks 1-2)
**Features**:
- Single Expo app with role-based views
- Basic inspection workflow for mechanics
- Photo capture and upload to Railway volumes
- Shop manager view in same app (no separate web interface)
- VIN-based template selection

**Success Criteria**:
- 5 beta shops onboarded
- <30 minute inspection time
- Working SMS integration

#### Phase 2: iPad & SMS (Weeks 3-4)
**Features**:
- iPad-optimized split-view SMS center
- Short link service (ci.link/xyz) for SMS cost savings
- Beautiful HTML reports served from Railway
- SMS integration with Telnyx (links, not content)

**Success Criteria**:
- 25 beta shops
- Customer portal 40% adoption
- $15K MRR

#### Phase 3: Web Export & Polish (Weeks 5-6)
**Features**:
- Expo Web export for browser fallback
- Performance optimization for all platforms
- Railway deployment with automatic scaling
- Basic reporting and analytics

**Success Criteria**:
- 100 paying customers
- NPS >40
- $25K MRR

### 7.2 MVP Resource Requirements

#### Core Team (6 weeks)
- **Lead Developer** (1) - Expo + Railway PostgreSQL
- **Frontend Developer** (1) - React Native + responsive design
- **No separate mobile/web teams** - Expo handles everything
- **No DevOps needed** - Railway handles deployment
- **No complex infrastructure** - Railway handles everything

#### MVP Budget (6 weeks to launch)
- **Development**: Focus on single Expo codebase (~3,000 lines)
- **Infrastructure**: $25-55/month (Railway with PostgreSQL addon)
- **Domain**: ci.link ($10/year)
- **SMS**: Telnyx with 66% savings from link strategy
- **Total Operating Cost**: $25-55/month (not $200+/month)

---

## 8. Success Metrics & KPIs

### 8.1 MVP Product Metrics

#### Usage Metrics
- **Daily Active Users (DAU)**: Target 50% of licensed users
- **Inspections per Day**: Average 3 per mechanic
- **Time to Complete**: <30 minutes average
- **Feature Adoption**: 70% using photo features, 50% using two-way texting
- **Communication Engagement**: 80% of customers respond to texts within 24 hours

#### Quality Metrics
- **Inspection Completeness**: >80% of items checked
- **Photo Attachment Rate**: 2+ photos per inspection
- **Report View Rate**: 60% of sent reports viewed
- **Customer Portal Engagement**: 30% register accounts
- **Estimate Approval Rate**: 55% of estimates approved within 48 hours

### 8.2 MVP Business Metrics

#### Revenue Metrics
- **Monthly Recurring Revenue (MRR)**: $60K by Month 9
- **Average Revenue Per User (ARPU)**: $95/month
- **Customer Lifetime Value (CLV)**: $3,400
- **Customer Acquisition Cost (CAC)**: <$400
- **LTV:CAC Ratio**: >3:1

#### Growth Metrics
- **Month-over-Month Growth**: 25% MRR growth (early stage)
- **Logo Retention**: >90% after Month 6
- **Market Validation**: 250 shops by Month 9

---

## 9. Next Steps & Call to Action

### Immediate Actions (Weeks 1-4)
1. **Validate with 15 shop owners** - Focus on MVP pricing and core features
2. **Build clickable prototype** - Include workflow states and texting mockups
3. **Set up Telnyx integration** - Core communication infrastructure
4. **Recruit core engineering team** - 2-3 experienced full-stack developers

### 90-Day Milestones
- **Month 1**: Working prototype with SMS integration
- **Month 2**: Beta version with 5 test shops
- **Month 3**: Production-ready MVP with 25 paying customers

### Success Factors
- **Focus on core value**: 30-minute inspections + customer communication
- **Customer obsession**: Weekly feedback cycles with early adopters
- **Technical excellence**: Reliable SMS delivery and workflow management
- **Operational discipline**: Consistent 2-week development cycles

---

**Document Version**: 1.0 MVP  
**Last Updated**: January 2025 
**Status**: Ready for 6-Week Implementation  
**Contact**: howtoreachmr.e@gmail.com

---

*"One codebase, all platforms. Links, not content. 6 weeks, not 6 months."*

---

## The Simple Truth

**What We're Building:**
- ✅ One Expo app (phone + iPad + web)
- ✅ One Railway API (REST + short links + HTML)
- ✅ One Railway backend (PostgreSQL + API + storage)
- ✅ SMS with links (66% cost savings)
- ✅ 6 weeks to ship
- ✅ $25-55/month operating costs
- ✅ ~3,000 lines of code

**What We're NOT Building:**
- ❌ Separate web dashboard
- ❌ Complex microservices
- ❌ Multiple codebases to maintain
- ❌ Expensive SMS with full content
- ❌ 12-week development timeline
- ❌ $200+/month infrastructure costs

January 2025