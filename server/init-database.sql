-- Courtesy Inspection Database Initialization
-- Run this after creating new Railway PostgreSQL

-- Create tables
CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER REFERENCES shops(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'mechanic',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER REFERENCES shops(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  preferred_contact VARCHAR(20) DEFAULT 'sms',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  vin VARCHAR(17),
  license_plate VARCHAR(20),
  color VARCHAR(50),
  mileage INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspections (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER REFERENCES shops(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  mechanic_id INTEGER REFERENCES users(id),
  customer_id INTEGER REFERENCES customers(id),
  status VARCHAR(50) DEFAULT 'draft',
  type VARCHAR(50) DEFAULT 'courtesy',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  sent_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspection_items (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER REFERENCES inspections(id),
  category VARCHAR(100),
  component VARCHAR(200),
  status VARCHAR(50),
  severity VARCHAR(20),
  notes TEXT,
  measurement_value DECIMAL(10,2),
  measurement_unit VARCHAR(20),
  cost_estimate DECIMAL(10,2),
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspection_photos (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER REFERENCES inspections(id),
  item_id INTEGER REFERENCES inspection_items(id),
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(50),
  caption TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sms_messages (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER REFERENCES inspections(id),
  customer_id INTEGER REFERENCES customers(id),
  to_phone VARCHAR(20) NOT NULL,
  from_phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  telnyx_message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_reminders (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id),
  service_type VARCHAR(100) NOT NULL,
  due_date DATE,
  due_mileage INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_shop_id ON users(shop_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_inspections_shop_id ON inspections(shop_id);
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_inspections_mechanic_id ON inspections(mechanic_id);
CREATE INDEX idx_inspection_items_inspection_id ON inspection_items(inspection_id);
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_sms_messages_inspection_id ON sms_messages(inspection_id);

-- Insert test data
INSERT INTO shops (name, address, phone, email) VALUES
('Main Street Auto', '123 Main St, Springfield, IL 62701', '555-0100', 'info@mainstauto.com');

-- Password is 'password123' for all users (bcrypt hash)
INSERT INTO users (shop_id, email, password_hash, first_name, last_name, role) VALUES
(1, 'admin@shop.com', '$2b$10$liOOmPB1r0lyO33UzMXmEewymXUIBgJiUpBuzBXi/Wz4Eqp5kweim', 'Admin', 'User', 'admin'),
(1, 'mike@shop.com', '$2b$10$liOOmPB1r0lyO33UzMXmEewymXUIBgJiUpBuzBXi/Wz4Eqp5kweim', 'Mike', 'Johnson', 'mechanic'),
(1, 'sarah@shop.com', '$2b$10$liOOmPB1r0lyO33UzMXmEewymXUIBgJiUpBuzBXi/Wz4Eqp5kweim', 'Sarah', 'Williams', 'shop_manager');

INSERT INTO customers (shop_id, first_name, last_name, email, phone) VALUES
(1, 'John', 'Doe', 'john@example.com', '555-0101'),
(1, 'Jane', 'Smith', 'jane@example.com', '555-0102'),
(1, 'Bob', 'Wilson', 'bob@example.com', '555-0103');

INSERT INTO vehicles (customer_id, make, model, year, license_plate, mileage) VALUES
(1, 'Toyota', 'Camry', 2019, 'ABC123', 45000),
(2, 'Honda', 'Accord', 2020, 'XYZ789', 32000),
(3, 'Ford', 'F-150', 2018, 'DEF456', 67000);

-- Grant permissions (if needed)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;