-- Courtesy Inspection MVP Database Schema - Railway PostgreSQL
-- Complete schema for Railway PostgreSQL deployment
-- Run with: railway run psql $DATABASE_URL < railway-schema.sql

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USER MANAGEMENT TABLES
-- =============================================

-- Users table (replaces Supabase auth.users)
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'mechanic' CHECK (role IN ('admin', 'shop_manager', 'mechanic')),
    shop_id UUID,
    active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table for JWT refresh tokens
CREATE TABLE user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- BUSINESS TABLES
-- =============================================

-- Shops table
CREATE TABLE shops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    owner_id UUID REFERENCES users(id),
    settings JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add shop_id foreign key constraint to users
ALTER TABLE users ADD CONSTRAINT users_shop_id_fkey 
    FOREIGN KEY (shop_id) REFERENCES shops(id);

-- Customers table
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, phone)
);

-- Vehicles table
CREATE TABLE vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    year INTEGER,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    vin VARCHAR(17),
    license_plate VARCHAR(20),
    color VARCHAR(50),
    mileage INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inspection templates table
CREATE TABLE inspection_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    checklist_items JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inspections table
CREATE TABLE inspections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) NOT NULL,
    technician_id UUID REFERENCES users(id) NOT NULL,
    template_id UUID REFERENCES inspection_templates(id),
    
    -- Inspection details
    inspection_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('draft', 'in_progress', 'completed', 'sent', 'archived')),
    
    -- Inspection data
    checklist_data JSONB DEFAULT '{}',
    overall_condition VARCHAR(20) CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor')),
    recommendations TEXT,
    notes TEXT,
    
    -- Metadata
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(shop_id, inspection_number)
);

-- Inspection photos table
CREATE TABLE inspection_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    original_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    category VARCHAR(50), -- 'before', 'issue', 'after', 'general'
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inspection_id UUID REFERENCES inspections(id) NOT NULL,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    
    -- Report details
    report_url TEXT,
    short_link VARCHAR(20) UNIQUE,
    pdf_path TEXT,
    html_content TEXT,
    
    -- Delivery info
    sent_via TEXT[], -- ['sms', 'email']
    sent_to JSONB DEFAULT '{}', -- {phone: '+1234567890', email: 'test@example.com'}
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- User and authentication indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_shop_id ON users(shop_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Business data indexes
CREATE INDEX idx_shops_owner_id ON shops(owner_id);
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_shop_id ON vehicles(shop_id);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);

-- Inspection indexes
CREATE INDEX idx_inspection_templates_shop_id ON inspection_templates(shop_id);
CREATE INDEX idx_inspections_shop_id ON inspections(shop_id);
CREATE INDEX idx_inspections_customer_id ON inspections(customer_id);
CREATE INDEX idx_inspections_vehicle_id ON inspections(vehicle_id);
CREATE INDEX idx_inspections_technician_id ON inspections(technician_id);
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_inspections_created_at ON inspections(created_at);
CREATE INDEX idx_inspections_inspection_number ON inspections(inspection_number);

-- Photo and report indexes
CREATE INDEX idx_inspection_photos_inspection_id ON inspection_photos(inspection_id);
CREATE INDEX idx_inspection_photos_category ON inspection_photos(category);
CREATE INDEX idx_reports_inspection_id ON reports(inspection_id);
CREATE INDEX idx_reports_shop_id ON reports(shop_id);
CREATE INDEX idx_reports_short_link ON reports(short_link);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all tables that have updated_at column
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_shops_updated_at 
    BEFORE UPDATE ON shops 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at 
    BEFORE UPDATE ON vehicles 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_inspection_templates_updated_at 
    BEFORE UPDATE ON inspection_templates 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_inspections_updated_at 
    BEFORE UPDATE ON inspections 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_reports_updated_at 
    BEFORE UPDATE ON reports 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- =============================================
-- DEFAULT DATA
-- =============================================

-- Insert default inspection template for all shops
-- This will be run after shops are created
-- You can customize this template based on your needs

-- Note: The following INSERT will need shop_id values
-- In production, you'll create this template when a shop is created
-- For now, we'll create a function to add default templates

CREATE OR REPLACE FUNCTION create_default_inspection_template(shop_uuid UUID)
RETURNS UUID AS $$
DECLARE
    template_id UUID;
BEGIN
    INSERT INTO inspection_templates (shop_id, name, description, checklist_items, is_default)
    VALUES (
        shop_uuid,
        'Basic Vehicle Inspection',
        'Standard multi-point vehicle inspection checklist',
        '[
            {
                "id": "engine",
                "name": "Engine",
                "items": [
                    {"id": "oil_level", "name": "Oil Level", "required": true},
                    {"id": "oil_condition", "name": "Oil Condition", "required": true},
                    {"id": "coolant_level", "name": "Coolant Level", "required": true},
                    {"id": "belts", "name": "Belts", "required": true},
                    {"id": "hoses", "name": "Hoses", "required": true}
                ]
            },
            {
                "id": "brakes",
                "name": "Brakes",
                "items": [
                    {"id": "brake_pads", "name": "Brake Pads", "required": true},
                    {"id": "brake_fluid", "name": "Brake Fluid", "required": true},
                    {"id": "brake_lines", "name": "Brake Lines", "required": true}
                ]
            },
            {
                "id": "tires",
                "name": "Tires",
                "items": [
                    {"id": "tire_pressure", "name": "Tire Pressure", "required": true},
                    {"id": "tire_tread", "name": "Tire Tread Depth", "required": true},
                    {"id": "tire_condition", "name": "Tire Condition", "required": true}
                ]
            },
            {
                "id": "lights",
                "name": "Lights",
                "items": [
                    {"id": "headlights", "name": "Headlights", "required": true},
                    {"id": "taillights", "name": "Taillights", "required": true},
                    {"id": "brake_lights", "name": "Brake Lights", "required": true},
                    {"id": "turn_signals", "name": "Turn Signals", "required": true}
                ]
            },
            {
                "id": "safety",
                "name": "Safety",
                "items": [
                    {"id": "seat_belts", "name": "Seat Belts", "required": true},
                    {"id": "horn", "name": "Horn", "required": true},
                    {"id": "windshield", "name": "Windshield", "required": true},
                    {"id": "wipers", "name": "Wipers", "required": true}
                ]
            }
        ]'::jsonb,
        true
    )
    RETURNING id INTO template_id;
    
    RETURN template_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to generate inspection numbers
CREATE OR REPLACE FUNCTION generate_inspection_number(shop_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    shop_prefix TEXT;
    sequence_num INTEGER;
    inspection_number TEXT;
BEGIN
    -- Get shop name prefix (first 3 characters, uppercase)
    SELECT UPPER(LEFT(name, 3)) INTO shop_prefix 
    FROM shops 
    WHERE id = shop_uuid;
    
    -- If no prefix found, use 'INS'
    IF shop_prefix IS NULL OR shop_prefix = '' THEN
        shop_prefix := 'INS';
    END IF;
    
    -- Get next sequence number for this shop
    SELECT COALESCE(MAX(CAST(SUBSTRING(inspection_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM inspections 
    WHERE shop_id = shop_uuid 
    AND inspection_number ~ (shop_prefix || '-[0-9]+$');
    
    -- Generate inspection number
    inspection_number := shop_prefix || '-' || LPAD(sequence_num::TEXT, 6, '0');
    
    RETURN inspection_number;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMMENTS FOR REFERENCE (RLS from Supabase)
-- =============================================

-- The following would be Row Level Security policies in Supabase
-- For Railway PostgreSQL, we handle security in the application layer
-- through the authentication middleware in auth.js

/*
Row Level Security Policies (for reference - would be used in Supabase):

-- Users can only see their own data
-- Shops can only be accessed by members
-- All data is scoped by shop_id
-- Reports can be viewed publicly via short_link

This is handled in the application through:
1. JWT authentication middleware
2. Shop-based access control
3. Role-based permissions
4. Query filtering by user's shop_id
*/

-- =============================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =============================================

-- Uncomment the following if you want sample data for testing

/*
-- Insert sample shop
INSERT INTO shops (id, name, address, phone, email) VALUES 
(gen_random_uuid(), 'Demo Auto Shop', '123 Main St, Anytown USA', '+1234567890', 'demo@autoshop.com');

-- Get the shop ID for sample data
DO $$
DECLARE
    demo_shop_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get demo shop ID
    SELECT id INTO demo_shop_id FROM shops WHERE name = 'Demo Auto Shop' LIMIT 1;
    
    -- Insert admin user (password: 'admin123' - you should hash this properly)
    INSERT INTO users (id, email, password_hash, full_name, role, shop_id) VALUES 
    (gen_random_uuid(), 'admin@demo.com', '$2b$12$hash_here', 'Demo Admin', 'shop_manager', demo_shop_id)
    RETURNING id INTO admin_user_id;
    
    -- Update shop owner
    UPDATE shops SET owner_id = admin_user_id WHERE id = demo_shop_id;
    
    -- Create default inspection template
    PERFORM create_default_inspection_template(demo_shop_id);
END $$;
*/

-- =============================================
-- SCHEMA VALIDATION
-- =============================================

-- Verify all tables were created successfully
DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'users', 'user_sessions', 'shops', 'customers', 'vehicles',
        'inspection_templates', 'inspections', 'inspection_photos', 'reports'
    );
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public' 
    AND trigger_name LIKE 'update_%_updated_at';
    
    -- Output summary
    RAISE NOTICE 'Schema creation summary:';
    RAISE NOTICE '- Tables created: %', table_count;
    RAISE NOTICE '- Indexes created: %', index_count;
    RAISE NOTICE '- Triggers created: %', trigger_count;
    
    IF table_count = 9 THEN
        RAISE NOTICE '✅ All tables created successfully';
    ELSE
        RAISE NOTICE '⚠️  Expected 9 tables, found %', table_count;
    END IF;
END $$;

-- Success message
SELECT 'Railway PostgreSQL schema created successfully! 🚀' AS status,
       'Run: railway variables set JWT_SECRET=$(openssl rand -hex 64)' AS next_step;