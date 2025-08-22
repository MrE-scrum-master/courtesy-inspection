# Railway PostgreSQL Setup Guide

Complete setup guide for Railway PostgreSQL deployment with file storage and environment configuration.

## Prerequisites

- Railway account (sign up at [railway.app](https://railway.app))
- Railway CLI installed
- Node.js project ready for deployment

## Installation

### 1. Install Railway CLI

```bash
# macOS
brew install railway

# Windows/Linux
npm install -g @railway/cli

# Or download from: https://docs.railway.app/develop/cli
```

### 2. Login to Railway

```bash
railway login
```

## Project Setup

### 1. Initialize Railway Project

```bash
# In your project directory
railway init

# Follow prompts to create new project or link existing
```

### 2. Add PostgreSQL Service

```bash
# Add PostgreSQL to your project
railway add postgresql

# This creates a PostgreSQL instance and sets DATABASE_URL automatically
```

### 3. View Database Connection Info

```bash
# Show all environment variables
railway variables

# Show specific database URL
railway variables --kv | grep DATABASE_URL
```

## Database Management

### 1. Connect to Database

```bash
# Connect via Railway CLI
railway connect postgresql

# Or use psql directly
railway run psql $DATABASE_URL
```

### 2. Run Database Migrations

```bash
# Run your schema file
railway run psql $DATABASE_URL -f templates/railway-schema.sql

# Or connect and paste SQL manually
railway connect postgresql
# Then paste your SQL schema
```

### 3. Database Commands

```bash
# List tables
railway run psql $DATABASE_URL -c "\dt"

# Check database size
railway run psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('railway'));"

# Create database backup
railway run pg_dump $DATABASE_URL > backup.sql

# Restore database
railway run psql $DATABASE_URL < backup.sql
```

## Volume Setup for File Storage

### 1. Create Volume

```bash
# Create a volume for file uploads
railway volume create --name uploads --mount /data

# Verify volume
railway volume list
```

### 2. Configure Upload Directory

Add to your environment variables:

```bash
railway variables set UPLOAD_DIR=/data/uploads
railway variables set MAX_FILE_SIZE=10485760
```

### 3. Volume Commands

```bash
# List volumes
railway volume list

# Mount volume to service
railway volume attach uploads --mount /data

# Check volume usage
railway logs --tail 100 | grep -i volume
```

## Environment Configuration

### 1. Set Core Variables

```bash
# Node.js environment
railway variables set NODE_ENV=production
railway variables set PORT=3000

# Database (automatically set when you add PostgreSQL)
# DATABASE_URL is automatically configured

# JWT Authentication
railway variables set JWT_SECRET=$(openssl rand -hex 64)
railway variables set JWT_EXPIRES=24h
railway variables set REFRESH_EXPIRES=7d

# Domain configuration
railway variables set PUBLIC_URL=https://your-app-name.up.railway.app
railway variables set BASE_URL=https://your-app-name.up.railway.app
```

### 2. Set Twilio Variables

```bash
railway variables set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
railway variables set TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
railway variables set TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Optional Variables

```bash
# Database connection tuning
railway variables set DB_POOL_MAX=20
railway variables set DB_IDLE_TIMEOUT=30000
railway variables set DB_CONNECTION_TIMEOUT=2000

# File upload limits
railway variables set MAX_FILE_SIZE=10485760
railway variables set ALLOWED_FILE_TYPES=image/jpeg,image/jpg,image/png,image/webp

# Debug mode
railway variables set DEBUG=false
railway variables set CORS_ALLOW_ALL=false
```

## Deployment

### 1. Deploy Application

```bash
# Deploy current directory
railway up

# Deploy with build command
railway up --detach

# Deploy specific branch
railway up --branch main
```

### 2. Monitor Deployment

```bash
# View logs
railway logs

# Follow logs in real-time
railway logs --tail

# Check service status
railway status
```

### 3. Custom Domain (Optional)

```bash
# Add custom domain
railway domain add your-domain.com

# View domains
railway domain list

# Remove domain
railway domain remove your-domain.com
```

## Local Development with Railway

### 1. Run Local with Railway Environment

```bash
# Run locally with Railway environment variables
railway run npm start

# Or run specific command
railway run node server.js

# Run development server
railway run npm run dev
```

### 2. Link Local Environment

```bash
# Create .env file with Railway variables
railway variables --kv > .env

# Run with local .env
npm start
```

### 3. Development Database

```bash
# Use Railway database locally
railway run npm run migrate

# Run seeds
railway run npm run seed

# Reset database
railway run npm run reset-db
```

## Database Maintenance

### 1. Backup and Restore

```bash
# Create backup
railway run pg_dump $DATABASE_URL --clean --no-owner --no-privileges > backup.sql

# Restore backup
railway run psql $DATABASE_URL < backup.sql

# Schedule backups (using cron locally or Railway cron)
0 2 * * * railway run pg_dump $DATABASE_URL > "backup-$(date +%Y%m%d).sql"
```

### 2. Monitor Database

```bash
# Check database connections
railway run psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check table sizes
railway run psql $DATABASE_URL -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relname::regclass)) AS size FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relname::regclass) DESC;"

# Check slow queries
railway run psql $DATABASE_URL -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### 3. Database Performance

```bash
# Enable query logging
railway variables set POSTGRES_LOG_STATEMENT=all

# Analyze query performance
railway run psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM inspections WHERE shop_id = 'uuid-here';"

# Update table statistics
railway run psql $DATABASE_URL -c "ANALYZE;"
```

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   ```bash
   railway variables set DB_CONNECTION_TIMEOUT=5000
   ```

2. **File Upload Fails**
   ```bash
   # Check volume mount
   railway logs | grep -i volume
   railway volume list
   ```

3. **Memory Issues**
   ```bash
   # Check memory usage
   railway logs | grep -i memory
   # Upgrade plan if needed
   ```

4. **Environment Variables Not Loading**
   ```bash
   # Refresh variables
   railway variables
   # Redeploy
   railway up --detach
   ```

### Debug Commands

```bash
# Check service health
curl https://your-app.up.railway.app/health

# Test database connection
railway run node -e "const db = require('./templates/db')(); db.healthCheck().then(console.log)"

# Test file upload directory
railway run ls -la /data/uploads

# Check environment variables
railway run printenv | grep -E "(DATABASE_URL|JWT_SECRET|TWILIO)"
```

## Production Checklist

- [ ] PostgreSQL service added and connected
- [ ] Volume created and mounted to `/data`
- [ ] All environment variables set
- [ ] Database schema deployed
- [ ] File upload directory accessible
- [ ] Health check endpoint working
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active (automatic)
- [ ] Backup strategy implemented
- [ ] Monitoring and logging configured

## Security Notes

- **Never commit** environment variables to version control
- Database credentials are **automatically managed** by Railway
- Use **JWT secrets** with sufficient entropy (64+ characters)
- Enable **CORS** only for your domain in production
- **File uploads** should be validated and scanned
- Set up **database connection limits** to prevent exhaustion
- **Monitor logs** for suspicious activity
- Use **HTTPS only** in production (Railway provides this automatically)

## Cost Optimization

- Use **shared PostgreSQL** for development
- Implement **connection pooling** (included in template)
- **Archive old data** to reduce database size
- **Optimize queries** with proper indexes
- **Monitor resource usage** via Railway dashboard
- Consider **read replicas** for high-traffic applications

## Next Steps

After setup is complete:

1. Test all API endpoints
2. Verify file upload functionality
3. Send test SMS with report links
4. Monitor application logs
5. Set up automated backups
6. Configure custom domain
7. Implement monitoring and alerts

For migration to Supabase later, see `MIGRATION_TO_SUPABASE.md`.