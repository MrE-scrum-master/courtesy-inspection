# Ultra-Lean MVP: What We're ACTUALLY Building

## The 80/20 Rule Applied Ruthlessly

### What Stays (Core Value)
✅ **Voice-driven inspections** - The killer feature  
✅ **SMS to customers** - Simple, universal  
✅ **Photo capture** - Evidence builds trust  
✅ **Green/Yellow/Red status** - Dead simple  
✅ **Inspection reports** - Basic PDF/link  

### What Goes (YAGNI)

#### ❌ Remove These "MVP" Features:
1. **VIN Scanner/Decoder** → Manual entry (VIN APIs cost $$$)
2. **Payment Processing** → Send invoice, they pay however 
3. **Customer Portal** → Just SMS links to reports
4. **Service History** → That's Phase 2
5. **Estimate Generation** → Text the price
6. **Shop Management Integration** → Copy/paste for now
7. **Workflow States** → Just "Started" and "Done"
8. **Service Advisor Dashboard** → They use the same mobile app
9. **Redis Caching** → PostgreSQL is fast enough
10. **API Gateway** → One simple Express server
11. **Queue System (RabbitMQ)** → Not needed
12. **Docker/Kubernetes** → Railway handles containers
13. **CloudFront CDN** → Supabase Storage is fast enough
14. **Multiple inspection stages** → One continuous flow
15. **Automated notifications** → Manual SMS when done

### The REAL MVP Architecture

```
Mechanic App (Expo)
    ↓
Supabase (Everything)
    ↓
SMS to Customer (Telnyx)
```

That's it. Three boxes.

## Simplified Inspection Flow

### OLD: 7-Stage Process ❌
Too complex, too many handoffs

### NEW: One Continuous Flow ✅
```javascript
// Entire inspection model
const inspection = {
  id: uuid(),
  vehicleInfo: {
    make: 'Toyota',
    model: 'Camry', 
    year: '2020',
    vin: '1234...' // Manual entry
  },
  items: [
    {
      name: 'Front Brakes',
      status: 'yellow', // green/yellow/red
      notes: 'Wearing down, 30% life left',
      photos: ['url1', 'url2']
    }
  ],
  createdBy: userId,
  shopId: shopId,
  customerPhone: '+1234567890',
  completedAt: null
}
```

## User Roles Simplified

### OLD: Complex Permission System ❌
- SUPER_ADMIN
- SHOP_MANAGER  
- MECHANIC
- SERVICE_ADVISOR
- CUSTOMER

### NEW: Two Roles ✅
1. **Shop User** - Can do everything in their shop
2. **Customer** - Receives SMS (not even a user!)

```javascript
// Entire auth system
const user = {
  id: supabase.auth.user().id,
  email: 'mike@shop.com',
  shopId: 'shop_123',
  role: 'shop_user' // That's it
}
```

## Data Model: 5 Tables Total

```sql
-- 1. Shops (from Supabase auth)
shops (
  id, name, phone, created_at
)

-- 2. Users (extends Supabase auth.users)
users (
  id, auth_user_id, shop_id, name
)

-- 3. Inspections
inspections (
  id, shop_id, vehicle_info, customer_phone, 
  created_by, created_at, completed_at
)

-- 4. Inspection Items  
inspection_items (
  id, inspection_id, name, status, notes, created_at
)

-- 5. Photos (Supabase Storage handles files)
photos (
  id, inspection_item_id, url, created_at
)
```

## Features By Week (6 Weeks Total)

### Week 1: Foundation
- Supabase project setup
- Basic Expo app that logs in
- Railway "hello world"

### Week 2: Core Inspection
- Create inspection
- Add items with status
- Voice-to-text notes

### Week 3: Photos
- Camera integration
- Upload to Supabase Storage
- Attach to inspection items

### Week 4: SMS
- Telnyx setup
- Send inspection complete SMS
- Include link to report

### Week 5: Report Generation
- Simple HTML report
- Hosted on Supabase
- Shareable link

### Week 6: Polish
- Fix what's broken
- Deploy to app stores
- First customer!

## Cost Reality Check

### True MVP Costs (Month 1-3)
- **Supabase**: $0 (free tier)
- **Railway**: $0 (free credits)
- **Telnyx**: $10 (testing)
- **Domain**: $12/year ($1/month)
- **Apple Developer**: $99/year ($8/month)
- **Google Play**: $25 one-time
**Total: ~$20/month**

### When You Need to Pay (Good Problems)
- **>50 inspections/day**: Upgrade Supabase ($25/mo)
- **>100 SMS/day**: Telnyx volume pricing
- **>1GB photos**: Supabase Pro ($25/mo)
- **>10 shops**: Add monitoring/support tools

## The Beautiful Simplicity

### What We're NOT Building:
- No complex workflows
- No payment processing  
- No customer accounts
- No service advisor special interface
- No Redis/RabbitMQ/CDN
- No Docker/K8s
- No API Gateway
- No microservices
- No VIN decoder
- No estimate builder

### What We ARE Building:
1. **Mechanic opens app** → Logs in with email (Supabase)
2. **Starts inspection** → Voice notes + photos
3. **Marks items** → Green/Yellow/Red
4. **Completes inspection** → Tap done
5. **Customer gets SMS** → "Your inspection is ready: [link]"
6. **Shop calls customer** → Discusses needed repairs

## Success Metrics (Simplified)

### Technical
- App doesn't crash ✓
- Photos upload ✓
- SMS sends ✓
- Report link works ✓

### Business  
- 5 shops using it
- 50 inspections/week
- Customers respond to SMS
- Shops want to pay for it

## Migration Path (When Needed)

When you hit these milestones, add complexity:

1. **10 shops** → Add payment processing (Stripe)
2. **100 inspections/day** → Add caching layer
3. **$10K MRR** → Add customer portal
4. **$25K MRR** → Add VIN decoder
5. **$50K MRR** → Add integrations

## The One-Page Deployment Guide

```bash
# 1. Setup (30 minutes)
- Create Supabase project
- Create Railway project  
- Create Expo app
- Buy domain

# 2. Deploy (10 minutes)
git push main  # Railway auto-deploys API and web routes
eas build     # Expo builds app

# 3. Configure (20 minutes)
- Add env vars to Railway
- Setup Telnyx number
- Configure Supabase auth

# Done. You're live.
```

## Remember

Instagram: 2 engineers, 13 employees, sold for $1B
WhatsApp: 35 engineers, 55 employees, sold for $19B

You don't need complexity. You need customers.

**Ship this in 6 weeks. Fix problems when you have revenue.**