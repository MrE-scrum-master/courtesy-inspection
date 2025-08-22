# Migration Guide: Railway PostgreSQL to Supabase

Complete step-by-step guide for migrating from Railway PostgreSQL to Supabase with minimal downtime.

## Overview

This guide covers migrating your Courtesy Inspection app from Railway PostgreSQL to Supabase, including:
- Database schema and data migration
- Authentication system changes
- File storage migration
- Code updates
- Testing and rollback procedures

## Pre-Migration Preparation

### 1. Create Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create new project
3. Note down project details:
   - Project URL
   - Anonymous key
   - Service role key
   - JWT secret

### 2. Backup Current Data

```bash
# Create full backup
railway run pg_dump $DATABASE_URL --clean --no-owner --no-privileges > railway_backup.sql

# Create data-only backup
railway run pg_dump $DATABASE_URL --data-only --no-owner --no-privileges > railway_data.sql

# Verify backup
head -n 50 railway_backup.sql
```

### 3. Document Current State

```bash
# List all tables
railway run psql $DATABASE_URL -c "\dt"

# Count records in each table
railway run psql $DATABASE_URL -c "
SELECT 
  schemaname,
  tablename,
  n_tup_ins AS inserts,
  n_tup_upd AS updates,
  n_tup_del AS deletes,
  n_live_tup AS live_rows
FROM pg_stat_user_tables
ORDER BY live_rows DESC;
"

# Export file paths for photo migration
railway run psql $DATABASE_URL -c "SELECT file_path, file_url FROM inspection_photos;" > photos_inventory.csv
```

## Phase 1: Database Schema Migration

### 1. Convert Schema to Supabase

**Create:** `templates/supabase-schema.sql` (convert Railway schema)

Key changes needed:
- Remove Railway-specific user management
- Add Supabase auth.users integration
- Convert to RLS (Row Level Security)
- Add Supabase-specific functions

### 2. Create Schema in Supabase

1. Open Supabase SQL Editor
2. Run the converted schema:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Run full supabase-schema.sql content
-- (Copy from templates/supabase-schema.sql)
```

### 3. Verify Schema Creation

```sql
-- Check tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check RLS policies
SELECT schemaname, tablename, policyname FROM pg_policies;

-- Check functions
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';
```

## Phase 2: Data Migration

### 1. Transform Data for Supabase

**Create data transformation script:**

```javascript
// data-transform.js
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateData() {
  // Read Railway data export
  const railwayData = JSON.parse(fs.readFileSync('railway_export.json'));
  
  // Transform users data (Railway users -> Supabase profiles)
  const profiles = railwayData.users.map(user => ({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    phone: user.phone,
    role: user.role,
    shop_id: user.shop_id,
    created_at: user.created_at
  }));
  
  // Insert profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .insert(profiles);
    
  if (profileError) {
    console.error('Profile migration error:', profileError);
    return;
  }
  
  // Migrate other tables in dependency order
  await migrateTable('shops', railwayData.shops);
  await migrateTable('customers', railwayData.customers);
  await migrateTable('vehicles', railwayData.vehicles);
  await migrateTable('inspection_templates', railwayData.inspection_templates);
  await migrateTable('inspections', railwayData.inspections);
  await migrateTable('inspection_photos', railwayData.inspection_photos);
  await migrateTable('reports', railwayData.reports);
}

async function migrateTable(tableName, data) {
  const { error } = await supabase
    .from(tableName)
    .insert(data);
    
  if (error) {
    console.error(`${tableName} migration error:`, error);
  } else {
    console.log(`${tableName} migrated: ${data.length} records`);
  }
}

migrateData().catch(console.error);
```

### 2. Export Data from Railway

```bash
# Export data as JSON
railway run node export-data.js > railway_export.json

# Or use pg_dump with specific format
railway run pg_dump $DATABASE_URL --data-only --column-inserts > railway_data.sql
```

### 3. Import Data to Supabase

```bash
# Set Supabase environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run data transformation
node data-transform.js

# Verify data migration
```

### 4. Verify Data Migration

```sql
-- In Supabase SQL Editor
SELECT 'profiles' as table_name, count(*) as count FROM profiles
UNION ALL
SELECT 'shops', count(*) FROM shops
UNION ALL
SELECT 'customers', count(*) FROM customers
UNION ALL
SELECT 'vehicles', count(*) FROM vehicles
UNION ALL
SELECT 'inspections', count(*) FROM inspections
UNION ALL
SELECT 'inspection_photos', count(*) FROM inspection_photos
UNION ALL
SELECT 'reports', count(*) FROM reports;
```

## Phase 3: File Storage Migration

### 1. Create Supabase Storage Bucket

```javascript
// In Supabase console or via API
const { data, error } = await supabase.storage.createBucket('inspection-photos', {
  public: true,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  fileSizeLimit: 10485760 // 10MB
});
```

### 2. Migrate Files from Railway

```javascript
// migrate-files.js
const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateFiles() {
  // Get list of files from Railway
  const photosData = await fs.readFile('photos_inventory.csv', 'utf8');
  const photos = photosData.split('\n').slice(1); // Skip header
  
  for (const photoLine of photos) {
    if (!photoLine.trim()) continue;
    
    const [filePath, fileUrl] = photoLine.split(',');
    
    try {
      // Read file from Railway volume
      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('inspection-photos')
        .upload(fileName, fileBuffer);
        
      if (error) {
        console.error(`Failed to upload ${fileName}:`, error);
        continue;
      }
      
      // Update database with new URL
      const publicUrl = supabase.storage
        .from('inspection-photos')
        .getPublicUrl(fileName).data.publicUrl;
        
      await supabase
        .from('inspection_photos')
        .update({ file_url: publicUrl })
        .eq('file_path', filePath);
        
      console.log(`Migrated: ${fileName}`);
    } catch (err) {
      console.error(`Error migrating ${filePath}:`, err);
    }
  }
}

migrateFiles().catch(console.error);
```

### 3. Update File URLs in Database

```sql
-- Update photo URLs to point to Supabase storage
UPDATE inspection_photos 
SET file_url = 'https://your-project.supabase.co/storage/v1/object/public/inspection-photos/' || 
              substring(file_path from '[^/]+$')
WHERE file_url LIKE '%railway%';
```

## Phase 4: Code Changes

### 1. Update Database Connection

**Replace:** `templates/db.js` with Supabase client

```javascript
// db-supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
```

### 2. Update Authentication

**Replace:** `templates/auth.js` with Supabase Auth

```javascript
// auth-supabase.js
const { createClient } = require('@supabase/supabase-js');

class AuthService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async register({ email, password, fullName, phone, role, shopId }) {
    // Create user in Supabase Auth
    const { data: { user }, error: authError } = await this.supabase.auth.admin
      .createUser({
        email,
        password,
        user_metadata: { full_name: fullName, phone, role, shop_id: shopId }
      });

    if (authError) throw authError;

    // Profile is created automatically via trigger
    return { user };
  }

  async login({ email, password }) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    return data;
  }

  // ... other methods updated for Supabase
}
```

### 3. Update Server Code

**Update:** `templates/railway-server.js`

- Replace PostgreSQL client with Supabase client
- Update all database queries to use Supabase API
- Replace file upload to use Supabase Storage
- Update authentication middleware

### 4. Update Environment Variables

**Create:** `.env.supabase`

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Remove Railway-specific variables
# DATABASE_URL (no longer needed)
# UPLOAD_DIR (no longer needed)

# Keep existing
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
PUBLIC_URL=...
```

## Phase 5: Testing

### 1. Test Database Operations

```javascript
// test-migration.js
const supabase = require('./templates/db-supabase');

async function testMigration() {
  // Test user registration
  console.log('Testing user registration...');
  // ... test code

  // Test inspection creation
  console.log('Testing inspection creation...');
  // ... test code

  // Test file upload
  console.log('Testing file upload...');
  // ... test code

  // Test report generation
  console.log('Testing report generation...');
  // ... test code
}

testMigration().catch(console.error);
```

### 2. Test Authentication

```bash
# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

# Test protected endpoint
curl -X GET http://localhost:3000/api/inspections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Test File Operations

```bash
# Test file upload
curl -X POST http://localhost:3000/api/inspections/photos \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "photo=@test-image.jpg" \
  -F "inspectionId=uuid-here"

# Test file serving
curl -I http://localhost:3000/api/uploads/filename.jpg
```

### 4. End-to-End Testing

- Create new user account
- Create inspection with photos
- Generate and send report
- Verify SMS links work
- Test all user roles
- Verify data integrity

## Phase 6: Deployment

### 1. Deploy to Staging

```bash
# Deploy with Supabase configuration
railway up --environment staging

# Test in staging environment
curl https://staging-your-app.up.railway.app/health
```

### 2. Production Deployment

```bash
# Update production environment variables
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
railway variables unset DATABASE_URL

# Deploy to production
railway up --environment production
```

### 3. DNS and Domain Updates

- Update any hardcoded URLs
- Test custom domain functionality
- Verify SSL certificates
- Update monitoring endpoints

## Rollback Plan

### 1. Quick Rollback (Code Only)

```bash
# Revert to Railway database code
git checkout main -- templates/db.js templates/auth.js
railway up
```

### 2. Full Rollback (Data)

```bash
# Restore Railway database from backup
railway run psql $DATABASE_URL < railway_backup.sql

# Revert environment variables
railway variables set DATABASE_URL=your-railway-db-url
railway variables unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY

# Deploy old version
git checkout pre-migration-tag
railway up
```

### 3. File Storage Rollback

```bash
# Restore files to Railway volume if needed
# This requires manual process or backup restoration
```

## Post-Migration Checklist

- [ ] All data migrated successfully
- [ ] Authentication working correctly
- [ ] File upload/download functional
- [ ] SMS functionality working
- [ ] Report generation working
- [ ] All API endpoints tested
- [ ] Performance acceptable
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Documentation updated
- [ ] Team trained on new system

## Performance Comparison

After migration, monitor:

- Database query response times
- File upload/download speeds
- Authentication latency
- Overall application performance
- Resource usage costs

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**
   - Check user context in policies
   - Verify JWT token claims
   - Test with service role key

2. **File Upload Issues**
   - Check bucket permissions
   - Verify CORS settings
   - Test with different file types

3. **Authentication Problems**
   - Verify JWT secret configuration
   - Check user creation triggers
   - Test with different user roles

4. **Data Migration Issues**
   - Check foreign key constraints
   - Verify data types match
   - Test with smaller datasets first

### Support Resources

- Supabase Documentation: [supabase.com/docs](https://supabase.com/docs)
- Community Forum: [github.com/supabase/supabase/discussions](https://github.com/supabase/supabase/discussions)
- Discord: [discord.supabase.com](https://discord.supabase.com)

## Cost Analysis

Compare costs between Railway PostgreSQL and Supabase:

**Railway:**
- Database hosting: $X/month
- File storage: $Y/GB
- Bandwidth: $Z/GB

**Supabase:**
- Free tier: Up to 500MB database, 1GB storage
- Pro tier: $25/month for larger usage
- Additional storage: $0.125/GB/month
- Bandwidth: Included in plans

Calculate total cost based on your usage patterns.

Migration complete! Your application now runs on Supabase with improved scalability and features.