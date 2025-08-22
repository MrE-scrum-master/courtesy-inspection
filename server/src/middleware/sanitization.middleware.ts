// Input Sanitization Middleware - Comprehensive data cleaning and validation
// Sanitizes HTML, normalizes Unicode, validates against schemas, and prevents injection attacks

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { DatabaseService, HttpStatus } from '../types/common';

export interface SanitizationConfig {
  enableHTMLSanitization: boolean;
  enableUnicodeNormalization: boolean;
  enableTrimming: boolean;
  maxStringLength: number;
  allowedTags: string[];
  allowedAttributes: string[];
  logSanitization: boolean;
}

export interface SanitizationRule {
  field: string;
  type: 'string' | 'email' | 'phone' | 'url' | 'html' | 'json' | 'number' | 'boolean';
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  allowedValues?: string[];
  sanitize?: boolean;
  escape?: boolean;
}

export interface SanitizationResult {
  sanitized: any;
  violations: Array<{
    field: string;
    violation: string;
    original: any;
    sanitized: any;
  }>;
}

export class SanitizationMiddleware {
  private db: DatabaseService;
  private config: SanitizationConfig;
  private dangerousPatterns: RegExp[];

  constructor(db: DatabaseService, config?: Partial<SanitizationConfig>) {
    this.db = db;
    this.config = {
      enableHTMLSanitization: true,
      enableUnicodeNormalization: true,
      enableTrimming: true,
      maxStringLength: 10000,
      allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
      allowedAttributes: ['class'],
      logSanitization: process.env.LOG_SANITIZATION === 'true',
      ...config
    };

    this.dangerousPatterns = [
      // Script injection
      /<script[^>]*>.*?<\/script>/gi,
      /javascript\s*:/gi,
      /data\s*:\s*text\s*\/\s*html/gi,
      
      // Event handlers
      /on\w+\s*=/gi,
      
      // Meta refresh
      /<meta[^>]*http-equiv[^>]*refresh/gi,
      
      // Iframe injection
      /<iframe[^>]*>.*?<\/iframe>/gi,
      
      // Object/embed injection
      /<(object|embed|applet)[^>]*>/gi,
      
      // SQL injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\b)/gi,
      /(OR\s+1\s*=\s*1|AND\s+1\s*=\s*1)/gi,
      
      // NoSQL injection patterns
      /\$where|\$regex|\$ne|\$gt|\$lt/gi,
      
      // Command injection
      /[;&|`]|\$\(|\$\{/g,
      
      // Path traversal
      /\.\.\/|\.\.\\|\.\.\\/gi
    ];
  }

  // General sanitization middleware
  sanitizeRequest(rules?: SanitizationRule[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const startTime = Date.now();

        // Sanitize body
        if (req.body && typeof req.body === 'object') {
          const bodyResult = await this.sanitizeObject(req.body, rules);
          req.body = bodyResult.sanitized;
          
          if (bodyResult.violations.length > 0) {
            await this.logSanitizationViolations('body', bodyResult.violations, req);
          }
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          const queryResult = await this.sanitizeObject(req.query, rules);
          req.query = queryResult.sanitized;
          
          if (queryResult.violations.length > 0) {
            await this.logSanitizationViolations('query', queryResult.violations, req);
          }
        }

        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
          const paramsResult = await this.sanitizeObject(req.params, rules);
          req.params = paramsResult.sanitized;
          
          if (paramsResult.violations.length > 0) {
            await this.logSanitizationViolations('params', paramsResult.violations, req);
          }
        }

        const processingTime = Date.now() - startTime;
        
        if (this.config.logSanitization && processingTime > 100) {
          console.warn(`Sanitization took ${processingTime}ms for ${req.method} ${req.path}`);
        }

        next();
      } catch (error) {
        console.error('Sanitization error:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Request processing failed'
        });
      }
    };
  }

  // Specific field sanitization
  sanitizeFields(fieldRules: Record<string, SanitizationRule>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const violations: Array<{ field: string; violation: string; original: any; sanitized: any }> = [];

        for (const [fieldPath, rule] of Object.entries(fieldRules)) {
          const value = this.getNestedValue(req.body, fieldPath);
          
          if (value !== undefined) {
            const sanitized = await this.sanitizeValue(value, rule);
            
            if (sanitized !== value) {
              violations.push({
                field: fieldPath,
                violation: 'sanitized',
                original: value,
                sanitized
              });
            }
            
            this.setNestedValue(req.body, fieldPath, sanitized);
          } else if (rule.required) {
            return res.status(HttpStatus.BAD_REQUEST).json({
              success: false,
              error: 'Validation failed',
              details: {
                field: fieldPath,
                message: 'Required field missing'
              }
            });
          }
        }

        if (violations.length > 0) {
          await this.logSanitizationViolations('fields', violations, req);
        }

        next();
      } catch (error) {
        console.error('Field sanitization error:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Field validation failed'
        });
      }
    };
  }

  // HTML content sanitization
  sanitizeHTML() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.body) {
          this.sanitizeHTMLInObject(req.body);
        }
        next();
      } catch (error) {
        console.error('HTML sanitization error:', error);
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Invalid HTML content detected'
        });
      }
    };
  }

  // File upload sanitization
  sanitizeFileUpload() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.files) {
          const files = Array.isArray(req.files) ? req.files : [req.files];
          
          for (const file of files) {
            if (this.isFileSecure(file)) {
              continue;
            }
            
            return res.status(HttpStatus.BAD_REQUEST).json({
              success: false,
              error: 'Unsafe file detected',
              details: {
                filename: file.originalname,
                mimetype: file.mimetype
              }
            });
          }
        }
        next();
      } catch (error) {
        console.error('File sanitization error:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'File validation failed'
        });
      }
    };
  }

  // Dangerous pattern detection
  detectDangerousPatterns() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dangerousContent = this.scanForDangerousPatterns(req.body) ||
                               this.scanForDangerousPatterns(req.query) ||
                               this.scanForDangerousPatterns(req.params);

        if (dangerousContent) {
          await this.logSecurityThreat('DANGEROUS_PATTERN_DETECTED', {
            pattern: dangerousContent.pattern,
            field: dangerousContent.field,
            value: dangerousContent.value,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id
          });

          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            error: 'Potentially dangerous content detected'
          });
        }

        next();
      } catch (error) {
        console.error('Pattern detection error:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Security scan failed'
        });
      }
    };
  }

  // Private methods
  private async sanitizeObject(obj: any, rules?: SanitizationRule[]): Promise<SanitizationResult> {
    const violations: Array<{ field: string; violation: string; original: any; sanitized: any }> = [];
    const sanitized = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        sanitized[key] = value;
        continue;
      }

      const rule = rules?.find(r => r.field === key);
      
      if (typeof value === 'object') {
        const result = await this.sanitizeObject(value, rules);
        sanitized[key] = result.sanitized;
        violations.push(...result.violations.map(v => ({ ...v, field: `${key}.${v.field}` })));
      } else {
        const sanitizedValue = await this.sanitizeValue(value, rule);
        
        if (sanitizedValue !== value) {
          violations.push({
            field: key,
            violation: 'sanitized',
            original: value,
            sanitized: sanitizedValue
          });
        }
        
        sanitized[key] = sanitizedValue;
      }
    }

    return { sanitized, violations };
  }

  private async sanitizeValue(value: any, rule?: SanitizationRule): Promise<any> {
    if (value === null || value === undefined) {
      return value;
    }

    let sanitized = value;

    // Type-specific sanitization
    if (typeof value === 'string') {
      // Trim whitespace
      if (this.config.enableTrimming) {
        sanitized = sanitized.trim();
      }

      // Unicode normalization
      if (this.config.enableUnicodeNormalization) {
        sanitized = sanitized.normalize('NFC');
      }

      // Length limits
      if (rule?.maxLength && sanitized.length > rule.maxLength) {
        sanitized = sanitized.substring(0, rule.maxLength);
      }

      if (sanitized.length > this.config.maxStringLength) {
        sanitized = sanitized.substring(0, this.config.maxStringLength);
      }

      // Pattern validation
      if (rule?.pattern && !rule.pattern.test(sanitized)) {
        throw new Error(`Value does not match required pattern`);
      }

      // Allowed values check
      if (rule?.allowedValues && !rule.allowedValues.includes(sanitized)) {
        throw new Error(`Value not in allowed list`);
      }

      // Type-specific sanitization
      if (rule?.type) {
        sanitized = this.sanitizeByType(sanitized, rule.type);
      }

      // HTML sanitization
      if (this.config.enableHTMLSanitization && (rule?.type === 'html' || rule?.sanitize !== false)) {
        sanitized = this.sanitizeHTMLString(sanitized);
      }

      // Escape if required
      if (rule?.escape) {
        sanitized = validator.escape(sanitized);
      }
    }

    return sanitized;
  }

  private sanitizeByType(value: string, type: string): string {
    switch (type) {
      case 'email':
        return validator.isEmail(value) ? validator.normalizeEmail(value) || value : value;
      
      case 'phone':
        // Remove all non-digit characters except +
        return value.replace(/[^\d+]/g, '');
      
      case 'url':
        try {
          const url = new URL(value);
          return url.toString();
        } catch {
          return value;
        }
      
      case 'json':
        try {
          JSON.parse(value);
          return value;
        } catch {
          throw new Error('Invalid JSON format');
        }
      
      case 'number':
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error('Invalid number format');
        }
        return num.toString();
      
      case 'boolean':
        const lowerValue = value.toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(lowerValue)) {
          return 'true';
        } else if (['false', '0', 'no', 'off'].includes(lowerValue)) {
          return 'false';
        }
        throw new Error('Invalid boolean format');
      
      default:
        return value;
    }
  }

  private sanitizeHTMLString(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: this.config.allowedTags,
      ALLOWED_ATTR: this.config.allowedAttributes,
      FORBID_SCRIPT: true,
      FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
    });
  }

  private sanitizeHTMLInObject(obj: any): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        obj[key] = this.sanitizeHTMLString(value);
      } else if (typeof value === 'object' && value !== null) {
        this.sanitizeHTMLInObject(value);
      }
    }
  }

  private scanForDangerousPatterns(obj: any, path = ''): { pattern: string; field: string; value: any } | null {
    if (typeof obj === 'string') {
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(obj)) {
          return {
            pattern: pattern.toString(),
            field: path || 'unknown',
            value: obj.substring(0, 100) // Truncate for logging
          };
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        const result = this.scanForDangerousPatterns(value, currentPath);
        if (result) return result;
      }
    }
    
    return null;
  }

  private isFileSecure(file: any): boolean {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv'
    ];

    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.scr', '.pif', '.com',
      '.js', '.vbs', '.ps1', '.php', '.asp', '.jsp'
    ];

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return false;
    }

    // Check file extension
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (dangerousExtensions.includes(`.${extension}`)) {
      return false;
    }

    // Check for embedded scripts in filename
    if (this.scanForDangerousPatterns(file.originalname)) {
      return false;
    }

    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private async logSanitizationViolations(
    section: string,
    violations: Array<{ field: string; violation: string; original: any; sanitized: any }>,
    req: Request
  ): Promise<void> {
    if (!this.config.logSanitization) return;

    try {
      await this.db.query(
        `INSERT INTO audit_logs (action, resource, request_data, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [
          'SANITIZATION_VIOLATION',
          `REQUEST_${section.toUpperCase()}`,
          JSON.stringify({
            violations,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            userId: req.user?.id
          })
        ]
      );
    } catch (error) {
      console.error('Failed to log sanitization violations:', error);
    }
  }

  private async logSecurityThreat(threat: string, details: any): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_logs (action, resource, request_data, created_at)
         VALUES ($1, $2, $3, NOW())`,
        ['SECURITY_THREAT', threat, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Failed to log security threat:', error);
    }
  }
}