# DATABASE SCHEMA - MVP VERSION

**Simplified for 6-week implementation**

This document defines the **minimal viable** database schema for the Courtesy Inspection platform MVP, focusing on 8 core tables necessary for basic functionality. Advanced features like analytics, audit logs, and partner revenue tracking have been moved to Phase 2.

## MVP Core Features
- **Multi-tenant**: Basic shop isolation with simple RLS
- **User Management**: Shop Manager → Mechanic workflow 
- **Vehicle Inspections**: Core inspection workflow
- **Customer Messaging**: Two-way SMS communication
- **Basic Media**: Photo uploads for inspections

---

## Core MVP Tables (8 Total)

### 1. shops - Multi-tenant root entity
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_crypto";

CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address JSONB NOT NULL DEFAULT '{}',
    phone VARCHAR(20),
    email VARCHAR(255),
    
    -- Basic subscription (simplified)
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'starter',
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Basic settings
    settings JSONB NOT NULL DEFAULT '{}', -- timezone, units, etc.
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_subscription_tier CHECK (
        subscription_tier IN ('starter', 'professional', 'business')
    ),
    CONSTRAINT valid_subscription_status CHECK (
        subscription_status IN ('active', 'inactive')
    )
);
```

### 2. users - Shop employees
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'mechanic',
    
    -- Profile information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_role CHECK (
        role IN ('shop_manager', 'mechanic')
    ),
    CONSTRAINT valid_status CHECK (
        status IN ('active', 'inactive')
    )
);
```

### 3. customers - Shop customers
```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Personal information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    
    -- Address information
    address JSONB NOT NULL DEFAULT '{}',
    
    -- Communication preferences
    sms_opt_in BOOLEAN DEFAULT TRUE,
    email_opt_in BOOLEAN DEFAULT TRUE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_customer_status CHECK (
        status IN ('active', 'inactive')
    )
);
```

### 4. vehicles - Customer vehicles
```sql
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Vehicle identification
    vin VARCHAR(17),
    make VARCHAR(50),
    model VARCHAR(50),
    year INTEGER,
    
    -- Vehicle details
    mileage INTEGER,
    license_plate VARCHAR(20),
    color VARCHAR(50),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_year CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM NOW()) + 2),
    CONSTRAINT valid_vehicle_status CHECK (
        status IN ('active', 'inactive')
    )
);
```

### 5. inspections - Core inspection workflow
```sql
CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Inspection workflow state
    status VARCHAR(50) NOT NULL DEFAULT 'created',
    
    -- Customer information
    customer_concerns JSONB NOT NULL DEFAULT '[]',
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Inspection details
    odometer_reading INTEGER,
    
    -- Notes
    internal_notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_inspection_status CHECK (
        status IN ('created', 'assigned', 'in_progress', 'completed', 'sent')
    )
);
```

### 6. inspection_items - Individual inspection findings
```sql
CREATE TABLE inspection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    
    -- Finding classification
    category VARCHAR(100) NOT NULL,
    component VARCHAR(200) NOT NULL,
    
    -- Severity assessment
    severity VARCHAR(10) NOT NULL DEFAULT 'green',
    
    -- Finding details
    notes TEXT,
    
    -- Workflow
    sort_order INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_severity CHECK (
        severity IN ('green', 'yellow', 'red')
    )
);
```

### 7. conversations - Customer communication threads
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Conversation details
    subject VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Timing
    last_message_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_conversation_status CHECK (
        status IN ('active', 'closed')
    )
);
```

### 8. messages - Two-way SMS communication
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Message details
    direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
    type VARCHAR(20) NOT NULL DEFAULT 'sms',
    
    -- Contact information
    phone_number VARCHAR(20), -- For SMS
    
    -- Message content
    content TEXT NOT NULL,
    
    -- Provider details
    provider VARCHAR(50), -- 'twilio'
    provider_message_id VARCHAR(255),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending',
    
    -- Timing
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_direction CHECK (
        direction IN ('inbound', 'outbound')
    ),
    CONSTRAINT valid_type CHECK (
        type IN ('sms')
    ),
    CONSTRAINT valid_status CHECK (
        status IN ('pending', 'sent', 'delivered', 'failed')
    )
);
```

## Essential Indexes (MVP)

```sql
-- Core performance indexes only
CREATE INDEX idx_users_shop_id ON users(shop_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

CREATE INDEX idx_customers_shop_id ON customers(shop_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_phone ON customers(phone) WHERE deleted_at IS NULL;

CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_inspections_vehicle_id ON inspections(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inspections_shop_id ON inspections(shop_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inspections_assigned_to ON inspections(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_inspections_status ON inspections(status, shop_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_inspection_items_inspection_id ON inspection_items(inspection_id);

CREATE INDEX idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX idx_conversations_shop_id ON conversations(shop_id);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_customer_id ON messages(customer_id);
```

## Basic Row Level Security (RLS)

```sql
-- Enable RLS on all shop-isolated tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Basic shop isolation policy
CREATE POLICY shop_isolation_users ON users
    FOR ALL USING (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY shop_isolation_customers ON customers
    FOR ALL USING (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY shop_isolation_inspections ON inspections
    FOR ALL USING (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY shop_isolation_conversations ON conversations
    FOR ALL USING (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY shop_isolation_messages ON messages
    FOR ALL USING (shop_id = current_setting('app.current_shop_id')::UUID);
```

## MVP Limitations

**Removed from MVP (moved to Phase 2):**
- Partners and revenue sharing tables
- Subscription management (subscriptions table)
- Audit logs and change tracking
- Analytics events and business intelligence
- Advanced media management
- Inspection templates system
- Recommendation engine
- Estimates and external PDF management
- Advanced user permissions and MFA
- Email communication (SMS only)
- Complex RLS policies
- Performance optimization indexes
- Table partitioning
- Sync queue for offline support

**MVP Trade-offs:**
- Hardcoded inspection categories instead of templates
- Basic shop isolation instead of complex RLS
- SMS-only messaging (no email)
- No audit trail
- No analytics or reporting
- Simple user roles (no granular permissions)
- No offline mobile sync

This MVP schema supports the core inspection workflow while keeping complexity minimal for rapid development and deployment.