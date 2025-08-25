-- Migration: Add test vehicles for VIN Scanner testing
-- Date: 2025-08-24

-- First, ensure we have a test shop (if not already present)
INSERT INTO shops (id, name, address, phone, email, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Auto Shop',
  '123 Main St, Test City, TC 12345',
  '555-0100',
  'shop@example.com',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add test customer for testing vehicle associations
INSERT INTO customers (first_name, last_name, phone, email, shop_id, created_at)
VALUES (
  'John',
  'Doe', 
  '555-1234',
  'john.doe@example.com',
  '550e8400-e29b-41d4-a716-446655440001',
  NOW()
) ON CONFLICT (phone, shop_id) DO NOTHING;

-- Test Vehicle 1: Honda Civic without customer (new vehicle scenario)
INSERT INTO vehicles (vin, make, model, year, license_plate, color, mileage, shop_id, created_at)
VALUES (
  '1HGBH41JXMN109186',
  'Honda',
  'Civic',
  2020,
  'TEST123',
  'Blue', 
  25000,
  '550e8400-e29b-41d4-a716-446655440001',
  NOW()
) ON CONFLICT (vin) DO UPDATE SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  year = EXCLUDED.year;

-- Test Vehicle 2: Toyota Camry WITH customer (returning customer scenario)  
INSERT INTO vehicles (vin, make, model, year, license_plate, color, mileage, customer_id, shop_id, created_at)
VALUES (
  '2HGFC2F53JH123456',
  'Toyota',
  'Camry',
  2019,
  'ABC789',
  'Silver',
  35000,
  (SELECT id FROM customers WHERE phone = '555-1234' AND shop_id = '550e8400-e29b-41d4-a716-446655440001' LIMIT 1),
  '550e8400-e29b-41d4-a716-446655440001',
  NOW()
) ON CONFLICT (vin) DO UPDATE SET
  make = EXCLUDED.make,
  model = EXCLUDED.model, 
  year = EXCLUDED.year,
  customer_id = EXCLUDED.customer_id;

-- Test Vehicle 3: Ford F-150 without customer (another new vehicle)
INSERT INTO vehicles (vin, make, model, year, license_plate, color, mileage, shop_id, created_at)
VALUES (
  '1FTFW1ET5DFC10312',
  'Ford',
  'F-150',
  2013,
  'TRUCK99',
  'Red',
  85000,
  '550e8400-e29b-41d4-a716-446655440001',
  NOW()
) ON CONFLICT (vin) DO NOTHING;

-- Display the test vehicles
SELECT 
  v.vin,
  v.make || ' ' || v.model || ' (' || v.year || ')' as vehicle,
  CASE 
    WHEN v.customer_id IS NULL THEN 'No Customer'
    ELSE c.first_name || ' ' || c.last_name
  END as customer,
  v.license_plate
FROM vehicles v
LEFT JOIN customers c ON v.customer_id = c.id
WHERE v.shop_id = '550e8400-e29b-41d4-a716-446655440001'
ORDER BY v.created_at DESC;

-- Output message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Test vehicles added successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Test VINs you can use in the VIN Scanner:';
  RAISE NOTICE '1. 1HGBH41JXMN109186 - Honda Civic (no customer)';
  RAISE NOTICE '2. 2HGFC2F53JH123456 - Toyota Camry (has customer: John Doe)';
  RAISE NOTICE '3. 1FTFW1ET5DFC10312 - Ford F-150 (no customer)';
  RAISE NOTICE '';
END $$;