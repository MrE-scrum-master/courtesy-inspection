# Courtesy Inspection MVP Specifications

## 🎯 MVP Goal
Build a voice-first vehicle inspection app with SMS customer communication in 6 weeks.

**Vision**: Transform vehicle inspections from tedious paperwork into fast, voice-driven experiences that delight customers and mechanics alike.

## 📋 What's Included (MVP Specs)

### Core Specifications
- **[Voice Implementation](./voice-implementation.md)** - 50-line native voice solution for hands-free inspections
- **[User Roles & Permissions](./user-roles.md)** - Simple 3-role system (admin, mechanic, customer)
- **[Inspection Workflow](./inspection-workflow.md)** - Streamlined 30-minute inspection process
- **[SMS Customer Communication](./sms-customer-communication.md)** - Automated texting with quick action buttons
- **[Templates & Forms](./templates-forms.md)** - Pre-built inspection templates for common vehicles

### Simplified MVP Versions
- **[Database Schema MVP](./database-schema_MVP.md)** - Essential tables only, no complex relationships
- **[API Endpoints MVP](./api-endpoints_MVP.md)** - Core endpoints for MVP functionality
- **[Frontend Components MVP](./frontend-components_MVP.md)** - Minimal UI components for launch

## 🚀 What Makes This MVP Special

### 🎙️ Voice-First Innovation
- **50-line implementation** using device native speech recognition
- Hands-free operation for mechanics working under vehicles
- Natural language input: "Front tire pressure 32 PSI, good condition"

### 📱 SMS Magic
- **Quick action buttons** in text messages (genius simple feature)
- Customer can approve/decline with one tap
- Automated follow-ups and status updates
- **2-3 day implementation** timeline

### ⚡ Speed & Simplicity
- **30-minute inspection** completion target
- Pre-filled templates for common vehicles
- Smart defaults and shortcuts
- **Simple deployment** to Render/Railway

### 💡 Customer Delight
- Real-time updates via SMS
- Photo sharing of issues found
- Clear, jargon-free explanations
- Transparent pricing before work begins

## ⏰ Timeline

### Month 1: Foundation & Mobile App
- ✅ Database setup and core API
- ✅ React Native app with voice implementation
- ✅ Basic inspection workflow
- ✅ User authentication and roles

### Month 2: Web Components & SMS
- ✅ Simple web reports served from Railway
- ✅ SMS integration with Telnyx
- ✅ Customer communication flow
- ✅ Photo upload and sharing

### Month 3: Polish & Launch
- ✅ End-to-end testing
- ✅ Performance optimization
- ✅ Production deployment
- ✅ Beta customer onboarding

## 💰 Cost Estimate

### Infrastructure
- **Database**: PostgreSQL managed service - $10-25/month
- **App hosting**: Render/Railway - $15-25/month
- **File storage**: Basic plan - $5-10/month

### SMS Communication
- **Telnyx SMS**: $0.004/message - $15-50/month (usage based)
- **Phone numbers**: $1-2/month per location

### Total Monthly Cost
**$25-55/month** depending on usage and scaling needs

## 🚫 What's NOT Included (Deferred to Phase 2)

### Advanced Features
- Partner revenue sharing system
- VIN decoder API integration (manual entry for MVP)
- Advanced analytics dashboards
- Multi-location management
- Custom branding per shop

### Enterprise Features
- Kubernetes deployment
- Advanced monitoring and alerting
- SSO integration
- API rate limiting
- Audit logs

### Business Features
- Inventory management
- Parts ordering integration
- Scheduling system
- Customer portal
- Reporting dashboards

## 📦 Tech Stack

### Mobile Application
- **Framework**: React Native with Expo
- **Voice**: Device native speech recognition
- **State**: Redux Toolkit or Zustand
- **Navigation**: React Navigation

### Web Application
- **Framework**: Next.js 13+ with App Router
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI or Headless UI
- **Authentication**: NextAuth.js

### Backend & Database
- **Database**: PostgreSQL (managed service)
- **API**: REST with OpenAPI documentation
- **File Storage**: Cloud storage service
- **Authentication**: JWT tokens

### Communication
- **SMS Provider**: Telnyx (customer communication)
- **Push Notifications**: Expo Push Notifications (mechanic app)
- **Email**: None needed - Stripe handles receipts

### Deployment & DevOps
- **Hosting**: Render or Railway
- **CI/CD**: GitHub Actions
- **Monitoring**: Basic logging and health checks
- **Backups**: Automated database backups

## 🎉 Success Metrics

### Technical Success
- ⚡ **30-minute inspections** (down from 60+ minutes)
- 📱 **95% uptime** for mobile app
- 💬 **2-second response** for SMS delivery
- 🎙️ **90% voice recognition** accuracy

### Business Success
- 👥 **10+ active mechanics** using the app daily
- 📈 **50+ inspections** completed per week
- 😊 **4.5+ star rating** from customers
- 💰 **Break-even** by month 6

## 🚀 Getting Started

1. **Review the specs** in this folder to understand the full scope
2. **Start with database setup** using the MVP schema
3. **Build mobile app foundation** with voice implementation
4. **Add SMS integration** for customer communication
5. **Deploy and test** with real mechanics and customers

---

*This MVP is designed to be buildable, scalable, and profitable. Focus on core value first, then expand based on real user feedback.*