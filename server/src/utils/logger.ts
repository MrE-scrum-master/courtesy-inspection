// Logger utility with structured logging and correlation IDs
// Production-ready logging with different levels and contexts

import { LogContext } from '../types/common';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class Logger {
  private static currentLevel: LogLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;

  // Set log level
  static setLevel(level: LogLevel): void {
    Logger.currentLevel = level;
  }

  // Log error with context
  static error(message: string, error?: Error | any, context?: Partial<LogContext>): void {
    if (Logger.currentLevel >= LogLevel.ERROR) {
      const logEntry = {
        level: 'ERROR',
        message,
        timestamp: new Date().toISOString(),
        ...context
      };

      if (error) {
        logEntry.error = {
          name: error.name || 'Error',
          message: error.message || 'Unknown error',
          stack: error.stack || null
        };
      }

      console.error(JSON.stringify(logEntry));
    }
  }

  // Log warning with context
  static warn(message: string, data?: any, context?: Partial<LogContext>): void {
    if (Logger.currentLevel >= LogLevel.WARN) {
      const logEntry = {
        level: 'WARN',
        message,
        timestamp: new Date().toISOString(),
        data,
        ...context
      };

      console.warn(JSON.stringify(logEntry));
    }
  }

  // Log info with context
  static info(message: string, data?: any, context?: Partial<LogContext>): void {
    if (Logger.currentLevel >= LogLevel.INFO) {
      const logEntry = {
        level: 'INFO',
        message,
        timestamp: new Date().toISOString(),
        data,
        ...context
      };

      console.log(JSON.stringify(logEntry));
    }
  }

  // Log debug information
  static debug(message: string, data?: any, context?: Partial<LogContext>): void {
    if (Logger.currentLevel >= LogLevel.DEBUG) {
      const logEntry = {
        level: 'DEBUG',
        message,
        timestamp: new Date().toISOString(),
        data,
        ...context
      };

      console.log(JSON.stringify(logEntry));
    }
  }

  // Log HTTP request
  static request(method: string, url: string, context: Partial<LogContext>): void {
    Logger.info('HTTP Request', {
      method,
      url,
      userAgent: context.metadata?.userAgent,
      ip: context.metadata?.ip
    }, context);
  }

  // Log HTTP response
  static response(method: string, url: string, statusCode: number, duration: number, context: Partial<LogContext>): void {
    const logLevel = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    
    if (Logger.currentLevel >= logLevel) {
      const message = statusCode >= 400 ? 'HTTP Error Response' : 'HTTP Response';
      
      const logData = {
        method,
        url,
        statusCode,
        duration: `${duration}ms`
      };

      if (statusCode >= 400) {
        Logger.error(message, null, { ...context, metadata: { ...context.metadata, ...logData } });
      } else {
        Logger.info(message, logData, context);
      }
    }
  }

  // Log database operation
  static database(operation: string, table: string, duration: number, context?: Partial<LogContext>): void {
    Logger.debug('Database Operation', {
      operation,
      table,
      duration: `${duration}ms`
    }, context);
  }

  // Log authentication events
  static auth(event: 'login' | 'logout' | 'register' | 'token_refresh', userId?: string, context?: Partial<LogContext>): void {
    Logger.info('Authentication Event', {
      event,
      userId
    }, context);
  }

  // Log business events
  static business(event: string, data?: any, context?: Partial<LogContext>): void {
    Logger.info('Business Event', {
      event,
      ...data
    }, context);
  }

  // Log security events
  static security(event: string, severity: 'low' | 'medium' | 'high', data?: any, context?: Partial<LogContext>): void {
    const message = `Security Event: ${event}`;
    
    if (severity === 'high') {
      Logger.error(message, null, { ...context, metadata: { ...context.metadata, severity, ...data } });
    } else {
      Logger.warn(message, { severity, ...data }, context);
    }
  }

  // Log performance metrics
  static performance(metric: string, value: number, unit: string, context?: Partial<LogContext>): void {
    Logger.info('Performance Metric', {
      metric,
      value,
      unit
    }, context);
  }

  // Create logger context from request
  static createContext(correlationId: string, userId?: string, shopId?: string, action?: string): LogContext {
    return {
      correlationId,
      userId,
      shopId,
      action: action || 'unknown',
      metadata: {}
    };
  }

  // Child logger with fixed context
  static child(baseContext: Partial<LogContext>) {
    return {
      error: (message: string, error?: Error | any, context?: Partial<LogContext>) => 
        Logger.error(message, error, { ...baseContext, ...context }),
      
      warn: (message: string, data?: any, context?: Partial<LogContext>) => 
        Logger.warn(message, data, { ...baseContext, ...context }),
      
      info: (message: string, data?: any, context?: Partial<LogContext>) => 
        Logger.info(message, data, { ...baseContext, ...context }),
      
      debug: (message: string, data?: any, context?: Partial<LogContext>) => 
        Logger.debug(message, data, { ...baseContext, ...context })
    };
  }

  // Format error for logging
  static formatError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    
    if (typeof error === 'object' && error !== null) {
      return error;
    }
    
    return { message: String(error) };
  }

  // Sanitize sensitive data for logging
  static sanitize(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    const sanitized = { ...data };

    const sanitizeRecursive = (obj: any, path: string = ''): any => {
      if (Array.isArray(obj)) {
        return obj.map((item, index) => sanitizeRecursive(item, `${path}[${index}]`));
      }

      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitizeRecursive(value, currentPath);
          }
        }
        return result;
      }

      return obj;
    };

    return sanitizeRecursive(sanitized);
  }

  // Log application startup
  static startup(version?: string, environment?: string): void {
    Logger.info('Application Starting', {
      version: version || 'unknown',
      environment: environment || process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      pid: process.pid,
      timestamp: new Date().toISOString()
    });
  }

  // Log application shutdown
  static shutdown(reason?: string): void {
    Logger.info('Application Shutting Down', {
      reason: reason || 'unknown',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
}