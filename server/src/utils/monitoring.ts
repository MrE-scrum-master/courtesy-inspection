/**
 * Monitoring and Observability Utils
 * Structured logging, metrics, and health monitoring for production readiness
 */

import { Request, Response } from 'express';

// Types for monitoring
interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

interface LogContext {
  correlationId?: string;
  userId?: string;
  shopId?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, any>;
  responseTime?: number;
}

// Structured logger
export class Logger {
  private static instance: Logger;
  private context: Record<string, any> = {};

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private log(level: string, message: string, extra: LogContext = {}): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...extra,
      environment: process.env.NODE_ENV || 'development',
      service: 'courtesy-inspection-api',
      version: process.env.APP_VERSION || '1.0.0'
    };

    // In production, this would integrate with a logging service (Winston, Bunyan, etc.)
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      const colorMap = {
        error: '\x1b[31m',   // Red
        warn: '\x1b[33m',    // Yellow
        info: '\x1b[36m',    // Cyan
        debug: '\x1b[90m',   // Gray
        reset: '\x1b[0m'
      };
      
      const color = colorMap[level as keyof typeof colorMap] || colorMap.info;
      console.log(`${color}[${level.toUpperCase()}]${colorMap.reset} ${message}`, extra);
    }
  }

  error(message: string, context: LogContext = {}): void {
    this.log('error', message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.log('warn', message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.log('info', message, context);
  }

  debug(message: string, context: LogContext = {}): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      this.log('debug', message, context);
    }
  }

  // Security event logging
  security(event: string, context: LogContext = {}): void {
    this.log('security', `SECURITY EVENT: ${event}`, {
      ...context,
      security: true,
      alert: true
    });
  }

  // Performance logging
  performance(operation: string, duration: number, context: LogContext = {}): void {
    this.log('performance', `PERFORMANCE: ${operation}`, {
      ...context,
      duration,
      performance: true
    });
  }

  // Business event logging
  business(event: string, context: LogContext = {}): void {
    this.log('business', `BUSINESS EVENT: ${event}`, {
      ...context,
      business: true
    });
  }
}

// Metrics collector
export class Metrics {
  private static instance: Metrics;
  private metrics: Map<string, MetricData[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  // Counter metrics (incrementing values)
  increment(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    this.recordMetric(name, current + value, tags);
  }

  // Gauge metrics (current value)
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);
    
    this.recordMetric(name, value, tags);
  }

  // Histogram metrics (value distribution)
  histogram(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    
    this.recordMetric(name, value, tags);
  }

  // Timer utility
  timer(name: string, tags: Record<string, string> = {}): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.histogram(`${name}_duration_ms`, duration, tags);
    };
  }

  // Get all metrics
  getAllMetrics(): Record<string, any> {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: this.getHistogramStats()
    };
  }

  // Get histogram statistics
  private getHistogramStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [key, values] of this.histograms) {
      if (values.length === 0) continue;
      
      const sorted = values.sort((a, b) => a - b);
      stats[key] = {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        p50: this.percentile(sorted, 0.5),
        p95: this.percentile(sorted, 0.95),
        p99: this.percentile(sorted, 0.99)
      };
    }
    
    return stats;
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private getMetricKey(name: string, tags: Record<string, string>): string {
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return tagString ? `${name}|${tagString}` : name;
  }

  private recordMetric(name: string, value: number, tags: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const metrics = this.metrics.get(key) || [];
    metrics.push({
      name,
      value,
      tags,
      timestamp: new Date()
    });
    
    // Keep only last 1000 entries per metric
    if (metrics.length > 1000) {
      metrics.shift();
    }
    
    this.metrics.set(key, metrics);
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// Health monitoring
export class HealthMonitor {
  private static instance: HealthMonitor;
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  // Register health check
  register(name: string, check: () => Promise<HealthCheck>): void {
    this.checks.set(name, check);
  }

  // Run all health checks
  async checkHealth(): Promise<{ status: string; checks: Record<string, HealthCheck> }> {
    const results: Record<string, HealthCheck> = {};
    let overallStatus = 'healthy';

    for (const [name, check] of this.checks) {
      try {
        const start = Date.now();
        const result = await Promise.race([
          check(),
          new Promise<HealthCheck>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        
        result.responseTime = Date.now() - start;
        results[name] = result;

        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results[name] = {
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - Date.now()
        };
        overallStatus = 'unhealthy';
      }
    }

    return { status: overallStatus, checks: results };
  }

  // Get specific health check
  async checkOne(name: string): Promise<HealthCheck | null> {
    const check = this.checks.get(name);
    if (!check) return null;

    try {
      const start = Date.now();
      const result = await check();
      result.responseTime = Date.now() - start;
      return result;
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private logger = Logger.getInstance();
  private metrics = Metrics.getInstance();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Express middleware for request monitoring
  requestMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      const start = Date.now();
      const correlationId = req.headers['x-correlation-id'] as string || 
                          req.headers['x-request-id'] as string ||
                          `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Set correlation ID for tracing
      req.correlationId = correlationId;
      res.setHeader('X-Correlation-ID', correlationId);

      // Log request start
      this.logger.info('Request started', {
        correlationId,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress
      });

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = function(chunk: any, encoding?: any) {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;

        // Record metrics
        const instance = PerformanceMonitor.getInstance();
        instance.metrics.increment('http_requests_total', 1, {
          method: req.method,
          status: statusCode.toString(),
          endpoint: req.route?.path || req.url
        });

        instance.metrics.histogram('http_request_duration_ms', duration, {
          method: req.method,
          status: statusCode.toString()
        });

        // Log request completion
        const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        instance.logger[logLevel]('Request completed', {
          correlationId,
          method: req.method,
          url: req.url,
          statusCode,
          duration,
          performance: true
        });

        // Alert on slow requests
        if (duration > 1000) {
          instance.logger.warn('Slow request detected', {
            correlationId,
            method: req.method,
            url: req.url,
            duration,
            alert: true
          });
        }

        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  // Database operation monitoring
  monitorDatabase<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const timer = this.metrics.timer('database_operation_duration_ms', { operation });
    const start = Date.now();

    return fn()
      .then(result => {
        timer();
        this.metrics.increment('database_operations_total', 1, { 
          operation, 
          status: 'success' 
        });
        
        const duration = Date.now() - start;
        if (duration > 100) {
          this.logger.warn('Slow database operation', {
            operation,
            duration,
            performance: true
          });
        }
        
        return result;
      })
      .catch(error => {
        timer();
        this.metrics.increment('database_operations_total', 1, { 
          operation, 
          status: 'error' 
        });
        
        this.logger.error('Database operation failed', {
          operation,
          error: error.message,
          duration: Date.now() - start
        });
        
        throw error;
      });
  }

  // Memory usage monitoring
  monitorMemory(): void {
    const usage = process.memoryUsage();
    
    this.metrics.gauge('memory_heap_used_bytes', usage.heapUsed);
    this.metrics.gauge('memory_heap_total_bytes', usage.heapTotal);
    this.metrics.gauge('memory_external_bytes', usage.external);
    this.metrics.gauge('memory_rss_bytes', usage.rss);

    // Alert on high memory usage
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    if (usagePercent > 85) {
      this.logger.warn('High memory usage detected', {
        heapUsedMB: Math.round(heapUsedMB),
        heapTotalMB: Math.round(heapTotalMB),
        usagePercent: Math.round(usagePercent),
        alert: true
      });
    }
  }

  // Start periodic monitoring
  startPeriodicMonitoring(intervalMs: number = 30000): void {
    setInterval(() => {
      this.monitorMemory();
      
      // Monitor event loop lag
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        this.metrics.gauge('event_loop_lag_ms', lag);
        
        if (lag > 100) {
          this.logger.warn('Event loop lag detected', {
            lag,
            performance: true,
            alert: true
          });
        }
      });
    }, intervalMs);
  }
}

// Circuit breaker for external service calls
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private logger = Logger.getInstance();
  private metrics = Metrics.getInstance();

  constructor(
    private name: string,
    private failureThreshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private retryTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.retryTimeout) {
        this.state = 'half-open';
        this.logger.info('Circuit breaker half-open', { service: this.name });
      } else {
        this.metrics.increment('circuit_breaker_rejected', 1, { service: this.name });
        throw new Error(`Circuit breaker open for ${this.name}`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), this.timeout)
        )
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.logger.info('Circuit breaker closed', { service: this.name });
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.logger.error('Circuit breaker opened', { 
        service: this.name, 
        failures: this.failures 
      });
      this.metrics.increment('circuit_breaker_opened', 1, { service: this.name });
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Export singleton instances
export const logger = Logger.getInstance();
export const metrics = Metrics.getInstance();
export const healthMonitor = HealthMonitor.getInstance();
export const performanceMonitor = PerformanceMonitor.getInstance();

// Utility function to create correlation ID
export function generateCorrelationId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Express error handler with monitoring
export function errorHandler(error: Error, req: Request, res: Response, next: Function): void {
  const correlationId = req.correlationId || generateCorrelationId();
  
  logger.error('Unhandled error', {
    correlationId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    shopId: req.user?.shop_id
  });

  metrics.increment('errors_total', 1, {
    type: error.constructor.name,
    endpoint: req.route?.path || req.url
  });

  if (res.headersSent) {
    return next(error);
  }

  const statusCode = (error as any).statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    correlationId
  });
}