# Courtesy Inspection - Security Documentation

## Security Overview

The Courtesy Inspection platform implements a comprehensive security framework designed to protect customer data, business information, and system integrity. This document outlines our security architecture, controls, and compliance measures.

## Security Architecture

### Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                     Security Layers                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Perimeter Security                                           │
│    ├─ TLS 1.3 Encryption                                       │
│    ├─ DDoS Protection (Railway)                                │
│    └─ Web Application Firewall                                 │
├─────────────────────────────────────────────────────────────────┤
│ 2. Application Security                                         │
│    ├─ JWT Authentication                                        │
│    ├─ Role-Based Access Control                                │
│    ├─ Input Validation & Sanitization                          │
│    └─ Rate Limiting                                             │
├─────────────────────────────────────────────────────────────────┤
│ 3. Data Security                                                │
│    ├─ Data Encryption (at rest & in transit)                   │
│    ├─ Database Access Controls                                  │
│    ├─ Secure File Storage                                       │
│    └─ Data Loss Prevention                                      │
├─────────────────────────────────────────────────────────────────┤
│ 4. Infrastructure Security                                      │
│    ├─ Network Segmentation                                      │
│    ├─ Security Monitoring                                       │
│    ├─ Vulnerability Management                                  │
│    └─ Incident Response                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication & Authorization

### JWT Token Security

#### Token Configuration
```javascript
// JWT configuration with secure defaults
const jwtConfig = {
  algorithm: 'HS256',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  issuer: 'courtesy-inspection-api',
  audience: 'courtesy-inspection-clients',
  notBefore: '0s',
  secret: process.env.JWT_SECRET // 256-bit secret
};

// Token payload structure (minimal data)
const tokenPayload = {
  sub: user.id,          // Subject (user ID)
  iat: Math.floor(Date.now() / 1000), // Issued at
  exp: expirationTime,   // Expiration
  role: user.role,       // User role
  shopId: user.shopId,   // Shop context
  permissions: user.permissions // Specific permissions
};
```

#### Token Security Measures
1. **Strong Secrets**: 256-bit randomly generated secrets
2. **Short Expiration**: 24-hour maximum lifetime
3. **Secure Storage**: HttpOnly cookies on web, secure storage on mobile
4. **Token Rotation**: Automatic refresh before expiration
5. **Blacklist Support**: Invalid tokens tracked in Redis

### Role-Based Access Control (RBAC)

#### User Roles
```typescript
enum UserRole {
  SHOP_OWNER = 'shop_owner',    // Full system access
  SHOP_MANAGER = 'shop_manager', // Shop management + inspections
  MECHANIC = 'mechanic',         // Inspections only
  CUSTOMER = 'customer'          // Read-only access to own data
}

// Permission matrix
const permissions = {
  [UserRole.SHOP_OWNER]: [
    'users:create', 'users:read', 'users:update', 'users:delete',
    'inspections:create', 'inspections:read', 'inspections:update', 'inspections:delete',
    'customers:create', 'customers:read', 'customers:update', 'customers:delete',
    'reports:generate', 'settings:manage', 'billing:access'
  ],
  [UserRole.SHOP_MANAGER]: [
    'inspections:create', 'inspections:read', 'inspections:update', 'inspections:approve',
    'customers:create', 'customers:read', 'customers:update',
    'reports:generate', 'users:read'
  ],
  [UserRole.MECHANIC]: [
    'inspections:create', 'inspections:read', 'inspections:update',
    'customers:read', 'photos:upload', 'voice:record'
  ],
  [UserRole.CUSTOMER]: [
    'inspections:read_own', 'profile:read', 'profile:update'
  ]
};
```

#### Access Control Implementation
```typescript
// RBAC middleware
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userPermissions = getUserPermissions(req.user.role);
    
    if (!userPermissions.includes(permission)) {
      Logger.security('Access denied', 'medium', {
        userId: req.user.id,
        permission,
        endpoint: req.path
      }, req.context);
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }
    
    next();
  };
};
```

## Input Validation & Sanitization

### Validation Schema
```typescript
// Comprehensive input validation using Joi
const inspectionSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  vehicle: Joi.object({
    year: Joi.number()
      .integer()
      .min(1900)
      .max(new Date().getFullYear() + 1)
      .required(),
    make: Joi.string()
      .trim()
      .max(50)
      .pattern(/^[a-zA-Z0-9\s\-]+$/)
      .required(),
    model: Joi.string()
      .trim()
      .max(50)
      .pattern(/^[a-zA-Z0-9\s\-]+$/)
      .required(),
    vin: Joi.string()
      .trim()
      .length(17)
      .pattern(/^[A-HJ-NPR-Z0-9]+$/)
      .optional(),
    licensePlate: Joi.string()
      .trim()
      .max(10)
      .pattern(/^[A-Z0-9\-\s]+$/i)
      .optional(),
    mileage: Joi.number()
      .integer()
      .min(0)
      .max(1000000)
      .optional()
  }).required(),
  scheduledDate: Joi.date()
    .iso()
    .min('now')
    .optional(),
  priority: Joi.string()
    .valid('low', 'medium', 'high')
    .default('medium'),
  notes: Joi.string()
    .trim()
    .max(1000)
    .optional()
});
```

### Sanitization Middleware
```typescript
// Input sanitization to prevent XSS and injection attacks
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove HTML tags and encode special characters
      return validator.escape(
        validator.stripLow(
          obj.trim().replace(/<[^>]*>/g, '')
        )
      );
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };
  
  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);
  
  next();
};
```

## Data Protection

### Encryption Standards

#### Data in Transit
- **TLS 1.3**: All HTTP communications encrypted
- **Certificate Pinning**: Mobile apps verify server certificates
- **HSTS**: HTTP Strict Transport Security headers
- **Perfect Forward Secrecy**: Ephemeral key exchange

#### Data at Rest
```typescript
// Sensitive data encryption using AES-256-GCM
import crypto from 'crypto';

class DataEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY = crypto.scryptSync(
    process.env.ENCRYPTION_KEY!,
    'salt',
    32
  );

  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.ALGORITHM, this.KEY);
    cipher.setAAD(Buffer.from('additional-data'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(this.ALGORITHM, this.KEY);
    decipher.setAAD(Buffer.from('additional-data'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Password Security
```typescript
// Bcrypt with adaptive cost factor
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export class PasswordService {
  static async hash(password: string): Promise<string> {
    // Validate password strength
    if (!this.isStrongPassword(password)) {
      throw new Error('Password does not meet security requirements');
    }
    
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private static isStrongPassword(password: string): boolean {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return password.length >= minLength &&
           hasUpperCase &&
           hasLowerCase &&
           hasNumbers &&
           hasSpecialChar;
  }
}
```

## Security Headers & CORS

### Security Headers Configuration
```typescript
// Comprehensive security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: { policy: "require-corp" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
}));
```

### CORS Configuration
```typescript
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      Logger.security('CORS violation', 'medium', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Correlation-ID'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  maxAge: 86400 // 24 hours
};
```

## Rate Limiting & DDoS Protection

### Multi-Tier Rate Limiting
```typescript
// Different rate limits for different endpoint types
const rateLimiters = {
  // Authentication endpoints - strict limits
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:auth:'
    })
  }),
  
  // File upload endpoints - lower limits
  upload: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
      error: {
        code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
        message: 'Too many file uploads'
      }
    }
  }),
  
  // General API endpoints
  api: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      error: {
        code: 'API_RATE_LIMIT_EXCEEDED',
        message: 'Too many requests'
      }
    }
  })
};

// Apply rate limiters
app.use('/api/auth', rateLimiters.auth);
app.use('/api/*/upload', rateLimiters.upload);
app.use('/api', rateLimiters.api);
```

### DDoS Protection
```typescript
// Custom DDoS protection middleware
export const ddosProtection = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip;
  const userAgent = req.get('User-Agent') || '';
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /scanner/i,
    /automated/i
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(userAgent)
  );
  
  if (isSuspicious) {
    Logger.security('Suspicious user agent detected', 'high', {
      ip: clientIP,
      userAgent
    });
    
    return res.status(429).json({
      error: {
        code: 'SUSPICIOUS_ACTIVITY',
        message: 'Request blocked due to suspicious activity'
      }
    });
  }
  
  next();
};
```

## File Upload Security

### Secure File Handling
```typescript
// Comprehensive file upload security
const uploadSecurity = {
  // File type validation
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/heic',
      'audio/mpeg',
      'audio/wav',
      'audio/mp4'
    ];
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.mp3', '.wav', '.m4a'];
    
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimeTypes.includes(file.mimetype) && 
        allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      Logger.security('Rejected file upload', 'medium', {
        filename: file.originalname,
        mimetype: file.mimetype,
        extension: fileExtension
      });
      cb(new Error('File type not allowed'), false);
    }
  },
  
  // Size limits
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 20 // Maximum 20 files per request
  },
  
  // Secure filename generation
  filename: (req: any, file: Express.Multer.File, cb: any) => {
    const uuid = crypto.randomUUID();
    const extension = path.extname(file.originalname);
    const secureFilename = `${uuid}${extension}`;
    cb(null, secureFilename);
  }
};

// File scanning for malware (conceptual - would integrate with service)
const scanFile = async (filePath: string): Promise<boolean> => {
  // Integration with malware scanning service
  // Return true if file is clean, false if malware detected
  return true; // Placeholder
};
```

### File Access Control
```typescript
// Secure file serving with access control
app.get('/api/files/:fileId', 
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const fileId = req.params.fileId;
      const file = await FileRepository.findById(fileId);
      
      if (!file) {
        return res.status(404).json({
          error: { code: 'FILE_NOT_FOUND', message: 'File not found' }
        });
      }
      
      // Check if user has access to this file
      const hasAccess = await checkFileAccess(req.user, file);
      if (!hasAccess) {
        Logger.security('Unauthorized file access attempt', 'high', {
          userId: req.user.id,
          fileId: file.id,
          filePath: file.path
        });
        
        return res.status(403).json({
          error: { code: 'ACCESS_DENIED', message: 'Access denied' }
        });
      }
      
      // Serve file with secure headers
      res.set({
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${file.originalName}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      });
      
      res.sendFile(file.path);
      
    } catch (error) {
      Logger.error('File serving error', error);
      res.status(500).json({
        error: { code: 'FILE_SERVE_ERROR', message: 'Error serving file' }
      });
    }
  }
);
```

## Database Security

### SQL Injection Prevention
```typescript
// All queries use parameterized statements
class InspectionRepository {
  static async findByShopId(shopId: string, page: number, limit: number) {
    const query = `
      SELECT i.*, c.first_name, c.last_name, u.first_name as mechanic_first_name
      FROM inspections i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u ON i.mechanic_id = u.id
      WHERE i.shop_id = $1
      ORDER BY i.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const offset = (page - 1) * limit;
    const result = await pool.query(query, [shopId, limit, offset]);
    
    return result.rows;
  }
  
  // NO string concatenation - prevents SQL injection
  static async search(shopId: string, searchTerm: string) {
    const query = `
      SELECT * FROM inspections i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.shop_id = $1 
      AND (
        c.first_name ILIKE $2 OR 
        c.last_name ILIKE $2 OR 
        i.vehicle_make ILIKE $2 OR 
        i.vehicle_model ILIKE $2
      )
    `;
    
    const likePattern = `%${searchTerm}%`;
    return pool.query(query, [shopId, likePattern]);
  }
}
```

### Database Access Control
```typescript
// Database connection with minimal privileges
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT // Certificate authority for SSL
  },
  // Connection pooling with security limits
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Application-level query timeout
  query_timeout: 30000,
  statement_timeout: 30000
};
```

## Logging & Monitoring

### Security Event Logging
```typescript
// Comprehensive security logging
export class SecurityLogger {
  static logAuthEvent(event: string, userId?: string, context?: any) {
    Logger.info('Security Event', {
      type: 'authentication',
      event,
      userId,
      timestamp: new Date().toISOString(),
      ip: context?.ip,
      userAgent: context?.userAgent,
      success: event.includes('success')
    });
  }
  
  static logAccessViolation(userId: string, resource: string, action: string, context?: any) {
    Logger.security('Access violation', 'high', {
      type: 'authorization',
      userId,
      resource,
      action,
      ip: context?.ip,
      endpoint: context?.endpoint
    });
  }
  
  static logDataAccess(userId: string, dataType: string, recordId: string) {
    Logger.info('Data Access', {
      type: 'data_access',
      userId,
      dataType,
      recordId,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Intrusion Detection
```typescript
// Simple intrusion detection patterns
export class IntrusionDetection {
  private static suspiciousPatterns = [
    /union.*select/i,        // SQL injection
    /<script[^>]*>/i,        // XSS attempts
    /\.\.\/\.\.\//,          // Directory traversal
    /eval\(/i,               // Code injection
    /document\.cookie/i,     // Cookie theft
    /javascript:/i           // JavaScript injection
  ];
  
  static detectSuspiciousInput(input: string): boolean {
    return this.suspiciousPatterns.some(pattern => pattern.test(input));
  }
  
  static analyzeRequest(req: Request): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    
    // Check all input fields
    const allInputs = [
      ...Object.values(req.body || {}),
      ...Object.values(req.query || {}),
      ...Object.values(req.params || {})
    ].filter(value => typeof value === 'string');
    
    for (const input of allInputs) {
      if (this.detectSuspiciousInput(input)) {
        threats.push({
          type: 'MALICIOUS_INPUT',
          severity: 'HIGH',
          details: `Suspicious pattern detected in input: ${input.substring(0, 100)}`
        });
      }
    }
    
    return threats;
  }
}
```

## Incident Response

### Security Incident Handling
```typescript
// Automated security incident response
export class IncidentResponse {
  static async handleSecurityIncident(incident: SecurityIncident) {
    // Log the incident
    Logger.security('Security incident detected', 'critical', {
      type: incident.type,
      severity: incident.severity,
      details: incident.details,
      timestamp: new Date().toISOString()
    });
    
    // Immediate response actions
    switch (incident.severity) {
      case 'CRITICAL':
        await this.handleCriticalIncident(incident);
        break;
      case 'HIGH':
        await this.handleHighSeverityIncident(incident);
        break;
      case 'MEDIUM':
        await this.handleMediumSeverityIncident(incident);
        break;
    }
    
    // Notify security team
    await this.notifySecurityTeam(incident);
  }
  
  private static async handleCriticalIncident(incident: SecurityIncident) {
    // For critical incidents:
    // 1. Block suspicious IP addresses
    // 2. Revoke compromised tokens
    // 3. Enable enhanced monitoring
    // 4. Prepare for system isolation if needed
    
    if (incident.type === 'POTENTIAL_BREACH') {
      await this.enableEmergencyMode();
    }
  }
  
  private static async enableEmergencyMode() {
    // Increase rate limiting
    // Enable additional logging
    // Require re-authentication for sensitive operations
    Logger.security('Emergency mode activated', 'critical');
  }
}
```

## Compliance & Standards

### Security Standards Compliance

#### OWASP Top 10 Mitigation
1. **Injection**: Parameterized queries, input validation
2. **Broken Authentication**: Strong JWT implementation, MFA ready
3. **Sensitive Data Exposure**: Encryption at rest and in transit
4. **XML External Entities**: N/A (JSON API only)
5. **Broken Access Control**: RBAC implementation
6. **Security Misconfiguration**: Hardened server configuration
7. **Cross-Site Scripting**: Input sanitization, CSP headers
8. **Insecure Deserialization**: No unsafe deserialization
9. **Known Vulnerabilities**: Automated dependency scanning
10. **Insufficient Logging**: Comprehensive security logging

#### Data Protection Compliance
```typescript
// GDPR/CCPA compliance features
export class DataProtection {
  // Data portability
  static async exportUserData(userId: string): Promise<UserDataExport> {
    const userData = await UserRepository.getAllUserData(userId);
    
    return {
      profile: userData.profile,
      inspections: userData.inspections,
      photos: userData.photos.map(photo => ({
        ...photo,
        url: await this.generateSecureDownloadURL(photo.id)
      })),
      createdAt: userData.createdAt,
      exportedAt: new Date().toISOString()
    };
  }
  
  // Right to be forgotten
  static async deleteUserData(userId: string): Promise<void> {
    // Soft delete to maintain referential integrity
    await UserRepository.markForDeletion(userId);
    
    // Schedule hard deletion after retention period
    await this.scheduleHardDeletion(userId, 30); // 30 days
    
    Logger.info('User data deletion initiated', { userId });
  }
  
  // Data minimization
  static sanitizeForLogging(data: any): any {
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'ssn', 'license'
    ];
    
    return this.deepSanitize(data, sensitiveFields);
  }
}
```

## Security Testing

### Automated Security Testing
```bash
# Security testing pipeline
npm run test:security        # Custom security tests
npm audit --audit-level high # Dependency vulnerability scan
npm run lint:security        # ESLint security rules
```

### Security Test Examples
```typescript
// Security-focused test cases
describe('Authentication Security', () => {
  test('should reject weak passwords', async () => {
    const weakPasswords = ['123456', 'password', 'qwerty'];
    
    for (const password of weakPasswords) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password,
          firstName: 'Test',
          lastName: 'User'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    }
  });
  
  test('should prevent SQL injection in login', async () => {
    const maliciousEmail = "'; DROP TABLE users; --";
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: maliciousEmail,
        password: 'password'
      });
    
    expect(response.status).toBe(400);
    
    // Verify users table still exists
    const users = await UserRepository.count();
    expect(users).toBeGreaterThan(0);
  });
  
  test('should prevent XSS in user input', async () => {
    const xssPayload = '<script>alert("xss")</script>';
    
    const response = await authenticatedRequest()
      .post('/api/customers')
      .send({
        firstName: xssPayload,
        lastName: 'Test',
        email: 'test@example.com',
        phone: '+1234567890'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Security Configuration Checklist

### Production Security Checklist

#### Environment Configuration
- [ ] Strong JWT secrets (256-bit minimum)
- [ ] Database connection over SSL
- [ ] File upload size limits configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers implemented
- [ ] Error messages don't leak information
- [ ] Debug mode disabled in production

#### Access Controls
- [ ] RBAC implemented and tested
- [ ] Default deny policy in place
- [ ] Privilege escalation prevention
- [ ] Session management secure
- [ ] Multi-factor authentication ready
- [ ] Password policies enforced

#### Data Protection
- [ ] Encryption at rest configured
- [ ] Encryption in transit enforced
- [ ] Sensitive data identified and protected
- [ ] Data retention policies implemented
- [ ] Backup encryption verified
- [ ] Data access logging enabled

#### Monitoring & Response
- [ ] Security event logging configured
- [ ] Intrusion detection active
- [ ] Vulnerability scanning scheduled
- [ ] Incident response plan documented
- [ ] Security metrics monitored
- [ ] Alert thresholds configured

#### Infrastructure Security
- [ ] Network segmentation implemented
- [ ] Firewall rules configured
- [ ] DDoS protection enabled
- [ ] SSL certificates valid
- [ ] Security patches current
- [ ] Access logs retained

## Conclusion

The Courtesy Inspection platform implements enterprise-grade security controls appropriate for handling sensitive customer and business data. Regular security assessments, penetration testing, and compliance audits should be conducted to maintain and improve the security posture.

For security concerns or incident reporting, contact: security@courtesy-inspection.com