-- Wave 4: Communication and Short Link Tables
-- Migration 004: Advanced communication features

-- Short links table for SMS URL shortening
CREATE TABLE short_links (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(10) UNIQUE NOT NULL,
    long_url TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    click_count INTEGER DEFAULT 0,
    last_clicked_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    
    INDEX idx_short_links_code (short_code),
    INDEX idx_short_links_expires (expires_at),
    INDEX idx_short_links_created_by (created_by)
);

-- Link clicks tracking
CREATE TABLE link_clicks (
    id SERIAL PRIMARY KEY,
    short_link_id INTEGER REFERENCES short_links(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    referrer TEXT,
    
    INDEX idx_link_clicks_short_link (short_link_id),
    INDEX idx_link_clicks_clicked_at (clicked_at)
);

-- SMS messages tracking
CREATE TABLE sms_messages (
    id SERIAL PRIMARY KEY,
    telnyx_message_id VARCHAR(100) UNIQUE,
    to_phone VARCHAR(20) NOT NULL,
    from_phone VARCHAR(20) NOT NULL,
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'outbound', -- outbound, inbound
    status VARCHAR(30) DEFAULT 'pending', -- pending, sent, delivered, failed, received
    shop_id INTEGER REFERENCES shops(id),
    customer_id INTEGER REFERENCES customers(id),
    inspection_id INTEGER REFERENCES inspections(id),
    cost_cents INTEGER DEFAULT 0,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    webhook_data JSONB DEFAULT '{}',
    
    INDEX idx_sms_messages_telnyx_id (telnyx_message_id),
    INDEX idx_sms_messages_to_phone (to_phone),
    INDEX idx_sms_messages_shop (shop_id),
    INDEX idx_sms_messages_customer (customer_id),
    INDEX idx_sms_messages_inspection (inspection_id),
    INDEX idx_sms_messages_sent_at (sent_at),
    INDEX idx_sms_messages_status (status)
);

-- Communication log for unified tracking
CREATE TABLE communications (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    inspection_id INTEGER REFERENCES inspections(id),
    user_id INTEGER REFERENCES users(id), -- who initiated
    communication_type VARCHAR(20) NOT NULL, -- sms, email, phone, in_person
    direction VARCHAR(10) DEFAULT 'outbound', -- outbound, inbound
    subject VARCHAR(200),
    content TEXT,
    status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, failed, read
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    metadata JSONB DEFAULT '{}', -- template vars, costs, etc
    
    INDEX idx_communications_shop (shop_id),
    INDEX idx_communications_customer (customer_id),
    INDEX idx_communications_inspection (inspection_id),
    INDEX idx_communications_user (user_id),
    INDEX idx_communications_type (communication_type),
    INDEX idx_communications_sent_at (sent_at)
);

-- Approval workflows
CREATE TABLE approval_workflows (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER REFERENCES inspections(id) NOT NULL,
    submitted_by INTEGER REFERENCES users(id) NOT NULL, -- mechanic
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, changes_requested
    assigned_to INTEGER REFERENCES users(id), -- manager
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    manager_comments TEXT,
    escalated_at TIMESTAMP,
    escalated_to INTEGER REFERENCES users(id), -- owner/senior manager
    priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, urgent
    
    INDEX idx_approval_workflows_inspection (inspection_id),
    INDEX idx_approval_workflows_submitted_by (submitted_by),
    INDEX idx_approval_workflows_assigned_to (assigned_to),
    INDEX idx_approval_workflows_status (status),
    INDEX idx_approval_workflows_submitted_at (submitted_at)
);

-- Approval workflow history
CREATE TABLE approval_history (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES approval_workflows(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    action VARCHAR(30) NOT NULL, -- submitted, approved, rejected, commented, escalated
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    
    INDEX idx_approval_history_workflow (workflow_id),
    INDEX idx_approval_history_user (user_id),
    INDEX idx_approval_history_action (action),
    INDEX idx_approval_history_created_at (created_at)
);

-- SMS templates for consistent messaging
CREATE TABLE sms_templates (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id),
    template_key VARCHAR(50) NOT NULL, -- inspection_ready, approval_needed, etc
    template_name VARCHAR(100) NOT NULL,
    message_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- [{"name": "customer_name", "required": true}]
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(shop_id, template_key),
    INDEX idx_sms_templates_shop (shop_id),
    INDEX idx_sms_templates_key (template_key)
);

-- Cost tracking per shop
CREATE TABLE shop_costs (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) NOT NULL,
    cost_type VARCHAR(20) NOT NULL, -- sms, report_generation, storage
    cost_cents INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_cost_cents INTEGER NOT NULL,
    description TEXT,
    billing_date DATE DEFAULT CURRENT_DATE,
    metadata JSONB DEFAULT '{}',
    
    INDEX idx_shop_costs_shop (shop_id),
    INDEX idx_shop_costs_type (cost_type),
    INDEX idx_shop_costs_billing_date (billing_date)
);

-- Customer communication preferences
CREATE TABLE customer_preferences (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) UNIQUE NOT NULL,
    sms_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    preferred_time_start TIME DEFAULT '09:00:00',
    preferred_time_end TIME DEFAULT '17:00:00',
    timezone VARCHAR(50) DEFAULT 'America/Chicago',
    language VARCHAR(5) DEFAULT 'en',
    opt_out_date TIMESTAMP,
    opt_out_reason TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_customer_preferences_customer (customer_id),
    INDEX idx_customer_preferences_sms_enabled (sms_enabled)
);

-- Insert default SMS templates
INSERT INTO sms_templates (shop_id, template_key, template_name, message_text, variables) VALUES
(NULL, 'inspection_ready', 'Inspection Complete', 'Hi {{customer_name}}, your {{year}} {{make}} {{model}} inspection is complete. View results: {{short_link}}', '["customer_name", "year", "make", "model", "short_link"]'),
(NULL, 'approval_needed', 'Manager Approval Needed', 'Inspection #{{inspection_id}} by {{mechanic_name}} needs your review. Priority: {{priority}}', '["inspection_id", "mechanic_name", "priority"]'),
(NULL, 'reminder_follow_up', 'Follow-up Reminder', 'Hi {{customer_name}}, just a reminder about the recommendations from your recent inspection. Questions? Call us!', '["customer_name"]'),
(NULL, 'appointment_confirmed', 'Appointment Confirmed', 'Your inspection appointment for {{date}} at {{time}} is confirmed. See you then!', '["date", "time"]'),
(NULL, 'urgent_issue_found', 'Urgent Safety Issue', 'URGENT: Safety issue found during inspection. Please call us immediately at {{shop_phone}}.', '["shop_phone"]');

-- Add approval status to inspections table if not exists
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'draft'; -- draft, submitted, approved, rejected
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approval_workflow_id INTEGER REFERENCES approval_workflows(id);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_inspections_approval_status ON inspections(approval_status);
CREATE INDEX IF NOT EXISTS idx_inspections_approval_workflow ON inspections(approval_workflow_id);

-- Add SMS cost tracking to shops
ALTER TABLE shops ADD COLUMN IF NOT EXISTS monthly_sms_budget_cents INTEGER DEFAULT 500000; -- $5000 default
ALTER TABLE shops ADD COLUMN IF NOT EXISTS sms_sender_number VARCHAR(20);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS telnyx_profile_id VARCHAR(100);

-- Update trigger for customer_preferences updated_at
CREATE OR REPLACE FUNCTION update_customer_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customer_preferences_updated_at
    BEFORE UPDATE ON customer_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_preferences_updated_at();

-- Function to get active shop SMS templates with fallback to global
CREATE OR REPLACE FUNCTION get_sms_template(p_shop_id INTEGER, p_template_key VARCHAR)
RETURNS TABLE (
    template_text TEXT,
    variables JSONB
) AS $$
BEGIN
    -- Try shop-specific template first
    RETURN QUERY
    SELECT message_text, sms_templates.variables
    FROM sms_templates 
    WHERE shop_id = p_shop_id 
    AND template_key = p_template_key 
    AND is_active = true
    LIMIT 1;
    
    -- If no shop-specific template, use global default
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT message_text, sms_templates.variables
        FROM sms_templates 
        WHERE shop_id IS NULL 
        AND template_key = p_template_key 
        AND is_active = true
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO railway;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO railway;