# Pragmatic Architecture for Courtesy Inspection MVP
## "Build for Success, Not for Scale" Strategy

### Core Philosophy
**Goal**: Ship in 6 weeks, break at 10,000 users (then we have money to fix it)

**Principles**:
- KISS: Every decision should be defensible to a 5-year-old
- DRY: Write it once, use it everywhere  
- YAGNI: If you're not using it this month, delete it
- SOLID: But only where it actually matters

---

## The Stack That Actually Ships

### 🗄️ Database: Supabase
**Why Supabase over Neon?**
- **Built-in Auth**: Stop writing auth code forever
- **Realtime**: WebSocket subscriptions built-in (for Phase 2)
- **Row Level Security**: Security without writing middleware
- **Storage**: File uploads included (inspection photos)
- **PostgREST**: Instant REST API from your schema
- **Free Tier**: 500MB database, 1GB storage, 50K auth users

```sql
-- Supabase handles auth, we just reference auth.users
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    subscription_tier TEXT DEFAULT 'starter',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy: Users can only see their shop
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shop" ON shops
    FOR SELECT USING (
        id IN (
            SELECT shop_id FROM users 
            WHERE auth_user_id = auth.uid()
        )
    );
```

### 🚂 Backend: Railway + Node.js
**Why Railway?**
- **One-click deploys**: Push to main, it's live
- **Built-in PostgreSQL**: But we'll use Supabase
- **Automatic HTTPS**: No cert management
- **Simple scaling**: Slider bar for more power
- **$5 credit**: Free to start

**Minimal API Structure**:
```javascript
// server.js - The entire backend in 200 lines
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const sms = twilio(process.env.TELNYX_KEY); // Telnyx has Twilio-compatible SDK

// Middleware - Verify Supabase JWT
app.use(async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    req.user = user;
    next();
});

// ONE endpoint that matters - Send SMS
app.post('/sms/send', async (req, res) => {
    const { to, message, inspectionId } = req.body;
    
    // Send via Telnyx
    const result = await sms.messages.create({
        to,
        from: process.env.TELNYX_PHONE,
        body: message
    });
    
    // Log to Supabase
    await supabase.from('sms_logs').insert({
        inspection_id: inspectionId,
        to,
        message,
        status: result.status
    });
    
    res.json({ success: true });
});

// Health check for Railway
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(process.env.PORT || 3000);
```

### 📱 Mobile: Expo + Supabase Client
**Why this combo works**:
- Expo handles voice, camera, push notifications
- Supabase client has auth, realtime, storage built-in
- One codebase for iOS/Android

```javascript
// App.js - Core inspection flow
import { createClient } from '@supabase/supabase-js';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login - Supabase handles everything
const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    // That's it. Seriously.
};

// Voice to inspection item
const addVoiceNote = async (inspectionId, audioText) => {
    const { data } = await supabase
        .from('inspection_items')
        .insert({
            inspection_id: inspectionId,
            notes: audioText,
            status: detectStatus(audioText), // "good" "warning" "urgent"
            created_by: supabase.auth.user().id
        });
};

// Upload photo directly to Supabase Storage
const uploadPhoto = async (inspectionId, photo) => {
    const fileName = `${inspectionId}/${Date.now()}.jpg`;
    const { data } = await supabase.storage
        .from('inspection-photos')
        .upload(fileName, photo);
    
    // URL is automatically generated
    return supabase.storage.from('inspection-photos').getPublicUrl(fileName);
};
```

### 🌐 Web Components: Served from Railway
**Why Railway for web components?**
- **Single platform**: Same as API, no additional complexity
- **Zero config**: HTML served from Express routes
- **Free tier**: More than enough for MVP
- **Built-in SSL**: Secure report links

```javascript
// pages/dashboard.js - Shop manager view
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export default function Dashboard() {
    const supabase = useSupabaseClient();
    
    // Real-time inspection updates
    useEffect(() => {
        const channel = supabase
            .channel('inspections')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'inspections',
                filter: `shop_id=eq.${shopId}`
            }, handleRealtimeUpdate)
            .subscribe();
            
        return () => supabase.removeChannel(channel);
    }, []);
    
    // That's your real-time dashboard with 10 lines
}
```

---

## What We're NOT Building (YAGNI)

### ❌ Skip These Completely
- **Microservices**: One monolith until 100K users
- **Message queues**: Supabase has async webhooks if needed
- **Redis caching**: PostgreSQL is fast enough for MVP
- **Docker/K8s**: Railway handles containers for you
- **Load balancers**: Railway does this automatically
- **Email service**: Stripe sends receipts
- **Payment processing**: Stripe Checkout (3 lines of code)
- **Monitoring**: Railway provides basic metrics
- **Log aggregation**: Console.log + Railway logs
- **CI/CD pipelines**: Push to main = deployed

### ⏰ Defer to Phase 2
- **Advanced auth**: Start with email/password
- **API rate limiting**: Supabase has built-in limits
- **Audit logs**: Supabase tracks changes already
- **Analytics**: Railway built-in logs are enough
- **A/B testing**: Ship first, optimize later
- **Internationalization**: English only for MVP
- **Offline sync**: Require internet for MVP

---

## The "Oh Shit We're Growing" Plan

### When you hit these triggers, it's time to scale:

**1. Database hits 80% capacity (400MB)**
- Upgrade Supabase plan ($25/month)
- Or move to Railway PostgreSQL

**2. SMS costs exceed $100/month**
- Negotiate Telnyx volume pricing
- Consider SMS batching

**3. Photo storage exceeds 1GB**
- Upgrade Supabase ($25/month)
- Or add Cloudinary (better image optimization)

**4. API response time >500ms**
- Add Railway replicas (one click)
- Consider caching layer (finally)

**5. More than 5 shops onboarded**
- Time to add proper monitoring
- Consider dedicated support tools

---

## Development Workflow

### Week 1-2: Foundation
```bash
# Setup everything in 1 hour
1. Create Supabase project (5 min)
2. Create Railway project (5 min)  
3. npx create-expo-app courtesy-inspection (5 min)
4. Copy the database schema to Supabase (10 min)
5. Deploy "hello world" to Railway (10 min)
6. Add web routes to Railway API (10 min)
7. Coffee break - you're ahead of schedule
```

### Week 3-4: Core Features
- Auth flow (Supabase handles it)
- Basic inspection CRUD
- Voice input (50 lines)
- Photo upload (Supabase Storage)

### Week 5-6: SMS Integration
- Telnyx setup
- Quick action buttons
- Basic templates

### Week 7-8: Polish
- Fix the bugs you found
- Add the features users screamed for
- Deploy and celebrate

---

## Cost Breakdown (Reality Check)

### Month 1-3 (Building)
- **Supabase**: $0 (free tier)
- **Railway**: $0 (free credit, handles both API and web)
- **Telnyx**: $20-50 (SMS)
- **Domain**: $12/year
**Total: ~$25-55/month**

### Month 4-6 (Early customers)
- **Supabase**: $0-25
- **Railway**: $0-5 (handles both API and web)
- **Telnyx**: $20-50 (SMS)
- **Stripe**: 2.9% + 30¢ per transaction
**Total: ~$25-55/month**

### Month 7+ (Growth)
- **Upgrade everything**: $200-500/month
- **But you have paying customers now!**

---

## The 10 Commandments of Pragmatic Development

1. **Thou shalt not optimize prematurely**
2. **Thou shalt use managed services**
3. **Thou shalt not write auth code**
4. **Thou shalt deploy daily**
5. **Thou shalt use boring technology**
6. **Thou shalt not build "for scale"**
7. **Thou shalt copy working patterns**
8. **Thou shalt delete unused code**
9. **Thou shalt measure before optimizing**
10. **Thou shalt ship before perfect**

---

## Migration Path (When Success Happens)

### From Supabase to "Enterprise"
```sql
-- Supabase -> Self-hosted PostgreSQL
pg_dump your_db > backup.sql
# Import to any PostgreSQL instance

-- Auth migration
# Export users via Supabase dashboard
# Import to Auth0/Cognito/Custom
```

### From Railway to AWS/GCP
```yaml
# Your app already runs in containers
# Railway -> ECS/Cloud Run is trivial
docker build -t your-app .
docker push
# Deploy anywhere
```

### The beauty: Nothing we build locks us in!

---

## TL;DR - Start Building Today

1. **Sign up for Supabase** (5 minutes)
2. **Sign up for Railway** (you have this)
3. **Clone this schema** (10 minutes)
4. **Start with mobile app** (Expo)
5. **Ship in 6 weeks**
6. **Fix scaling problems when you have money**

Remember: Instagram ran on 2 servers with 2 engineers when Facebook bought them for $1B. You don't need Kubernetes to start.

**Your job**: Ship something people want to pay for. Everything else is just details.