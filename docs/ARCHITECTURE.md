# Courtesy Inspection - System Architecture

## Executive Summary

The Courtesy Inspection MVP is a digital vehicle inspection platform designed for automotive service shops. The system enables mechanics to conduct inspections using mobile devices (phones/tablets) while providing shop managers with oversight capabilities through a unified interface.

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Applications                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   iOS App       │   Android App   │      Web Application        │
│  (React Native) │ (React Native)  │    (React Native Web)       │
└─────────────────┴─────────────────┴─────────────────────────────┘
                              │
                    ┌─────────────────┐
                    │   Load Balancer │
                    │   (Railway)     │
                    └─────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway                               │
├─────────────────────────────────────────────────────────────────┤
│                   Express.js API Server                        │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │    Auth     │ Inspections │   Photos    │      SMS        │  │
│  │   Service   │   Service   │   Service   │    Service      │  │
│  └─────────────┴─────────────┴─────────────┴─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────────────────────┐
            │                                 │
    ┌─────────────────┐               ┌─────────────────┐
    │   PostgreSQL    │               │   File Storage  │
    │   Database      │               │  (Railway Vol.) │
    │   (Railway)     │               │                 │
    └─────────────────┘               └─────────────────┘
            │                                 │
    ┌─────────────────┐               ┌─────────────────┐
    │   Redis Cache   │               │   Telnyx SMS    │
    │   (Optional)    │               │     Service     │
    └─────────────────┘               └─────────────────┘
```

### Technology Stack

#### Frontend
- **Framework**: Expo (React Native)
- **Platforms**: iOS, Android, Web
- **State Management**: React Query + Context API
- **Navigation**: React Navigation 6
- **UI Components**: Custom components built on React Native
- **Camera**: Expo Camera for photo capture
- **Audio**: Expo AV for voice recording

#### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15 (Railway)
- **ORM**: Raw SQL with pg (no ORM for performance)
- **Authentication**: JWT with bcrypt
- **File Upload**: Multer with local storage
- **Voice Processing**: Custom transcription service

#### Infrastructure
- **Hosting**: Railway (PaaS)
- **Database**: Railway PostgreSQL
- **File Storage**: Railway Volumes
- **CDN**: Railway built-in
- **Monitoring**: Prometheus + Grafana
- **Logging**: Structured JSON logs
- **CI/CD**: GitHub Actions

#### External Services
- **SMS**: Telnyx API
- **Error Tracking**: Sentry (optional)
- **Analytics**: Custom metrics collection

## Detailed Architecture

### Application Architecture

#### Layered Architecture Pattern

```
┌─────────────────────────────────────────────┐
│              Presentation Layer             │
│  ┌─────────────┬─────────────┬────────────┐ │
│  │ Controllers │ Middleware  │ Validators │ │
│  └─────────────┴─────────────┴────────────┘ │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│               Business Layer                │
│  ┌─────────────┬─────────────┬────────────┐ │
│  │  Services   │   Workflow  │  Business  │ │
│  │             │   Engine    │   Logic    │ │
│  └─────────────┴─────────────┴────────────┘ │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│               Data Access Layer             │
│  ┌─────────────┬─────────────┬────────────┐ │
│  │Repositories │   Models    │   Utils    │ │
│  └─────────────┴─────────────┴────────────┘ │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│               Data Layer                    │
│  ┌─────────────┬─────────────┬────────────┐ │
│  │ PostgreSQL  │ File System │  External  │ │
│  │  Database   │   Storage   │   APIs     │ │
│  └─────────────┴─────────────┴────────────┘ │
└─────────────────────────────────────────────┘
```

### Database Architecture

#### Entity Relationship Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Users       │    │     Shops       │    │   Customers     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ email           │    │ name            │    │ first_name      │
│ password_hash   │    │ address         │    │ last_name       │
│ first_name      │    │ phone           │    │ email           │
│ last_name       │ ┌──│ owner_id (FK)   │    │ phone           │
│ role            │ │  │ created_at      │ ┌──│ shop_id (FK)    │
│ shop_id (FK)    │─┘  │ updated_at      │ │  │ created_at      │
│ is_active       │    └─────────────────┘ │  │ updated_at      │
│ created_at      │                        │  └─────────────────┘
│ updated_at      │                        │           │
└─────────────────┘                        │           │
         │                                 │           │
         │    ┌─────────────────┐          │           │
         │    │  Inspections    │          │           │
         │    ├─────────────────┤          │           │
         │    │ id (PK)         │          │           │
         │    │ customer_id (FK)│──────────┘           │
         │    │ mechanic_id (FK)│──────────────────────┘
         └────│ shop_id (FK)    │
              │ vehicle_year    │
              │ vehicle_make    │
              │ vehicle_model   │
              │ vehicle_vin     │
              │ license_plate   │
              │ mileage         │
              │ status          │
              │ priority        │
              │ scheduled_date  │
              │ started_at      │
              │ completed_at    │
              │ notes           │
              │ created_at      │
              │ updated_at      │
              └─────────────────┘
                       │
              ┌─────────────────┐
              │InspectionItems  │
              ├─────────────────┤
              │ id (PK)         │
              │ inspection_id   │──┘
              │ category        │
              │ name            │
              │ status          │
              │ condition       │
              │ notes           │
              │ voice_note_url  │
              │ estimated_cost  │
              │ urgency         │
              │ checked_at      │
              │ created_at      │
              │ updated_at      │
              └─────────────────┘
                       │
              ┌─────────────────┐
              │     Photos      │
              ├─────────────────┤
              │ id (PK)         │
              │ item_id (FK)    │──┘
              │ filename        │
              │ url             │
              │ thumbnail_url   │
              │ size            │
              │ mime_type       │
              │ caption         │
              │ taken_at        │
              │ created_at      │
              └─────────────────┘
```

#### Database Design Principles

1. **Normalization**: 3NF compliance for data integrity
2. **Indexing**: Strategic indexes on frequently queried columns
3. **Constraints**: Foreign key constraints for referential integrity
4. **Audit Trail**: Created/updated timestamps on all entities
5. **Soft Deletes**: Important entities support soft deletion
6. **UUID Primary Keys**: For better security and scalability

#### Performance Optimizations

```sql
-- Key indexes for performance
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_inspections_shop_date ON inspections(shop_id, created_at);
CREATE INDEX idx_inspection_items_inspection ON inspection_items(inspection_id);
CREATE INDEX idx_photos_item ON photos(item_id);
CREATE INDEX idx_users_shop_active ON users(shop_id, is_active);
```

### API Architecture

#### RESTful Design

| Resource | POST | GET | PUT | DELETE |
|----------|------|-----|-----|--------|
| `/api/auth` | Login | - | - | Logout |
| `/api/inspections` | Create | List | Update | Delete |
| `/api/inspections/{id}` | - | Get | Update | Delete |
| `/api/inspections/{id}/items` | Add Item | List Items | - | - |
| `/api/customers` | Create | List | Update | Delete |
| `/api/photos` | Upload | - | - | Delete |

#### Request/Response Flow

```
Client Request
     │
     ▼
┌─────────────────┐
│   Rate Limiter  │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   CORS Check    │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Authentication │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   Authorization │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   Validation    │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   Controller    │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│    Service      │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   Repository    │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│    Database     │
└─────────────────┘
```

### Security Architecture

#### Authentication & Authorization

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   API Gateway   │    │   Auth Service  │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Login Request   │───▶│ Rate Limiting   │───▶│ Validate Creds  │
│                 │    │ Input Validation│    │ Generate JWT    │
│                 │◀───│ Return JWT      │◀───│ Return Token    │
│                 │    │                 │    │                 │
│ API Request     │───▶│ Extract JWT     │───▶│ Validate Token  │
│ with JWT        │    │ Verify Signature│    │ Check Expiry    │
│                 │◀───│ Allow/Deny      │◀───│ Return Claims   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### Security Layers

1. **Transport Security**: TLS 1.3 for all communications
2. **Application Security**: JWT authentication with secure secrets
3. **Data Security**: Bcrypt password hashing (12 rounds)
4. **Input Security**: Joi validation for all inputs
5. **Rate Limiting**: Per-IP and per-user rate limits
6. **CORS**: Strict origin validation
7. **SQL Injection Prevention**: Parameterized queries only

### File Management Architecture

#### File Upload Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   API Server    │    │  File Storage   │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Select Photo    │    │                 │    │                 │
│ Compress Image  │───▶│ Validate File   │    │                 │
│ Upload Request  │    │ Check Size/Type │    │                 │
│                 │    │ Generate UUID   │───▶│ Store File      │
│                 │    │ Create Record   │    │ Generate URL    │
│                 │◀───│ Return URL      │◀───│ Return Path     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### File Storage Strategy

- **Local Storage**: Railway volumes for simplicity
- **File Types**: JPEG, PNG, HEIC for photos; MP3, WAV for audio
- **Size Limits**: 10MB per file, 20 files per inspection
- **Thumbnails**: Auto-generated for photos
- **Naming**: UUID-based filenames for security
- **Cleanup**: Orphaned file cleanup via scheduled jobs

### Communication Architecture

#### SMS Integration (Telnyx)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Inspection     │    │   SMS Service   │    │  Telnyx API     │
│  Completed      │───▶│ Generate Link   │───▶│ Send Message    │
│                 │    │ Create Template │    │ Track Delivery  │
│                 │◀───│ Update Status   │◀───│ Webhook Status  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### Message Types

1. **Inspection Ready**: Link to view completed inspection
2. **Approval Required**: Notification for shop manager approval
3. **Reminder**: Follow-up for pending actions
4. **Receipt**: Confirmation of service completion

### Monitoring & Observability

#### Logging Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Application    │    │   Log Processor │    │   Storage       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Structured JSON │───▶│ Parse & Enrich  │───▶│ Railway Logs    │
│ with Context    │    │ Add Metadata    │    │ (30 day retain) │
│ Correlation IDs │    │ Filter & Route  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Alert Manager │
                       │ Critical Errors │
                       │ Performance     │
                       │ Business Metrics│
                       └─────────────────┘
```

#### Metrics Collection

```javascript
// Custom metrics for business monitoring
const metrics = {
  inspections: {
    total: 'counter',
    duration: 'histogram',
    by_status: 'counter'
  },
  sms: {
    sent: 'counter',
    failed: 'counter',
    cost: 'counter'
  },
  photos: {
    uploaded: 'counter',
    size: 'histogram'
  }
};
```

## Deployment Architecture

### Railway Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                       Railway Project                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  API Service    │  Database       │      Volumes                │
│  ┌───────────┐  │  ┌───────────┐  │  ┌─────────────────────────┐ │
│  │ Express   │  │  │PostgreSQL │  │  │ /app/uploads            │ │
│  │ App       │  │  │ 15.x      │  │  │ (5GB Production)        │ │
│  │ (Node.js) │  │  │           │  │  │ (1GB Staging)           │ │
│  └───────────┘  │  └───────────┘  │  └─────────────────────────┘ │
│  Auto-scaling   │  Connection     │  Automatic Backups          │
│  Load Balancer  │  Pooling        │  Version Control            │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### Environment Configuration

#### Production Environment
- **CPU**: 500m (0.5 core)
- **Memory**: 1GB
- **Storage**: 5GB volume
- **Database**: Pro plan with high availability
- **Replicas**: 2 for high availability
- **Auto-scaling**: Enabled (2-5 replicas)

#### Staging Environment
- **CPU**: 250m (0.25 core)
- **Memory**: 512MB
- **Storage**: 1GB volume
- **Database**: Hobby plan
- **Replicas**: 1
- **Auto-scaling**: Disabled

### CI/CD Pipeline

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Git Push      │    │  GitHub Actions │    │   Railway       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Code Changes    │───▶│ Run Tests       │───▶│ Build & Deploy  │
│ Branch: main    │    │ Security Scan   │    │ Health Checks   │
│               │    │ Performance     │    │ Rollback if Fail│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │  Notifications  │
                       │ Slack Webhooks  │
                       │ Email Alerts    │
                       │ Sentry Updates  │
                       └─────────────────┘
```

## Performance Architecture

### Response Time Targets

| Endpoint Type | Target | Acceptable |
|---------------|--------|------------|
| Health Check | <100ms | <200ms |
| Authentication | <200ms | <500ms |
| List APIs | <300ms | <1s |
| Detail APIs | <200ms | <500ms |
| File Upload | <2s | <5s |
| Report Generation | <1s | <3s |

### Caching Strategy

#### Application-Level Caching
```javascript
// In-memory caching for frequent queries
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache inspection templates
const getInspectionTemplate = async (type) => {
  const cacheKey = `template:${type}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await repository.getTemplate(type);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
};
```

#### Database Query Optimization
- Connection pooling (2-20 connections)
- Prepared statements for all queries
- Strategic indexes on frequently accessed columns
- Query result caching for read-heavy operations

### Scalability Design

#### Horizontal Scaling
- Stateless application design
- Database connection pooling
- File storage on shared volumes
- Session data in JWT tokens (stateless)

#### Vertical Scaling
- Railway auto-scaling based on CPU/Memory
- Database scaling through Railway plans
- Volume expansion as needed

## Data Architecture

### Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   API Server    │    │   Database      │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ User Input      │───▶│ Validation      │───▶│ Transaction     │
│ Photos/Audio    │    │ Business Logic  │    │ Consistency     │
│ State Sync      │◀───│ Response        │◀───│ ACID Properties │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────│  File Storage   │──────────────┘
                        │ Railway Volumes │
                        │ Auto Backup     │
                        └─────────────────┘
```

### Data Consistency

#### ACID Properties
- **Atomicity**: All database operations in transactions
- **Consistency**: Foreign key constraints and validation
- **Isolation**: Proper transaction isolation levels
- **Durability**: Railway automated backups

#### Data Validation
```javascript
// Multi-layer validation
const layers = [
  'Client-side validation (immediate feedback)',
  'API input validation (Joi schemas)',
  'Business logic validation (service layer)',
  'Database constraints (final safety net)'
];
```

## Integration Architecture

### External Service Integration

#### Telnyx SMS Service
```javascript
// SMS integration with circuit breaker pattern
class SMSService {
  private circuitBreaker = new CircuitBreaker({
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  });

  async sendSMS(to: string, message: string) {
    return this.circuitBreaker.execute(async () => {
      return await telnyx.messages.create({
        to,
        text: message,
        from: process.env.TELNYX_PHONE_NUMBER
      });
    });
  }
}
```

#### Error Handling & Resilience
- Circuit breaker pattern for external APIs
- Exponential backoff for retries
- Graceful degradation when services unavailable
- Comprehensive error logging with correlation IDs

## Future Architecture Considerations

### Scalability Enhancements

#### Phase 2 Considerations
1. **Microservices**: Split into separate services as load increases
2. **CDN**: Implement CDN for static file delivery
3. **Caching Layer**: Redis for distributed caching
4. **Message Queue**: Background job processing
5. **Search Service**: Elasticsearch for advanced search

#### Migration Path
```
Current (MVP)          Phase 2              Enterprise
┌─────────────┐       ┌─────────────┐      ┌─────────────┐
│ Monolith    │  ──▶  │Microservices│ ──▶  │Multi-tenant │
│ Railway     │       │ + Cache     │      │ + Analytics │
│ PostgreSQL  │       │ + Queue     │      │ + AI/ML     │
└─────────────┘       └─────────────┘      └─────────────┘
```

### Technology Evolution

#### Database Evolution
- **Current**: Single PostgreSQL instance
- **Phase 2**: Read replicas for scaling
- **Enterprise**: Distributed database with sharding

#### Frontend Evolution
- **Current**: Single Expo app for all platforms
- **Phase 2**: Platform-specific optimizations
- **Enterprise**: Separate web dashboard

## Architecture Benefits

### Technical Benefits
1. **Simplicity**: Single codebase for all platforms
2. **Performance**: Optimized for Railway deployment
3. **Maintainability**: Clear separation of concerns
4. **Scalability**: Designed for horizontal scaling
5. **Security**: Multiple security layers
6. **Monitoring**: Comprehensive observability

### Business Benefits
1. **Fast Time-to-Market**: MVP ready for production
2. **Cost-Effective**: $25-55/month operating cost
3. **Reliable**: 99.9% uptime target
4. **User-Friendly**: Intuitive mobile-first design
5. **Extensible**: Easy to add new features
6. **Compliant**: Industry security standards

## Conclusion

The Courtesy Inspection architecture provides a solid foundation for a digital vehicle inspection platform. The design prioritizes simplicity, performance, and reliability while maintaining the flexibility to scale as the business grows. The use of proven technologies and patterns ensures maintainability and reduces technical risk.

The architecture successfully meets the MVP requirements while providing clear paths for future enhancement and scaling to enterprise levels.