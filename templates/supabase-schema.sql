-- Courtesy Inspection MVP Database Schema
-- Ready to paste into Supabase SQL Editor

-- Enable Row Level Security and required extensions
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret-here';

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users table (extends auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'technician' CHECK (role IN ('admin', 'manager', 'technician')),
    shop_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Shops table
CREATE TABLE shops (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    owner_id UUID REFERENCES profiles(id),
    settings JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Customers table
CREATE TABLE customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_id, phone)
);

-- 4. Vehicles table
CREATE TABLE vehicles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    year INTEGER,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    vin TEXT,
    license_plate TEXT,
    color TEXT,
    mileage INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Inspection Templates table
CREATE TABLE inspection_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    checklist_items JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Inspections table
CREATE TABLE inspections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) NOT NULL,
    technician_id UUID REFERENCES profiles(id) NOT NULL,
    template_id UUID REFERENCES inspection_templates(id),
    
    -- Inspection details
    inspection_number TEXT NOT NULL,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('draft', 'in_progress', 'completed', 'sent', 'archived')),
    
    -- Inspection data
    checklist_data JSONB DEFAULT '{}',
    overall_condition TEXT CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor')),
    recommendations TEXT,
    notes TEXT,
    
    -- Metadata
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(shop_id, inspection_number)
);

-- 7. Inspection Photos table
CREATE TABLE inspection_photos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    category TEXT, -- 'before', 'issue', 'after', 'general'
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Reports table
CREATE TABLE reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    inspection_id UUID REFERENCES inspections(id) NOT NULL,
    shop_id UUID REFERENCES shops(id) NOT NULL,
    
    -- Report details
    report_url TEXT,
    short_link TEXT UNIQUE,
    pdf_path TEXT,
    html_content TEXT,
    
    -- Delivery info
    sent_via TEXT[], -- ['sms', 'email']
    sent_to JSONB DEFAULT '{}', -- {phone: '+1234567890', email: 'test@example.com'}
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    view_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for shop_id in profiles
ALTER TABLE profiles ADD CONSTRAINT profiles_shop_id_fkey 
    FOREIGN KEY (shop_id) REFERENCES shops(id);

-- Create indexes for performance
CREATE INDEX idx_profiles_shop_id ON profiles(shop_id);
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_shop_id ON vehicles(shop_id);
CREATE INDEX idx_inspections_shop_id ON inspections(shop_id);
CREATE INDEX idx_inspections_customer_id ON inspections(customer_id);
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_inspections_created_at ON inspections(created_at);
CREATE INDEX idx_inspection_photos_inspection_id ON inspection_photos(inspection_id);
CREATE INDEX idx_reports_inspection_id ON reports(inspection_id);
CREATE INDEX idx_reports_short_link ON reports(short_link);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_inspection_templates_updated_at BEFORE UPDATE ON inspection_templates 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON inspections 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Shops policies (users can only access their shop's data)
CREATE POLICY "Users can view own shop" ON shops
    FOR SELECT USING (
        id IN (
            SELECT shop_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Shop owners can update shop" ON shops
    FOR UPDATE USING (owner_id = auth.uid());

-- Customers policies
CREATE POLICY "Users can view customers from their shop" ON customers
    FOR ALL USING (
        shop_id IN (
            SELECT shop_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Vehicles policies
CREATE POLICY "Users can view vehicles from their shop" ON vehicles
    FOR ALL USING (
        shop_id IN (
            SELECT shop_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Inspection templates policies
CREATE POLICY "Users can view templates from their shop" ON inspection_templates
    FOR ALL USING (
        shop_id IN (
            SELECT shop_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Inspections policies
CREATE POLICY "Users can view inspections from their shop" ON inspections
    FOR ALL USING (
        shop_id IN (
            SELECT shop_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Inspection photos policies
CREATE POLICY "Users can manage photos for their shop's inspections" ON inspection_photos
    FOR ALL USING (
        inspection_id IN (
            SELECT id FROM inspections WHERE shop_id IN (
                SELECT shop_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- Reports policies
CREATE POLICY "Users can view reports from their shop" ON reports
    FOR SELECT USING (
        shop_id IN (
            SELECT shop_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Public access policy for report viewing (via short links)
CREATE POLICY "Public can view reports via short_link" ON reports
    FOR SELECT USING (short_link IS NOT NULL);

-- Insert default inspection template
INSERT INTO inspection_templates (name, description, checklist_items, is_default, shop_id)
SELECT 
    'Basic Vehicle Inspection',
    'Standard multi-point vehicle inspection checklist',
    '[
        {"id": "engine", "name": "Engine", "items": [
            {"id": "oil_level", "name": "Oil Level", "required": true},
            {"id": "oil_condition", "name": "Oil Condition", "required": true},
            {"id": "coolant_level", "name": "Coolant Level", "required": true},
            {"id": "belts", "name": "Belts", "required": true},
            {"id": "hoses", "name": "Hoses", "required": true}
        ]},
        {"id": "brakes", "name": "Brakes", "items": [
            {"id": "brake_pads", "name": "Brake Pads", "required": true},
            {"id": "brake_fluid", "name": "Brake Fluid", "required": true},
            {"id": "brake_lines", "name": "Brake Lines", "required": true}
        ]},
        {"id": "tires", "name": "Tires", "items": [
            {"id": "tire_pressure", "name": "Tire Pressure", "required": true},
            {"id": "tire_tread", "name": "Tire Tread Depth", "required": true},
            {"id": "tire_condition", "name": "Tire Condition", "required": true}
        ]},
        {"id": "lights", "name": "Lights", "items": [
            {"id": "headlights", "name": "Headlights", "required": true},
            {"id": "taillights", "name": "Taillights", "required": true},
            {"id": "brake_lights", "name": "Brake Lights", "required": true},
            {"id": "turn_signals", "name": "Turn Signals", "required": true}
        ]}
    ]'::jsonb,
    true,
    id
FROM shops
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create a function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
    RETURN new;
END;
$$ language plpgsql security definer;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Success message
SELECT 'Database schema created successfully! Ready for MVP development.' AS status;