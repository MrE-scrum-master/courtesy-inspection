# ENVIRONMENT CONFIG - MVP VERSION

## Philosophy: Simple .env files, no complexity

This MVP version focuses on simplicity and speed-to-market using basic .env files and simple deployment to platforms like Render or Railway.

## Overview

Basic environment configuration for the Courtesy Inspection MVP platform using simple .env files and default ports. No complex port management, AWS Secrets Manager, or multi-environment setups.

## Environment Configuration

### Single .env File

```bash
# =============================================================================
# COURTESY INSPECTION - MVP ENVIRONMENT
# =============================================================================

# Environment Configuration
NODE_ENV=production
APP_ENV=production
DEBUG=false
LOG_LEVEL=info

# Application Configuration
APP_NAME="Courtesy Inspection"
APP_VERSION=1.0.0
APP_URL=https://app.courtesyinspection.com
API_URL=https://api.courtesyinspection.com
API_VERSION=v1

# Port Configuration (use defaults - Render/Railway will assign)
PORT=3000

# Database Configuration (use provider default)
DATABASE_URL=postgresql://username:password@hostname:5432/courtesy_inspection

# Redis Configuration (use provider default)
REDIS_URL=redis://hostname:6379

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
JWT_ISSUER=courtesy-inspection-api
JWT_AUDIENCE=courtesy-inspection-client

# OAuth Configuration
OAUTH_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_APPLE_CLIENT_ID=com.courtesyinspection.app
OAUTH_APPLE_PRIVATE_KEY_PATH=./certs/apple_private_key.p8
OAUTH_APPLE_KEY_ID=your_apple_key_id
OAUTH_APPLE_TEAM_ID=your_apple_team_id

# Telnyx SMS Configuration
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_MESSAGING_PROFILE_ID=your_messaging_profile_id
TELNYX_WEBHOOK_URL=https://api.courtesyinspection.com/webhooks/telnyx
TELNYX_WEBHOOK_SECRET=your_telnyx_webhook_secret
SMS_FROM_NUMBER=+1234567890
SMS_RATE_LIMIT=1000

# VIN Decoder APIs
VIN_API_PRIMARY_KEY=your_vin_api_key
VIN_API_PRIMARY_URL=https://api.vindecoder.eu/3.2
VIN_API_SECONDARY_KEY=your_secondary_vin_api_key
VIN_API_SECONDARY_URL=https://vpic.nhtsa.dot.gov/api
VIN_API_TIMEOUT=10000
VIN_API_RETRY_ATTEMPTS=3

# Email Configuration (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@courtesyinspection.com
EMAIL_REPLY_TO=support@courtesyinspection.com
EMAIL_TEMPLATE_INSPECTION_COMPLETE=your_template_id
EMAIL_TEMPLATE_WELCOME=your_welcome_template_id

# File Storage (Simple S3 or local)
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-west-2
AWS_S3_BUCKET=courtesy-inspection
AWS_S3_PREFIX=uploads/
STORAGE_TYPE=s3

# CORS Configuration
CORS_ORIGIN=https://app.courtesyinspection.com
CORS_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_HEADERS=Content-Type,Authorization,X-Requested-With
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false
RATE_LIMIT_HEADERS=true

# Security Headers
HELMET_CONTENT_SECURITY_POLICY=true
HELMET_HSTS=true
HELMET_NO_SNIFF=true
HELMET_X_FRAME_OPTIONS=DENY
HELMET_X_XSS_PROTECTION=true

# SSL/TLS Configuration (handled by provider)
SSL_ENABLED=true

# React Native / Expo Configuration
EXPO_PUBLIC_API_URL=https://api.courtesyinspection.com
EXPO_PUBLIC_WS_URL=wss://api.courtesyinspection.com
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_VERSION=1.0.0

# Next.js Configuration
NEXTAUTH_URL=https://app.courtesyinspection.com
NEXTAUTH_SECRET=your_nextauth_secret
NEXT_PUBLIC_API_URL=https://api.courtesyinspection.com
NEXT_PUBLIC_WS_URL=wss://api.courtesyinspection.com
NEXT_PUBLIC_ENV=production

# WatermelonDB Configuration
WATERMELON_SYNC_URL=https://api.courtesyinspection.com/sync
WATERMELON_SYNC_INTERVAL=300000
WATERMELON_BATCH_SIZE=100
WATERMELON_DEBUG=false

# External Service URLs
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
PAYMENT_CURRENCY=USD

# AI/ML Configuration
OPENAI_API_KEY=your_openai_api_key
VISION_API_ENABLED=true

# Feature Flags
FEATURE_AI_ANALYSIS=true
FEATURE_VOICE_COMMANDS=false
FEATURE_ADVANCED_ANALYTICS=false
FEATURE_MOBILE_PAYMENT=true
FEATURE_MULTI_LANGUAGE=false
```

## Deployment Platforms

### Render Deployment

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Use the following settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment: Add all variables from .env above

### Railway Deployment

1. Connect your GitHub repository to Railway
2. Create a new project
3. Add environment variables from .env above
4. Railway will automatically assign PORT

### Database Setup

Use managed database services:
- **PostgreSQL**: Render PostgreSQL, Railway PostgreSQL, or Neon
- **Redis**: Upstash Redis or Railway Redis

## Environment Validation

### Simple Validation Script

```javascript
// scripts/validate-env-mvp.js
const required = [
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'TELNYX_API_KEY',
  'SENDGRID_API_KEY',
  'STRIPE_SECRET_KEY'
];

function validateEnvironment() {
  const missing = [];
  
  required.forEach(variable => {
    if (!process.env[variable]) {
      missing.push(variable);
    }
  });
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(variable => {
      console.error(`   - ${variable}`);
    });
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
}

if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment };
```

## Package.json Scripts

```json
{
  "scripts": {
    "validate:env": "node scripts/validate-env-mvp.js",
    "start": "npm run validate:env && node server.js",
    "dev": "npm run validate:env && nodemon server.js",
    "build": "next build"
  }
}
```

## Security Best Practices

1. **Never commit .env files to git**
2. **Use environment variables in deployment platform**
3. **Rotate secrets manually every 90 days**
4. **Use HTTPS everywhere (handled by platform)**
5. **Enable basic rate limiting**

## Setup Instructions

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/courtesy-inspection/platform.git
cd platform

# 2. Copy environment template
cp .env.example .env

# 3. Fill in your API keys and secrets in .env

# 4. Install dependencies
npm install

# 5. Validate environment
npm run validate:env

# 6. Start the application
npm run dev
```

### Deployment

1. **Push to GitHub**
2. **Connect to Render/Railway**
3. **Add environment variables in platform UI**
4. **Deploy automatically on push**

## MVP Limitations

- Single environment (production)
- No complex port management
- No AWS Secrets Manager
- No Docker setup
- No monitoring setup
- Manual secret rotation
- Basic security configuration
- No load balancing

These limitations will be addressed in Phase 2 Enterprise configuration.

---

**Document Version**: 1.0 MVP  
**Last Updated**: December 2024  
**Contact**: support@courtesyinspection.com