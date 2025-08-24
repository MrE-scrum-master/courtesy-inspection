# ENVIRONMENT CONFIG - PHASE 2 ENTERPRISE

Enterprise-grade environment configuration with AWS Secrets Manager, multi-environment support, complex port allocation, Docker compose configurations, and comprehensive monitoring.

## Overview

This document provides comprehensive environment configuration for the Courtesy Inspection platform, covering all environments (development, staging, production) with port allocations within the 9000-9999 range, AWS Secrets Manager integration, and enterprise-grade infrastructure.

## Table of Contents

1. [Port Allocation Strategy](#port-allocation-strategy)
2. [Environment Templates](#environment-templates)
3. [Database Configuration](#database-configuration)
4. [API Keys & Secrets Management](#api-keys--secrets-management)
5. [Service-Specific Configuration](#service-specific-configuration)
6. [Docker Compose Setup](#docker-compose-setup)
7. [Environment Validation](#environment-validation)
8. [Security Best Practices](#security-best-practices)
9. [Setup Instructions](#setup-instructions)

---

## 1. Port Allocation Strategy

### 1.1 Port Range Distribution (9000-9999)

```yaml
port_allocation:
  development: 9000-9199
  staging: 9200-9399
  production: 9400-9599
  testing: 9600-9699
  tools: 9700-9999
```

### 1.2 Service Port Mapping

```yaml
services:
  # Core Services
  api_gateway: 
    dev: 9000
    staging: 9200
    prod: 9400
  
  auth_service:
    dev: 9001
    staging: 9201
    prod: 9401
  
  inspection_service:
    dev: 9002
    staging: 9202
    prod: 9402
  
  customer_service:
    dev: 9003
    staging: 9203
    prod: 9403
  
  shop_service:
    dev: 9004
    staging: 9204
    prod: 9404
  
  media_service:
    dev: 9005
    staging: 9205
    prod: 9405
  
  report_service:
    dev: 9006
    staging: 9206
    prod: 9406
  
  notification_service:
    dev: 9007
    staging: 9207
    prod: 9407
  
  analytics_service:
    dev: 9008
    staging: 9208
    prod: 9408
  
  ai_service:
    dev: 9009
    staging: 9209
    prod: 9409
  
  # Web Interfaces
  web_portal:
    dev: 9010
    staging: 9210
    prod: 9410
  
  admin_panel:
    dev: 9011
    staging: 9211
    prod: 9411
  
  customer_portal:
    dev: 9012
    staging: 9212
    prod: 9412
  
  # Database & Infrastructure
  postgresql:
    dev: 9020
    staging: 9220
    prod: 9420
  
  redis:
    dev: 9021
    staging: 9221
    prod: 9421
  
  rabbitmq:
    dev: 9022
    staging: 9222
    prod: 9422
  
  elasticsearch:
    dev: 9023
    staging: 9223
    prod: 9423
  
  influxdb:
    dev: 9024
    staging: 9224
    prod: 9424
  
  # Monitoring & Tools
  prometheus:
    dev: 9700
    staging: 9701
    prod: 9702
  
  grafana:
    dev: 9703
    staging: 9704
    prod: 9705
  
  jaeger:
    dev: 9706
    staging: 9707
    prod: 9708
  
  # Mobile Development
  expo_dev_server: 9050
  metro_bundler: 9051
  react_native_debugger: 9052
```

---

## 2. Environment Templates

### 2.1 Development Environment (.env.development)

```bash
# =============================================================================
# COURTESY INSPECTION - DEVELOPMENT ENVIRONMENT
# =============================================================================

# Environment Configuration
NODE_ENV=development
APP_ENV=development
DEBUG=true
LOG_LEVEL=debug

# Application Configuration
APP_NAME="Courtesy Inspection"
APP_VERSION=1.0.0
APP_URL=http://localhost:9010
API_URL=http://localhost:9000
API_VERSION=v1

# Port Configuration (9000-9199 range)
PORT=9000
API_GATEWAY_PORT=9000
AUTH_SERVICE_PORT=9001
INSPECTION_SERVICE_PORT=9002
CUSTOMER_SERVICE_PORT=9003
SHOP_SERVICE_PORT=9004
MEDIA_SERVICE_PORT=9005
REPORT_SERVICE_PORT=9006
NOTIFICATION_SERVICE_PORT=9007
ANALYTICS_SERVICE_PORT=9008
AI_SERVICE_PORT=9009
WEB_PORTAL_PORT=9010
ADMIN_PANEL_PORT=9011
CUSTOMER_PORTAL_PORT=9012

# Database Configuration
DATABASE_URL=postgresql://courtesy_user:dev_password_123@localhost:9020/courtesy_inspection_dev
DB_HOST=localhost
DB_PORT=9020
DB_NAME=courtesy_inspection_dev
DB_USER=courtesy_user
DB_PASSWORD=dev_password_123
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_TIMEOUT=30000

# Redis Configuration
REDIS_URL=redis://localhost:9021
REDIS_HOST=localhost
REDIS_PORT=9021
REDIS_PASSWORD=dev_redis_pass_456
REDIS_DB=0
REDIS_TTL=3600

# RabbitMQ Configuration
RABBITMQ_URL=amqp://courtesy:dev_rabbit_789@localhost:9022/
RABBITMQ_HOST=localhost
RABBITMQ_PORT=9022
RABBITMQ_USER=courtesy
RABBITMQ_PASSWORD=dev_rabbit_789
RABBITMQ_VHOST=/

# JWT Configuration
JWT_SECRET=dev_jwt_secret_key_very_long_and_random_123456789
JWT_REFRESH_SECRET=dev_jwt_refresh_secret_key_very_long_and_random_987654321
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
JWT_ISSUER=courtesy-inspection-api
JWT_AUDIENCE=courtesy-inspection-client

# OAuth Configuration
OAUTH_GOOGLE_CLIENT_ID=dev_google_client_id_123.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=dev_GOCSPX-fake_google_secret_123
OAUTH_APPLE_CLIENT_ID=com.courtesyinspection.dev
OAUTH_APPLE_PRIVATE_KEY_PATH=./certs/dev_apple_private_key.p8
OAUTH_APPLE_KEY_ID=dev_apple_key_id_123
OAUTH_APPLE_TEAM_ID=dev_apple_team_id_456

# Telnyx SMS Configuration
TELNYX_API_KEY=dev_KEY_fake_telnyx_api_key_123456789
TELNYX_MESSAGING_PROFILE_ID=dev_40000000-0000-4000-8000-000000000001
TELNYX_WEBHOOK_URL=http://localhost:9000/webhooks/telnyx
TELNYX_WEBHOOK_SECRET=dev_telnyx_webhook_secret_123
SMS_FROM_NUMBER=+15551234567
SMS_RATE_LIMIT=100

# VIN Decoder APIs
VIN_API_PRIMARY_KEY=dev_fake_vin_api_key_primary_123456789
VIN_API_PRIMARY_URL=https://api.vindecoder.eu/3.2
VIN_API_SECONDARY_KEY=dev_fake_vin_api_key_secondary_987654321
VIN_API_SECONDARY_URL=https://vpic.nhtsa.dot.gov/api
VIN_API_TIMEOUT=10000
VIN_API_RETRY_ATTEMPTS=3

# Email Configuration (SendGrid)
SENDGRID_API_KEY=SG.dev_fake_sendgrid_api_key_123456789.abcdefghijklmnopqrstuvwxyz
EMAIL_FROM=noreply@courtesyinspection.dev
EMAIL_REPLY_TO=support@courtesyinspection.dev
EMAIL_TEMPLATE_INSPECTION_COMPLETE=d-dev123456789
EMAIL_TEMPLATE_WELCOME=d-dev987654321

# File Storage (AWS S3 / Local)
AWS_ACCESS_KEY_ID=AKIADEV123456789FAKE
AWS_SECRET_ACCESS_KEY=dev+fake/aws/secret/key/123456789/abcdefghijk
AWS_REGION=us-west-2
AWS_S3_BUCKET=courtesy-inspection-dev
AWS_S3_PREFIX=dev/
AWS_CLOUDFRONT_DOMAIN=dev-cdn.courtesyinspection.com
STORAGE_TYPE=local
STORAGE_PATH=./uploads

# CORS Configuration
CORS_ORIGIN=http://localhost:9010,http://localhost:9011,http://localhost:9012,exp://localhost:19000
CORS_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_HEADERS=Content-Type,Authorization,X-Requested-With
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false
RATE_LIMIT_HEADERS=true

# Security Headers
HELMET_CONTENT_SECURITY_POLICY=false
HELMET_HSTS=false
HELMET_NO_SNIFF=true
HELMET_X_FRAME_OPTIONS=DENY
HELMET_X_XSS_PROTECTION=true

# SSL/TLS Configuration (Development - disabled)
SSL_ENABLED=false
SSL_CERT_PATH=
SSL_KEY_PATH=
SSL_CA_PATH=

# React Native / Expo Configuration
EXPO_PUBLIC_API_URL=http://localhost:9000
EXPO_PUBLIC_WS_URL=ws://localhost:9000
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_VERSION=1.0.0-dev
EXPO_PUBLIC_SENTRY_DSN=
EXPO_USE_METRO_WORKSPACE_ROOT=1

# Next.js Configuration
NEXTAUTH_URL=http://localhost:9010
NEXTAUTH_SECRET=dev_nextauth_secret_very_long_random_string_123456789
NEXT_PUBLIC_API_URL=http://localhost:9000
NEXT_PUBLIC_WS_URL=ws://localhost:9000
NEXT_PUBLIC_ENV=development

# WatermelonDB Configuration
WATERMELON_SYNC_URL=http://localhost:9000/sync
WATERMELON_SYNC_INTERVAL=300000
WATERMELON_BATCH_SIZE=100
WATERMELON_DEBUG=true

# Monitoring & Observability
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
PROMETHEUS_PORT=9700
GRAFANA_PORT=9703
JAEGER_PORT=9706
NEW_RELIC_LICENSE_KEY=
NEW_RELIC_APP_NAME=courtesy-inspection-dev

# External Service URLs
STRIPE_PUBLISHABLE_KEY=pk_test_dev_fake_stripe_key_123456789
STRIPE_SECRET_KEY=sk_test_dev_fake_stripe_secret_123456789
STRIPE_WEBHOOK_SECRET=whsec_dev_fake_stripe_webhook_secret_123
PAYMENT_CURRENCY=USD

# AI/ML Configuration
OPENAI_API_KEY=sk-dev-fake-openai-api-key-123456789abcdefghijklmnopqrstuvwxyz
TENSORFLOW_SERVING_URL=http://localhost:9709
MODEL_BUCKET=courtesy-ml-models-dev
VISION_API_ENABLED=false

# Feature Flags
FEATURE_AI_ANALYSIS=true
FEATURE_VOICE_COMMANDS=true
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_MOBILE_PAYMENT=false
FEATURE_MULTI_LANGUAGE=false

# Development Tools
WEBPACK_DEV_SERVER_PORT=9710
STORYBOOK_PORT=9711
DOCS_PORT=9712
```

### 2.2 Staging Environment (.env.staging)

```bash
# =============================================================================
# COURTESY INSPECTION - STAGING ENVIRONMENT
# =============================================================================

# Environment Configuration
NODE_ENV=production
APP_ENV=staging
DEBUG=false
LOG_LEVEL=info

# Application Configuration
APP_NAME="Courtesy Inspection Staging"
APP_VERSION=1.0.0-rc
APP_URL=https://staging.courtesyinspection.com
API_URL=https://staging-api.courtesyinspection.com
API_VERSION=v1

# Port Configuration (9200-9399 range)
PORT=9200
API_GATEWAY_PORT=9200
AUTH_SERVICE_PORT=9201
INSPECTION_SERVICE_PORT=9202
CUSTOMER_SERVICE_PORT=9203
SHOP_SERVICE_PORT=9204
MEDIA_SERVICE_PORT=9205
REPORT_SERVICE_PORT=9206
NOTIFICATION_SERVICE_PORT=9207
ANALYTICS_SERVICE_PORT=9208
AI_SERVICE_PORT=9209
WEB_PORTAL_PORT=9210
ADMIN_PANEL_PORT=9211
CUSTOMER_PORTAL_PORT=9212

# Database Configuration
DATABASE_URL=postgresql://courtesy_user:${DB_PASSWORD}@staging-db.internal:9220/courtesy_inspection_staging?sslmode=require
DB_HOST=staging-db.internal
DB_PORT=9220
DB_NAME=courtesy_inspection_staging
DB_USER=courtesy_user
DB_PASSWORD=${SECRET_DB_PASSWORD}
DB_SSL=true
DB_POOL_MIN=5
DB_POOL_MAX=25
DB_TIMEOUT=30000

# Redis Configuration
REDIS_URL=rediss://:${REDIS_PASSWORD}@staging-redis.internal:9221
REDIS_HOST=staging-redis.internal
REDIS_PORT=9221
REDIS_PASSWORD=${SECRET_REDIS_PASSWORD}
REDIS_DB=0
REDIS_TTL=3600

# RabbitMQ Configuration
RABBITMQ_URL=amqps://courtesy:${RABBITMQ_PASSWORD}@staging-rabbitmq.internal:9222/
RABBITMQ_HOST=staging-rabbitmq.internal
RABBITMQ_PORT=9222
RABBITMQ_USER=courtesy
RABBITMQ_PASSWORD=${SECRET_RABBITMQ_PASSWORD}
RABBITMQ_VHOST=/

# JWT Configuration
JWT_SECRET=${SECRET_JWT_SECRET}
JWT_REFRESH_SECRET=${SECRET_JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
JWT_ISSUER=courtesy-inspection-api
JWT_AUDIENCE=courtesy-inspection-client

# OAuth Configuration
OAUTH_GOOGLE_CLIENT_ID=${SECRET_GOOGLE_CLIENT_ID}
OAUTH_GOOGLE_CLIENT_SECRET=${SECRET_GOOGLE_CLIENT_SECRET}
OAUTH_APPLE_CLIENT_ID=com.courtesyinspection.staging
OAUTH_APPLE_PRIVATE_KEY_PATH=/etc/ssl/certs/apple_private_key.p8
OAUTH_APPLE_KEY_ID=${SECRET_APPLE_KEY_ID}
OAUTH_APPLE_TEAM_ID=${SECRET_APPLE_TEAM_ID}

# Telnyx SMS Configuration
TELNYX_API_KEY=${SECRET_TELNYX_API_KEY}
TELNYX_MESSAGING_PROFILE_ID=${SECRET_TELNYX_MESSAGING_PROFILE_ID}
TELNYX_WEBHOOK_URL=https://staging-api.courtesyinspection.com/webhooks/telnyx
TELNYX_WEBHOOK_SECRET=${SECRET_TELNYX_WEBHOOK_SECRET}
SMS_FROM_NUMBER=+15551234567
SMS_RATE_LIMIT=500

# VIN Decoder APIs
VIN_API_PRIMARY_KEY=${SECRET_VIN_API_PRIMARY_KEY}
VIN_API_PRIMARY_URL=https://api.vindecoder.eu/3.2
VIN_API_SECONDARY_KEY=${SECRET_VIN_API_SECONDARY_KEY}
VIN_API_SECONDARY_URL=https://vpic.nhtsa.dot.gov/api
VIN_API_TIMEOUT=10000
VIN_API_RETRY_ATTEMPTS=3

# Email Configuration (SendGrid)
SENDGRID_API_KEY=${SECRET_SENDGRID_API_KEY}
EMAIL_FROM=noreply@staging.courtesyinspection.com
EMAIL_REPLY_TO=support@courtesyinspection.com
EMAIL_TEMPLATE_INSPECTION_COMPLETE=${SECRET_SENDGRID_TEMPLATE_INSPECTION}
EMAIL_TEMPLATE_WELCOME=${SECRET_SENDGRID_TEMPLATE_WELCOME}

# File Storage (AWS S3)
AWS_ACCESS_KEY_ID=${SECRET_AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${SECRET_AWS_SECRET_ACCESS_KEY}
AWS_REGION=us-west-2
AWS_S3_BUCKET=courtesy-inspection-staging
AWS_S3_PREFIX=staging/
AWS_CLOUDFRONT_DOMAIN=staging-cdn.courtesyinspection.com
STORAGE_TYPE=s3

# CORS Configuration
CORS_ORIGIN=https://staging.courtesyinspection.com,https://staging-admin.courtesyinspection.com
CORS_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_HEADERS=Content-Type,Authorization,X-Requested-With
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=5000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false
RATE_LIMIT_HEADERS=true

# Security Headers
HELMET_CONTENT_SECURITY_POLICY=true
HELMET_HSTS=true
HELMET_NO_SNIFF=true
HELMET_X_FRAME_OPTIONS=DENY
HELMET_X_XSS_PROTECTION=true

# SSL/TLS Configuration
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/staging.crt
SSL_KEY_PATH=/etc/ssl/private/staging.key
SSL_CA_PATH=/etc/ssl/certs/ca-bundle.crt

# React Native / Expo Configuration
EXPO_PUBLIC_API_URL=https://staging-api.courtesyinspection.com
EXPO_PUBLIC_WS_URL=wss://staging-api.courtesyinspection.com
EXPO_PUBLIC_ENV=staging
EXPO_PUBLIC_VERSION=1.0.0-rc
EXPO_PUBLIC_SENTRY_DSN=${SECRET_SENTRY_DSN}

# Next.js Configuration
NEXTAUTH_URL=https://staging.courtesyinspection.com
NEXTAUTH_SECRET=${SECRET_NEXTAUTH_SECRET}
NEXT_PUBLIC_API_URL=https://staging-api.courtesyinspection.com
NEXT_PUBLIC_WS_URL=wss://staging-api.courtesyinspection.com
NEXT_PUBLIC_ENV=staging

# WatermelonDB Configuration
WATERMELON_SYNC_URL=https://staging-api.courtesyinspection.com/sync
WATERMELON_SYNC_INTERVAL=300000
WATERMELON_BATCH_SIZE=100
WATERMELON_DEBUG=false

# Monitoring & Observability
SENTRY_DSN=${SECRET_SENTRY_DSN}
SENTRY_ENVIRONMENT=staging
PROMETHEUS_PORT=9701
GRAFANA_PORT=9704
JAEGER_PORT=9707
NEW_RELIC_LICENSE_KEY=${SECRET_NEW_RELIC_LICENSE_KEY}
NEW_RELIC_APP_NAME=courtesy-inspection-staging

# External Service URLs
STRIPE_PUBLISHABLE_KEY=${SECRET_STRIPE_PUBLISHABLE_KEY}
STRIPE_SECRET_KEY=${SECRET_STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${SECRET_STRIPE_WEBHOOK_SECRET}
PAYMENT_CURRENCY=USD

# AI/ML Configuration
OPENAI_API_KEY=${SECRET_OPENAI_API_KEY}
TENSORFLOW_SERVING_URL=http://staging-ml.internal:9709
MODEL_BUCKET=courtesy-ml-models-staging
VISION_API_ENABLED=true

# Feature Flags
FEATURE_AI_ANALYSIS=true
FEATURE_VOICE_COMMANDS=true
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_MOBILE_PAYMENT=true
FEATURE_MULTI_LANGUAGE=false
```

### 2.3 Production Environment (.env.production)

```bash
# =============================================================================
# COURTESY INSPECTION - PRODUCTION ENVIRONMENT
# =============================================================================

# Environment Configuration
NODE_ENV=production
APP_ENV=production
DEBUG=false
LOG_LEVEL=warn

# Application Configuration
APP_NAME="Courtesy Inspection"
APP_VERSION=1.0.0
APP_URL=https://app.courtesyinspection.com
API_URL=https://api.courtesyinspection.com
API_VERSION=v1

# Port Configuration (9400-9599 range)
PORT=9400
API_GATEWAY_PORT=9400
AUTH_SERVICE_PORT=9401
INSPECTION_SERVICE_PORT=9402
CUSTOMER_SERVICE_PORT=9403
SHOP_SERVICE_PORT=9404
MEDIA_SERVICE_PORT=9405
REPORT_SERVICE_PORT=9406
NOTIFICATION_SERVICE_PORT=9407
ANALYTICS_SERVICE_PORT=9408
AI_SERVICE_PORT=9409
WEB_PORTAL_PORT=9410
ADMIN_PANEL_PORT=9411
CUSTOMER_PORTAL_PORT=9412

# Database Configuration
DATABASE_URL=postgresql://courtesy_user:${DB_PASSWORD}@prod-db-cluster.internal:9420/courtesy_inspection?sslmode=require
DB_HOST=prod-db-cluster.internal
DB_PORT=9420
DB_NAME=courtesy_inspection
DB_USER=courtesy_user
DB_PASSWORD=${SECRET_DB_PASSWORD}
DB_SSL=true
DB_POOL_MIN=10
DB_POOL_MAX=50
DB_TIMEOUT=30000

# Redis Configuration
REDIS_URL=rediss://:${REDIS_PASSWORD}@prod-redis-cluster.internal:9421
REDIS_HOST=prod-redis-cluster.internal
REDIS_PORT=9421
REDIS_PASSWORD=${SECRET_REDIS_PASSWORD}
REDIS_DB=0
REDIS_TTL=3600

# RabbitMQ Configuration
RABBITMQ_URL=amqps://courtesy:${RABBITMQ_PASSWORD}@prod-rabbitmq-cluster.internal:9422/
RABBITMQ_HOST=prod-rabbitmq-cluster.internal
RABBITMQ_PORT=9422
RABBITMQ_USER=courtesy
RABBITMQ_PASSWORD=${SECRET_RABBITMQ_PASSWORD}
RABBITMQ_VHOST=/

# JWT Configuration
JWT_SECRET=${SECRET_JWT_SECRET}
JWT_REFRESH_SECRET=${SECRET_JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
JWT_ISSUER=courtesy-inspection-api
JWT_AUDIENCE=courtesy-inspection-client

# OAuth Configuration
OAUTH_GOOGLE_CLIENT_ID=${SECRET_GOOGLE_CLIENT_ID}
OAUTH_GOOGLE_CLIENT_SECRET=${SECRET_GOOGLE_CLIENT_SECRET}
OAUTH_APPLE_CLIENT_ID=com.courtesyinspection.app
OAUTH_APPLE_PRIVATE_KEY_PATH=/etc/ssl/certs/apple_private_key.p8
OAUTH_APPLE_KEY_ID=${SECRET_APPLE_KEY_ID}
OAUTH_APPLE_TEAM_ID=${SECRET_APPLE_TEAM_ID}

# Telnyx SMS Configuration
TELNYX_API_KEY=${SECRET_TELNYX_API_KEY}
TELNYX_MESSAGING_PROFILE_ID=${SECRET_TELNYX_MESSAGING_PROFILE_ID}
TELNYX_WEBHOOK_URL=https://api.courtesyinspection.com/webhooks/telnyx
TELNYX_WEBHOOK_SECRET=${SECRET_TELNYX_WEBHOOK_SECRET}
SMS_FROM_NUMBER=${SECRET_SMS_FROM_NUMBER}
SMS_RATE_LIMIT=10000

# VIN Decoder APIs
VIN_API_PRIMARY_KEY=${SECRET_VIN_API_PRIMARY_KEY}
VIN_API_PRIMARY_URL=https://api.vindecoder.eu/3.2
VIN_API_SECONDARY_KEY=${SECRET_VIN_API_SECONDARY_KEY}
VIN_API_SECONDARY_URL=https://vpic.nhtsa.dot.gov/api
VIN_API_TIMEOUT=10000
VIN_API_RETRY_ATTEMPTS=3

# Email Configuration (SendGrid)
SENDGRID_API_KEY=${SECRET_SENDGRID_API_KEY}
EMAIL_FROM=noreply@courtesyinspection.com
EMAIL_REPLY_TO=support@courtesyinspection.com
EMAIL_TEMPLATE_INSPECTION_COMPLETE=${SECRET_SENDGRID_TEMPLATE_INSPECTION}
EMAIL_TEMPLATE_WELCOME=${SECRET_SENDGRID_TEMPLATE_WELCOME}

# File Storage (AWS S3)
AWS_ACCESS_KEY_ID=${SECRET_AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${SECRET_AWS_SECRET_ACCESS_KEY}
AWS_REGION=us-west-2
AWS_S3_BUCKET=courtesy-inspection-production
AWS_S3_PREFIX=prod/
AWS_CLOUDFRONT_DOMAIN=cdn.courtesyinspection.com
STORAGE_TYPE=s3

# CORS Configuration
CORS_ORIGIN=https://app.courtesyinspection.com,https://admin.courtesyinspection.com,https://portal.courtesyinspection.com
CORS_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_HEADERS=Content-Type,Authorization,X-Requested-With
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=10000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=true
RATE_LIMIT_HEADERS=true

# Security Headers
HELMET_CONTENT_SECURITY_POLICY=true
HELMET_HSTS=true
HELMET_NO_SNIFF=true
HELMET_X_FRAME_OPTIONS=DENY
HELMET_X_XSS_PROTECTION=true

# SSL/TLS Configuration
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/production.crt
SSL_KEY_PATH=/etc/ssl/private/production.key
SSL_CA_PATH=/etc/ssl/certs/ca-bundle.crt

# React Native / Expo Configuration
EXPO_PUBLIC_API_URL=https://api.courtesyinspection.com
EXPO_PUBLIC_WS_URL=wss://api.courtesyinspection.com
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_VERSION=1.0.0
EXPO_PUBLIC_SENTRY_DSN=${SECRET_SENTRY_DSN}

# Next.js Configuration
NEXTAUTH_URL=https://app.courtesyinspection.com
NEXTAUTH_SECRET=${SECRET_NEXTAUTH_SECRET}
NEXT_PUBLIC_API_URL=https://api.courtesyinspection.com
NEXT_PUBLIC_WS_URL=wss://api.courtesyinspection.com
NEXT_PUBLIC_ENV=production

# WatermelonDB Configuration
WATERMELON_SYNC_URL=https://api.courtesyinspection.com/sync
WATERMELON_SYNC_INTERVAL=300000
WATERMELON_BATCH_SIZE=100
WATERMELON_DEBUG=false

# Monitoring & Observability
SENTRY_DSN=${SECRET_SENTRY_DSN}
SENTRY_ENVIRONMENT=production
PROMETHEUS_PORT=9702
GRAFANA_PORT=9705
JAEGER_PORT=9708
NEW_RELIC_LICENSE_KEY=${SECRET_NEW_RELIC_LICENSE_KEY}
NEW_RELIC_APP_NAME=courtesy-inspection-production

# External Service URLs
STRIPE_PUBLISHABLE_KEY=${SECRET_STRIPE_PUBLISHABLE_KEY}
STRIPE_SECRET_KEY=${SECRET_STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${SECRET_STRIPE_WEBHOOK_SECRET}
PAYMENT_CURRENCY=USD

# AI/ML Configuration
OPENAI_API_KEY=${SECRET_OPENAI_API_KEY}
TENSORFLOW_SERVING_URL=http://prod-ml-cluster.internal:9709
MODEL_BUCKET=courtesy-ml-models-production
VISION_API_ENABLED=true

# Feature Flags
FEATURE_AI_ANALYSIS=true
FEATURE_VOICE_COMMANDS=true
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_MOBILE_PAYMENT=true
FEATURE_MULTI_LANGUAGE=true
```

---

## 3. Database Configuration

### 3.1 PostgreSQL Connection Strings

```bash
# Development
DATABASE_URL=postgresql://courtesy_user:dev_password_123@localhost:9020/courtesy_inspection_dev

# Staging
DATABASE_URL=postgresql://courtesy_user:${SECRET_DB_PASSWORD}@staging-db.internal:9220/courtesy_inspection_staging?sslmode=require

# Production
DATABASE_URL=postgresql://courtesy_user:${SECRET_DB_PASSWORD}@prod-db-cluster.internal:9420/courtesy_inspection?sslmode=require

# Test Database
TEST_DATABASE_URL=postgresql://courtesy_user:test_password@localhost:9620/courtesy_inspection_test
```

### 3.2 Database Pool Configuration

```yaml
database_pools:
  development:
    min_connections: 2
    max_connections: 10
    acquire_timeout: 30000
    idle_timeout: 300000
  
  staging:
    min_connections: 5
    max_connections: 25
    acquire_timeout: 30000
    idle_timeout: 300000
  
  production:
    min_connections: 10
    max_connections: 50
    acquire_timeout: 30000
    idle_timeout: 300000
```

### 3.3 Redis Configuration

```yaml
redis_config:
  development:
    host: localhost
    port: 9021
    password: dev_redis_pass_456
    db: 0
    ttl: 3600
  
  staging:
    host: staging-redis.internal
    port: 9221
    password: ${SECRET_REDIS_PASSWORD}
    db: 0
    ttl: 3600
    tls: true
  
  production:
    host: prod-redis-cluster.internal
    port: 9421
    password: ${SECRET_REDIS_PASSWORD}
    db: 0
    ttl: 3600
    tls: true
    cluster_mode: true
```

---

## 4. API Keys & Secrets Management

### 4.1 Secret Categories

```yaml
secret_categories:
  database:
    - DB_PASSWORD
    - REDIS_PASSWORD
    - RABBITMQ_PASSWORD
  
  authentication:
    - JWT_SECRET
    - JWT_REFRESH_SECRET
    - NEXTAUTH_SECRET
  
  oauth:
    - GOOGLE_CLIENT_SECRET
    - APPLE_PRIVATE_KEY
    - APPLE_KEY_ID
    - APPLE_TEAM_ID
  
  external_services:
    - TELNYX_API_KEY
    - TELNYX_WEBHOOK_SECRET
    - SENDGRID_API_KEY
    - STRIPE_SECRET_KEY
    - STRIPE_WEBHOOK_SECRET
    - VIN_API_PRIMARY_KEY
    - VIN_API_SECONDARY_KEY
  
  cloud_services:
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
  
  monitoring:
    - SENTRY_DSN
    - NEW_RELIC_LICENSE_KEY
  
  ai_services:
    - OPENAI_API_KEY
```

### 4.2 Secret Generation Commands

```bash
# Generate JWT Secrets
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)

# Generate Database Password
DB_PASSWORD=$(openssl rand -base64 32)

# Generate Redis Password
REDIS_PASSWORD=$(openssl rand -base64 32)

# Generate NextAuth Secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Generate Webhook Secret
TELNYX_WEBHOOK_SECRET=$(openssl rand -base64 32)
STRIPE_WEBHOOK_SECRET=$(openssl rand -base64 32)
```

### 4.3 AWS Secrets Manager Integration

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "courtesy-inspection/production/database" \
  --description "Production database credentials" \
  --secret-string '{"username":"courtesy_user","password":"generated_password"}'

aws secretsmanager create-secret \
  --name "courtesy-inspection/production/jwt" \
  --description "Production JWT secrets" \
  --secret-string '{"access_secret":"generated_secret","refresh_secret":"generated_secret"}'
```

---

## 5. Service-Specific Configuration

### 5.1 Telnyx SMS Configuration

```bash
# Telnyx Configuration
TELNYX_API_KEY=KEY_your_telnyx_api_key_here
TELNYX_MESSAGING_PROFILE_ID=40000000-0000-4000-8000-000000000001
TELNYX_WEBHOOK_URL=https://api.courtesyinspection.com/webhooks/telnyx
TELNYX_WEBHOOK_SECRET=your_webhook_secret_here
SMS_FROM_NUMBER=+1234567890
SMS_RATE_LIMIT=1000

# Webhook Verification
TELNYX_WEBHOOK_SIGNATURE_HEADER=telnyx-signature-ed25519
TELNYX_WEBHOOK_TIMESTAMP_HEADER=telnyx-timestamp
```

### 5.2 VIN Decoder APIs

```bash
# Primary VIN API (VIN Decoder EU)
VIN_API_PRIMARY_KEY=your_primary_vin_api_key
VIN_API_PRIMARY_URL=https://api.vindecoder.eu/3.2
VIN_API_PRIMARY_RATE_LIMIT=100

# Secondary VIN API (NHTSA)
VIN_API_SECONDARY_KEY=your_secondary_vin_api_key
VIN_API_SECONDARY_URL=https://vpic.nhtsa.dot.gov/api
VIN_API_SECONDARY_RATE_LIMIT=unlimited

# Fallback Configuration
VIN_API_TIMEOUT=10000
VIN_API_RETRY_ATTEMPTS=3
VIN_API_RETRY_DELAY=1000
```

### 5.3 WatermelonDB Sync Configuration

```bash
# WatermelonDB Configuration
WATERMELON_SYNC_URL=https://api.courtesyinspection.com/sync
WATERMELON_SYNC_INTERVAL=300000  # 5 minutes
WATERMELON_BATCH_SIZE=100
WATERMELON_RETRY_ATTEMPTS=3
WATERMELON_CONFLICT_RESOLUTION=client_wins
WATERMELON_DEBUG=false

# Offline Queue Configuration
WATERMELON_QUEUE_MAX_SIZE=1000
WATERMELON_QUEUE_RETRY_DELAY=5000
WATERMELON_QUEUE_MAX_RETRIES=5
```

### 5.4 Expo Configuration

```bash
# Expo Development Configuration
EXPO_PUBLIC_API_URL=http://localhost:9000
EXPO_PUBLIC_WS_URL=ws://localhost:9000
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_VERSION=1.0.0-dev
EXPO_PUBLIC_SENTRY_DSN=

# Expo Build Configuration
EXPO_USE_METRO_WORKSPACE_ROOT=1
EXPO_LEGACY_IMPORTS=0
EXPO_CLI_PASSWORD=your_expo_password
EXPO_APPLE_ID=your_apple_id
EXPO_GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account.json
```

---

## 6. Docker Compose Setup

### 6.1 Development Docker Compose

```yaml
# docker-compose.development.yml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: courtesy_inspection_dev
      POSTGRES_USER: courtesy_user
      POSTGRES_PASSWORD: dev_password_123
    ports:
      - "9020:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass dev_redis_pass_456
    ports:
      - "9021:6379"
    volumes:
      - redis_data:/data

  # RabbitMQ Message Queue
  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: courtesy
      RABBITMQ_DEFAULT_PASS: dev_rabbit_789
    ports:
      - "9022:5672"
      - "9722:15672"  # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  # Elasticsearch (for logging and search)
  elasticsearch:
    image: elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    ports:
      - "9023:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  # InfluxDB (for metrics)
  influxdb:
    image: influxdb:2.7-alpine
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: courtesy
      DOCKER_INFLUXDB_INIT_PASSWORD: dev_influx_password
      DOCKER_INFLUXDB_INIT_ORG: courtesy-inspection
      DOCKER_INFLUXDB_INIT_BUCKET: metrics
    ports:
      - "9024:8086"
    volumes:
      - influxdb_data:/var/lib/influxdb2

  # Prometheus (monitoring)
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9700:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  # Grafana (dashboards)
  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: dev_grafana_admin
    ports:
      - "9703:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources

  # Jaeger (distributed tracing)
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "9706:16686"  # UI
      - "14268:14268"  # HTTP collector
    environment:
      COLLECTOR_OTLP_ENABLED: true

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  elasticsearch_data:
  influxdb_data:
  prometheus_data:
  grafana_data:
```

### 6.2 Production Docker Compose

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  # API Gateway
  api-gateway:
    image: courtesy-inspection/api-gateway:latest
    ports:
      - "9400:9400"
    environment:
      - NODE_ENV=production
      - PORT=9400
    env_file:
      - .env.production
    depends_on:
      - auth-service
      - inspection-service
    restart: unless-stopped

  # Auth Service
  auth-service:
    image: courtesy-inspection/auth-service:latest
    ports:
      - "9401:9401"
    environment:
      - NODE_ENV=production
      - PORT=9401
    env_file:
      - .env.production
    restart: unless-stopped

  # Inspection Service
  inspection-service:
    image: courtesy-inspection/inspection-service:latest
    ports:
      - "9402:9402"
    environment:
      - NODE_ENV=production
      - PORT=9402
    env_file:
      - .env.production
    restart: unless-stopped

  # Web Portal
  web-portal:
    image: courtesy-inspection/web-portal:latest
    ports:
      - "9410:9410"
    environment:
      - NODE_ENV=production
      - PORT=9410
    env_file:
      - .env.production
    restart: unless-stopped

  # Nginx Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - api-gateway
      - web-portal
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## 7. Environment Validation

### 7.1 Environment Validation Script

```javascript
// scripts/validate-env.js
const required = {
  development: [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET',
    'REDIS_URL'
  ],
  staging: [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET',
    'REDIS_URL',
    'TELNYX_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY'
  ],
  production: [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET',
    'REDIS_URL',
    'TELNYX_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'SENDGRID_API_KEY',
    'STRIPE_SECRET_KEY'
  ]
};

function validateEnvironment(env = process.env.NODE_ENV) {
  const requiredVars = required[env] || required.development;
  const missing = [];
  
  requiredVars.forEach(variable => {
    if (!process.env[variable]) {
      missing.push(variable);
    }
  });
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables for ${env}:`);
    missing.forEach(variable => {
      console.error(`   - ${variable}`);
    });
    process.exit(1);
  }
  
  console.log(`✅ All required environment variables are set for ${env}`);
  
  // Validate port ranges
  validatePortRanges(env);
  
  // Validate database connection
  validateDatabaseConnection();
  
  // Validate external services
  validateExternalServices(env);
}

function validatePortRanges(env) {
  const port = parseInt(process.env.PORT);
  const ranges = {
    development: [9000, 9199],
    staging: [9200, 9399],
    production: [9400, 9599]
  };
  
  const [min, max] = ranges[env] || ranges.development;
  
  if (port < min || port > max) {
    console.error(`❌ Port ${port} is outside the allowed range for ${env}: ${min}-${max}`);
    process.exit(1);
  }
  
  console.log(`✅ Port ${port} is within the allowed range for ${env}`);
}

async function validateDatabaseConnection() {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    await pool.end();
    
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

async function validateExternalServices(env) {
  if (env === 'production') {
    // Validate Telnyx API
    try {
      const response = await fetch('https://api.telnyx.com/v2/messaging_profiles', {
        headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` }
      });
      
      if (response.ok) {
        console.log('✅ Telnyx API connection successful');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Telnyx API validation failed:', error.message);
      process.exit(1);
    }
    
    // Validate SendGrid API
    try {
      const response = await fetch('https://api.sendgrid.com/v3/user/account', {
        headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` }
      });
      
      if (response.ok) {
        console.log('✅ SendGrid API connection successful');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ SendGrid API validation failed:', error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment };
```

### 7.2 Package.json Scripts

```json
{
  "scripts": {
    "validate:env": "node scripts/validate-env.js",
    "validate:env:dev": "NODE_ENV=development node scripts/validate-env.js",
    "validate:env:staging": "NODE_ENV=staging node scripts/validate-env.js",
    "validate:env:prod": "NODE_ENV=production node scripts/validate-env.js",
    "setup:dev": "npm run validate:env:dev && docker-compose -f docker-compose.development.yml up -d",
    "setup:staging": "npm run validate:env:staging && docker-compose -f docker-compose.staging.yml up -d",
    "setup:prod": "npm run validate:env:prod && docker-compose -f docker-compose.production.yml up -d"
  }
}
```

---

## 8. Security Best Practices

### 8.1 Secret Management Guidelines

```yaml
secret_management:
  development:
    storage: .env files (git-ignored)
    rotation: manual
    access: local developers only
  
  staging:
    storage: AWS Secrets Manager
    rotation: 90 days
    access: development team + QA
  
  production:
    storage: AWS Secrets Manager
    rotation: 30 days
    access: ops team only
    
  best_practices:
    - Never commit secrets to version control
    - Use environment-specific secrets
    - Implement secret rotation
    - Monitor secret access
    - Use least privilege access
```

### 8.2 Environment Isolation

```yaml
environment_isolation:
  network:
    development: local network only
    staging: VPN access required
    production: private network with WAF
  
  database:
    development: local PostgreSQL instance
    staging: isolated staging database
    production: production cluster with replicas
  
  api_keys:
    development: sandbox/test keys only
    staging: limited production keys
    production: full production keys
```

### 8.3 SSL/TLS Configuration

```nginx
# nginx/ssl.conf
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Certificate paths
ssl_certificate /etc/ssl/certs/courtesy-inspection.crt;
ssl_certificate_key /etc/ssl/private/courtesy-inspection.key;
ssl_trusted_certificate /etc/ssl/certs/ca-bundle.crt;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
```

---

## 9. Setup Instructions

### 9.1 Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/courtesy-inspection/platform.git
cd platform

# 2. Copy environment template
cp .env.example .env.development

# 3. Generate secrets
npm run generate:secrets

# 4. Validate environment
npm run validate:env:dev

# 5. Start development services
npm run setup:dev

# 6. Install dependencies
npm install

# 7. Run database migrations
npm run db:migrate

# 8. Seed development data
npm run db:seed

# 9. Start the application
npm run dev
```

### 9.2 Staging Deployment

```bash
# 1. Set up AWS credentials
aws configure

# 2. Create secrets in AWS Secrets Manager
aws secretsmanager create-secret --name "courtesy-inspection/staging/database"
aws secretsmanager create-secret --name "courtesy-inspection/staging/jwt"
aws secretsmanager create-secret --name "courtesy-inspection/staging/external-apis"

# 3. Deploy infrastructure
terraform apply -var-file="staging.tfvars"

# 4. Configure environment variables
kubectl create secret generic staging-secrets --from-env-file=.env.staging

# 5. Deploy application
kubectl apply -f k8s/staging/

# 6. Run database migrations
kubectl exec -it staging-api-0 -- npm run db:migrate

# 7. Validate deployment
npm run validate:env:staging
```

### 9.3 Production Deployment

```bash
# 1. Set up production AWS credentials
aws configure --profile production

# 2. Create production secrets
aws secretsmanager create-secret --name "courtesy-inspection/production/database"
aws secretsmanager create-secret --name "courtesy-inspection/production/jwt"
aws secretsmanager create-secret --name "courtesy-inspection/production/external-apis"

# 3. Deploy production infrastructure
terraform apply -var-file="production.tfvars"

# 4. Configure production secrets
kubectl create secret generic production-secrets --from-env-file=.env.production

# 5. Deploy application with blue-green deployment
kubectl apply -f k8s/production/

# 6. Run database migrations (with backup)
kubectl exec -it production-api-0 -- npm run db:backup
kubectl exec -it production-api-0 -- npm run db:migrate

# 7. Validate production deployment
npm run validate:env:prod
npm run test:e2e:production
```

## Environment Configuration Checklist

### Pre-Deployment Checklist

- [ ] All required environment variables are set
- [ ] Secrets are stored securely (AWS Secrets Manager for staging/prod)
- [ ] Port allocations are within assigned ranges
- [ ] Database connections are tested
- [ ] External API keys are validated
- [ ] SSL certificates are configured
- [ ] Monitoring is set up
- [ ] Backup procedures are in place
- [ ] Security headers are configured
- [ ] Rate limiting is enabled

### Post-Deployment Verification

- [ ] Application health checks pass
- [ ] Database migrations completed successfully
- [ ] External integrations are working
- [ ] Mobile app can connect to APIs
- [ ] Web portals load correctly
- [ ] SMS notifications are sent
- [ ] Email delivery is working
- [ ] File uploads to S3 succeed
- [ ] Monitoring dashboards show green status
- [ ] Log aggregation is functioning

---

**Document Version**: 2.0 Enterprise  
**Last Updated**: December 2024  
**Next Review**: January 2025  
**Contact**: devops@courtesyinspection.com