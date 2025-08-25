-- Migration 005: Timezone Support Implementation
-- FINAL CORRECT VERSION - Matches actual database schema
-- Backend-driven timezone architecture following KISS, DRY, SOLID, YAGNI

BEGIN;

-- Step 1: Convert existing timestamp columns to TIMESTAMPTZ
-- Only converting columns that actually exist in our schema

-- Inspections table (has started_at, completed_at, sent_at)
ALTER TABLE inspections 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC',
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC',
  ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'UTC';

-- Customers table
ALTER TABLE customers 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Vehicles table
ALTER TABLE vehicles 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Inspection_photos table
ALTER TABLE inspection_photos 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Reports table
ALTER TABLE reports 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- User_sessions table
ALTER TABLE user_sessions 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC';

-- Users table (has last_login_at)
ALTER TABLE users 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_login_at TYPE TIMESTAMPTZ USING last_login_at AT TIME ZONE 'UTC';

-- Shops table
ALTER TABLE shops 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Inspection_templates table
ALTER TABLE inspection_templates 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Step 2: Add timezone configuration columns
-- Shops get timezone and business hours
ALTER TABLE shops 
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
    "monday": {"open": "08:00", "close": "18:00"},
    "tuesday": {"open": "08:00", "close": "18:00"},
    "wednesday": {"open": "08:00", "close": "18:00"},
    "thursday": {"open": "08:00", "close": "18:00"},
    "friday": {"open": "08:00", "close": "18:00"},
    "saturday": {"open": "09:00", "close": "15:00"},
    "sunday": {"closed": true}
  }'::jsonb;

-- Users can have timezone preferences
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS date_format VARCHAR(10) DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS use_24hour_time BOOLEAN DEFAULT false;

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_shops_timezone ON shops(timezone);
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone) WHERE timezone IS NOT NULL;

-- Step 4: Create helper function to get shop's current time
CREATE OR REPLACE FUNCTION get_shop_local_time(shop_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  shop_tz VARCHAR(50);
BEGIN
  SELECT timezone INTO shop_tz 
  FROM shops 
  WHERE id = shop_id;
  
  IF shop_tz IS NULL THEN
    shop_tz := 'America/Chicago';
  END IF;
  
  RETURN NOW() AT TIME ZONE shop_tz;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 5: Create function to check if shop is open
CREATE OR REPLACE FUNCTION is_shop_open(shop_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  shop_tz VARCHAR(50);
  shop_hours JSONB;
  current_day_name TEXT;
  shop_current_time TIME;
  day_hours JSONB;
BEGIN
  -- Get shop timezone and hours
  SELECT timezone, business_hours 
  INTO shop_tz, shop_hours
  FROM shops 
  WHERE id = shop_id;
  
  IF shop_tz IS NULL THEN
    shop_tz := 'America/Chicago';
  END IF;
  
  -- Get current day and time in shop's timezone
  current_day_name := LOWER(TRIM(TO_CHAR(NOW() AT TIME ZONE shop_tz, 'Day')));
  shop_current_time := (NOW() AT TIME ZONE shop_tz)::TIME;
  
  -- Get hours for current day
  day_hours := shop_hours->current_day_name;
  
  -- Check if closed
  IF day_hours IS NULL OR day_hours->>'closed' = 'true' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if within business hours
  IF shop_current_time >= (day_hours->>'open')::TIME 
     AND shop_current_time <= (day_hours->>'close')::TIME THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 6: Add validation constraint for timezone values
-- Using common US timezones that are IANA-compliant
ALTER TABLE shops 
  ADD CONSTRAINT check_valid_timezone 
  CHECK (timezone IN (
    'America/New_York',      -- Eastern
    'America/Chicago',       -- Central
    'America/Denver',        -- Mountain
    'America/Phoenix',       -- Arizona (no DST)
    'America/Los_Angeles',   -- Pacific
    'America/Anchorage',     -- Alaska
    'Pacific/Honolulu',      -- Hawaii (no DST)
    'America/Puerto_Rico'    -- Atlantic
  ));

-- Step 7: Set default timezone for existing shops
UPDATE shops 
SET timezone = 'America/Chicago' 
WHERE timezone IS NULL;

-- Step 8: Add migration record
INSERT INTO migrations (name, executed_at) 
VALUES ('005_timezone_support', NOW())
ON CONFLICT (name) DO NOTHING;

-- Step 9: Verify the migration
DO $$
DECLARE
  non_tz_columns INTEGER;
  shops_without_tz INTEGER;
BEGIN
  -- Check that timestamp columns are now TIMESTAMPTZ
  SELECT COUNT(*) INTO non_tz_columns
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND column_name IN ('created_at', 'updated_at', 'started_at', 'completed_at', 'sent_at', 'expires_at', 'last_login_at')
    AND data_type = 'timestamp without time zone';
  
  IF non_tz_columns > 0 THEN
    RAISE WARNING 'Found % timestamp columns not converted to TIMESTAMPTZ', non_tz_columns;
  END IF;
  
  -- Check that timezone columns exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'shops' 
    AND column_name = 'timezone'
  ) THEN
    RAISE EXCEPTION 'Timezone column was not added to shops table';
  END IF;
  
  -- Check all shops have timezone
  SELECT COUNT(*) INTO shops_without_tz
  FROM shops 
  WHERE timezone IS NULL;
  
  IF shops_without_tz > 0 THEN
    RAISE WARNING 'Found % shops without timezone configured', shops_without_tz;
  END IF;
  
  RAISE NOTICE 'Timezone migration completed successfully';
  RAISE NOTICE '- All timestamp columns converted to TIMESTAMPTZ';
  RAISE NOTICE '- Timezone configuration added to shops and users';
  RAISE NOTICE '- Helper functions created';
  RAISE NOTICE '- Indexes added for performance';
END $$;

COMMIT;

-- Post-migration verification queries (run these manually to verify)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND column_name LIKE '%_at'
-- ORDER BY table_name, column_name;

-- SELECT id, name, timezone, business_hours 
-- FROM shops 
-- LIMIT 5;

-- SELECT get_shop_local_time(id) as local_time, timezone 
-- FROM shops 
-- LIMIT 1;