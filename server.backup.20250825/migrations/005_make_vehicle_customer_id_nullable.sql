-- Migration: Make vehicles.customer_id nullable to support VIN scanning workflow
-- Date: 2025-01-23
-- Description: Allow vehicles to exist temporarily without a customer during VIN scanning

-- Make customer_id nullable
ALTER TABLE vehicles ALTER COLUMN customer_id DROP NOT NULL;

-- Add VIN unique constraint if it doesn't exist
ALTER TABLE vehicles ADD CONSTRAINT unique_vin UNIQUE (vin);

-- Add index on VIN for quick lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);

-- Add comment
COMMENT ON COLUMN vehicles.customer_id IS 'Foreign key to customers table - nullable to support VIN scanning workflow where vehicle may exist before customer assignment';