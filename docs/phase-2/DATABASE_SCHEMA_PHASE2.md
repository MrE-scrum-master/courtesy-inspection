# DATABASE SCHEMA - PHASE 2 ENHANCEMENTS

**Advanced features for scale and enterprise readiness**

This document defines the Phase 2 database schema enhancements for the Courtesy Inspection platform, adding advanced features removed from the MVP for rapid initial deployment.

## Phase 2 Additions

**What was removed from MVP:**
- Partners and revenue sharing system
- Advanced subscription management with Stripe
- Comprehensive audit logs and change tracking
- Analytics events and business intelligence
- Advanced media management with AI analysis
- Inspection templates configuration system
- Recommendation engine with cost estimation
- Estimates and external PDF management
- Advanced user permissions and MFA
- Email communication (MVP has SMS only)
- Complex Row Level Security policies
- Performance optimization with partitioning
- Offline mobile sync with conflict resolution

---

## Advanced Tables (Phase 2)

### Partners and Revenue Sharing

```sql
-- Partners table - Revenue sharing partners
CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'reseller', 'affiliate', 'integration'
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    
    -- Revenue sharing
    commission_rate DECIMAL(5,4) DEFAULT 0.0000, -- e.g., 0.1500 for 15%
    payment_terms VARCHAR(50) DEFAULT 'net_30',
    
    -- Settings
    settings JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_partner_type CHECK (
        type IN ('reseller', 'affiliate', 'integration', 'oemtools')
    ),
    CONSTRAINT valid_commission_rate CHECK (
        commission_rate >= 0.0000 AND commission_rate <= 1.0000
    )
);

-- Shop-Partner relationships
CREATE TABLE shop_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    
    -- Relationship details
    referral_code VARCHAR(50),
    custom_commission_rate DECIMAL(5,4), -- Override default partner rate
    status VARCHAR(20) DEFAULT 'active',
    
    -- Tracking
    referred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(shop_id, partner_id)
);

-- Partner revenue tracking table
CREATE TABLE partner_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    
    -- Revenue details
    revenue_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    commission_rate DECIMAL(5,4) NOT NULL, -- Rate applied for this period
    
    -- Period information
    period_type VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'quarterly', 'annual'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'calculated',
    
    -- Payment tracking
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(255),
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_period_type CHECK (
        period_type IN ('monthly', 'quarterly', 'annual')
    ),
    CONSTRAINT valid_revenue_status CHECK (
        status IN ('calculated', 'pending_payment', 'paid', 'disputed')
    ),
    CONSTRAINT positive_amounts CHECK (
        revenue_amount >= 0 AND commission_amount >= 0
    ),
    CONSTRAINT valid_commission_rate CHECK (
        commission_rate >= 0.0000 AND commission_rate <= 1.0000
    )
);
```

### Advanced Subscription Management

```sql
-- Subscriptions table - Stripe integration
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Stripe details
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    
    -- Subscription details
    plan_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Billing
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    interval_type VARCHAR(20), -- 'month', 'year'
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    canceled_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_subscription_status CHECK (
        status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')
    )
);
```

### Inspection Templates System

```sql
-- Inspection templates - Vehicle-based templates
CREATE TABLE inspection_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Template identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Vehicle applicability
    applies_to_makes VARCHAR(50)[], -- Array of makes, empty = all
    applies_to_years INTEGER[], -- Array of years, empty = all
    vehicle_types VARCHAR(50)[], -- 'passenger', 'truck', 'motorcycle', etc.
    
    -- Template settings
    is_default BOOLEAN DEFAULT FALSE,
    estimated_duration_minutes INTEGER DEFAULT 20,
    
    -- Template metadata
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_template_status CHECK (
        status IN ('active', 'inactive', 'draft')
    )
);

-- Template categories (e.g., "Engine", "Brakes", "Electrical")
CREATE TABLE template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES inspection_templates(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    
    -- Category settings
    is_required BOOLEAN DEFAULT TRUE,
    color VARCHAR(7), -- Hex color code
    icon VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template items (e.g., "Engine Oil Level", "Brake Pad Thickness")
CREATE TABLE template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES template_categories(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    
    -- Item settings
    is_required BOOLEAN DEFAULT TRUE,
    measurement_type VARCHAR(50), -- 'visual', 'measurement', 'percentage', 'pass_fail'
    measurement_unit VARCHAR(20), -- 'mm', 'inches', '%', etc.
    measurement_range JSONB, -- {min: 0, max: 100} for valid ranges
    
    -- Default values
    default_severity VARCHAR(10) DEFAULT 'green',
    
    -- Recommendations
    yellow_threshold DECIMAL(10,3), -- When to show yellow
    red_threshold DECIMAL(10,3), -- When to show red
    auto_recommendation TEXT, -- Template for auto-generated recommendations
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_measurement_type CHECK (
        measurement_type IN ('visual', 'measurement', 'percentage', 'pass_fail', 'boolean')
    ),
    CONSTRAINT valid_default_severity CHECK (
        default_severity IN ('green', 'yellow', 'red')
    )
);
```

### Advanced Inspection Features

```sql
-- Inspection assignments table - Track assignment workflow
CREATE TABLE inspection_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Shop Manager
    assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Mechanic
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Assignment details
    status VARCHAR(50) NOT NULL DEFAULT 'assigned',
    priority VARCHAR(20) DEFAULT 'normal',
    due_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Timing
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_assignment_status CHECK (
        status IN ('assigned', 'accepted', 'in_progress', 'completed', 'cancelled', 'reassigned')
    ),
    CONSTRAINT valid_priority CHECK (
        priority IN ('low', 'normal', 'high', 'urgent')
    )
);

-- Enhanced findings table (replaces simple inspection_items)
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    template_item_id UUID REFERENCES template_items(id) ON DELETE SET NULL,
    
    -- Finding classification
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    component VARCHAR(200) NOT NULL,
    
    -- Severity assessment
    severity VARCHAR(10) NOT NULL DEFAULT 'green',
    
    -- Measurements
    measurement DECIMAL(10,3),
    unit VARCHAR(20),
    
    -- Finding details
    notes TEXT,
    technician_notes TEXT, -- Internal notes not shown to customer
    
    -- Location and context
    position JSONB, -- {x: 0.5, y: 0.3} for overlay positioning
    location VARCHAR(100), -- 'front_left', 'rear_right', etc.
    
    -- Workflow
    sort_order INTEGER DEFAULT 0,
    requires_follow_up BOOLEAN DEFAULT FALSE,
    
    -- AI/ML features
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00 for AI-detected findings
    ai_detected BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_severity CHECK (
        severity IN ('green', 'yellow', 'red')
    ),
    CONSTRAINT valid_confidence_score CHECK (
        confidence_score IS NULL OR (confidence_score >= 0.00 AND confidence_score <= 1.00)
    )
);

-- Recommendations table
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    
    -- Recommendation details
    priority VARCHAR(20) NOT NULL DEFAULT 'monitor',
    title VARCHAR(255),
    description TEXT NOT NULL,
    
    -- Cost estimation
    estimated_cost DECIMAL(10,2),
    labor_hours DECIMAL(5,2),
    parts JSONB NOT NULL DEFAULT '[]', -- Array of {name, part_number, quantity, price}
    
    -- Timing
    recommended_timeframe VARCHAR(50), -- 'immediate', 'within_month', 'next_service'
    mileage_interval INTEGER, -- Miles until next check
    
    -- Customer interaction
    approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Service advisor who got approval
    declined BOOLEAN DEFAULT FALSE,
    declined_at TIMESTAMP WITH TIME ZONE,
    decline_reason TEXT,
    
    -- Follow-up
    scheduled_service_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_priority CHECK (
        priority IN ('immediate', 'soon', 'eventual', 'monitor')
    ),
    CONSTRAINT valid_timeframe CHECK (
        recommended_timeframe IN ('immediate', 'within_week', 'within_month', 'next_service', 'annual')
    )
);
```

### Advanced Media Management

```sql
-- Media table - Photos and videos with AI analysis
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES findings(id) ON DELETE CASCADE,
    
    -- Media details
    type VARCHAR(20) NOT NULL,
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500),
    
    -- Storage
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    storage_provider VARCHAR(50) DEFAULT 's3',
    storage_key VARCHAR(500),
    
    -- File information
    file_size INTEGER, -- Bytes
    mime_type VARCHAR(100),
    
    -- Image/video metadata
    metadata JSONB NOT NULL DEFAULT '{}', -- width, height, duration, etc.
    
    -- AI analysis results
    ai_analysis JSONB, -- Object detection, damage assessment, etc.
    
    -- Status
    processing_status VARCHAR(20) DEFAULT 'completed',
    
    -- Audit fields
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_media_type CHECK (
        type IN ('photo', 'video', 'audio', 'document')
    ),
    CONSTRAINT valid_processing_status CHECK (
        processing_status IN ('pending', 'processing', 'completed', 'failed')
    ),
    CONSTRAINT media_belongs_to_inspection_or_finding CHECK (
        (inspection_id IS NOT NULL AND finding_id IS NULL) OR
        (inspection_id IS NULL AND finding_id IS NOT NULL) OR
        (inspection_id IS NOT NULL AND finding_id IS NOT NULL)
    )
);

-- Estimates table - External PDFs from shop management systems
CREATE TABLE estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Estimate details
    estimate_number VARCHAR(100),
    source_system VARCHAR(100), -- 'mitchell1', 'shopware', 'tekmetric', 'manual'
    
    -- Document storage
    pdf_url TEXT,
    pdf_storage_key VARCHAR(500),
    
    -- Parsed estimate data
    total_amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    line_items JSONB NOT NULL DEFAULT '[]', -- Array of line items
    
    -- Dates
    estimate_date DATE,
    expires_at DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_estimate_status CHECK (
        status IN ('draft', 'active', 'approved', 'declined', 'expired', 'invoiced')
    )
);
```

### Analytics and Audit System

```sql
-- Audit log table - Track all important changes
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What was changed
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    
    -- Who made the change
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Change details
    old_values JSONB,
    new_values JSONB,
    changed_fields VARCHAR(255)[], -- Array of field names that changed
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100), -- For tracing requests
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_action CHECK (
        action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')
    )
);

-- Analytics events table - Business intelligence
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event classification
    event_type VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    
    -- Context
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    inspection_id UUID REFERENCES inspections(id) ON DELETE SET NULL,
    
    -- Event data
    properties JSONB NOT NULL DEFAULT '{}',
    
    -- Session tracking
    session_id VARCHAR(100),
    
    -- Technical details
    ip_address INET,
    user_agent TEXT,
    platform VARCHAR(50), -- 'ios', 'android', 'web'
    app_version VARCHAR(20),
    
    -- Timing
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partitioning helper
    date_partition DATE GENERATED ALWAYS AS (DATE(occurred_at)) STORED
);
```

### Offline Mobile Sync

```sql
-- Sync queue for mobile offline support
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Device and user context
    device_id VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sync operation
    operation VARCHAR(20) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    
    -- Data
    data JSONB NOT NULL,
    
    -- Conflict resolution
    client_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    conflict_resolution VARCHAR(20) DEFAULT 'server_wins',
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_operation CHECK (
        operation IN ('CREATE', 'UPDATE', 'DELETE')
    ),
    CONSTRAINT valid_sync_status CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'conflict')
    ),
    CONSTRAINT valid_conflict_resolution CHECK (
        conflict_resolution IN ('client_wins', 'server_wins', 'manual')
    )
);
```

## Enhanced Indexes for Performance

```sql
-- Partner revenue indexes
CREATE INDEX CONCURRENTLY idx_partner_revenue_shop_id ON partner_revenue(shop_id, period_start);
CREATE INDEX CONCURRENTLY idx_partner_revenue_partner_id ON partner_revenue(partner_id, period_start);
CREATE INDEX CONCURRENTLY idx_partner_revenue_period ON partner_revenue(period_type, period_start, period_end);
CREATE INDEX CONCURRENTLY idx_partner_revenue_status ON partner_revenue(status, created_at);

-- Inspection assignments indexes
CREATE INDEX CONCURRENTLY idx_inspection_assignments_inspection_id ON inspection_assignments(inspection_id);
CREATE INDEX CONCURRENTLY idx_inspection_assignments_assigned_to ON inspection_assignments(assigned_to, status);
CREATE INDEX CONCURRENTLY idx_inspection_assignments_assigned_by ON inspection_assignments(assigned_by, created_at);
CREATE INDEX CONCURRENTLY idx_inspection_assignments_shop_id ON inspection_assignments(shop_id, status);

-- Enhanced findings indexes
CREATE INDEX CONCURRENTLY idx_findings_severity ON findings(inspection_id, severity);
CREATE INDEX CONCURRENTLY idx_findings_category ON findings(category, severity);
CREATE INDEX CONCURRENTLY idx_findings_ai_detected ON findings(ai_detected, confidence_score);

-- Recommendations indexes
CREATE INDEX CONCURRENTLY idx_recommendations_finding_id ON recommendations(finding_id);
CREATE INDEX CONCURRENTLY idx_recommendations_approved ON recommendations(approved, priority);

-- Media indexes
CREATE INDEX CONCURRENTLY idx_media_inspection_id ON media(inspection_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_media_finding_id ON media(finding_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_media_type ON media(type, uploaded_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_media_processing_status ON media(processing_status, uploaded_at);

-- Estimates indexes
CREATE INDEX CONCURRENTLY idx_estimates_vehicle_id ON estimates(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_estimates_shop_id ON estimates(shop_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_estimates_status ON estimates(status, estimate_date) WHERE deleted_at IS NULL;

-- Analytics and audit indexes
CREATE INDEX CONCURRENTLY idx_audit_logs_table_record ON audit_logs(table_name, record_id, created_at);
CREATE INDEX CONCURRENTLY idx_audit_logs_user_shop ON audit_logs(user_id, shop_id, created_at);
CREATE INDEX CONCURRENTLY idx_analytics_events_shop_type ON analytics_events(shop_id, event_type, occurred_at);
CREATE INDEX CONCURRENTLY idx_analytics_events_partition ON analytics_events(date_partition, event_type);

-- Sync queue indexes
CREATE INDEX CONCURRENTLY idx_sync_queue_device_status ON sync_queue(device_id, status, created_at);
CREATE INDEX CONCURRENTLY idx_sync_queue_processing ON sync_queue(status, created_at) WHERE status IN ('pending', 'failed');

-- JSONB indexes for flexible queries
CREATE INDEX CONCURRENTLY idx_shops_settings_gin ON shops USING GIN (settings) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_vehicles_specifications_gin ON vehicles USING GIN (specifications) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_inspections_metadata_gin ON inspections USING GIN (metadata) WHERE deleted_at IS NULL;

-- Full-text search indexes
CREATE INDEX CONCURRENTLY idx_customers_fulltext ON customers USING GIN (
    to_tsvector('english', COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(email, '') || ' ' || COALESCE(phone, ''))
) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_findings_fulltext ON findings USING GIN (
    to_tsvector('english', COALESCE(component, '') || ' ' || COALESCE(notes, ''))
);
```

## Table Partitioning for Scale

```sql
-- Partition analytics_events by date for performance
CREATE TABLE analytics_events_y2024m01 PARTITION OF analytics_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE analytics_events_y2024m02 PARTITION OF analytics_events
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Auto-create monthly partitions
DO $$
DECLARE
    start_date DATE := '2024-01-01';
    end_date DATE;
BEGIN
    FOR i IN 1..12 LOOP
        end_date := start_date + INTERVAL '1 month';
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS analytics_events_y%s PARTITION OF analytics_events
             FOR VALUES FROM (%L) TO (%L)',
            to_char(start_date, 'YYYY"m"MM'),
            start_date,
            end_date
        );
        start_date := end_date;
    END LOOP;
END $$;

-- Partition audit_logs by date
CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Enhanced Security Features

```sql
-- Add advanced user security fields to MVP users table
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN permissions JSONB NOT NULL DEFAULT '{}';

-- Add advanced shop features
ALTER TABLE shops ADD COLUMN website VARCHAR(255);
ALTER TABLE shops ADD COLUMN stripe_customer_id VARCHAR(255);
ALTER TABLE shops ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE shops ADD COLUMN branding JSONB NOT NULL DEFAULT '{}';
ALTER TABLE shops ADD COLUMN features JSONB NOT NULL DEFAULT '{}';

-- Add advanced customer features
ALTER TABLE customers ADD COLUMN preferences JSONB NOT NULL DEFAULT '{}';
ALTER TABLE customers ADD COLUMN portal_access_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE customers ADD COLUMN portal_password_hash VARCHAR(255);
ALTER TABLE customers ADD COLUMN portal_last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE customers ADD COLUMN marketing_opt_in BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN notes TEXT;
ALTER TABLE customers ADD COLUMN tags VARCHAR(255)[];

-- Add advanced vehicle features
ALTER TABLE vehicles ADD COLUMN trim VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN engine VARCHAR(100);
ALTER TABLE vehicles ADD COLUMN transmission VARCHAR(100);
ALTER TABLE vehicles ADD COLUMN drivetrain VARCHAR(20);
ALTER TABLE vehicles ADD COLUMN fuel_type VARCHAR(20);
ALTER TABLE vehicles ADD COLUMN specifications JSONB NOT NULL DEFAULT '{}';
ALTER TABLE vehicles ADD COLUMN photos JSONB NOT NULL DEFAULT '[]';
ALTER TABLE vehicles ADD COLUMN notes TEXT;

-- Add advanced inspection features
ALTER TABLE inspections ADD COLUMN template_id UUID REFERENCES inspection_templates(id) ON DELETE SET NULL;
ALTER TABLE inspections ADD COLUMN workflow_state VARCHAR(50) NOT NULL DEFAULT 'pending_assignment';
ALTER TABLE inspections ADD COLUMN service_request_details TEXT;
ALTER TABLE inspections ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inspections ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inspections ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inspections ADD COLUMN fuel_level VARCHAR(20);
ALTER TABLE inspections ADD COLUMN reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE inspections ADD COLUMN quality_score INTEGER;
ALTER TABLE inspections ADD COLUMN report_url VARCHAR(500);
ALTER TABLE inspections ADD COLUMN report_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inspections ADD COLUMN customer_viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inspections ADD COLUMN customer_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inspections ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';

-- Add email support to messages
ALTER TABLE messages ADD COLUMN email_address VARCHAR(255);
ALTER TABLE messages ADD COLUMN subject VARCHAR(500);
ALTER TABLE messages ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]';
ALTER TABLE messages ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN failed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN in_reply_to UUID REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN cost_cents INTEGER;
ALTER TABLE messages ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';

-- Update message type constraint
ALTER TABLE messages DROP CONSTRAINT valid_type;
ALTER TABLE messages ADD CONSTRAINT valid_type CHECK (
    type IN ('sms', 'email', 'push', 'whatsapp')
);

-- Add conversation participants
ALTER TABLE conversations ADD COLUMN participants JSONB NOT NULL DEFAULT '[]';
ALTER TABLE conversations ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
```

## Phase 2 Benefits

**Enterprise Readiness:**
- Complete audit trail for compliance
- Analytics and business intelligence
- Partner revenue sharing capabilities
- Advanced user management with MFA

**Operational Efficiency:**
- Inspection templates for consistency
- Recommendation engine with cost estimates
- Advanced media management with AI
- Offline mobile sync for field work

**Customer Experience:**
- Email communication in addition to SMS
- Customer portal access
- Detailed recommendations with approval workflow
- Professional estimates integration

**Performance and Scale:**
- Table partitioning for large datasets
- Comprehensive indexing strategy
- Conflict resolution for offline sync
- Advanced caching strategies