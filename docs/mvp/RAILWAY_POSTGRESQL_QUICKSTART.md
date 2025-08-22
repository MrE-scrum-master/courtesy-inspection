# Railway PostgreSQL Quick Start Guide

**Timeline**: 30 minutes to full setup  
**Cost**: $5/month (covered by existing Railway credits)  
**Result**: Complete development environment with real PostgreSQL  

---

## 🚀 5-Minute Setup

### Step 1: Install Railway CLI
```bash
# macOS
brew install railwayapp/railway/railway

# or via npm
npm install -g @railway/cli
```

### Step 2: Login & Create Project
```bash
# Login to Railway
railway login

# Create new project
railway init
# Name it: courtesy-inspection

# Link to your project
railway link
```

### Step 3: Add PostgreSQL
```bash
# Add PostgreSQL service
railway add

# Select "PostgreSQL"
# Railway automatically provisions it!
```

### Step 4: Get Database URL
```bash
# View your database URL
railway variables

# Copy the DATABASE_URL value
# It looks like: postgresql://user:pass@host:5432/railway
```

### Step 5: Create Volume for File Storage
```bash
# In Railway Dashboard (railway.app):
# 1. Go to your project
# 2. Click on your service
# 3. Go to "Settings" → "Volumes"
# 4. Add volume at path: /data
# 5. Size: 1GB (enough for MVP)
```

---

## 🏗️ Local Development Setup

### 1. Clone & Setup
```bash
# Clone the repo
git clone https://github.com/yourusername/courtesy-inspection.git
cd courtesy-inspection

# Make startup script executable
chmod +x start-dev.sh
```

### 2. Configure Environment
```bash
# Copy environment templates
cp server/.env.example server/.env
cp app/.env.example app/.env

# Edit server/.env
DATABASE_URL=postgresql://... # From railway variables
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=development
```

### 3. Initialize Database
```bash
# Connect to Railway PostgreSQL
railway run psql $DATABASE_URL

# Or use the migration command
cd server
railway run npm run migrate
```

### 4. Start Development
```bash
# Use the convenience script
./start-dev.sh

# Or manually:
# Terminal 1: cd server && npm run dev
# Terminal 2: cd app && npx expo start
```

---

## 📊 Railway CLI Database Commands

### Connect to Database
```bash
# Interactive PostgreSQL shell
railway connect postgresql

# Or with specific database URL
railway run psql $DATABASE_URL
```

### Run SQL Files
```bash
# Run schema
railway run psql $DATABASE_URL < templates/railway-schema.sql

# Run seed data
railway run psql $DATABASE_URL < templates/seed-data.sql
```

### Database Backup
```bash
# Backup database
railway run pg_dump $DATABASE_URL > backup.sql

# Restore database
railway run psql $DATABASE_URL < backup.sql
```

### View Logs
```bash
# View all logs
railway logs

# Follow logs (real-time)
railway logs -f

# Filter PostgreSQL logs
railway logs | grep postgres
```

---

## 🔧 Common Development Tasks

### Reset Database
```bash
# Drop all tables and recreate
railway run psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
railway run psql $DATABASE_URL < templates/railway-schema.sql
railway run psql $DATABASE_URL < templates/seed-data.sql
```

### Check Database Status
```bash
# Quick health check
curl http://localhost:3000/api/health

# Database stats
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM inspections;"
```

### Environment Variables
```bash
# View all Railway variables
railway variables

# Set a new variable
railway variables set MY_VAR=value

# Use Railway variables locally
railway run npm run dev
# This injects all Railway variables into your local environment!
```

---

## 🚢 Deployment

### Deploy to Railway
```bash
# Deploy current code
railway up

# Or use GitHub auto-deploy:
git push origin main
# Railway automatically deploys!
```

### Production Database
```bash
# Create production environment
railway environment add production

# Switch to production
railway environment production

# Add PostgreSQL to production
railway add
# Select PostgreSQL

# Deploy to production
railway up --environment production
```

---

## 💡 Pro Tips

### 1. Use Railway Run for Everything
```bash
# This ensures Railway environment variables are available
railway run npm run dev
railway run npm test
railway run npm run migrate
```

### 2. Database URL in Code
```javascript
// db.js - Works locally and in production
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/courtesy'
```

### 3. File Storage Path
```javascript
// Works with Railway volumes
const UPLOAD_PATH = process.env.RAILWAY_VOLUME_PATH 
  ? `${process.env.RAILWAY_VOLUME_PATH}/uploads`
  : './data/uploads'
```

### 4. Health Checks
```javascript
// Railway expects /health endpoint
app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabase()
  res.json({ 
    status: dbHealthy ? 'healthy' : 'unhealthy',
    database: dbHealthy 
  })
})
```

---

## 🔍 Troubleshooting

### Can't Connect to Database
```bash
# Check Railway service status
railway status

# Verify DATABASE_URL
railway variables

# Test connection
railway run psql $DATABASE_URL -c "SELECT 1;"
```

### Files Not Persisting
```bash
# Ensure volume is mounted
# Check Railway Dashboard → Service → Volumes
# Should show /data mounted

# Use absolute paths in code
const uploadPath = '/data/uploads' // Railway volume
```

### Port Issues
```bash
# Railway provides PORT automatically
const PORT = process.env.PORT || 3000

# Never hardcode ports for production!
```

---

## 📈 Monitoring

### Railway Dashboard
- CPU usage
- Memory usage
- Network requests
- Database connections
- Deployment history

### CLI Monitoring
```bash
# Service metrics
railway status

# Live logs
railway logs -f

# Database size
railway run psql $DATABASE_URL -c "SELECT pg_database_size('railway');"
```

---

## 🎯 Next Steps

1. **Run the schema**: `railway run psql $DATABASE_URL < templates/railway-schema.sql`
2. **Start development**: `./start-dev.sh`
3. **Test the API**: `curl http://localhost:3000/api/health`
4. **Open Expo**: Navigate to `http://localhost:8081`

You're ready to build! The Railway PostgreSQL setup gives you:
- Real PostgreSQL (same as production)
- Persistent file storage
- Easy deployment
- Built-in monitoring
- $5/month total cost

When ready to migrate to Supabase later, follow `MIGRATION_TO_SUPABASE.md`.