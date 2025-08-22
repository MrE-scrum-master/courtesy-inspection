// Common types and interfaces used throughout the application

export interface DatabaseClient {
  query: (text: string, params?: any[]) => Promise<any>;
  release?: () => void;
}

export interface DatabaseService {
  query: (text: string, params?: any[]) => Promise<any>;
  getClient: () => Promise<DatabaseClient>;
  transaction: <T>(callback: (client: DatabaseClient) => Promise<T>) => Promise<T>;
  findOne: (table: string, conditions?: Record<string, any>, columns?: string) => Promise<any>;
  findMany: (table: string, conditions?: Record<string, any>, options?: QueryOptions) => Promise<any[]>;
  insert: (table: string, data: Record<string, any>) => Promise<any>;
  update: (table: string, data: Record<string, any>, conditions: Record<string, any>) => Promise<any[]>;
  delete: (table: string, conditions: Record<string, any>) => Promise<any[]>;
  count: (table: string, conditions?: Record<string, any>) => Promise<number>;
  exists: (table: string, conditions: Record<string, any>) => Promise<boolean>;
}

export interface QueryOptions {
  columns?: string;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface RequestUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'admin' | 'shop_manager' | 'mechanic';
  shop_id: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  data?: any;
}

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface RepositoryOptions {
  transaction?: DatabaseClient;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface PaginationResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  shopId?: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export interface UploadFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface ErrorDetails {
  field: string;
  message: string;
  value?: any;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export interface LogContext {
  correlationId: string;
  userId?: string;
  shopId?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  tags?: string[];
}

// HTTP Status Codes
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503
}

// User Roles
export enum UserRole {
  ADMIN = 'admin',
  SHOP_MANAGER = 'shop_manager',
  MECHANIC = 'mechanic'
}

// Inspection Status
export enum InspectionStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SENT = 'sent',
  ARCHIVED = 'archived'
}

// Item Status (Traffic Light System)
export enum ItemStatus {
  GREEN = 'green',
  YELLOW = 'yellow',
  RED = 'red'
}

// Vehicle Condition
export enum VehicleCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor'
}

// Security-related interfaces
export interface SecurityContext {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  correlationId?: string;
  riskScore?: number;
}

export interface AuditContext extends LogContext {
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'auth' | 'data' | 'security' | 'system' | 'api' | 'user_action';
  executionTime?: number;
  statusCode?: number;
  errorMessage?: string;
}

export interface PasswordValidation {
  isValid: boolean;
  violations: string[];
  strength?: 'weak' | 'medium' | 'strong' | 'very_strong';
}

export interface LoginAttempt {
  email: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  timestamp: Date;
  failureReason?: string;
  lockoutUntil?: Date;
}

export interface RefreshTokenInfo {
  id: string;
  userId: string;
  tokenHash: string;
  deviceInfo?: any;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  isExpired: boolean;
  isRevoked: boolean;
}

export interface SessionInfo {
  id: string;
  userId: string;
  sessionId: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
}

// Permission and RBAC types
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  category: string;
}

export interface RolePermissions {
  role: string;
  permissions: Permission[];
}

export interface UserPermissionOverride {
  userId: string;
  permissionId: string;
  granted: boolean;
  grantedBy?: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface AccessRequest {
  user: RequestUser;
  resource: string;
  action: string;
  resourceId?: string;
  context?: SecurityContext;
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
  missingPermissions?: string[];
  appliedRules?: string[];
}

// Security monitoring interfaces
export interface SecurityMetrics {
  failedLogins: number;
  suspiciousActivities: number;
  blockedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  activeUsers: number;
  activeSessions: number;
}

export interface ThreatDetection {
  type: 'brute_force' | 'sql_injection' | 'xss_attempt' | 'suspicious_behavior' | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: any;
  timestamp: Date;
  blocked: boolean;
}

// Rate limiting interfaces
export interface RateLimitInfo {
  key: string;
  count: number;
  resetTime: number;
  windowMs: number;
  maxRequests: number;
  remaining: number;
}

export interface RateLimitRule {
  path: string;
  method?: string;
  maxRequests: number;
  windowMs: number;
  skipIf?: (req: any) => boolean;
  keyGenerator?: (req: any) => string;
}

// File security interfaces
export interface FileSecurityInfo {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  isSecure: boolean;
  securityChecks: {
    mimeTypeValid: boolean;
    extensionValid: boolean;
    sizeValid: boolean;
    contentScanned: boolean;
    virusFree: boolean;
  };
  quarantined: boolean;
}

export interface UploadRestrictions {
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFileSize: number;
  maxTotalSize: number;
  scanForViruses: boolean;
  quarantineSuspicious: boolean;
}

// Configuration interfaces
export interface SecurityConfig {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventReuse: number;
    maxAge: number;
  };
  sessionManagement: {
    maxConcurrentSessions: number;
    sessionTimeout: number;
    strictIpValidation: boolean;
    trackDeviceFingerprints: boolean;
  };
  rateLimiting: {
    enabled: boolean;
    generalLimit: number;
    authLimit: number;
    windowMs: number;
  };
  auditLogging: {
    enabled: boolean;
    logLevel: 'info' | 'warning' | 'error' | 'critical';
    retentionDays: number;
    realTimeAlerts: boolean;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
    rounds: number;
  };
}