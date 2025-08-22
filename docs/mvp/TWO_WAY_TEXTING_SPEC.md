# Two-Way SMS for Courtesy Inspection - MVP SPEC
## Dead Simple, Smart Features, 2-3 Day Build

**Core Philosophy**: This isn't a chat app. This is a business tool that makes Service Advisors look professional with zero effort.

---

## THIS IS SIMPLE!

**NO WebSockets** → 5-second polling  
**NO real-time sync** → Simple HTTP requests  
**NO typing indicators** → Just messages  
**NO MMS/images** → Text only for MVP  
**NO template engine** → Hardcoded quick actions  

**YES to smart, zero-effort features** → Quick action buttons that provide huge value

---

## Quick Action Buttons (The Magic)

These 5 buttons handle 90% of customer communication with zero effort:

```typescript
const QUICK_ACTIONS = {
  'inspection_report': {
    label: 'Send Inspection Report',
    message: (customerName, reportUrl) => 
      `Hi ${customerName}! Your vehicle inspection is complete. View your detailed report: ${reportUrl}`
  },
  'request_approval': {
    label: 'Request Approval', 
    message: (customerName, estimateUrl) =>
      `Hi ${customerName}! Your estimate is ready for review. Please approve or decline: ${estimateUrl}`
  },
  'inspection_ready': {
    label: 'Inspection Ready',
    message: (customerName) =>
      `Hi ${customerName}! Your vehicle inspection is complete and ready for pickup. Thank you!`
  },
  'thank_you': {
    label: 'Thank You',
    message: (customerName) =>
      `Thank you ${customerName}! We appreciate your business. Drive safely!`
  },
  'schedule_service': {
    label: 'Schedule Service',
    message: (customerName, bookingUrl) =>
      `Hi ${customerName}! Ready to schedule your recommended service? Book online: ${bookingUrl}`
  }
};
```

**That's it.** These 5 buttons handle the majority of customer communication with zero typing.

---

## Simple Database Schema

Just two tables:

```sql
-- Conversations (customer-level, persistent)
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  shop_id UUID NOT NULL,
  last_message_at TIMESTAMP,
  unread_count INTEGER DEFAULT 0
);

-- Messages (the actual texts)
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'in' or 'out'
  content TEXT NOT NULL,
  sent_by UUID, -- NULL for incoming
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent' -- sent, delivered, failed
);
```

**No complex templates table. No approval workflows. No analytics. Just conversations and messages.**

---

## Simple API Endpoints

```typescript
// Get conversations for a shop
GET /api/conversations?shop_id=123

// Get messages for a conversation  
GET /api/conversations/:id/messages

// Send a message
POST /api/conversations/:id/messages
{
  "content": "Hi John! Your inspection is complete...",
  "quick_action": "inspection_report", // optional, for tracking
  "sent_by": "user_id"
}

// Mark messages as read
PUT /api/conversations/:id/read
```

**That's literally it. Four endpoints.**

---

## 5-Second Polling (Not WebSockets)

```typescript
// Simple polling - works everywhere, no connection issues
function startPolling(shopId) {
  setInterval(async () => {
    const response = await fetch(`/api/conversations?shop_id=${shopId}&since=${lastCheck}`);
    const { conversations } = await response.json();
    
    if (conversations.length > 0) {
      updateUI(conversations);
      lastCheck = new Date().toISOString();
    }
  }, 5000); // Every 5 seconds
}
```

**No WebSocket complexity. No connection drops. No reconnection logic. Just simple HTTP every 5 seconds.**

---

## Minimal UI Components

### Conversation List (50 lines)
```typescript
function ConversationList({ shopId }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="conversation-list">
      {conversations.map(conv => (
        <div 
          key={conv.id}
          className={`conversation-item ${selectedId === conv.id ? 'selected' : ''}`}
          onClick={() => setSelectedId(conv.id)}
        >
          <div className="customer-name">{conv.customer.name}</div>
          <div className="last-message">{conv.lastMessage?.content}</div>
          <div className="timestamp">{formatTime(conv.lastMessageAt)}</div>
          {conv.unreadCount > 0 && (
            <div className="unread-badge">{conv.unreadCount}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Message Thread (50 lines)
```typescript
function MessageThread({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const sendMessage = async (content) => {
    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, sent_by: currentUser.id })
    });
    
    setNewMessage('');
    // Polling will pick up the sent message
  };

  return (
    <div className="message-thread">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.direction}`}>
            <div className="content">{msg.content}</div>
            <div className="time">{formatTime(msg.createdAt)}</div>
          </div>
        ))}
      </div>
      
      <QuickActions onSend={sendMessage} customerId={conversation.customerId} />
      
      <div className="message-input">
        <input 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          onKeyPress={(e) => e.key === 'Enter' && sendMessage(newMessage)}
        />
        <button onClick={() => sendMessage(newMessage)}>Send</button>
      </div>
    </div>
  );
}
```

### Quick Actions (25 lines)
```typescript
function QuickActions({ onSend, customerId }) {
  const customer = useCustomer(customerId);
  
  const handleQuickAction = (actionKey) => {
    const action = QUICK_ACTIONS[actionKey];
    const message = action.message(customer.firstName, getRelevantUrl(actionKey, customerId));
    onSend(message);
  };

  return (
    <div className="quick-actions">
      {Object.entries(QUICK_ACTIONS).map(([key, action]) => (
        <button 
          key={key}
          onClick={() => handleQuickAction(key)}
          className="quick-action-btn"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
```

**Total UI code: ~125 lines. That's it.**

---

## Telnyx Integration (Simple)

### Send Message
```typescript
async function sendSMS(toNumber, content) {
  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: toNumber,
      from: process.env.TELNYX_PHONE_NUMBER,
      text: content
    })
  });
  
  return response.json();
}
```

### Receive Webhook (Simple)
```typescript
app.post('/webhooks/telnyx', async (req, res) => {
  const { data } = req.body;
  
  if (data.event_type === 'message.received') {
    const { payload } = data;
    
    // Find customer by phone
    const customer = await findCustomerByPhone(payload.from.phone_number);
    if (!customer) return res.json({ received: true });
    
    // Get/create conversation
    const conversation = await getOrCreateConversation(customer.id);
    
    // Save message
    await saveMessage({
      conversationId: conversation.id,
      direction: 'in',
      content: payload.text,
      createdAt: new Date(payload.received_at)
    });
    
    // Increment unread count
    await incrementUnreadCount(conversation.id);
  }
  
  res.json({ received: true });
});
```

**Total Telnyx integration: ~30 lines.**

---

## Shared Code (Web + Mobile)

Same components work everywhere with minor styling changes:

```typescript
// shared/components/ConversationList.js - works in React and React Native
// shared/components/MessageThread.js - works in React and React Native  
// shared/components/QuickActions.js - works in React and React Native
// shared/api/conversations.js - same API calls everywhere
// shared/utils/polling.js - same polling logic everywhere
```

**One codebase, two platforms. No duplication.**

---

## Mobile Differences (Minimal)

```typescript
// Mobile: Use React Native components
import { View, Text, TouchableOpacity, TextInput, FlatList } from 'react-native';

// Web: Use HTML elements  
import { div as View, span as Text, button as TouchableOpacity, input as TextInput } from 'react';

// Same logic, different imports. That's it.
```

---

## What's NOT in MVP

- ❌ WebSockets / real-time updates
- ❌ Typing indicators
- ❌ Read receipts  
- ❌ Message templates with variables
- ❌ MMS/image support
- ❌ Voice messages
- ❌ Message approval workflow
- ❌ Analytics dashboard
- ❌ Auto-responses
- ❌ Message scheduling
- ❌ Bulk messaging
- ❌ Complex permissions

**We'll add these later if needed. MVP focuses on core value.**

---

## Implementation Plan (2-3 Days)

### Day 1: Backend Core
- [ ] Database tables (30 min)
- [ ] Four API endpoints (2 hours)
- [ ] Telnyx webhook handler (1 hour)  
- [ ] Basic auth middleware (30 min)
- [ ] Deploy and test (1 hour)

### Day 2: Web UI
- [ ] ConversationList component (1 hour)
- [ ] MessageThread component (1 hour)
- [ ] QuickActions component (30 min)
- [ ] Simple polling logic (30 min)
- [ ] Basic CSS styling (2 hours)
- [ ] Integration testing (1 hour)

### Day 3: Mobile + Polish
- [ ] React Native versions of components (2 hours)
- [ ] Mobile-specific styling (1 hour)
- [ ] Cross-platform testing (1 hour)
- [ ] Bug fixes and polish (2 hours)
- [ ] Production deployment (1 hour)

**Total: 16 hours of actual development time.**

---

## Why This Works

### 1. Quick Actions Provide Huge Value
- Service Advisor clicks "Send Inspection Report" 
- Customer instantly gets professional message with link
- Zero typing, zero mistakes, looks professional

### 2. Polling Is Actually Better for MVP
- No WebSocket connection issues
- Works on every device/network
- Simpler error handling
- 5-second delay is imperceptible for business texting

### 3. Minimal UI, Maximum Value
- Customers see the same conversation across iPad/web
- Service Advisors can text from anywhere
- Simple = fewer bugs = faster shipping

### 4. Hardcoded Smart Features
- No template engine complexity
- No user configuration needed  
- Buttons work instantly
- Easy to modify/add new ones

---

## Example User Flow

1. **Customer texts**: "Is my car ready?"

2. **Service Advisor sees notification** (from 5-second polling)

3. **Service Advisor clicks "Inspection Ready"** (zero typing)

4. **Customer receives**: "Hi John! Your vehicle inspection is complete and ready for pickup. Thank you!"

5. **Customer texts back**: "Great, I'll be right there"

6. **Service Advisor clicks "Thank You"** (zero typing)

7. **Customer receives**: "Thank you John! We appreciate your business. Drive safely!"

**Total effort for Service Advisor: 2 clicks. Total time: 10 seconds. Customer experience: Professional and responsive.**

---

## Smart URL Generation

```typescript
function getRelevantUrl(actionKey, customerId) {
  switch (actionKey) {
    case 'inspection_report':
      const latestInspection = getLatestInspection(customerId);
      return `${BASE_URL}/inspection/${latestInspection.id}`;
      
    case 'request_approval':
      const latestEstimate = getLatestEstimate(customerId);
      return `${BASE_URL}/estimate/${latestEstimate.id}`;
      
    case 'schedule_service':
      return `${BASE_URL}/booking?customer=${customerId}`;
      
    default:
      return null;
  }
}
```

**Smart without being complex. Uses existing data to generate relevant links.**

---

## File Structure (Simple)

```
src/
  components/
    ConversationList.js    (50 lines)
    MessageThread.js       (50 lines)  
    QuickActions.js        (25 lines)
  api/
    conversations.js       (100 lines)
    telnyx.js             (50 lines)
  utils/
    polling.js            (25 lines)
    constants.js          (25 lines)
```

**Total: ~325 lines of code for the entire feature.**

---

## Success Metrics

### Week 1 Targets
- 5+ shops using daily
- 100+ messages sent via quick actions
- <1 second average response time
- Zero critical bugs

### Month 1 Targets  
- 80% of messages sent via quick actions (not typing)
- 50% customer response rate
- 99%+ message delivery rate
- 95% user satisfaction

---

## This Spec Guarantees Success Because:

✅ **Simple enough to build in 2-3 days**  
✅ **Smart features provide immediate value**  
✅ **No complex dependencies or integrations**  
✅ **Works reliably on all devices**  
✅ **Easy to maintain and extend**  
✅ **Customers see professional communication**  
✅ **Service Advisors save massive time**

**Ship fast, provide value, iterate based on real usage.**