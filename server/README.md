# Courtesy Inspection API Server

Enterprise-grade API server for the Courtesy Inspection MVP, built with TypeScript, Express, and PostgreSQL.

## 🏗️ Architecture

### Repository Pattern
- **BaseRepository**: Generic CRUD operations with transaction support
- **InspectionRepository**: Complex inspection queries with pagination
- **UserRepository**: User management with shop access control
- **CustomerRepository**: Customer data with vehicle relationships

### Service Layer
- **AuthService**: JWT authentication with refresh tokens
- **InspectionService**: Complete inspection lifecycle management
- **VoiceService**: Voice-to-text parsing and validation
- **SMSService**: Telnyx SMS integration with templates

### Controller Layer
- **AuthController**: HTTP authentication endpoints
- **InspectionController**: RESTful inspection API

### Middleware Stack
- **AuthMiddleware**: JWT validation and role-based authorization
- **ValidationMiddleware**: Joi schema validation
- **ErrorMiddleware**: Centralized error handling and logging

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (Railway)
- Environment variables configured

### Installation
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your environment variables in .env
```

### Development
```bash
# Start development server with hot reload
npm run dev

# Run with debugger
npm run dev:debug

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

### Database
```bash
# Run migrations
npm run db:migrate

# Health check
npm run db:health

# Maintenance
npm run db:maintenance
```

### Testing
```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Production
```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## 📋 API Documentation

### Authentication Endpoints
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get user profile
- `POST /auth/change-password` - Change password
- `GET /auth/validate` - Validate token

### Inspection Endpoints
- `POST /inspections` - Create inspection
- `GET /inspections` - List inspections (filtered)
- `GET /inspections/:id` - Get inspection details
- `PUT /inspections/:id` - Update inspection
- `PATCH /inspections/:id/items` - Update checklist item
- `DELETE /inspections/:id` - Delete inspection (admin)
- `GET /inspections/my` - Get my inspections
- `GET /inspections/generate-number/:shopId` - Generate inspection number
- `GET /inspections/statistics/:shopId` - Get shop statistics
- `GET /inspections/recent/:shopId` - Get recent inspections

### Voice Processing Endpoints
- `POST /voice/parse` - Parse voice input
- `GET /voice/components` - Get available components

### SMS Endpoints
- `POST /sms/send` - Send SMS message
- `GET /sms/templates` - Get SMS templates
- `POST /sms/webhook` - Telnyx webhook handler

## 🔐 Security Features

### Authentication
- JWT access tokens (24h expiry)
- Refresh tokens (7d expiry)
- Secure password hashing with bcrypt
- Session management with database storage

### Authorization
- Role-based access control (admin, shop_manager, mechanic)
- Shop-based data isolation
- Resource ownership validation
- API key support for external integrations

### Security Headers
- Helmet.js security headers
- CORS configuration
- Request sanitization
- Rate limiting support

## 🗄️ Database Schema

### Core Tables
- `users` - User accounts with role-based access
- `shops` - Shop organizations
- `customers` - Customer information
- `vehicles` - Vehicle details
- `inspections` - Inspection records
- `inspection_photos` - Photo attachments
- `reports` - Generated reports with short links
- `user_sessions` - Active user sessions

### Relationships
- Users belong to shops
- Customers belong to shops
- Vehicles belong to customers
- Inspections link customer, vehicle, technician
- Photos and reports belong to inspections

## 🔧 Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://...

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES=24h
REFRESH_EXPIRES=7d

# SMS (Telnyx)
TELNYX_API_KEY=your-api-key
TELNYX_PHONE_NUMBER=+1234567890

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006
```

## 📊 Logging

### Structured Logging
- JSON formatted logs for production
- Correlation IDs for request tracking
- Performance metrics
- Security event logging

### Log Levels
- **ERROR**: System errors and failures
- **WARN**: Warning conditions
- **INFO**: General information
- **DEBUG**: Detailed debugging information

## 🧪 Testing

### Test Structure
- Unit tests for services and utilities
- Integration tests for repositories
- API endpoint testing
- Database transaction testing

### Coverage Requirements
- Minimum 80% code coverage
- Critical path coverage 100%
- Service layer full coverage

## 🚀 Deployment

### Railway Deployment
```bash
# Build and deploy
npm run build
railway deploy
```

### Environment Setup
1. Configure DATABASE_URL in Railway
2. Set JWT_SECRET (generate secure key)
3. Configure Telnyx credentials
4. Set ALLOWED_ORIGINS for CORS

### Health Monitoring
- `/health` endpoint for health checks
- Database connection monitoring
- Performance metrics collection
- Error rate tracking

## 📋 Development Checklist

### Code Quality
- [ ] TypeScript strict mode enabled
- [ ] ESLint configuration
- [ ] Prettier formatting
- [ ] Jest testing setup
- [ ] Joi validation schemas

### Architecture
- [ ] Repository pattern implemented
- [ ] Service layer separation
- [ ] Middleware stack configured
- [ ] Error handling centralized
- [ ] Logging structured

### Security
- [ ] JWT authentication
- [ ] Role-based authorization
- [ ] Input validation
- [ ] Security headers
- [ ] Environment variables secured

### Database
- [ ] Migration system
- [ ] Connection pooling
- [ ] Transaction support
- [ ] Query optimization
- [ ] Backup strategy

## 🔗 Integration

### External Services
- **Railway PostgreSQL**: Primary database
- **Telnyx SMS**: SMS notifications
- **Expo Push**: Mobile notifications (future)

### Frontend Integration
- CORS configured for Expo development
- JWT token-based authentication
- RESTful API design
- Error response standardization

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": { ... }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

Built with ❤️ for the Courtesy Inspection MVP