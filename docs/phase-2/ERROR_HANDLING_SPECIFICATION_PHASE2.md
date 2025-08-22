# ERROR HANDLING - PHASE 2 ENTERPRISE

**Philosophy**: "Prevent proactively, recover automatically, monitor comprehensively"

**Version 2.0 Enterprise | December 2024**

---

## Executive Summary

This document defines enterprise-grade error handling for Phase 2 of the Courtesy Inspection platform. The strategy includes advanced monitoring with Sentry integration, circuit breakers, exponential backoff retry mechanisms, automated recovery systems, and comprehensive error analytics.

**Core Enterprise Principles:**
- **Sentry Integration**: Advanced error tracking and monitoring
- **Circuit Breakers**: Prevent cascading failures in distributed systems
- **Automated Recovery**: Intelligent retry mechanisms with exponential backoff
- **Error Analytics**: Real-time error pattern analysis and alerting
- **Graceful Degradation**: Automated fallback systems for service failures

---

## 1. Advanced Error Architecture

### 1.1 Enterprise Error Classification

```typescript
enum ErrorSeverity {
  CRITICAL = 'critical',    // System down, data loss risk
  HIGH = 'high',           // Major feature unavailable
  MEDIUM = 'medium',       // Minor feature impact
  LOW = 'low',            // Cosmetic or non-blocking
  INFO = 'info'           // Informational only
}

enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service',
  DATABASE = 'database',
  SYSTEM = 'system',
  SECURITY = 'security'
}

interface ErrorContext {
  correlationId: string;
  userId?: string;
  shopId?: string;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
  stackTrace?: string;
  additionalData?: Record<string, any>;
  retryable: boolean;
  expectedRecoveryTime: number; // seconds
}

class EnterpriseError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly isOperational: boolean;
  public readonly statusCode: number;
  public readonly fingerprint: string;

  constructor(
    message: string,
    severity: ErrorSeverity,
    category: ErrorCategory,
    statusCode: number = 500,
    context: Partial<ErrorContext> = {},
    isOperational: boolean = true
  ) {
    super(message);
    
    this.severity = severity;
    this.category = category;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.fingerprint = this.generateFingerprint();
    this.context = {
      correlationId: generateCorrelationId(),
      timestamp: new Date(),
      retryable: this.isRetryable(category),
      expectedRecoveryTime: this.calculateRecoveryTime(severity),
      ...context
    };

    Error.captureStackTrace(this, EnterpriseError);
  }

  private generateFingerprint(): string {
    return crypto
      .createHash('md5')
      .update(`${this.category}:${this.message}:${this.constructor.name}`)
      .digest('hex');
  }

  private isRetryable(category: ErrorCategory): boolean {
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.EXTERNAL_SERVICE,
      ErrorCategory.DATABASE
    ];
    return retryableCategories.includes(category);
  }

  private calculateRecoveryTime(severity: ErrorSeverity): number {
    const recoveryTimes = {
      [ErrorSeverity.CRITICAL]: 300, // 5 minutes
      [ErrorSeverity.HIGH]: 120,     // 2 minutes
      [ErrorSeverity.MEDIUM]: 60,    // 1 minute
      [ErrorSeverity.LOW]: 30,       // 30 seconds
      [ErrorSeverity.INFO]: 10       // 10 seconds
    };
    return recoveryTimes[severity] || 60;
  }
}
```

### 1.2 Sentry Integration

```typescript
import * as Sentry from '@sentry/node';
import { RewriteFrames } from '@sentry/integrations';

class SentryErrorService {
  static initialize(): void {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.APP_VERSION,
      
      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Session tracking
      autoSessionTracking: true,
      
      // Enhanced integrations
      integrations: [
        new RewriteFrames({
          root: process.cwd(),
        }),
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
        new Sentry.Integrations.Postgres(),
        new Sentry.Integrations.OnUncaughtException({
          exitEvenIfOtherHandlersAreRegistered: false,
        }),
        new Sentry.Integrations.OnUnhandledRejection({
          mode: 'warn',
        }),
      ],
      
      // Custom error filtering
      beforeSend: (event, hint) => this.filterSensitiveData(event, hint),
      
      // Custom breadcrumb filtering
      beforeBreadcrumb: (breadcrumb) => this.filterBreadcrumbs(breadcrumb),
      
      // Release health monitoring
      beforeSendTransaction: (event) => {
        // Sample transactions based on performance impact
        if (event.transaction?.includes('/health')) {
          return null; // Don't track health checks
        }
        return event;
      }
    });
  }

  static captureError(error: Error, context?: ErrorContext): void {
    Sentry.withScope((scope) => {
      if (error instanceof EnterpriseError) {
        // Set user context
        if (error.context.userId) {
          scope.setUser({
            id: error.context.userId,
            ip_address: error.context.ip
          });
        }
        
        // Set tags for filtering and grouping
        scope.setTag('error_category', error.category);
        scope.setTag('error_severity', error.severity);
        scope.setTag('correlation_id', error.context.correlationId);
        scope.setTag('fingerprint', error.fingerprint);
        scope.setTag('retryable', error.context.retryable.toString());
        
        // Set level based on severity
        scope.setLevel(this.mapSeverityToLevel(error.severity));
        
        // Add context data
        scope.setContext('error_details', {
          category: error.category,
          severity: error.severity,
          statusCode: error.statusCode,
          isOperational: error.isOperational,
          expectedRecoveryTime: error.context.expectedRecoveryTime
        });
        
        // Add shop context
        if (error.context.shopId) {
          scope.setContext('shop', {
            id: error.context.shopId
          });
        }
        
        // Add request context
        if (error.context.additionalData?.request) {
          scope.setContext('request', error.context.additionalData.request);
        }
        
        // Set fingerprint for grouping
        scope.setFingerprint([error.fingerprint]);
      }
      
      // Add additional context if provided
      if (context) {
        scope.setContext('additional', context);
      }
      
      Sentry.captureException(error);
    });
  }

  private static filterSensitiveData(event: Sentry.Event, hint: Sentry.EventHint): Sentry.Event | null {
    // Remove sensitive data from error events
    if (event.request?.data) {
      const sanitizedData = { ...event.request.data };
      // Remove sensitive fields
      delete sanitizedData.password;
      delete sanitizedData.token;
      delete sanitizedData.credit_card;
      delete sanitizedData.ssn;
      delete sanitizedData.phone;
      event.request.data = sanitizedData;
    }
    
    // Remove sensitive headers
    if (event.request?.headers) {
      const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
      sensitiveHeaders.forEach(header => {
        if (event.request!.headers![header]) {
          event.request!.headers![header] = '[Filtered]';
        }
      });
    }
    
    return event;
  }

  private static filterBreadcrumbs(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('/health')) {
      return null;
    }
    
    // Remove sensitive data from breadcrumbs
    if (breadcrumb.data?.request?.data) {
      delete breadcrumb.data.request.data.password;
      delete breadcrumb.data.request.data.token;
    }
    
    return breadcrumb;
  }

  private static mapSeverityToLevel(severity: ErrorSeverity): Sentry.Severity {
    const mapping = {
      [ErrorSeverity.CRITICAL]: 'fatal',
      [ErrorSeverity.HIGH]: 'error',
      [ErrorSeverity.MEDIUM]: 'warning',
      [ErrorSeverity.LOW]: 'info',
      [ErrorSeverity.INFO]: 'info'
    } as const;
    
    return mapping[severity] || 'error';
  }
}
```

### 1.3 Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime?: Date;
  private successCount = 0;
  private readonly metrics = new CircuitBreakerMetrics();
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly successThreshold: number = 3,
    private readonly monitoringWindow: number = 300000 // 5 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        this.metrics.recordStateChange('HALF_OPEN');
      } else {
        this.metrics.recordRejection();
        if (fallback) {
          return await fallback();
        }
        throw new EnterpriseError(
          'Circuit breaker is OPEN',
          ErrorSeverity.HIGH,
          ErrorCategory.SYSTEM,
          503,
          { additionalData: { circuitBreakerState: this.state } }
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      this.metrics.recordSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      this.metrics.recordFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime.getTime() >= this.timeout;
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
        this.metrics.recordStateChange('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.metrics.recordStateChange('OPEN');
    }
  }

  getState(): { state: string; failures: number; lastFailureTime?: Date } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

class CircuitBreakerMetrics {
  recordSuccess(): void {
    MetricsCollector.incrementCounter('circuit_breaker.success');
  }

  recordFailure(): void {
    MetricsCollector.incrementCounter('circuit_breaker.failure');
  }

  recordRejection(): void {
    MetricsCollector.incrementCounter('circuit_breaker.rejection');
  }

  recordStateChange(newState: string): void {
    MetricsCollector.incrementCounter('circuit_breaker.state_change', { state: newState });
  }
}
```

### 1.4 Exponential Backoff Retry

```typescript
class ExponentialBackoffRetry {
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      jitter = true,
      retryableErrors = [ErrorCategory.NETWORK, ErrorCategory.EXTERNAL_SERVICE, ErrorCategory.DATABASE]
    } = options;

    let lastError: Error;
    const retryMetrics = new RetryMetrics();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 0) {
          retryMetrics.recordSuccessfulRetry(attempt);
        }
        return result;
      } catch (error) {
        lastError = error;
        retryMetrics.recordFailedAttempt(attempt);

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (error instanceof EnterpriseError) {
          if (!error.context.retryable || !retryableErrors.includes(error.category)) {
            retryMetrics.recordNonRetryableError(error.category);
            break;
          }
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, baseDelay, maxDelay, backoffMultiplier, jitter);
        retryMetrics.recordRetryDelay(delay);
        
        await this.delay(delay);
      }
    }

    retryMetrics.recordExhaustedRetries();
    
    // Wrap with retry information
    if (lastError instanceof EnterpriseError) {
      lastError.context.additionalData = {
        ...lastError.context.additionalData,
        retryAttempts: maxRetries,
        finalAttempt: true
      };
    }

    throw lastError!;
  }

  private static calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    multiplier: number,
    jitter: boolean
  ): number {
    let delay = baseDelay * Math.pow(multiplier, attempt);
    delay = Math.min(delay, maxDelay);
    
    if (jitter) {
      // Add random jitter (±25%)
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(delay, 0);
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryableErrors?: ErrorCategory[];
}

class RetryMetrics {
  recordFailedAttempt(attempt: number): void {
    MetricsCollector.incrementCounter('retry.attempt', { attempt: attempt.toString() });
  }

  recordSuccessfulRetry(attempt: number): void {
    MetricsCollector.incrementCounter('retry.success', { attempt: attempt.toString() });
  }

  recordNonRetryableError(category: ErrorCategory): void {
    MetricsCollector.incrementCounter('retry.non_retryable', { category });
  }

  recordExhaustedRetries(): void {
    MetricsCollector.incrementCounter('retry.exhausted');
  }

  recordRetryDelay(delay: number): void {
    MetricsCollector.recordHistogram('retry.delay', delay);
  }
}
```

---

## 2. Advanced API Error Handling

### 2.1 Enhanced API Error Responses (RFC 7807)

```typescript
interface ProblemDetails {
  type: string;           // URI identifying the problem type
  title: string;          // Human-readable summary
  status: number;         // HTTP status code
  detail?: string;        // Human-readable explanation
  instance?: string;      // URI reference identifying the occurrence
  timestamp: string;      // ISO 8601 timestamp
  traceId: string;       // Request trace ID for debugging
  correlationId: string; // Correlation ID for request tracking
  errors?: FieldError[];  // Field-specific errors
  retryAfter?: number;   // Seconds to wait before retrying
  documentation?: string; // Link to error documentation
}

class EnterpriseAPIErrorHandler {
  formatError(error: EnterpriseError, req: Request): ProblemDetails {
    const baseResponse: ProblemDetails = {
      type: this.getErrorTypeURI(error),
      title: this.getErrorTitle(error),
      status: error.statusCode,
      timestamp: error.context.timestamp.toISOString(),
      traceId: req.headers['x-trace-id'] as string || generateTraceId(),
      correlationId: error.context.correlationId
    };

    // Add retry information for retryable errors
    if (error.context.retryable) {
      baseResponse.retryAfter = error.context.expectedRecoveryTime;
    }

    // Add documentation link
    baseResponse.documentation = `https://docs.courtesyinspection.com/errors/${error.category}`;

    // Add detail if safe to expose
    if (this.isSafeToExpose(error)) {
      baseResponse.detail = error.message;
      baseResponse.instance = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    }

    // Add field-specific errors for validation failures
    if (error.category === ErrorCategory.VALIDATION && error.context.additionalData?.fieldErrors) {
      baseResponse.errors = error.context.additionalData.fieldErrors.map((fe: any) => ({
        field: fe.field,
        code: fe.code,
        message: this.getUserFriendlyFieldMessage(fe.code),
        value: fe.value
      }));
    }

    return baseResponse;
  }

  private getErrorTypeURI(error: EnterpriseError): string {
    return `https://docs.courtesyinspection.com/errors/${error.category}/${error.fingerprint}`;
  }

  private getErrorTitle(error: EnterpriseError): string {
    const titles = {
      [ErrorCategory.VALIDATION]: 'Validation Failed',
      [ErrorCategory.AUTHENTICATION]: 'Authentication Required',
      [ErrorCategory.AUTHORIZATION]: 'Access Denied',
      [ErrorCategory.NETWORK]: 'Network Error',
      [ErrorCategory.EXTERNAL_SERVICE]: 'External Service Error',
      [ErrorCategory.DATABASE]: 'Database Error',
      [ErrorCategory.BUSINESS_LOGIC]: 'Business Logic Error',
      [ErrorCategory.SECURITY]: 'Security Error',
      [ErrorCategory.SYSTEM]: 'System Error'
    };
    
    return titles[error.category] || 'Unknown Error';
  }

  private isSafeToExpose(error: EnterpriseError): boolean {
    const safeCategories = [
      ErrorCategory.VALIDATION,
      ErrorCategory.AUTHENTICATION,
      ErrorCategory.AUTHORIZATION,
      ErrorCategory.BUSINESS_LOGIC
    ];
    
    return error.isOperational && safeCategories.includes(error.category);
  }

  private getUserFriendlyFieldMessage(code: string): string {
    const messages = {
      'REQUIRED': 'This field is required',
      'EMAIL_INVALID': 'Please enter a valid email address',
      'PHONE_INVALID': 'Please enter a valid phone number',
      'VIN_INVALID': 'VIN must be exactly 17 characters',
      'TOO_SHORT': 'This field is too short',
      'TOO_LONG': 'This field is too long',
      'INVALID_FORMAT': 'Invalid format for this field',
      'OUT_OF_RANGE': 'Value is out of acceptable range'
    };
    
    return messages[code as keyof typeof messages] || 'Invalid value';
  }
}
```

### 2.2 Rate Limiting with Advanced Error Handling

```typescript
class RateLimitErrorHandler {
  async handleRateLimit(
    request: Request, 
    rateLimitInfo: RateLimitInfo,
    circuitBreaker: CircuitBreaker
  ): Promise<Response> {
    const resetTime = new Date(rateLimitInfo.resetTimestamp);
    const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
    
    // Check if we should open circuit breaker for this client
    if (rateLimitInfo.remaining === 0 && rateLimitInfo.consecutiveRateLimit > 5) {
      await circuitBreaker.execute(
        () => Promise.reject(new Error('Frequent rate limiting detected')),
        () => this.activateClientThrottling(request.ip)
      );
    }

    const problemDetails: ProblemDetails = {
      type: 'https://docs.courtesyinspection.com/errors/rate-limited',
      title: 'Rate Limit Exceeded',
      status: 429,
      detail: `You have exceeded the rate limit of ${rateLimitInfo.limit} requests per ${rateLimitInfo.window}. Please slow down your requests.`,
      timestamp: new Date().toISOString(),
      traceId: request.headers['x-trace-id'] as string || generateTraceId(),
      correlationId: request.headers['x-correlation-id'] as string || generateCorrelationId(),
      retryAfter: retryAfter,
      documentation: 'https://docs.courtesyinspection.com/api/rate-limiting'
    };

    // Send to monitoring
    SentryErrorService.captureError(new EnterpriseError(
      'Rate limit exceeded',
      ErrorSeverity.MEDIUM,
      ErrorCategory.NETWORK,
      429,
      {
        additionalData: {
          clientIp: request.ip,
          endpoint: request.path,
          rateLimitInfo
        }
      }
    ));

    return new Response(JSON.stringify(problemDetails), {
      status: 429,
      headers: {
        'Content-Type': 'application/problem+json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
        'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
        'X-RateLimit-Reset': rateLimitInfo.resetTimestamp.toString(),
        'X-RateLimit-Window': rateLimitInfo.window,
        'X-Correlation-ID': problemDetails.correlationId
      }
    });
  }

  private async activateClientThrottling(clientIp: string): Promise<void> {
    // Implement additional throttling for abusive clients
    await RedisClient.setex(`throttle:${clientIp}`, 3600, 'true'); // 1 hour throttle
    
    Logger.warn('Client throttling activated', { 
      clientIp,
      reason: 'Consecutive rate limiting'
    });
  }
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTimestamp: number;
  window: string;
  consecutiveRateLimit: number;
}
```

---

## 3. Database Error Handling with Transactions

### 3.1 Advanced Database Error Management

```typescript
class DatabaseErrorHandler {
  private connectionPool: ConnectionPool;
  private circuitBreaker: CircuitBreaker;
  private queryMetrics = new DatabaseMetrics();
  
  constructor() {
    this.connectionPool = new ConnectionPool({
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 3000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    });
    
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    
    this.connectionPool.on('error', (err) => {
      Logger.error('Database pool error', { error: err.message });
      SentryErrorService.captureError(err);
    });
  }

  async executeQuery<T>(
    query: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    return await this.circuitBreaker.execute(async () => {
      return await ExponentialBackoffRetry.executeWithRetry(
        () => this.performQuery<T>(query, params, options),
        {
          maxRetries: options.retries || 3,
          retryableErrors: [ErrorCategory.DATABASE, ErrorCategory.NETWORK]
        }
      );
    }, options.fallback);
  }

  private async performQuery<T>(
    query: string,
    params: any[],
    options: QueryOptions
  ): Promise<QueryResult<T>> {
    const connection = await this.connectionPool.getConnection();
    const queryTimeout = options.timeout || 30000;
    const startTime = Date.now();

    try {
      // Set query timeout
      await connection.query('SET statement_timeout = $1', [queryTimeout]);
      
      // Execute query with correlation tracking
      const result = await connection.query(query, params);
      
      const duration = Date.now() - startTime;
      this.queryMetrics.recordSuccess(query, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const dbError = this.categorizeDbError(error, query, params);
      
      this.queryMetrics.recordFailure(query, duration, dbError.category);
      
      Logger.error('Database query failed', {
        error: error.message,
        query: this.sanitizeQuery(query),
        paramCount: params.length,
        duration,
        correlationId: generateCorrelationId()
      });
      
      // Send to Sentry with context
      SentryErrorService.captureError(dbError, {
        query: this.sanitizeQuery(query),
        paramCount: params.length,
        duration
      });
      
      throw dbError;
    } finally {
      connection.release();
    }
  }

  private categorizeDbError(error: any, query: string, params: any[]): EnterpriseError {
    const errorCode = error.code;
    const errorMessage = error.message;

    switch (errorCode) {
      case '23505': // unique_violation
        return new EnterpriseError(
          'A record with this information already exists',
          ErrorSeverity.MEDIUM,
          ErrorCategory.VALIDATION,
          409,
          {
            additionalData: {
              constraint: this.extractConstraintName(errorMessage),
              duplicateValue: this.extractDuplicateValue(errorMessage)
            }
          }
        );
      
      case '23503': // foreign_key_violation
        return new EnterpriseError(
          'Referenced record does not exist',
          ErrorSeverity.MEDIUM,
          ErrorCategory.VALIDATION,
          400,
          {
            additionalData: {
              constraint: this.extractConstraintName(errorMessage),
              referencedTable: this.extractReferencedTable(errorMessage)
            }
          }
        );
      
      case '23514': // check_violation
        return new EnterpriseError(
          'Data validation failed',
          ErrorSeverity.MEDIUM,
          ErrorCategory.VALIDATION,
          400,
          {
            additionalData: {
              constraint: this.extractConstraintName(errorMessage)
            }
          }
        );
      
      case '57014': // query_canceled (timeout)
        return new EnterpriseError(
          'Database query timeout',
          ErrorSeverity.HIGH,
          ErrorCategory.DATABASE,
          504,
          {
            expectedRecoveryTime: 30,
            additionalData: { queryTimeout: true }
          }
        );
      
      case '53300': // too_many_connections
        return new EnterpriseError(
          'Database connection limit reached',
          ErrorSeverity.HIGH,
          ErrorCategory.DATABASE,
          503,
          {
            expectedRecoveryTime: 60,
            additionalData: { connectionPoolExhausted: true }
          }
        );
      
      case '08006': // connection_failure
      case '08001': // unable_to_connect
        return new EnterpriseError(
          'Database connection failed',
          ErrorSeverity.CRITICAL,
          ErrorCategory.DATABASE,
          503,
          {
            expectedRecoveryTime: 120,
            additionalData: { connectionFailure: true }
          }
        );
      
      case '40001': // serialization_failure
        return new EnterpriseError(
          'Transaction conflict detected',
          ErrorSeverity.MEDIUM,
          ErrorCategory.DATABASE,
          409,
          {
            retryable: true,
            expectedRecoveryTime: 5,
            additionalData: { serializationFailure: true }
          }
        );
      
      default:
        return new EnterpriseError(
          'Database operation failed',
          ErrorSeverity.HIGH,
          ErrorCategory.DATABASE,
          500,
          {
            additionalData: {
              errorCode,
              originalMessage: errorMessage,
              sanitizedQuery: this.sanitizeQuery(query)
            }
          }
        );
    }
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data from query for logging
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password = '[REDACTED]'")
      .replace(/token\s*=\s*'[^']*'/gi, "token = '[REDACTED]'")
      .substring(0, 200); // Limit length
  }

  private extractConstraintName(errorMessage: string): string {
    const match = errorMessage.match(/constraint "([^"]+)"/);
    return match ? match[1] : 'unknown';
  }

  private extractDuplicateValue(errorMessage: string): string {
    const match = errorMessage.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
    return match ? `${match[1]}: ${match[2]}` : 'unknown';
  }

  private extractReferencedTable(errorMessage: string): string {
    const match = errorMessage.match(/table "([^"]+)"/);
    return match ? match[1] : 'unknown';
  }
}

interface QueryOptions {
  timeout?: number;
  retries?: number;
  fallback?: () => Promise<any>;
  readOnly?: boolean;
}

class DatabaseMetrics {
  recordSuccess(query: string, duration: number): void {
    const operation = this.extractOperation(query);
    MetricsCollector.recordHistogram('database.query.duration', duration, { operation });
    MetricsCollector.incrementCounter('database.query.success', { operation });
  }

  recordFailure(query: string, duration: number, category: ErrorCategory): void {
    const operation = this.extractOperation(query);
    MetricsCollector.recordHistogram('database.query.duration', duration, { operation, status: 'failed' });
    MetricsCollector.incrementCounter('database.query.failure', { operation, category });
  }

  private extractOperation(query: string): string {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.startsWith('select')) return 'select';
    if (trimmed.startsWith('insert')) return 'insert';
    if (trimmed.startsWith('update')) return 'update';
    if (trimmed.startsWith('delete')) return 'delete';
    return 'other';
  }
}
```

### 3.2 Transaction Error Handling with Savepoints

```typescript
class TransactionManager {
  async executeTransaction<T>(
    operations: (tx: TransactionContext) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const connection = await this.connectionPool.getConnection();
    const context = new TransactionContext(connection, options);
    
    try {
      await context.begin();
      
      const result = await ExponentialBackoffRetry.executeWithRetry(
        () => operations(context),
        {
          maxRetries: options.retries || 2,
          retryableErrors: [ErrorCategory.DATABASE]
        }
      );
      
      await context.commit();
      return result;
    } catch (error) {
      await context.rollback();
      
      if (error instanceof EnterpriseError) {
        error.context.additionalData = {
          ...error.context.additionalData,
          transactionRolledBack: true,
          savepointsUsed: context.getSavepointCount()
        };
      }
      
      throw error;
    } finally {
      connection.release();
    }
  }
}

class TransactionContext {
  private savepointCounter = 0;
  private activeSavepoints: string[] = [];
  
  constructor(
    private connection: DatabaseConnection,
    private options: TransactionOptions
  ) {}

  async begin(): Promise<void> {
    await this.connection.query('BEGIN');
    
    if (this.options.isolationLevel) {
      await this.connection.query(
        `SET TRANSACTION ISOLATION LEVEL ${this.options.isolationLevel}`
      );
    }
    
    if (this.options.timeout) {
      await this.connection.query(
        'SET LOCAL statement_timeout = $1',
        [this.options.timeout]
      );
    }
  }

  async createSavepoint(): Promise<string> {
    const savepointName = `sp_${++this.savepointCounter}`;
    await this.connection.query(`SAVEPOINT ${savepointName}`);
    this.activeSavepoints.push(savepointName);
    return savepointName;
  }

  async rollbackToSavepoint(savepointName: string): Promise<void> {
    await this.connection.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    
    // Remove savepoints created after this one
    const index = this.activeSavepoints.indexOf(savepointName);
    if (index !== -1) {
      this.activeSavepoints = this.activeSavepoints.slice(0, index + 1);
    }
  }

  async releaseSavepoint(savepointName: string): Promise<void> {
    await this.connection.query(`RELEASE SAVEPOINT ${savepointName}`);
    
    const index = this.activeSavepoints.indexOf(savepointName);
    if (index !== -1) {
      this.activeSavepoints.splice(index, 1);
    }
  }

  async commit(): Promise<void> {
    await this.connection.query('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.connection.query('ROLLBACK');
  }

  getSavepointCount(): number {
    return this.activeSavepoints.length;
  }
}

interface TransactionOptions {
  timeout?: number;
  retries?: number;
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
}
```

---

## 4. External Service Error Handling

### 4.1 Advanced External Service Integration

```typescript
class ExternalServiceErrorHandler {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private degradationManager = new DegradationManager();
  
  async handleExternalServiceError(
    serviceName: string,
    operation: () => Promise<any>,
    fallback?: () => Promise<any>
  ): Promise<any> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(serviceName);
    
    return await this.degradationManager.executeWithDegradation(
      serviceName,
      () => circuitBreaker.execute(operation, fallback),
      fallback
    );
  }

  async sendSMS(phoneNumber: string, message: string): Promise<SMSResult> {
    return await this.handleExternalServiceError(
      'telnyx-sms',
      async () => {
        const response = await fetch('https://api.telnyx.com/v2/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Correlation-ID': generateCorrelationId()
          },
          body: JSON.stringify({
            from: process.env.TELNYX_FROM_NUMBER,
            to: phoneNumber,
            text: message
          }),
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
          throw this.createSMSError(response.status, await response.text());
        }

        const result = await response.json();
        
        Logger.info('SMS sent successfully', {
          messageId: result.data.id,
          to: this.maskPhoneNumber(phoneNumber),
          provider: 'telnyx'
        });

        return {
          messageId: result.data.id,
          status: 'sent',
          provider: 'telnyx'
        };
      },
      async () => {
        // Fallback SMS service or queue for later
        Logger.warn('Using SMS fallback', { 
          to: this.maskPhoneNumber(phoneNumber),
          reason: 'Primary service unavailable'
        });
        
        await this.queueSMSForRetry(phoneNumber, message);
        return {
          messageId: `fallback_${Date.now()}`,
          status: 'queued',
          provider: 'fallback'
        };
      }
    );
  }

  async processVIN(vin: string): Promise<VehicleInfo> {
    return await this.handleExternalServiceError(
      'vin-decoder',
      async () => {
        const response = await fetch(`https://api.vindecoder.com/v1/decode/${vin}`, {
          headers: {
            'Authorization': `Bearer ${process.env.VIN_DECODER_API_KEY}`,
            'X-Correlation-ID': generateCorrelationId()
          },
          signal: AbortSignal.timeout(15000) // 15 second timeout
        });

        if (!response.ok) {
          throw this.createVINError(response.status, vin);
        }

        const result = await response.json();
        
        return {
          make: result.make,
          model: result.model,
          year: result.year,
          engine: result.engine,
          transmission: result.transmission,
          source: 'external'
        };
      },
      async () => {
        // Fallback to cached data or manual entry
        Logger.warn('Using VIN fallback', { 
          vin: vin.substring(0, 8) + 'XXXXXXXXX',
          reason: 'VIN decoder service unavailable'
        });
        
        const cachedData = await this.getCachedVINData(vin);
        if (cachedData) {
          return { ...cachedData, source: 'cache' };
        }
        
        // Return minimal info requiring manual completion
        return {
          make: 'Unknown',
          model: 'Unknown',
          year: null,
          engine: 'Unknown',
          transmission: 'Unknown',
          source: 'manual_required'
        };
      }
    );
  }

  private createSMSError(status: number, responseText: string): EnterpriseError {
    let severity = ErrorSeverity.HIGH;
    let message = 'SMS delivery failed';
    
    switch (status) {
      case 400:
        severity = ErrorSeverity.MEDIUM;
        message = 'Invalid SMS request format';
        break;
      case 401:
        severity = ErrorSeverity.HIGH;
        message = 'SMS service authentication failed';
        break;
      case 429:
        severity = ErrorSeverity.MEDIUM;
        message = 'SMS rate limit exceeded';
        break;
      case 503:
        severity = ErrorSeverity.HIGH;
        message = 'SMS service temporarily unavailable';
        break;
    }
    
    return new EnterpriseError(
      message,
      severity,
      ErrorCategory.EXTERNAL_SERVICE,
      status,
      {
        additionalData: {
          service: 'telnyx-sms',
          originalResponse: responseText.substring(0, 500)
        },
        retryable: [429, 503, 504].includes(status)
      }
    );
  }

  private createVINError(status: number, vin: string): EnterpriseError {
    let message = 'VIN decoding failed';
    
    switch (status) {
      case 400:
        message = 'Invalid VIN format';
        break;
      case 404:
        message = 'VIN not found in database';
        break;
      case 429:
        message = 'VIN decoder rate limit exceeded';
        break;
    }
    
    return new EnterpriseError(
      message,
      ErrorSeverity.MEDIUM,
      ErrorCategory.EXTERNAL_SERVICE,
      status,
      {
        additionalData: {
          service: 'vin-decoder',
          vin: vin.substring(0, 8) + 'XXXXXXXXX' // Mask sensitive data
        },
        retryable: [429, 503, 504].includes(status)
      }
    );
  }

  private getOrCreateCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(5, 60000));
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  private maskPhoneNumber(phone: string): string {
    return phone.substring(0, 6) + 'XXX';
  }

  private async queueSMSForRetry(phone: string, message: string): Promise<void> {
    // Implementation would queue the SMS in Redis or database
    const queueItem = {
      phone,
      message,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3
    };
    
    await RedisClient.lpush('sms_retry_queue', JSON.stringify(queueItem));
  }

  private async getCachedVINData(vin: string): Promise<VehicleInfo | null> {
    try {
      const cached = await RedisClient.get(`vin_cache:${vin}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      Logger.warn('Failed to retrieve cached VIN data', { vin: vin.substring(0, 8) + 'XXXXXXXXX' });
      return null;
    }
  }
}

interface SMSResult {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  provider: string;
}

interface VehicleInfo {
  make: string;
  model: string;
  year: number | null;
  engine: string;
  transmission: string;
  source: 'external' | 'cache' | 'manual_required';
}
```

---

## 5. Error Aggregation and Analytics

### 5.1 Real-time Error Analytics

```typescript
class ErrorAnalyticsService {
  private errorPatterns = new Map<string, ErrorPattern>();
  private alertThresholds = {
    errorRate: 0.05,        // 5% error rate triggers alert
    errorSpike: 10,         // 10 errors in 1 minute
    criticalErrorCount: 1,  // Any critical error
    circuitBreakerOpen: 3   // 3 open circuit breakers
  };

  analyzeError(error: EnterpriseError): void {
    const pattern = this.getOrCreateErrorPattern(error);
    pattern.recordOccurrence();
    
    // Real-time alert checking
    this.checkAlertConditions(pattern, error);
    
    // Update metrics
    this.updateRealTimeMetrics(error);
    
    // Send to analytics pipeline
    this.sendToAnalyticsPipeline(error);
  }

  private getOrCreateErrorPattern(error: EnterpriseError): ErrorPattern {
    if (!this.errorPatterns.has(error.fingerprint)) {
      this.errorPatterns.set(error.fingerprint, new ErrorPattern(
        error.fingerprint,
        error.category,
        error.severity,
        error.message
      ));
    }
    return this.errorPatterns.get(error.fingerprint)!;
  }

  private checkAlertConditions(pattern: ErrorPattern, error: EnterpriseError): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Check for error spikes
    const recentErrors = pattern.getErrorCountInTimeRange(oneMinuteAgo, now);
    if (recentErrors >= this.alertThresholds.errorSpike) {
      this.triggerAlert({
        type: 'error_spike',
        severity: 'high',
        message: `Error spike detected: ${recentErrors} "${pattern.message}" errors in 1 minute`,
        fingerprint: pattern.fingerprint,
        category: pattern.category,
        metadata: {
          recentErrorCount: recentErrors,
          totalErrors: pattern.getTotalCount(),
          timeWindow: '1 minute'
        }
      });
    }
    
    // Check for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.triggerAlert({
        type: 'critical_error',
        severity: 'critical',
        message: `Critical error: ${error.message}`,
        fingerprint: error.fingerprint,
        category: error.category,
        metadata: {
          correlationId: error.context.correlationId,
          userId: error.context.userId,
          shopId: error.context.shopId
        }
      });
    }
    
    // Check overall error rate
    this.checkOverallErrorRate();
  }

  private async checkOverallErrorRate(): Promise<void> {
    const fiveMinutesAgo = Date.now() - 300000;
    const totalRequests = await MetricsCollector.getCounter('http.requests', fiveMinutesAgo);
    const totalErrors = await MetricsCollector.getCounter('http.errors', fiveMinutesAgo);
    
    if (totalRequests > 100) { // Only check if we have significant traffic
      const errorRate = totalErrors / totalRequests;
      if (errorRate >= this.alertThresholds.errorRate) {
        this.triggerAlert({
          type: 'high_error_rate',
          severity: 'high',
          message: `High error rate detected: ${(errorRate * 100).toFixed(2)}% over 5 minutes`,
          fingerprint: 'system_error_rate',
          category: ErrorCategory.SYSTEM,
          metadata: {
            errorRate: errorRate,
            totalRequests,
            totalErrors,
            timeWindow: '5 minutes'
          }
        });
      }
    }
  }

  private async triggerAlert(alert: ErrorAlert): Promise<void> {
    Logger.error('Error alert triggered', { alert });
    
    // Send to Sentry
    SentryErrorService.captureError(new EnterpriseError(
      alert.message,
      alert.severity === 'critical' ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
      alert.category,
      500,
      { additionalData: alert.metadata }
    ));
    
    // Record alert metrics
    MetricsCollector.incrementCounter('alerts.triggered', {
      type: alert.type,
      severity: alert.severity,
      category: alert.category
    });
    
    // Send to notification channels
    await this.sendToNotificationChannels(alert);
    
    // Store alert for dashboard
    await this.storeAlertInDatabase(alert);
  }

  private async sendToNotificationChannels(alert: ErrorAlert): Promise<void> {
    const notificationPromises: Promise<void>[] = [];
    
    // Slack notifications
    if (process.env.SLACK_WEBHOOK_URL) {
      notificationPromises.push(this.sendSlackNotification(alert));
    }
    
    // PagerDuty for critical alerts
    if (process.env.PAGERDUTY_ROUTING_KEY && alert.severity === 'critical') {
      notificationPromises.push(this.sendPagerDutyAlert(alert));
    }
    
    // Email for high severity alerts
    if (alert.severity === 'high' || alert.severity === 'critical') {
      notificationPromises.push(this.sendEmailAlert(alert));
    }
    
    // Execute all notifications in parallel
    await Promise.allSettled(notificationPromises);
  }

  private async sendSlackNotification(alert: ErrorAlert): Promise<void> {
    try {
      const color = {
        'critical': '#FF0000',
        'high': '#FF8000',
        'medium': '#FFFF00',
        'low': '#00FF00'
      }[alert.severity] || '#808080';

      await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 ${alert.type.toUpperCase()}: ${alert.message}`,
          attachments: [{
            color,
            fields: [
              { title: 'Severity', value: alert.severity, short: true },
              { title: 'Category', value: alert.category, short: true },
              { title: 'Fingerprint', value: alert.fingerprint, short: true },
              { title: 'Time', value: new Date().toISOString(), short: true },
              ...Object.entries(alert.metadata || {}).map(([key, value]) => ({
                title: key,
                value: String(value),
                short: true
              }))
            ]
          }]
        })
      });
    } catch (error) {
      Logger.error('Failed to send Slack notification', { error: error.message });
    }
  }

  private async sendPagerDutyAlert(alert: ErrorAlert): Promise<void> {
    try {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing_key: process.env.PAGERDUTY_ROUTING_KEY,
          event_action: 'trigger',
          dedup_key: alert.fingerprint,
          payload: {
            summary: alert.message,
            severity: alert.severity,
            source: 'courtesy-inspection-api',
            component: alert.category,
            group: 'error-monitoring',
            class: alert.type,
            custom_details: alert.metadata
          }
        })
      });
    } catch (error) {
      Logger.error('Failed to send PagerDuty alert', { error: error.message });
    }
  }

  private updateRealTimeMetrics(error: EnterpriseError): void {
    MetricsCollector.incrementCounter('errors.by_category', {
      category: error.category
    });
    
    MetricsCollector.incrementCounter('errors.by_severity', {
      severity: error.severity
    });
    
    MetricsCollector.recordHistogram('errors.by_hour', 1, {
      hour: new Date().getHours().toString()
    });
    
    if (error.context.userId) {
      MetricsCollector.incrementCounter('errors.by_user', {
        userId: error.context.userId
      });
    }
    
    if (error.context.shopId) {
      MetricsCollector.incrementCounter('errors.by_shop', {
        shopId: error.context.shopId
      });
    }
  }

  private sendToAnalyticsPipeline(error: EnterpriseError): void {
    // Send to analytics pipeline (e.g., BigQuery, Elasticsearch)
    const analyticsEvent = {
      timestamp: error.context.timestamp.toISOString(),
      fingerprint: error.fingerprint,
      category: error.category,
      severity: error.severity,
      message: error.message,
      correlationId: error.context.correlationId,
      userId: error.context.userId,
      shopId: error.context.shopId,
      userAgent: error.context.userAgent,
      ip: error.context.ip,
      retryable: error.context.retryable,
      expectedRecoveryTime: error.context.expectedRecoveryTime,
      stackTrace: error.stack,
      additionalData: error.context.additionalData
    };
    
    // Queue for batch processing to analytics pipeline
    AnalyticsQueue.enqueue(analyticsEvent);
  }
}

class ErrorPattern {
  private occurrences: number[] = [];
  
  constructor(
    public readonly fingerprint: string,
    public readonly category: ErrorCategory,
    public readonly severity: ErrorSeverity,
    public readonly message: string
  ) {}

  recordOccurrence(): void {
    const now = Date.now();
    this.occurrences.push(now);
    
    // Clean up old occurrences (keep last 24 hours)
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    this.occurrences = this.occurrences.filter(time => time >= oneDayAgo);
  }

  getErrorCountInTimeRange(start: number, end: number): number {
    return this.occurrences.filter(time => time >= start && time <= end).length;
  }

  getTotalCount(): number {
    return this.occurrences.length;
  }

  getFrequency(): number {
    if (this.occurrences.length < 2) return 0;
    
    const timeSpan = this.occurrences[this.occurrences.length - 1] - this.occurrences[0];
    return this.occurrences.length / (timeSpan / 1000 / 60); // errors per minute
  }
}

interface ErrorAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  fingerprint: string;
  category: ErrorCategory;
  metadata?: Record<string, any>;
}
```

---

## 6. Implementation Guidelines

### 6.1 Enterprise Error Handling Best Practices

```typescript
// ✅ Enterprise-grade error handling example
async function processInspectionEnterprise(
  inspectionData: InspectionData,
  context: RequestContext
): Promise<ProcessingResult> {
  const correlationId = context.correlationId;
  const startTime = Date.now();
  
  try {
    // Validate with comprehensive error context
    const validator = new EnterpriseInspectionValidator();
    const validationResult = await validator.validate(inspectionData, context);
    
    if (!validationResult.isValid) {
      throw new EnterpriseError(
        'Inspection validation failed',
        ErrorSeverity.MEDIUM,
        ErrorCategory.VALIDATION,
        400,
        {
          correlationId,
          userId: context.userId,
          shopId: context.shopId,
          additionalData: {
            fieldErrors: validationResult.errors,
            validationTime: Date.now() - startTime
          }
        }
      );
    }
    
    // Process with circuit breaker and retry logic
    const processor = new InspectionProcessor();
    const result = await ExponentialBackoffRetry.executeWithRetry(
      () => processor.process(inspectionData, context),
      {
        maxRetries: 3,
        retryableErrors: [ErrorCategory.DATABASE, ErrorCategory.EXTERNAL_SERVICE]
      }
    );
    
    // Record success metrics
    MetricsCollector.recordHistogram('inspection.processing.duration', Date.now() - startTime);
    MetricsCollector.incrementCounter('inspection.processing.success');
    
    return {
      success: true,
      data: result,
      correlationId,
      processingTime: Date.now() - startTime,
      warnings: validationResult.warnings
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Convert to enterprise error if needed
    let enterpriseError: EnterpriseError;
    if (error instanceof EnterpriseError) {
      enterpriseError = error;
    } else {
      enterpriseError = new EnterpriseError(
        'Inspection processing failed',
        ErrorSeverity.HIGH,
        ErrorCategory.SYSTEM,
        500,
        {
          correlationId,
          userId: context.userId,
          shopId: context.shopId,
          additionalData: {
            originalError: error.message,
            processingTime
          }
        }
      );
    }
    
    // Log with structured format
    Logger.error('Inspection processing failed', {
      correlationId,
      error: {
        message: enterpriseError.message,
        category: enterpriseError.category,
        severity: enterpriseError.severity,
        fingerprint: enterpriseError.fingerprint
      },
      inspection: {
        id: inspectionData.id,
        type: inspectionData.type
      },
      user: {
        id: context.userId,
        shopId: context.shopId
      },
      performance: {
        processingTime
      }
    });
    
    // Send to monitoring
    SentryErrorService.captureError(enterpriseError, {
      processingTime,
      inspectionType: inspectionData.type
    });
    
    // Update error metrics
    MetricsCollector.recordHistogram('inspection.processing.duration', processingTime, { status: 'failed' });
    MetricsCollector.incrementCounter('inspection.processing.failure', {
      category: enterpriseError.category,
      severity: enterpriseError.severity
    });
    
    // Analyze for patterns
    ErrorAnalyticsService.getInstance().analyzeError(enterpriseError);
    
    throw enterpriseError;
  }
}

// Request context interface
interface RequestContext {
  correlationId: string;
  userId: string;
  shopId: string;
  userAgent: string;
  ip: string;
  traceId: string;
}
```

### 6.2 Comprehensive Testing Strategy

```typescript
// Advanced error scenario testing
describe('Enterprise Error Handling', () => {
  describe('Circuit Breaker Integration', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const circuitBreaker = new CircuitBreaker(3, 5000);
      const failingOperation = jest.fn().mockRejectedValue(new Error('Service down'));
      
      // Should fail 3 times then open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }
      
      // Circuit should now be open
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Circuit breaker is OPEN');
      expect(failingOperation).toHaveBeenCalledTimes(3); // Should not call again
    });

    it('should transition to half-open after timeout', async () => {
      jest.useFakeTimers();
      
      const circuitBreaker = new CircuitBreaker(2, 1000);
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('Success');
      
      // Trigger circuit breaker
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      
      // Should be open
      expect(circuitBreaker.getState().state).toBe('OPEN');
      
      // Fast forward time
      jest.advanceTimersByTime(1100);
      
      // Should allow one attempt (half-open)
      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('Success');
      expect(circuitBreaker.getState().state).toBe('CLOSED');
      
      jest.useRealTimers();
    });
  });

  describe('Exponential Backoff Retry', () => {
    it('should retry with exponential backoff', async () => {
      jest.useFakeTimers();
      
      const operation = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Temporary failure'))
        .mockRejectedValueOnce(new NetworkError('Still failing'))
        .mockResolvedValueOnce('Success');
      
      const retryPromise = ExponentialBackoffRetry.executeWithRetry(operation, {
        maxRetries: 2,
        baseDelay: 100,
        backoffMultiplier: 2
      });
      
      // First call should fail immediately
      await jest.advanceTimersByTime(0);
      expect(operation).toHaveBeenCalledTimes(1);
      
      // After 100ms, should retry
      await jest.advanceTimersByTime(100);
      expect(operation).toHaveBeenCalledTimes(2);
      
      // After 200ms more (exponential backoff), should retry again
      await jest.advanceTimersByTime(200);
      expect(operation).toHaveBeenCalledTimes(3);
      
      const result = await retryPromise;
      expect(result).toBe('Success');
      
      jest.useRealTimers();
    });
  });

  describe('Error Analytics', () => {
    it('should detect error spikes and trigger alerts', async () => {
      const analytics = new ErrorAnalyticsService();
      const alertSpy = jest.spyOn(analytics as any, 'triggerAlert');
      
      // Simulate error spike
      for (let i = 0; i < 12; i++) {
        const error = new EnterpriseError(
          'Test error',
          ErrorSeverity.HIGH,
          ErrorCategory.NETWORK,
          500
        );
        analytics.analyzeError(error);
      }
      
      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_spike',
          severity: 'high'
        })
      );
    });
  });

  describe('Sentry Integration', () => {
    it('should capture errors with proper context', () => {
      const sentryCaptureSpy = jest.spyOn(Sentry, 'captureException');
      
      const error = new EnterpriseError(
        'Test error',
        ErrorSeverity.HIGH,
        ErrorCategory.VALIDATION,
        400,
        {
          userId: 'user123',
          shopId: 'shop456',
          correlationId: 'corr789'
        }
      );
      
      SentryErrorService.captureError(error);
      
      expect(sentryCaptureSpy).toHaveBeenCalledWith(error);
      // Verify that Sentry scope was configured with proper tags and context
    });
  });
});
```

---

## Conclusion

This Phase 2 enterprise error handling specification provides comprehensive error management with advanced monitoring, automated recovery, and intelligent analytics. The system ensures high availability, rapid error resolution, and proactive issue prevention.

**Phase 2 Implementation Priority:**
1. Sentry integration and advanced monitoring
2. Circuit breakers and retry mechanisms
3. Error analytics and alerting
4. Advanced database error handling
5. External service resilience patterns

**Success Metrics for Phase 2:**
- **MTTR (Mean Time To Recovery)**: < 5 minutes
- **Error Detection Time**: < 1 minute for critical errors
- **Automated Recovery Rate**: > 80% for transient errors
- **System Availability**: 99.9% uptime with graceful degradation
- **Error Rate**: < 0.1% for critical operations

**Key Enterprise Features:**
- Real-time error monitoring with Sentry
- Circuit breakers prevent cascading failures
- Exponential backoff retry with jitter
- Advanced error analytics and pattern detection
- Automated alerting to Slack, PagerDuty, email
- Comprehensive correlation tracking
- Graceful degradation for external services

---

**Document Version**: 2.0 Enterprise  
**Last Updated**: December 2024  
**Next Review**: Quarterly basis