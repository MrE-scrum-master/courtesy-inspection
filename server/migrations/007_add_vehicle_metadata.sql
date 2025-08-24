-- Migration: Add NHTSA decoded metadata fields to vehicles table
-- Date: 2025-08-24
-- Purpose: Store additional vehicle data from VIN decoder for better inspections

-- Add new columns for NHTSA data
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS body_class VARCHAR(50),
ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS drive_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS doors INTEGER,
ADD COLUMN IF NOT EXISTS engine_cylinders INTEGER,
ADD COLUMN IF NOT EXISTS trim_level VARCHAR(100),
ADD COLUMN IF NOT EXISTS manufacturer_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS gross_weight_rating VARCHAR(100),
ADD COLUMN IF NOT EXISTS decoded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS decoder_source VARCHAR(20) DEFAULT 'NHTSA';

-- Create an index on fuel_type and vehicle_type for filtering
CREATE INDEX IF NOT EXISTS idx_vehicles_fuel_type ON vehicles(fuel_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_body_class ON vehicles(body_class);

-- Add comments to document the fields
COMMENT ON COLUMN vehicles.body_class IS 'Vehicle body classification (Sedan, SUV, Pickup, etc.) from VIN decoder';
COMMENT ON COLUMN vehicles.vehicle_type IS 'Vehicle type category (Passenger Car, Truck, etc.) from VIN decoder';
COMMENT ON COLUMN vehicles.fuel_type IS 'Primary fuel type (Gasoline, Electric, Hybrid, Diesel, etc.)';
COMMENT ON COLUMN vehicles.drive_type IS 'Drivetrain type (FWD, RWD, AWD, 4WD)';
COMMENT ON COLUMN vehicles.doors IS 'Number of doors on the vehicle';
COMMENT ON COLUMN vehicles.engine_cylinders IS 'Number of engine cylinders (null for electric vehicles)';
COMMENT ON COLUMN vehicles.trim_level IS 'Vehicle trim level or package';
COMMENT ON COLUMN vehicles.manufacturer_name IS 'Full manufacturer name from VIN decoder';
COMMENT ON COLUMN vehicles.gross_weight_rating IS 'GVWR classification';
COMMENT ON COLUMN vehicles.decoded_at IS 'Timestamp when VIN was decoded';
COMMENT ON COLUMN vehicles.decoder_source IS 'Source of decoded data (NHTSA, Manual, etc.)';

-- Update existing vehicles with test data
UPDATE vehicles 
SET 
    body_class = 'Sedan',
    vehicle_type = 'Passenger Car',
    fuel_type = 'Gasoline',
    drive_type = 'FWD',
    doors = 4,
    engine_cylinders = 4,
    decoded_at = NOW(),
    decoder_source = 'Manual'
WHERE vin = '1HGBH41JXMN109186'; -- Honda Civic

UPDATE vehicles 
SET 
    body_class = 'Sedan',
    vehicle_type = 'Passenger Car',
    fuel_type = 'Gasoline',
    drive_type = 'FWD',
    doors = 4,
    engine_cylinders = 4,
    decoded_at = NOW(),
    decoder_source = 'Manual'
WHERE vin = '2HGFC2F53JH123456'; -- Toyota Camry

UPDATE vehicles 
SET 
    body_class = 'Pickup',
    vehicle_type = 'Truck',
    fuel_type = 'Gasoline',
    drive_type = '4WD',
    doors = 4,
    engine_cylinders = 8,
    decoded_at = NOW(),
    decoder_source = 'Manual'
WHERE vin = '1FTFW1ET5DFC10312'; -- Ford F-150

-- Output the changes
SELECT 
    vin,
    make || ' ' || model as vehicle,
    body_class,
    fuel_type,
    drive_type
FROM vehicles
WHERE shop_id = '550e8400-e29b-41d4-a716-446655440001'
ORDER BY make;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Vehicle metadata columns added successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'New fields available:';
  RAISE NOTICE '- body_class (Sedan, SUV, Pickup, etc.)';
  RAISE NOTICE '- vehicle_type (Passenger Car, Truck, etc.)';
  RAISE NOTICE '- fuel_type (Gasoline, Electric, Hybrid, etc.)';
  RAISE NOTICE '- drive_type (FWD, RWD, AWD, 4WD)';
  RAISE NOTICE '- Plus: doors, engine_cylinders, trim_level, etc.';
  RAISE NOTICE '';
  RAISE NOTICE 'These fields will help categorize inspections better!';
END $$;