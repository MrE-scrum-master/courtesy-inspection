-- Enhanced Inspection Tables Migration
-- Creates comprehensive tables for inspection workflow, voice processing, and photo management
-- Based on MVP schema with additional business logic requirements

-- Enable required extensions if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add missing columns to existing tables

-- Add workflow tracking to inspections table
ALTER TABLE inspections 
ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(50) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS previous_state VARCHAR(50),
ADD COLUMN IF NOT EXISTS state_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS state_changed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS inspection_duration INTEGER, -- minutes
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS next_service_date DATE,
ADD COLUMN IF NOT EXISTS warranty_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 -- for optimistic locking
;

-- Update workflow states constraint
ALTER TABLE inspections DROP CONSTRAINT IF EXISTS valid_inspection_status;
ALTER TABLE inspections ADD CONSTRAINT valid_workflow_state CHECK (
    workflow_state IN ('draft', 'in_progress', 'pending_review', 'approved', 'rejected', 'sent_to_customer', 'completed')
);

ALTER TABLE inspections ADD CONSTRAINT valid_urgency_level CHECK (
    urgency_level IN ('low', 'normal', 'high', 'critical')
);

-- Enhanced inspection_items table
ALTER TABLE inspection_items
ADD COLUMN IF NOT EXISTS condition VARCHAR(20) DEFAULT 'good',
ADD COLUMN IF NOT EXISTS measurements JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS recommendations TEXT,
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS voice_notes TEXT[],
ADD COLUMN IF NOT EXISTS photo_ids UUID[]
;

-- Update condition constraint
ALTER TABLE inspection_items DROP CONSTRAINT IF EXISTS valid_severity;
ALTER TABLE inspection_items ADD CONSTRAINT valid_condition CHECK (
    condition IN ('good', 'fair', 'poor', 'needs_immediate')
);

-- Inspection Photos table (enhanced from basic schema)
CREATE TABLE IF NOT EXISTS inspection_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    inspection_item_id UUID REFERENCES inspection_items(id) ON DELETE SET NULL,
    
    -- File information
    file_url VARCHAR(500) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    original_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    
    -- Image metadata
    width INTEGER,
    height INTEGER,
    thumbnail_path VARCHAR(500),
    compressed_path VARCHAR(500),
    
    -- Categorization
    category VARCHAR(100) DEFAULT 'general',
    description TEXT,
    tags VARCHAR(100)[],
    
    -- EXIF data (if available)
    exif_data JSONB DEFAULT '{}',
    
    -- Upload information
    uploaded_by UUID NOT NULL REFERENCES users(id),
    
    -- Ordering and status
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_photo_status CHECK (
        status IN ('active', 'deleted', 'processing')
    )
);

-- Voice Notes table for audio transcriptions
CREATE TABLE IF NOT EXISTS inspection_voice_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    inspection_item_id UUID REFERENCES inspection_items(id) ON DELETE SET NULL,
    
    -- Voice data
    original_text TEXT NOT NULL,
    processed_data JSONB DEFAULT '{}', -- parsed components, measurements, etc.
    confidence_score DECIMAL(3,2) DEFAULT 0.0, -- 0.00 to 1.00
    
    -- Audio file information (optional)
    audio_file_path VARCHAR(500),
    audio_duration INTEGER, -- seconds
    
    -- Processing information
    processed_by VARCHAR(50) DEFAULT 'voice-parser', -- service that processed it
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- User information
    recorded_by UUID NOT NULL REFERENCES users(id),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- State History for workflow tracking
CREATE TABLE IF NOT EXISTS inspection_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    
    -- State transition
    from_state VARCHAR(50),
    to_state VARCHAR(50) NOT NULL,
    
    -- Change information
    changed_by UUID NOT NULL REFERENCES users(id),
    change_reason TEXT,
    metadata JSONB DEFAULT '{}', -- additional context
    
    -- Timing
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Validation information
    validation_passed BOOLEAN DEFAULT true,
    validation_errors JSONB DEFAULT '[]'
);

-- Business Rules Configuration
CREATE TABLE IF NOT EXISTS inspection_business_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Rule definition
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'state_transition', 'validation', 'calculation'
    conditions JSONB NOT NULL DEFAULT '{}',
    actions JSONB NOT NULL DEFAULT '{}',
    
    -- Priority and status
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Ensure unique rule names per shop
    UNIQUE(shop_id, rule_name)
);

-- Inspection Categories (predefined inspection areas)
CREATE TABLE IF NOT EXISTS inspection_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE, -- NULL for system-wide categories
    
    -- Category information
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    
    -- Category configuration
    required BOOLEAN DEFAULT false,
    has_measurements BOOLEAN DEFAULT false,
    measurement_units VARCHAR(50)[], -- e.g., ['mm', 'inches', '%']
    
    -- Default components for this category
    default_components JSONB DEFAULT '[]',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance and security indexes
CREATE INDEX IF NOT EXISTS idx_inspections_workflow_state ON inspections(workflow_state, shop_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inspections_state_changed_at ON inspections(state_changed_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inspections_urgency_level ON inspections(urgency_level, shop_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inspections_version ON inspections(id, version); -- for optimistic locking

CREATE INDEX IF NOT EXISTS idx_inspection_items_condition ON inspection_items(condition);
CREATE INDEX IF NOT EXISTS idx_inspection_items_priority ON inspection_items(inspection_id, priority);

CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection_id ON inspection_photos(inspection_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_inspection_photos_item_id ON inspection_photos(inspection_item_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_inspection_photos_category ON inspection_photos(category) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_inspection_photos_uploaded_by ON inspection_photos(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_voice_notes_inspection_id ON inspection_voice_notes(inspection_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_item_id ON inspection_voice_notes(inspection_item_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_confidence ON inspection_voice_notes(confidence_score);

CREATE INDEX IF NOT EXISTS idx_state_history_inspection_id ON inspection_state_history(inspection_id);
CREATE INDEX IF NOT EXISTS idx_state_history_changed_at ON inspection_state_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_state_history_changed_by ON inspection_state_history(changed_by);

CREATE INDEX IF NOT EXISTS idx_business_rules_shop_id ON inspection_business_rules(shop_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_business_rules_type ON inspection_business_rules(rule_type) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_categories_shop_id ON inspection_categories(shop_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON inspection_categories(sort_order) WHERE is_active = true;

-- Insert default inspection categories
INSERT INTO inspection_categories (name, description, sort_order, required, has_measurements, measurement_units, default_components) VALUES
('Brakes', 'Brake system inspection including pads, rotors, calipers, and lines', 1, true, true, ARRAY['mm', 'inches'], 
 '["Front brake pads", "Rear brake pads", "Front rotors", "Rear rotors", "Brake fluid", "Brake lines", "Calipers"]'::jsonb),

('Tires', 'Tire condition and tread depth inspection', 2, true, true, ARRAY['32nds', 'mm'], 
 '["Front left tire", "Front right tire", "Rear left tire", "Rear right tire", "Spare tire"]'::jsonb),

('Fluids', 'All vehicle fluids inspection', 3, true, false, ARRAY['%', 'level'], 
 '["Engine oil", "Coolant", "Brake fluid", "Transmission fluid", "Power steering fluid", "Windshield washer fluid"]'::jsonb),

('Filters', 'Air and cabin filter inspection', 4, false, false, ARRAY[], 
 '["Air filter", "Cabin filter", "Oil filter"]'::jsonb),

('Battery', 'Battery and charging system', 5, true, true, ARRAY['volts', 'amps'], 
 '["Battery", "Battery terminals", "Alternator", "Charging system"]'::jsonb),

('Lights', 'All vehicle lighting systems', 6, true, false, ARRAY[], 
 '["Headlights", "Taillights", "Turn signals", "Hazard lights", "Interior lights", "Dashboard lights"]'::jsonb),

('Wipers', 'Windshield wiper system', 7, false, false, ARRAY[], 
 '["Front wipers", "Rear wiper", "Wiper fluid", "Wiper motor"]'::jsonb),

('Belts & Hoses', 'Engine belts and hoses inspection', 8, false, false, ARRAY[], 
 '["Serpentine belt", "Timing belt", "Radiator hoses", "Heater hoses", "Vacuum hoses"]'::jsonb)

ON CONFLICT DO NOTHING;

-- Insert default business rules (examples)
INSERT INTO inspection_business_rules (rule_name, rule_type, conditions, actions, priority) VALUES
('Auto Complete After All Items', 'state_transition', 
 '{"from_state": "in_progress", "condition": "all_items_completed"}'::jsonb,
 '{"to_state": "pending_review", "notify_manager": true}'::jsonb, 1),

('Critical Items Block Completion', 'validation', 
 '{"condition": "has_critical_items"}'::jsonb,
 '{"block_states": ["approved"], "require_manager_approval": true}'::jsonb, 10),

('Calculate Urgency', 'calculation', 
 '{"trigger": "item_updated"}'::jsonb,
 '{"calculate": "urgency_level", "based_on": "worst_condition"}'::jsonb, 5)

ON CONFLICT DO NOTHING;

-- Functions for business logic

-- Function to calculate inspection urgency based on item conditions
CREATE OR REPLACE FUNCTION calculate_inspection_urgency(inspection_uuid UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    critical_count INTEGER;
    poor_count INTEGER;
    fair_count INTEGER;
BEGIN
    SELECT 
        COUNT(CASE WHEN condition = 'needs_immediate' THEN 1 END),
        COUNT(CASE WHEN condition = 'poor' THEN 1 END),
        COUNT(CASE WHEN condition = 'fair' THEN 1 END)
    INTO critical_count, poor_count, fair_count
    FROM inspection_items 
    WHERE inspection_id = inspection_uuid;
    
    IF critical_count > 0 THEN
        RETURN 'critical';
    ELSIF poor_count >= 3 OR (poor_count >= 1 AND fair_count >= 3) THEN
        RETURN 'high';
    ELSIF poor_count >= 1 OR fair_count >= 2 THEN
        RETURN 'normal';
    ELSE
        RETURN 'low';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to validate state transitions
CREATE OR REPLACE FUNCTION validate_state_transition(
    inspection_uuid UUID, 
    from_state VARCHAR(50), 
    to_state VARCHAR(50),
    user_role VARCHAR(50)
)
RETURNS JSONB AS $$
DECLARE
    validation_result JSONB := '{"valid": true, "errors": []}'::jsonb;
    critical_items INTEGER;
BEGIN
    -- Check role-based permissions
    CASE to_state
        WHEN 'approved', 'rejected' THEN
            IF user_role NOT IN ('shop_manager', 'admin') THEN
                validation_result := jsonb_set(validation_result, '{valid}', 'false'::jsonb);
                validation_result := jsonb_set(validation_result, '{errors}', 
                    validation_result->'errors' || '["Only shop managers can approve/reject inspections"]'::jsonb);
            END IF;
        WHEN 'sent_to_customer' THEN
            IF user_role NOT IN ('shop_manager', 'admin') THEN
                validation_result := jsonb_set(validation_result, '{valid}', 'false'::jsonb);
                validation_result := jsonb_set(validation_result, '{errors}', 
                    validation_result->'errors' || '["Only shop managers can send to customers"]'::jsonb);
            END IF;
    END CASE;
    
    -- Check business rules
    IF to_state = 'approved' THEN
        SELECT COUNT(*) INTO critical_items 
        FROM inspection_items 
        WHERE inspection_id = inspection_uuid AND condition = 'needs_immediate';
        
        IF critical_items > 0 THEN
            validation_result := jsonb_set(validation_result, '{valid}', 'false'::jsonb);
            validation_result := jsonb_set(validation_result, '{errors}', 
                validation_result->'errors' || '["Cannot approve inspection with critical safety items"]'::jsonb);
        END IF;
    END IF;
    
    RETURN validation_result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update inspection urgency when items change
CREATE OR REPLACE FUNCTION update_inspection_urgency()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE inspections 
    SET urgency_level = calculate_inspection_urgency(NEW.inspection_id),
        updated_at = NOW()
    WHERE id = NEW.inspection_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for inspection items
DROP TRIGGER IF EXISTS trigger_update_urgency ON inspection_items;
CREATE TRIGGER trigger_update_urgency
    AFTER INSERT OR UPDATE OF condition ON inspection_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inspection_urgency();

-- Function to record state changes
CREATE OR REPLACE FUNCTION record_state_change()
RETURNS TRIGGER AS $$
DECLARE
    validation_result JSONB;
BEGIN
    -- Only record if workflow_state actually changed
    IF OLD.workflow_state IS DISTINCT FROM NEW.workflow_state THEN
        -- Validate state transition if we have user context
        IF current_setting('app.current_user_role', true) IS NOT NULL THEN
            validation_result := validate_state_transition(
                NEW.id, 
                OLD.workflow_state, 
                NEW.workflow_state,
                current_setting('app.current_user_role')
            );
            
            -- Record the state change
            INSERT INTO inspection_state_history (
                inspection_id, from_state, to_state, changed_by, 
                validation_passed, validation_errors
            ) VALUES (
                NEW.id, OLD.workflow_state, NEW.workflow_state, 
                current_setting('app.current_user_id', true)::UUID,
                (validation_result->>'valid')::boolean,
                validation_result->'errors'
            );
        ELSE
            -- Record without validation
            INSERT INTO inspection_state_history (
                inspection_id, from_state, to_state, changed_by
            ) VALUES (
                NEW.id, OLD.workflow_state, NEW.workflow_state, 
                current_setting('app.current_user_id', true)::UUID
            );
        END IF;
        
        -- Update tracking fields
        NEW.previous_state := OLD.workflow_state;
        NEW.state_changed_at := NOW();
        NEW.state_changed_by := current_setting('app.current_user_id', true)::UUID;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for workflow state changes
DROP TRIGGER IF EXISTS trigger_state_change ON inspections;
CREATE TRIGGER trigger_state_change
    BEFORE UPDATE OF workflow_state ON inspections
    FOR EACH ROW
    EXECUTE FUNCTION record_state_change();

-- Row Level Security policies for new tables
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_categories ENABLE ROW LEVEL SECURITY;

-- Policies for shop isolation
CREATE POLICY shop_isolation_inspection_photos ON inspection_photos
    FOR ALL USING (
        inspection_id IN (
            SELECT id FROM inspections 
            WHERE shop_id = current_setting('app.current_shop_id', true)::UUID
        )
    );

CREATE POLICY shop_isolation_voice_notes ON inspection_voice_notes
    FOR ALL USING (
        inspection_id IN (
            SELECT id FROM inspections 
            WHERE shop_id = current_setting('app.current_shop_id', true)::UUID
        )
    );

CREATE POLICY shop_isolation_state_history ON inspection_state_history
    FOR ALL USING (
        inspection_id IN (
            SELECT id FROM inspections 
            WHERE shop_id = current_setting('app.current_shop_id', true)::UUID
        )
    );

CREATE POLICY shop_isolation_business_rules ON inspection_business_rules
    FOR ALL USING (shop_id = current_setting('app.current_shop_id', true)::UUID OR shop_id IS NULL);

CREATE POLICY shop_isolation_categories ON inspection_categories
    FOR ALL USING (shop_id = current_setting('app.current_shop_id', true)::UUID OR shop_id IS NULL);

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_inspection_data()
RETURNS void AS $$
BEGIN
    -- Delete old state history (keep for 2 years)
    DELETE FROM inspection_state_history 
    WHERE changed_at < NOW() - INTERVAL '2 years';
    
    -- Delete orphaned voice notes
    DELETE FROM inspection_voice_notes 
    WHERE inspection_id NOT IN (SELECT id FROM inspections);
    
    -- Delete orphaned photos (metadata only, files handled separately)
    DELETE FROM inspection_photos 
    WHERE inspection_id NOT IN (SELECT id FROM inspections);
    
    RAISE NOTICE 'Inspection data cleanup completed';
END;
$$ LANGUAGE plpgsql;

COMMIT;