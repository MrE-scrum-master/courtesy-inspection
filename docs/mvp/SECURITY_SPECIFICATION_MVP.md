# SECURITY - MVP VERSION

## Philosophy
**Platform security + basic auth**

Leverage platform-provided security features (Render/Railway provides HTTPS, DDoS protection) combined with essential application-level security measures. Focus on critical vulnerabilities while maintaining development speed.

## MVP Security Principles

- **Platform Reliance**: Leverage hosting platform security features
- **Essential Security Only**: Focus on critical vulnerabilities
- **Simple Implementation**: Standard security patterns without complexity
- **Basic Authentication**: JWT-based authentication with simple RBAC
- **Development Speed**: Security that doesn't slow down MVP delivery

## 1. Platform-Provided Security

### 1.1 HTTPS/TLS
**Provided by Platform**: Render/Railway automatically provides:
- SSL/TLS certificates (Let's Encrypt)
- HTTPS termination
- HTTP to HTTPS redirects
- TLS 1.2+ enforcement

**Application Configuration**:
```javascript
// Trust proxy for platform HTTPS
app.set('trust proxy', 1);

// Force HTTPS in production (platform handled)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

### 1.2 DDoS Protection
**Provided by Platform**: Render/Railway includes:
- Edge-level DDoS protection
- Traffic filtering
- Rate limiting at infrastructure level
- CDN protection

### 1.3 Infrastructure Security
**Provided by Platform**:
- Container isolation
- Network segmentation
- Automated security patches
- Infrastructure monitoring

## 2. Basic JWT Authentication

### 2.1 Simple JWT Implementation
```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class AuthService {
  static generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      shopId: user.shopId
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h', // Simple 24-hour expiry
      issuer: 'courtesy-inspection'
    });
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static async hashPassword(password) {
    const saltRounds = 12; // Secure bcrypt rounds
    return await bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
}

// Simple authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = AuthService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { AuthService, authenticateToken };
```

### 2.2 Basic Password Hashing (bcrypt)
```javascript
// Password security requirements (basic)
const passwordPolicy = {
  minLength: 8,
  maxLength: 100,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false // Keep simple for MVP
};

function validatePassword(password) {
  const errors = [];

  if (password.length < passwordPolicy.minLength) {
    errors.push(`Password must be at least ${passwordPolicy.minLength} characters long`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

## 3. Simple Role-Based Access Control

### 3.1 Basic Role Hierarchy
```javascript
const ROLES = {
  SUPER_ADMIN: {
    level: 100,
    permissions: ['*'] // All permissions
  },
  SHOP_MANAGER: {
    level: 70,
    permissions: [
      'inspections:*',
      'customers:*',
      'users:manage_shop',
      'sms:send', // Key permission for SMS
      'reports:*'
    ]
  },
  MECHANIC: {
    level: 30,
    permissions: [
      'inspections:read',
      'inspections:write',
      'customers:read'
      // No SMS sending permission
    ]
  },
  CUSTOMER: {
    level: 10,
    permissions: [
      'inspections:read_own',
      'profile:*'
    ]
  }
};
```

### 3.2 Simple Role Checks
```javascript
// Basic permission check middleware
function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = ROLES[user.role];
    
    if (!userRole) {
      return res.status(403).json({ error: 'Invalid user role' });
    }

    // Check for wildcard permission
    if (userRole.permissions.includes('*')) {
      return next();
    }

    // Check for specific permission
    if (userRole.permissions.includes(permission)) {
      return next();
    }

    // Check for wildcard resource permission
    const [resource] = permission.split(':');
    if (userRole.permissions.includes(`${resource}:*`)) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

// Shop isolation middleware (simple)
function requireShopAccess(req, res, next) {
  const user = req.user;
  
  // Super admins can access any shop
  if (user.role === 'SUPER_ADMIN') {
    return next();
  }
  
  // Shop managers and mechanics can only access their own shop
  if (user.shopId && (user.role === 'SHOP_MANAGER' || user.role === 'MECHANIC')) {
    req.allowedShopId = user.shopId;
    return next();
  }
  
  return res.status(403).json({ error: 'Shop access denied' });
}

// SMS sending permission (simple check)
function requireSMSPermission(req, res, next) {
  const user = req.user;
  
  if (user.role === 'SUPER_ADMIN' || user.role === 'SHOP_MANAGER') {
    return next();
  }
  
  return res.status(403).json({ error: 'SMS sending not allowed' });
}
```

## 4. Basic CORS Setup

### 4.1 Simple CORS Configuration
```javascript
const cors = require('cors');

// Basic CORS - simple whitelist approach
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://app.courtesyinspection.com',
      'https://staging.courtesyinspection.com'
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization'
  ]
};

module.exports = corsOptions;
```

## 5. Basic Input Validation

### 5.1 Essential Validation (Joi)
```javascript
const Joi = require('joi');

// Basic validation schemas
const validationSchemas = {
  // User registration
  registerUser: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(8).max(100).required(),
    firstName: Joi.string().max(50).pattern(/^[a-zA-Z\s-']+$/).required(),
    lastName: Joi.string().max(50).pattern(/^[a-zA-Z\s-']+$/).required(),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20),
    role: Joi.string().valid('SHOP_MANAGER', 'MECHANIC').required()
  }),

  // Create inspection
  createInspection: Joi.object({
    customerEmail: Joi.string().email().required(),
    vehicleYear: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
    vehicleMake: Joi.string().max(50).pattern(/^[a-zA-Z0-9\s-]+$/).required(),
    vehicleModel: Joi.string().max(50).pattern(/^[a-zA-Z0-9\s-]+$/),
    mileage: Joi.number().integer().min(0).max(1000000),
    notes: Joi.string().max(2000)
  }),

  // Send SMS
  sendSMS: Joi.object({
    to: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).required(),
    message: Joi.string().max(160).required()
  })
};

// Simple validation middleware
function validateInput(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorDetails
      });
    }

    req.validatedBody = value;
    next();
  };
}
```

## 6. Basic Security Headers

### 6.1 Essential Headers (Helmet)
```javascript
const helmet = require('helmet');

// Basic security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: process.env.NODE_ENV === 'production'
  }
});

module.exports = securityHeaders;
```

## 7. Basic Rate Limiting

### 7.1 Simple Rate Limits
```javascript
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Simple limit
  message: {
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Strict for auth
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  skipSuccessfulRequests: true
});

// SMS rate limiting (basic)
const smsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Basic SMS limit
  message: {
    error: 'SMS rate limit exceeded, please try again later'
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

module.exports = { apiLimiter, authLimiter, smsLimiter };
```

## 8. Basic Error Handling

### 8.1 Secure Error Responses
```javascript
// Basic secure error handling
function secureErrorHandler(err, req, res, next) {
  // Log errors server-side only
  console.error('Error occurred:', {
    message: err.message,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Simple error responses for production
  if (process.env.NODE_ENV === 'production') {
    // Generic messages only
    if (err.status === 400) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    if (err.status === 401) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (err.status === 403) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (err.status === 404) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  } else {
    // Development: show detailed errors
    return res.status(err.status || 500).json({
      error: err.message,
      stack: err.stack
    });
  }
}

module.exports = secureErrorHandler;
```

## 9. Basic SQL Injection Prevention

### 9.1 Parameterized Queries Only
```javascript
const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  // Always use parameterized queries
  async query(text, params = []) {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error.message);
      throw new Error('Database operation failed');
    }
  }

  // Safe query examples
  async findUserByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.query(query, [email]);
    return result.rows[0];
  }

  async createInspection(data) {
    const query = `
      INSERT INTO inspections (customer_email, vehicle_year, vehicle_make, vehicle_model, mileage, notes, user_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    const values = [
      data.customerEmail,
      data.vehicleYear,
      data.vehicleMake,
      data.vehicleModel,
      data.mileage,
      data.notes,
      data.userId
    ];
    
    const result = await this.query(query, values);
    return result.rows[0];
  }
}

module.exports = DatabaseService;
```

## 10. Environment Configuration

### 10.1 Essential Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-32-chars-minimum

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Session Secret
SESSION_SECRET=your-session-secret-key

# Environment
NODE_ENV=production

# Platform provided (no SSL config needed)
# SSL_CERT_PATH - handled by platform
# SSL_KEY_PATH - handled by platform

# Rate Limiting
RATE_LIMIT_ENABLED=true

# Logging Level
LOG_LEVEL=info
```

## MVP Security Checklist

### Essential Security (MVP Requirements)
- [x] **Platform HTTPS**: Automatically provided by Render/Railway
- [x] **Platform DDoS Protection**: Included with hosting platform
- [x] **JWT Authentication**: Basic JWT with 24-hour expiry
- [x] **bcrypt Password Hashing**: 12 salt rounds for security
- [x] **Simple Role Checks**: SUPER_ADMIN, SHOP_MANAGER, MECHANIC, CUSTOMER
- [x] **Basic CORS Setup**: Simple whitelist configuration
- [x] **SQL Injection Prevention**: Parameterized queries only
- [x] **Input Validation**: Joi schemas for essential endpoints
- [x] **Basic Rate Limiting**: Simple limits on API and auth endpoints
- [x] **Secure Error Handling**: Generic errors in production

### Shop Isolation & SMS Controls
- [x] **Shop Data Isolation**: Users can only access their own shop data
- [x] **SMS Permission Control**: Only SUPER_ADMIN and SHOP_MANAGER can send SMS
- [x] **Shop Creation Control**: Only SUPER_ADMIN can create new shops

### Security Headers
- [x] **Basic Helmet Configuration**: Essential security headers
- [x] **Content Security Policy**: Basic CSP setup
- [x] **HSTS**: HTTP Strict Transport Security enabled

### Excluded from MVP (Phase 2)
- [ ] **Multi-Factor Authentication (MFA)**: Advanced auth features
- [ ] **Advanced Threat Detection**: AI-powered security monitoring
- [ ] **Penetration Testing**: Automated security testing
- [ ] **OWASP Compliance**: Comprehensive security standard compliance
- [ ] **Advanced RLS Policies**: Complex row-level security
- [ ] **Security Monitoring**: Real-time threat detection
- [ ] **Advanced Encryption**: Beyond basic bcrypt hashing
- [ ] **Security Auditing**: Comprehensive audit logging

## Security Philosophy Summary

**MVP Focus**: Leverage platform security features combined with essential application-level controls. Prioritize critical vulnerabilities while maintaining development velocity. Platform providers (Render/Railway) handle infrastructure security, allowing the application to focus on authentication, authorization, and basic data protection.

**Platform + Basic Auth Strategy**: 
- Infrastructure security → Platform responsibility
- Application security → Basic but solid implementation
- User security → Simple but effective auth/authz
- Data security → Parameterized queries and input validation

This MVP approach provides adequate security for initial deployment while establishing a foundation for Phase 2 enterprise security features.