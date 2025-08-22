# Courtesy Inspection - Production Deployment Guide

## Overview

This guide covers the complete deployment process for the Courtesy Inspection MVP to Railway's production environment. The deployment includes zero-downtime strategies, automated monitoring, and comprehensive backup systems.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Expo App      │────│   Railway API   │────│  PostgreSQL DB  │
│ (iOS/Android/   │    │  (Express.js)   │    │   (Railway)     │
│     Web)        │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────│  Static Files   │──────────────┘
                        │   (Railway      │
                        │   Volumes)      │
                        └─────────────────┘
                               │
                    ┌─────────────────┐
                    │   Monitoring    │
                    │ (Prometheus +   │
                    │   Grafana)      │
                    └─────────────────┘
```

## Prerequisites

### Required Tools
- **Railway CLI**: `npm install -g @railway/cli`
- **Node.js**: Version 20.x or later
- **Git**: Version 2.30 or later
- **Docker**: For local testing (optional)

### Required Accounts
- Railway account with billing enabled
- GitHub account for CI/CD
- Slack workspace for notifications (optional)
- Sentry account for error tracking (optional)

### Environment Setup
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Verify login
railway whoami
```

## Environment Configuration

### Production Environment Variables

Create the following environment variables in Railway:

#### Core Application
```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# CORS Configuration
CORS_ORIGIN=https://app.courtesy-inspection.com
```

#### Database Configuration
```bash
# Automatically provided by Railway PostgreSQL service
DATABASE_URL=${{ POSTGRES.DATABASE_URL }}

# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_CONNECTION_TIMEOUT=10000
DB_IDLE_TIMEOUT=30000
```

#### Authentication & Security
```bash
# Generate with: openssl rand -base64 32
JWT_SECRET=your-secure-jwt-secret-here
SESSION_SECRET=your-secure-session-secret-here

# Password hashing rounds
BCRYPT_ROUNDS=12

# Token expiration
JWT_EXPIRES_IN=24h
```

#### File Upload Configuration
```bash
MAX_FILE_SIZE=10485760  # 10MB
MAX_FILES=20
UPLOAD_PATH=/app/uploads
```

#### Rate Limiting
```bash
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # requests per window
```

#### SMS Configuration (Telnyx)
```bash
TELNYX_API_KEY=your-telnyx-api-key
TELNYX_PUBLIC_KEY=your-telnyx-public-key
TELNYX_PHONE_NUMBER=+1234567890
```

#### Monitoring & Error Tracking
```bash
SENTRY_DSN=your-sentry-dsn-here
SENTRY_ENVIRONMENT=production
```

#### Caching
```bash
REDIS_URL=${{ REDIS.REDIS_URL }}  # If using Redis
CACHE_TTL=3600  # 1 hour
```

## Deployment Process

### Automated Deployment (Recommended)

The project includes GitHub Actions for automated deployment:

1. **Push to main branch** triggers production deployment
2. **Push to staging branch** triggers staging deployment
3. **Pull requests** trigger test runs

#### GitHub Secrets Configuration

Add these secrets to your GitHub repository:

```bash
# Railway tokens
RAILWAY_TOKEN_PRODUCTION=your-production-token
RAILWAY_TOKEN_STAGING=your-staging-token

# Application secrets
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
TELNYX_API_KEY=your-telnyx-key
TELNYX_PUBLIC_KEY=your-telnyx-public-key
SENTRY_DSN=your-sentry-dsn

# Notification webhooks
SLACK_WEBHOOK=your-slack-webhook-url

# API keys for testing
STAGING_API_KEY=your-staging-api-key
PRODUCTION_API_KEY=your-production-api-key
```

### Manual Deployment

For manual deployments, use the provided scripts:

#### Production Deployment
```bash
# Full production deployment with backup
./scripts/deploy.sh -e production -b

# Force deployment without tests (emergency only)
./scripts/deploy.sh -e production -f -s
```

#### Staging Deployment
```bash
# Staging deployment
./scripts/deploy.sh -e staging

# Staging deployment without tests
./scripts/deploy.sh -e staging -s
```

## Step-by-Step Manual Deployment

### 1. Pre-Deployment Checklist

```bash
# Verify environment
echo "Current branch: $(git branch --show-current)"
echo "Uncommitted changes: $(git status --porcelain | wc -l)"
echo "Railway status: $(railway whoami)"

# Run local tests
cd server
npm run test:unit
npm run test:integration
npm run lint
npm run type-check
```

### 2. Create Railway Services

#### Database Service
```bash
# Create PostgreSQL service
railway add --service postgresql

# Set database plan (hobby for staging, pro for production)
railway configure --service postgres --plan pro
```

#### Redis Service (Optional)
```bash
# Create Redis service for caching
railway add --service redis

# Configure Redis
railway configure --service redis --plan hobby
```

#### API Service
```bash
# Create main API service
railway create --name courtesy-inspection-api

# Link to project
railway link
```

### 3. Configure Services

#### Database Schema
```bash
# Run migrations
railway run "npm run db:migrate" --service courtesy-inspection-api

# Seed with initial data (first deployment only)
railway run "npm run db:seed" --service courtesy-inspection-api
```

#### Volume Configuration
```bash
# Create volume for file uploads
railway volume create --name uploads --size 5GB --mount-path /app/uploads
```

### 4. Deploy Application

#### Build and Deploy
```bash
# Deploy from current directory
railway up --service courtesy-inspection-api --environment production

# Watch deployment logs
railway logs --service courtesy-inspection-api --environment production
```

#### Verify Deployment
```bash
# Check service status
railway status --service courtesy-inspection-api --environment production

# Test health endpoint
curl https://api.courtesy-inspection.com/api/health
```

### 5. Post-Deployment Verification

#### Health Checks
```bash
# API health
curl -f https://api.courtesy-inspection.com/api/health

# Database connectivity
curl -f https://api.courtesy-inspection.com/api/health/database

# Authentication endpoint
curl -f https://api.courtesy-inspection.com/api/auth/health
```

#### Performance Tests
```bash
# Run performance tests
npm run test:performance

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.courtesy-inspection.com/api/health
```

## Configuration Files

### railway.toml
Located at project root, this file defines Railway deployment configuration:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm ci --only=production && npm run build"

[deploy]
numReplicas = 1
restartPolicyType = "ON_FAILURE"

# See full configuration in railway.toml
```

### Environment-Specific Configurations

#### Production Overrides
```toml
[environments.production]
[environments.production.variables]
NODE_ENV = "production"
LOG_LEVEL = "info"
BCRYPT_ROUNDS = "12"
DB_POOL_MAX = "20"
```

#### Staging Overrides
```toml
[environments.staging]
[environments.staging.variables]
NODE_ENV = "staging"
LOG_LEVEL = "debug"
BCRYPT_ROUNDS = "10"
DB_POOL_MAX = "5"
```

## Monitoring Setup

### Application Monitoring

#### Health Checks
The application includes comprehensive health checks:
- Database connectivity
- Redis connectivity (if enabled)
- File system access
- Memory usage
- CPU usage

#### Metrics Collection
Prometheus metrics are exposed at `/metrics`:
- Request rates and latencies
- Database query performance
- Business metrics (inspections, SMS)
- System resource usage

### Log Aggregation

#### Structured Logging
All logs are structured JSON with correlation IDs:
```json
{
  "level": "INFO",
  "message": "HTTP Request",
  "timestamp": "2024-01-15T10:30:00Z",
  "correlationId": "req_abc123",
  "userId": "user_123",
  "method": "GET",
  "url": "/api/inspections"
}
```

#### Log Retention
- **Production**: 30 days
- **Staging**: 7 days
- **Critical errors**: Permanent retention

### Alerting

#### Critical Alerts
- API downtime (>1 minute)
- High error rate (>5%)
- Database connection failures
- Memory/CPU usage >80%

#### Warning Alerts
- High response times (>2 seconds)
- Database query performance issues
- Low disk space (<20%)

## Backup and Recovery

### Automated Backups

#### Database Backups
```bash
# Daily production backups
railway run "npm run db:backup" --service courtesy-inspection-db

# Backup with retention
./scripts/backup.sh -e production -r 30 -c -v
```

#### File System Backups
Railway volumes are automatically backed up, but for critical files:
```bash
# Backup uploads directory
railway run "tar -czf /tmp/uploads-backup-$(date +%Y%m%d).tar.gz /app/uploads"
```

### Disaster Recovery

#### Database Recovery
```bash
# List available backups
railway run "npm run db:list-backups" --service courtesy-inspection-db

# Restore from backup
railway run "npm run db:restore backup_id_here" --service courtesy-inspection-db
```

#### Full System Recovery
```bash
# Emergency rollback
./scripts/rollback.sh -e production -r

# Rollback with database restore
./scripts/rollback.sh -e production -r --restore-db
```

## Performance Optimization

### Database Optimization

#### Connection Pooling
```javascript
// Configured in database.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000
});
```

#### Query Optimization
- All queries use parameterized statements
- Database indexes on frequently queried columns
- Connection pooling with automatic failover

### Application Optimization

#### Caching Strategy
```javascript
// Redis caching for frequent queries
const cacheKey = `inspection:${inspectionId}`;
const cached = await redis.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}
```

#### Resource Limits
```toml
[services.resources]
memory = "1Gi"      # Production
cpu = "500m"        # Production
ephemeralStorage = "5Gi"
```

## Security Configuration

### Network Security

#### CORS Configuration
```javascript
// Only allow specific origins
const corsOptions = {
  origin: process.env.CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
```

#### Rate Limiting
```javascript
// Different limits for different endpoints
app.use('/api/auth', rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }));
app.use('/api/', rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }));
```

### Data Security

#### Encryption
- All data in transit encrypted with TLS 1.3
- Passwords hashed with bcrypt (12 rounds in production)
- JWT tokens with secure secrets
- Database connections encrypted

#### Input Validation
```javascript
// All inputs validated with Joi schemas
const inspectionSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  vehicle: Joi.object({
    year: Joi.number().min(1900).max(new Date().getFullYear() + 1).required(),
    make: Joi.string().max(50).required(),
    model: Joi.string().max(50).required()
  }).required()
});
```

## Troubleshooting

### Common Issues

#### Deployment Failures

**Issue**: Build fails with memory error
```bash
# Solution: Increase build resources
railway configure --build-memory 2Gi
```

**Issue**: Database connection fails
```bash
# Solution: Check database service status
railway status --service courtesy-inspection-db

# Restart database service if needed
railway restart --service courtesy-inspection-db
```

#### Performance Issues

**Issue**: High response times
```bash
# Check database queries
railway logs --service courtesy-inspection-api | grep "slow query"

# Check memory usage
railway metrics --service courtesy-inspection-api
```

**Issue**: Out of memory errors
```bash
# Increase memory allocation
railway configure --memory 2Gi --service courtesy-inspection-api
```

### Debug Commands

#### Application Debugging
```bash
# View real-time logs
railway logs --follow --service courtesy-inspection-api

# Check environment variables
railway variables --service courtesy-inspection-api

# Connect to database
railway connect postgres
```

#### Health Diagnostics
```bash
# Full health check
curl https://api.courtesy-inspection.com/api/health | jq

# Database health
curl https://api.courtesy-inspection.com/api/health/database | jq

# Memory usage
curl https://api.courtesy-inspection.com/api/health/memory | jq
```

## Maintenance

### Regular Maintenance Tasks

#### Weekly
- Review application logs for errors
- Check database performance metrics
- Verify backup completion
- Update dependencies (non-major versions)

#### Monthly
- Security audit with `npm audit`
- Performance baseline review
- Backup restore testing
- SSL certificate verification

#### Quarterly
- Dependency major version updates
- Security penetration testing
- Disaster recovery testing
- Performance optimization review

### Update Process

#### Application Updates
```bash
# Deploy to staging first
./scripts/deploy.sh -e staging

# Run staging tests
npm run test:e2e:staging

# Deploy to production
./scripts/deploy.sh -e production
```

#### Database Schema Updates
```bash
# Create migration
npm run db:migration:create update_name

# Test migration on staging
railway run "npm run db:migrate" --service courtesy-inspection-api --environment staging

# Deploy to production with migration
./scripts/deploy.sh -e production
```

## Support Contacts

### Emergency Contacts
- **On-call Engineer**: +1-XXX-XXX-XXXX
- **Technical Lead**: tech-lead@courtesy-inspection.com
- **Operations**: ops@courtesy-inspection.com

### Service Providers
- **Railway Support**: https://railway.app/help
- **Telnyx Support**: https://telnyx.com/support
- **Sentry Support**: https://sentry.io/support

### Documentation
- **API Docs**: https://docs.courtesy-inspection.com/api
- **User Guide**: https://docs.courtesy-inspection.com/user
- **Runbooks**: https://docs.courtesy-inspection.com/runbooks