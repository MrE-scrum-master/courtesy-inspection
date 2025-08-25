-- 005_timezone_fix.sql
-- Comprehensive timezone migration for Courtesy Inspection
-- Run this migration to fix all timezone issues

BEGIN;

-- 1. Convert all timestamp columns to TIMESTAMPTZ
-- This preserves existing data while adding timezone awareness

-- Inspections table
ALTER TABLE inspections 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC',
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'UTC';

-- Users table
ALTER TABLE users
  ALTER COLUMN last_login_at TYPE TIMESTAMPTZ USING last_login_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Customers table
ALTER TABLE customers
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Vehicles table
ALTER TABLE vehicles
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Shops table
ALTER TABLE shops
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Inspection_items table
ALTER TABLE inspection_items
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Photos table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'photos') THEN
    ALTER TABLE photos
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
  END IF;
END $$;

-- Communication logs (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
    ALTER TABLE communication_logs
      ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'UTC',
      ALTER COLUMN viewed_at TYPE TIMESTAMPTZ USING viewed_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
  END IF;
END $$;

-- Refresh tokens table
ALTER TABLE refresh_tokens
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- 2. Add timezone columns to shops and users
ALTER TABLE shops 
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
    "monday": {"open": "08:00", "close": "18:00"},
    "tuesday": {"open": "08:00", "close": "18:00"},
    "wednesday": {"open": "08:00", "close": "18:00"},
    "thursday": {"open": "08:00", "close": "18:00"},
    "friday": {"open": "08:00", "close": "18:00"},
    "saturday": {"open": "09:00", "close": "14:00"},
    "sunday": {"closed": true}
  }'::jsonb;

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS date_format VARCHAR(10) DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS use_24hour_time BOOLEAN DEFAULT false;

-- 3. Create timezone validation function
CREATE OR REPLACE FUNCTION validate_timezone(tz VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  PERFORM NOW() AT TIME ZONE tz;
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Add timezone validation constraints
ALTER TABLE shops 
  ADD CONSTRAINT valid_shop_timezone 
  CHECK (validate_timezone(timezone));

ALTER TABLE users 
  ADD CONSTRAINT valid_user_timezone 
  CHECK (timezone IS NULL OR validate_timezone(timezone));

-- 5. Create helper functions for timezone-aware queries
CREATE OR REPLACE FUNCTION get_shop_current_time(shop_id_param UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  shop_tz VARCHAR(50);
BEGIN
  SELECT timezone INTO shop_tz FROM shops WHERE id = shop_id_param;
  IF shop_tz IS NULL THEN
    shop_tz := 'America/Chicago';
  END IF;
  RETURN NOW() AT TIME ZONE shop_tz;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Create function to check if shop is open
CREATE OR REPLACE FUNCTION is_shop_open(shop_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  shop_tz VARCHAR(50);
  shop_hours JSONB;
  current_day TEXT;
  current_time TIME;
  day_hours JSONB;
  open_time TIME;
  close_time TIME;
BEGIN
  -- Get shop timezone and hours
  SELECT timezone, business_hours 
  INTO shop_tz, shop_hours 
  FROM shops 
  WHERE id = shop_id_param;
  
  IF shop_tz IS NULL THEN
    shop_tz := 'America/Chicago';
  END IF;
  
  -- Get current day and time in shop timezone
  current_day := LOWER(TO_CHAR(NOW() AT TIME ZONE shop_tz, 'Day'));
  current_day := TRIM(current_day);
  current_time := (NOW() AT TIME ZONE shop_tz)::TIME;
  
  -- Get hours for current day
  day_hours := shop_hours->current_day;
  
  -- Check if closed
  IF day_hours->>'closed' = 'true' OR day_hours IS NULL THEN
    RETURN false;
  END IF;
  
  -- Parse open and close times
  open_time := (day_hours->>'open')::TIME;
  close_time := (day_hours->>'close')::TIME;
  
  -- Check if currently open
  RETURN current_time >= open_time AND current_time <= close_time;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Update the updated_at trigger to use TIMESTAMPTZ
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW(); -- NOW() returns TIMESTAMPTZ
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create view for shop-localized inspection times
CREATE OR REPLACE VIEW inspections_localized AS
SELECT 
  i.*,
  i.created_at AT TIME ZONE COALESCE(s.timezone, 'America/Chicago') AS created_at_local,
  i.updated_at AT TIME ZONE COALESCE(s.timezone, 'America/Chicago') AS updated_at_local,
  i.started_at AT TIME ZONE COALESCE(s.timezone, 'America/Chicago') AS started_at_local,
  i.completed_at AT TIME ZONE COALESCE(s.timezone, 'America/Chicago') AS completed_at_local,
  COALESCE(s.timezone, 'America/Chicago') AS shop_timezone
FROM inspections i
JOIN shops s ON i.shop_id = s.id;

-- 9. Add indexes for timezone queries
CREATE INDEX IF NOT EXISTS idx_shops_timezone ON shops(timezone);
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);

-- 10. Update existing shops with common US timezones based on state (if you have state data)
-- This is optional but helpful for initial setup
UPDATE shops SET timezone = 'America/New_York' WHERE address ILIKE '%NY%' OR address ILIKE '%New York%';
UPDATE shops SET timezone = 'America/Chicago' WHERE address ILIKE '%IL%' OR address ILIKE '%Illinois%' OR address ILIKE '%TX%' OR address ILIKE '%Texas%';
UPDATE shops SET timezone = 'America/Denver' WHERE address ILIKE '%CO%' OR address ILIKE '%Colorado%';
UPDATE shops SET timezone = 'America/Los_Angeles' WHERE address ILIKE '%CA%' OR address ILIKE '%California%';
UPDATE shops SET timezone = 'America/Phoenix' WHERE address ILIKE '%AZ%' OR address ILIKE '%Arizona%';

COMMIT;

-- Verification queries
SELECT 
  'Timestamp columns converted to TIMESTAMPTZ' as check_name,
  COUNT(*) as columns_updated
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name LIKE '%_at'
  AND data_type = 'timestamp with time zone';

SELECT 
  'Shops with timezone configured' as check_name,
  COUNT(*) as shops_with_timezone
FROM shops 
WHERE timezone IS NOT NULL;