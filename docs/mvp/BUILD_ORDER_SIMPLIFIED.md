# Courtesy Inspection - Simplified Build Order (6 Weeks)

## Week 1: Foundation (Everything Working Day 1)

### Day 1: Setup All Services (2 hours)
```bash
# 1. Supabase (10 min)
- Create project at supabase.com
- Copy URL and anon key
- Enable auth

# 2. Railway (5 min)  
- Create new project
- Connect GitHub repo
- Add environment variables

# 3. Expo (10 min)
npx create-expo-app@latest courtesy-inspection --template
cd courtesy-inspection
npx expo install expo-speech expo-camera @supabase/supabase-js

# 4. Telnyx (10 min)
- Sign up, add $10 credit
- Get phone number
- Copy API key
```

### Day 2-3: Database Schema
```sql
-- Run this in Supabase SQL editor
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id),
  vehicle_info JSONB NOT NULL,
  customer_phone TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('green', 'yellow', 'red')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
```

### Day 4-5: Minimal API (Railway)
```javascript
// server.js - Entire backend
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Send SMS endpoint (the only custom endpoint we need)
app.post('/sms/send', async (req, res) => {
  const { to, message } = req.body;
  
  // Use Telnyx/Twilio SDK
  // Log to Supabase
  
  res.json({ sent: true });
});

app.listen(process.env.PORT || 3000);
```

**✅ End of Week 1**: Auth works, database ready, API deployed

---

## Week 2: Core Mobile App

### Day 1-2: Auth & Navigation
```javascript
// App.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login (5 lines)
const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email, password
  });
  if (data) navigate('InspectionList');
};
```

### Day 3-4: Inspection List
```javascript
// Simple list of inspections
const InspectionList = () => {
  const [inspections, setInspections] = useState([]);
  
  useEffect(() => {
    supabase
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setInspections(data));
  }, []);
  
  return (
    <FlatList
      data={inspections}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => navigate('Inspection', { id: item.id })}>
          <Text>{item.vehicle_info.make} {item.vehicle_info.model}</Text>
        </TouchableOpacity>
      )}
    />
  );
};
```

### Day 5: Create Inspection
```javascript
// One form, manual VIN entry
const CreateInspection = () => {
  const create = async () => {
    const { data } = await supabase
      .from('inspections')
      .insert({
        vehicle_info: { make, model, year, vin },
        customer_phone: phone,
        shop_id: user.shop_id
      })
      .select()
      .single();
    
    navigate('Inspection', { id: data.id });
  };
};
```

**✅ End of Week 2**: Can create and view inspections

---

## Week 3: Voice & Status

### Day 1-2: Voice Input
```javascript
// 50 lines of voice as promised
import * as Speech from 'expo-speech';

const VoiceInput = ({ onText }) => {
  const [recording, setRecording] = useState();
  
  const startRecording = async () => {
    const { recording } = await Audio.recordAsync();
    setRecording(recording);
  };
  
  const stopRecording = async () => {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    // Send to simple transcription service or use device voice-to-text
    onText(transcribedText);
  };
};
```

### Day 3-4: Status Buttons
```javascript
// Dead simple status selection
const StatusPicker = ({ itemId, currentStatus }) => {
  const updateStatus = async (status) => {
    await supabase
      .from('inspection_items')
      .update({ status })
      .eq('id', itemId);
  };
  
  return (
    <View style={{ flexDirection: 'row' }}>
      <Button title="✅" onPress={() => updateStatus('green')} />
      <Button title="⚠️" onPress={() => updateStatus('yellow')} />
      <Button title="❌" onPress={() => updateStatus('red')} />
    </View>
  );
};
```

### Day 5: Add Inspection Items
```javascript
// Add items to inspection
const addItem = async (inspectionId, name, notes, status) => {
  await supabase
    .from('inspection_items')
    .insert({
      inspection_id: inspectionId,
      name,
      notes,
      status
    });
};
```

**✅ End of Week 3**: Voice input works, items have status

---

## Week 4: Photos & Storage

### Day 1-3: Camera Integration
```javascript
import * as ImagePicker from 'expo-image-picker';

const PhotoCapture = ({ inspectionItemId }) => {
  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5, // Compress to save space
    });
    
    if (!result.canceled) {
      uploadPhoto(result.assets[0].uri);
    }
  };
  
  const uploadPhoto = async (uri) => {
    const fileName = `${inspectionItemId}/${Date.now()}.jpg`;
    
    // Upload directly to Supabase Storage
    const { data } = await supabase.storage
      .from('photos')
      .upload(fileName, {
        uri,
        type: 'image/jpeg',
      });
  };
};
```

### Day 4-5: Display Photos
```javascript
// Show photos for inspection item
const ItemPhotos = ({ itemId }) => {
  const [photos, setPhotos] = useState([]);
  
  useEffect(() => {
    const { data } = await supabase.storage
      .from('photos')
      .list(itemId);
    setPhotos(data);
  }, []);
  
  return photos.map(photo => (
    <Image source={{ uri: getPublicUrl(photo.name) }} />
  ));
};
```

**✅ End of Week 4**: Photos work, stored in Supabase

---

## Week 5: SMS Integration

### Day 1-2: Telnyx Setup
```javascript
// Backend: Add Telnyx
import telnyx from 'telnyx';

const sms = telnyx(process.env.TELNYX_API_KEY);

app.post('/sms/send', async (req, res) => {
  const { to, message, inspectionId } = req.body;
  
  try {
    await sms.messages.create({
      from: process.env.TELNYX_PHONE,
      to,
      text: message
    });
    
    // Log to database
    await supabase
      .from('sms_logs')
      .insert({ inspection_id: inspectionId, to, message });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Day 3-4: Send Inspection Complete
```javascript
// Mobile: Complete inspection and send SMS
const completeInspection = async (inspectionId) => {
  // Mark complete
  await supabase
    .from('inspections')
    .update({ completed_at: new Date() })
    .eq('id', inspectionId);
  
  // Get inspection data
  const { data: inspection } = await supabase
    .from('inspections')
    .select('*, inspection_items(*)')
    .eq('id', inspectionId)
    .single();
  
  // Send SMS
  const reportUrl = `https://yourapp.com/report/${inspectionId}`;
  await fetch(`${API_URL}/sms/send`, {
    method: 'POST',
    body: JSON.stringify({
      to: inspection.customer_phone,
      message: `Your ${inspection.vehicle_info.make} inspection is complete. View report: ${reportUrl}`,
      inspectionId
    })
  });
};
```

### Day 5: Basic Report Page
```html
<!-- Simple HTML report served from Railway API -->
<html>
  <body>
    <h1>Inspection Report</h1>
    <p>Vehicle: {{make}} {{model}} {{year}}</p>
    
    <h2>Items Inspected</h2>
    {{#each items}}
      <div class="item {{status}}">
        <h3>{{name}}</h3>
        <p>{{notes}}</p>
        <div class="photos">
          {{#each photos}}
            <img src="{{url}}" />
          {{/each}}
        </div>
      </div>
    {{/each}}
  </body>
</html>
```

**✅ End of Week 5**: SMS works, customers get reports

---

## Week 6: Polish & Deploy

### Day 1-2: Fix Critical Bugs
- Test full flow with real phone
- Fix any crashes
- Ensure photos upload reliably
- Test SMS delivery

### Day 3: Deploy
```bash
# Mobile
eas build --platform all
eas submit

# Backend (auto-deploys from git push)
git push main

# Report pages handled by Railway API
git push main
```

### Day 4-5: First Shop
1. Create shop in Supabase
2. Add shop user
3. Install app on their phone
4. Do test inspection
5. Monitor for issues

**✅ End of Week 6**: SHIPPED! 🎉

---

## What We Didn't Build (On Purpose)

❌ VIN decoder - Manual entry is fine  
❌ Payment processing - They can invoice separately  
❌ Customer accounts - They just get SMS  
❌ Service advisor dashboard - Use the same app  
❌ Complex workflows - Just "started" and "done"  
❌ Estimate builder - Text the price  
❌ Redis/queues - Not needed  
❌ Docker/K8s - Railway handles it  
❌ Microservices - One simple API  
❌ Real-time updates - Refresh to update  

## Success Metrics

Week 1: ✅ Everything deploys  
Week 2: ✅ Can create inspection  
Week 3: ✅ Voice input works  
Week 4: ✅ Photos upload  
Week 5: ✅ SMS sends  
Week 6: ✅ First shop using it  

## Total Cost for 6 Weeks

- Supabase: $0
- Railway: $0 (credits)
- Telnyx: $10
- Domain: $12
- **Total: $22**

## Remember

You're not building the perfect inspection app.
You're building the simplest inspection app that shops will pay for.

Ship in 6 weeks. Improve based on what customers actually want.