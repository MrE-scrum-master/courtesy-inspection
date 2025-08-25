// Security Configuration - Centralized security settings
// Production-ready security configuration with environment-based overrides

import { SecurityConfig } from '../types/common';

// Default security configuration
export const defaultSecurityConfig: SecurityConfig = {
  passwordPolicy: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
    preventReuse: parseInt(process.env.PASSWORD_PREVENT_REUSE || '5'),
    maxAge: parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '90')
  },
  
  sessionManagement: {
    maxConcurrentSessions: parseInt(process.env.MAX_SESSIONS_PER_USER || '5'),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60'),
    strictIpValidation: process.env.STRICT_IP_VALIDATION === 'true',
    trackDeviceFingerprints: process.env.TRACK_DEVICE_FINGERPRINTS !== 'false'
  },
  
  rateLimiting: {
    enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
    generalLimit: parseInt(process.env.RATE_LIMIT_GENERAL || '100'),
    authLimit: parseInt(process.env.RATE_LIMIT_AUTH || '5'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') // 15 minutes
  },
  
  auditLogging: {
    enabled: process.env.AUDIT_LOGGING_ENABLED !== 'false',
    logLevel: (process.env.AUDIT_LOG_LEVEL as 'info' | 'warning' | 'error' | 'critical') || 'info',
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '365'),
    realTimeAlerts: process.env.REAL_TIME_SECURITY_ALERTS === 'true'
  },
  
  encryption: {
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    keyLength: parseInt(process.env.ENCRYPTION_KEY_LENGTH || '32'),
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
  }
};

// Environment-specific configurations
export const getSecurityConfig = (): SecurityConfig => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...defaultSecurityConfig,
        passwordPolicy: {
          ...defaultSecurityConfig.passwordPolicy,
          minLength: 12, // Stricter in production
          preventReuse: 10 // Remember more passwords
        },
        sessionManagement: {
          ...defaultSecurityConfig.sessionManagement,
          maxConcurrentSessions: 3, // Limit sessions in production
          strictIpValidation: true // Always validate IPs in production
        },
        auditLogging: {
          ...defaultSecurityConfig.auditLogging,
          realTimeAlerts: true // Always enable alerts in production
        }
      };
      
    case 'staging':
      return {
        ...defaultSecurityConfig,
        passwordPolicy: {
          ...defaultSecurityConfig.passwordPolicy,
          minLength: 10
        },
        auditLogging: {
          ...defaultSecurityConfig.auditLogging,
          realTimeAlerts: true
        }
      };
      
    case 'development':
      return {
        ...defaultSecurityConfig,
        passwordPolicy: {
          ...defaultSecurityConfig.passwordPolicy,
          minLength: 6, // Relaxed for development
          requireSpecialChars: false
        },
        sessionManagement: {
          ...defaultSecurityConfig.sessionManagement,
          strictIpValidation: false // Relaxed for development
        }
      };
      
    case 'test':
      return {
        ...defaultSecurityConfig,
        passwordPolicy: {
          ...defaultSecurityConfig.passwordPolicy,
          minLength: 4, // Very relaxed for testing
          requireUppercase: false,
          requireLowercase: false,
          requireNumbers: false,
          requireSpecialChars: false,
          preventReuse: 1
        },
        sessionManagement: {
          ...defaultSecurityConfig.sessionManagement,
          maxConcurrentSessions: 10,
          strictIpValidation: false
        },
        rateLimiting: {
          ...defaultSecurityConfig.rateLimiting,
          enabled: false // Disable for testing
        },
        auditLogging: {
          ...defaultSecurityConfig.auditLogging,
          enabled: false, // Disable for testing
          realTimeAlerts: false
        }
      };
      
    default:
      return defaultSecurityConfig;
  }
};

// Security middleware configuration
export const securityMiddlewareConfig = {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8081'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token',
      'X-API-Key',
      'X-Correlation-ID'
    ],
    exposedHeaders: ['X-Correlation-ID', 'X-Rate-Limit-Remaining'],
    maxAge: 86400 // 24 hours
  },
  
  helmet: {
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      success: false,
      error: 'Too many requests, please try again later',
      retryAfter: 900 // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false
  },
  
  authRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 auth requests per windowMs
    message: {
      success: false,
      error: 'Too many authentication attempts, please try again later',
      retryAfter: 900
    }
  }
};

// File upload security configuration
export const fileUploadConfig = {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Maximum 5 files per request
    fieldSize: 1024 * 1024, // 1MB per field
    totalSize: 50 * 1024 * 1024 // 50MB total per request
  },
  
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json'
  ],
  
  allowedExtensions: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.txt', '.csv', '.json'
  ],
  
  dangerousExtensions: [
    '.exe', '.bat', '.cmd', '.scr', '.pif', '.com',
    '.js', '.vbs', '.ps1', '.php', '.asp', '.jsp',
    '.sh', '.py', '.rb', '.pl'
  ],
  
  scanForViruses: process.env.ENABLE_VIRUS_SCAN === 'true',
  quarantinePath: process.env.QUARANTINE_PATH || '/tmp/quarantine'
};

// Database security configuration
export const databaseConfig = {
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT,
    cert: process.env.DB_CLIENT_CERT,
    key: process.env.DB_CLIENT_KEY
  } : false,
  
  connectionTimeout: 30000, // 30 seconds
  queryTimeout: 10000, // 10 seconds
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  
  // Row Level Security settings
  enableRLS: process.env.ENABLE_ROW_LEVEL_SECURITY !== 'false',
  
  // Query logging for security monitoring
  logQueries: process.env.LOG_DATABASE_QUERIES === 'true',
  logSlowQueries: parseInt(process.env.LOG_SLOW_QUERIES_MS || '1000')
};

// Monitoring and alerting configuration
export const monitoringConfig = {
  healthCheck: {
    enabled: true,
    endpoint: '/health',
    interval: 30000, // 30 seconds
    timeout: 5000 // 5 seconds
  },
  
  metrics: {
    enabled: process.env.ENABLE_METRICS !== 'false',
    endpoint: '/metrics',
    collectInterval: 10000, // 10 seconds
    retentionPeriod: 24 * 60 * 60 * 1000 // 24 hours
  },
  
  alerts: {
    enabled: process.env.ENABLE_ALERTS === 'true',
    
    thresholds: {
      errorRate: 0.05, // 5% error rate
      responseTime: 2000, // 2 seconds
      memoryUsage: 0.85, // 85% memory usage
      diskUsage: 0.90, // 90% disk usage
      failedLogins: 10, // 10 failed logins per minute
      suspiciousActivities: 5 // 5 suspicious activities per minute
    },
    
    webhooks: {
      slack: process.env.SLACK_WEBHOOK_URL,
      email: process.env.EMAIL_ALERT_ENDPOINT,
      sms: process.env.SMS_ALERT_ENDPOINT
    }
  }
};

// JWT configuration
export const jwtConfig = {
  secret: process.env.JWT_SECRET || (() => {
    console.warn('JWT_SECRET not set in environment variables');
    return 'default-jwt-secret-change-in-production';
  })(),
  
  accessToken: {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    issuer: process.env.JWT_ISSUER || 'courtesy-inspection',
    audience: process.env.JWT_AUDIENCE || 'courtesy-inspection-api'
  },
  
  refreshToken: {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    rotateOnRefresh: process.env.ROTATE_REFRESH_TOKENS !== 'false'
  },
  
  // Algorithm and security settings
  algorithm: 'HS256' as const,
  clockTolerance: 30, // 30 seconds clock skew tolerance
  maxTokenAge: '7d' // Maximum age for any token
};

// Validation and sanitization configuration
export const validationConfig = {
  // Input field limits
  maxStringLength: 10000,
  maxArrayLength: 1000,
  maxObjectDepth: 10,
  
  // HTML sanitization
  allowedHtmlTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
  allowedHtmlAttributes: ['class'],
  
  // URL validation
  allowedProtocols: ['http:', 'https:'],
  allowedDomains: process.env.ALLOWED_DOMAINS?.split(',') || [],
  
  // Phone number formats
  phoneRegexPatterns: [
    /^\+?[1-9]\d{1,14}$/, // E.164 format
    /^\(\d{3}\)\s\d{3}-\d{4}$/, // US format: (555) 123-4567
    /^\d{3}-\d{3}-\d{4}$/ // US format: 555-123-4567
  ]
};

export default {
  security: getSecurityConfig(),
  middleware: securityMiddlewareConfig,
  fileUpload: fileUploadConfig,
  database: databaseConfig,
  monitoring: monitoringConfig,
  jwt: jwtConfig,
  validation: validationConfig
};