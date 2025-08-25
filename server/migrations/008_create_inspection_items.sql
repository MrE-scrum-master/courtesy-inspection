-- Create Inspection Items Table
-- This migration creates the inspection_items table for tracking individual inspection checklist items
-- Designed to work with existing UUID-based inspections table

BEGIN;

-- Create the inspection_items table
CREATE TABLE IF NOT EXISTS inspection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    
    -- Item categorization
    category VARCHAR(100) NOT NULL,
    component VARCHAR(200) NOT NULL,
    
    -- Item status and condition
    status VARCHAR(50) DEFAULT 'pending', -- pending, checked, skipped
    condition VARCHAR(50), -- good, fair, poor, needs_immediate
    
    -- Measurements and details
    measurement_value DECIMAL(10,2),
    measurement_unit VARCHAR(20),
    
    -- Notes and recommendations
    notes TEXT,
    recommendations TEXT,
    
    -- Cost estimation
    estimated_cost DECIMAL(10,2),
    
    -- Priority and urgency
    priority INTEGER DEFAULT 5, -- 1-10, 1 being highest priority
    requires_immediate_attention BOOLEAN DEFAULT FALSE,
    
    -- Photo references (storing photo IDs)
    photo_ids UUID[] DEFAULT '{}',
    
    -- Voice note references
    voice_note_ids UUID[] DEFAULT '{}',
    
    -- Metadata
    checked_by UUID REFERENCES users(id),
    checked_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_item_status CHECK (
        status IN ('pending', 'checked', 'skipped', 'deferred')
    ),
    CONSTRAINT valid_item_condition CHECK (
        condition IS NULL OR condition IN ('good', 'fair', 'poor', 'needs_immediate', 'not_applicable')
    ),
    CONSTRAINT valid_priority CHECK (
        priority >= 1 AND priority <= 10
    )
);

-- Create indexes for performance
CREATE INDEX idx_inspection_items_inspection_id ON inspection_items(inspection_id);
CREATE INDEX idx_inspection_items_category ON inspection_items(category);
CREATE INDEX idx_inspection_items_condition ON inspection_items(condition) WHERE condition IS NOT NULL;
CREATE INDEX idx_inspection_items_priority ON inspection_items(inspection_id, priority);
CREATE INDEX idx_inspection_items_immediate ON inspection_items(inspection_id) WHERE requires_immediate_attention = TRUE;
CREATE INDEX idx_inspection_items_status ON inspection_items(inspection_id, status);

-- Create a function to update inspection urgency when items change
CREATE OR REPLACE FUNCTION update_inspection_urgency_from_items()
RETURNS TRIGGER AS $$
DECLARE
    immediate_count INTEGER;
    poor_count INTEGER;
    fair_count INTEGER;
    new_urgency VARCHAR(20);
    new_condition VARCHAR(20);
BEGIN
    -- Count items by condition for the inspection
    SELECT 
        COUNT(CASE WHEN requires_immediate_attention = TRUE OR condition = 'needs_immediate' THEN 1 END),
        COUNT(CASE WHEN condition = 'poor' THEN 1 END),
        COUNT(CASE WHEN condition = 'fair' THEN 1 END)
    INTO immediate_count, poor_count, fair_count
    FROM inspection_items 
    WHERE inspection_id = COALESCE(NEW.inspection_id, OLD.inspection_id)
    AND status = 'checked';
    
    -- Determine overall urgency
    IF immediate_count > 0 THEN
        new_urgency := 'critical';
        new_condition := 'poor';
    ELSIF poor_count >= 3 THEN
        new_urgency := 'high';
        new_condition := 'poor';
    ELSIF poor_count >= 1 THEN
        new_urgency := 'moderate';
        new_condition := 'fair';
    ELSIF fair_count >= 3 THEN
        new_urgency := 'low';
        new_condition := 'fair';
    ELSE
        new_urgency := 'none';
        new_condition := 'good';
    END IF;
    
    -- Update the inspection with calculated urgency and condition
    UPDATE inspections 
    SET 
        overall_condition = new_condition,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.inspection_id, OLD.inspection_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating inspection urgency
CREATE TRIGGER trigger_update_inspection_urgency
    AFTER INSERT OR UPDATE OF condition, requires_immediate_attention OR DELETE ON inspection_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inspection_urgency_from_items();

-- Create a function to get inspection items summary
CREATE OR REPLACE FUNCTION get_inspection_items_summary(inspection_uuid UUID)
RETURNS TABLE (
    total_items INTEGER,
    checked_items INTEGER,
    pending_items INTEGER,
    immediate_attention_items INTEGER,
    good_items INTEGER,
    fair_items INTEGER,
    poor_items INTEGER,
    needs_immediate_items INTEGER,
    estimated_total_cost DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_items,
        COUNT(CASE WHEN status = 'checked' THEN 1 END)::INTEGER as checked_items,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as pending_items,
        COUNT(CASE WHEN requires_immediate_attention = TRUE THEN 1 END)::INTEGER as immediate_attention_items,
        COUNT(CASE WHEN condition = 'good' THEN 1 END)::INTEGER as good_items,
        COUNT(CASE WHEN condition = 'fair' THEN 1 END)::INTEGER as fair_items,
        COUNT(CASE WHEN condition = 'poor' THEN 1 END)::INTEGER as poor_items,
        COUNT(CASE WHEN condition = 'needs_immediate' THEN 1 END)::INTEGER as needs_immediate_items,
        COALESCE(SUM(estimated_cost), 0)::DECIMAL as estimated_total_cost
    FROM inspection_items
    WHERE inspection_id = inspection_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create predefined inspection item templates for common checks
CREATE TABLE IF NOT EXISTS inspection_item_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id), -- NULL for system-wide templates
    category VARCHAR(100) NOT NULL,
    component VARCHAR(200) NOT NULL,
    default_priority INTEGER DEFAULT 5,
    measurement_required BOOLEAN DEFAULT FALSE,
    measurement_unit VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(shop_id, category, component)
);

-- Insert default inspection item templates
INSERT INTO inspection_item_templates (category, component, default_priority, measurement_required, measurement_unit) VALUES
-- Brakes
('Brakes', 'Front brake pads', 2, true, 'mm'),
('Brakes', 'Rear brake pads', 2, true, 'mm'),
('Brakes', 'Front rotors', 3, true, 'mm'),
('Brakes', 'Rear rotors', 3, true, 'mm'),
('Brakes', 'Brake fluid', 4, false, NULL),
('Brakes', 'Brake lines', 2, false, NULL),
('Brakes', 'Parking brake', 5, false, NULL),

-- Tires
('Tires', 'Front left tire tread', 2, true, '32nds'),
('Tires', 'Front right tire tread', 2, true, '32nds'),
('Tires', 'Rear left tire tread', 2, true, '32nds'),
('Tires', 'Rear right tire tread', 2, true, '32nds'),
('Tires', 'Tire pressure all', 3, true, 'psi'),
('Tires', 'Tire condition', 3, false, NULL),
('Tires', 'Spare tire', 6, false, NULL),

-- Fluids
('Fluids', 'Engine oil level', 2, false, NULL),
('Fluids', 'Engine oil condition', 3, false, NULL),
('Fluids', 'Coolant level', 3, false, NULL),
('Fluids', 'Transmission fluid', 4, false, NULL),
('Fluids', 'Power steering fluid', 5, false, NULL),
('Fluids', 'Windshield washer fluid', 7, false, NULL),

-- Filters
('Filters', 'Engine air filter', 5, false, NULL),
('Filters', 'Cabin air filter', 6, false, NULL),
('Filters', 'Oil filter', 4, false, NULL),

-- Battery
('Battery', 'Battery condition', 3, false, NULL),
('Battery', 'Battery terminals', 4, false, NULL),
('Battery', 'Battery voltage', 3, true, 'volts'),

-- Lights
('Lights', 'Headlights', 2, false, NULL),
('Lights', 'Taillights', 2, false, NULL),
('Lights', 'Brake lights', 1, false, NULL),
('Lights', 'Turn signals', 2, false, NULL),
('Lights', 'Hazard lights', 3, false, NULL),
('Lights', 'License plate lights', 5, false, NULL),

-- Wipers
('Wipers', 'Front wipers', 5, false, NULL),
('Wipers', 'Rear wiper', 6, false, NULL),
('Wipers', 'Wiper fluid spray', 6, false, NULL),

-- Belts & Hoses
('Belts & Hoses', 'Serpentine belt', 4, false, NULL),
('Belts & Hoses', 'Radiator hoses', 3, false, NULL),
('Belts & Hoses', 'Heater hoses', 4, false, NULL),

-- Suspension
('Suspension', 'Shocks/Struts', 3, false, NULL),
('Suspension', 'CV joints', 3, false, NULL),
('Suspension', 'Ball joints', 3, false, NULL),
('Suspension', 'Tie rods', 3, false, NULL),

-- Exhaust
('Exhaust', 'Exhaust system', 4, false, NULL),
('Exhaust', 'Muffler', 5, false, NULL),
('Exhaust', 'Catalytic converter', 3, false, NULL)

ON CONFLICT (shop_id, category, component) DO NOTHING;

-- Create a function to initialize inspection items from templates
CREATE OR REPLACE FUNCTION initialize_inspection_items(
    inspection_uuid UUID,
    shop_uuid UUID
)
RETURNS INTEGER AS $$
DECLARE
    items_created INTEGER;
BEGIN
    -- Insert items from templates (shop-specific and system-wide)
    INSERT INTO inspection_items (
        inspection_id, category, component, priority, status
    )
    SELECT 
        inspection_uuid,
        category,
        component,
        default_priority,
        'pending'
    FROM inspection_item_templates
    WHERE is_active = TRUE
    AND (shop_id = shop_uuid OR shop_id IS NULL)
    ORDER BY 
        CASE 
            WHEN category = 'Brakes' THEN 1
            WHEN category = 'Tires' THEN 2
            WHEN category = 'Fluids' THEN 3
            WHEN category = 'Filters' THEN 4
            WHEN category = 'Battery' THEN 5
            WHEN category = 'Lights' THEN 6
            WHEN category = 'Wipers' THEN 7
            WHEN category = 'Belts & Hoses' THEN 8
            WHEN category = 'Suspension' THEN 9
            WHEN category = 'Exhaust' THEN 10
            ELSE 99
        END,
        default_priority,
        component;
    
    GET DIAGNOSTICS items_created = ROW_COUNT;
    
    RETURN items_created;
END;
$$ LANGUAGE plpgsql;

-- Add helper view for inspection items with inspection details
CREATE OR REPLACE VIEW inspection_items_detailed AS
SELECT 
    ii.*,
    i.inspection_number,
    i.status as inspection_status,
    i.shop_id,
    s.name as shop_name,
    v.make || ' ' || v.model || ' (' || v.year || ')' as vehicle_description,
    c.first_name || ' ' || c.last_name as customer_name,
    u.full_name as checked_by_name
FROM inspection_items ii
JOIN inspections i ON ii.inspection_id = i.id
JOIN shops s ON i.shop_id = s.id
JOIN vehicles v ON i.vehicle_id = v.id
JOIN customers c ON i.customer_id = c.id
LEFT JOIN users u ON ii.checked_by = u.id;

-- Grant permissions
GRANT ALL ON inspection_items TO postgres;
GRANT ALL ON inspection_item_templates TO postgres;
GRANT ALL ON inspection_items_detailed TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Add comment for documentation
COMMENT ON TABLE inspection_items IS 'Stores individual checklist items for each inspection with their status, condition, and recommendations';
COMMENT ON TABLE inspection_item_templates IS 'Predefined templates for common inspection checklist items';
COMMENT ON FUNCTION get_inspection_items_summary IS 'Returns a summary of inspection items including counts by status and condition';
COMMENT ON FUNCTION initialize_inspection_items IS 'Creates inspection items from templates when starting a new inspection';

COMMIT;