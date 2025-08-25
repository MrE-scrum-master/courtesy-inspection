// Validation Middleware - Joi schema validation for request/response
// Centralized input validation with detailed error reporting

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { HttpStatus } from '../types/common';
import { validateSchema } from '../validators/schemas';

export class ValidationMiddleware {
  
  // Validate request body
  static validateBody(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const validation = validateSchema(schema, req.body);
      
      if (!validation.isValid) {
        return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Replace request body with validated/sanitized data
      req.body = validation.data;
      next();
    };
  }

  // Validate query parameters
  static validateQuery(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const validation = validateSchema(schema, req.query);
      
      if (!validation.isValid) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Invalid query parameters',
          details: validation.errors
        });
      }

      // Replace query with validated/sanitized data
      req.query = validation.data;
      next();
    };
  }

  // Validate URL parameters
  static validateParams(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const validation = validateSchema(schema, req.params);
      
      if (!validation.isValid) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Invalid URL parameters',
          details: validation.errors
        });
      }

      // Replace params with validated/sanitized data
      req.params = validation.data;
      next();
    };
  }

  // Validate all three (body, query, params)
  static validate(schemas: {
    body?: Joi.ObjectSchema;
    query?: Joi.ObjectSchema;
    params?: Joi.ObjectSchema;
  }) {
    return (req: Request, res: Response, next: NextFunction) => {
      const errors: Record<string, Record<string, string[]>> = {};
      let hasErrors = false;

      // Validate body
      if (schemas.body) {
        const bodyValidation = validateSchema(schemas.body, req.body);
        if (!bodyValidation.isValid) {
          errors.body = bodyValidation.errors;
          hasErrors = true;
        } else {
          req.body = bodyValidation.data;
        }
      }

      // Validate query
      if (schemas.query) {
        const queryValidation = validateSchema(schemas.query, req.query);
        if (!queryValidation.isValid) {
          errors.query = queryValidation.errors;
          hasErrors = true;
        } else {
          req.query = queryValidation.data;
        }
      }

      // Validate params
      if (schemas.params) {
        const paramsValidation = validateSchema(schemas.params, req.params);
        if (!paramsValidation.isValid) {
          errors.params = paramsValidation.errors;
          hasErrors = true;
        } else {
          req.params = paramsValidation.data;
        }
      }

      if (hasErrors) {
        return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          success: false,
          error: 'Validation failed',
          details: errors
        });
      }

      next();
    };
  }

  // Content-Type validation
  static requireContentType(contentType: string = 'application/json') {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestContentType = req.headers['content-type'];
      
      if (!requestContentType || !requestContentType.includes(contentType)) {
        return res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
          success: false,
          error: `Content-Type must be ${contentType}`,
          details: {
            required: contentType,
            received: requestContentType || 'none'
          }
        });
      }

      next();
    };
  }

  // File upload validation
  static validateFileUpload(options: {
    maxSize?: number; // in bytes
    allowedMimeTypes?: string[];
    maxFiles?: number;
    required?: boolean;
  } = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'],
      maxFiles = 5,
      required = false
    } = options;

    return (req: Request, res: Response, next: NextFunction) => {
      const files = req.files as Express.Multer.File[] | undefined;

      // Check if files are required
      if (required && (!files || files.length === 0)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'File upload required'
        });
      }

      // Skip validation if no files and not required
      if (!files || files.length === 0) {
        return next();
      }

      // Check file count
      if (files.length > maxFiles) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: `Too many files (max: ${maxFiles})`,
          details: {
            maxFiles,
            received: files.length
          }
        });
      }

      // Validate each file
      for (const file of files) {
        // Check file size
        if (file.size > maxSize) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            error: 'File too large',
            details: {
              maxSize: `${Math.round(maxSize / 1024 / 1024)}MB`,
              file: file.originalname,
              size: `${Math.round(file.size / 1024 / 1024)}MB`
            }
          });
        }

        // Check MIME type
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            error: 'Invalid file type',
            details: {
              allowedTypes: allowedMimeTypes,
              received: file.mimetype,
              file: file.originalname
            }
          });
        }
      }

      next();
    };
  }

  // Request size validation
  static validateRequestSize(maxSize: number = 1024 * 1024) { // 1MB default
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = parseInt(req.headers['content-length'] || '0');

      if (contentLength > maxSize) {
        return res.status(HttpStatus.REQUEST_ENTITY_TOO_LARGE).json({
          success: false,
          error: 'Request too large',
          details: {
            maxSize: `${Math.round(maxSize / 1024)}KB`,
            received: `${Math.round(contentLength / 1024)}KB`
          }
        });
      }

      next();
    };
  }

  // Sanitization middleware
  static sanitizeInput() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Recursively sanitize all string values
      const sanitize = (obj: any): any => {
        if (typeof obj === 'string') {
          // Basic XSS prevention - remove script tags and javascript: urls
          return obj
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .trim();
        }
        
        if (Array.isArray(obj)) {
          return obj.map(sanitize);
        }
        
        if (obj && typeof obj === 'object') {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitize(value);
          }
          return sanitized;
        }
        
        return obj;
      };

      req.body = sanitize(req.body);
      req.query = sanitize(req.query);
      next();
    };
  }

  // UUID parameter validation helper
  static validateUUID(paramName: string = 'id') {
    const uuidSchema = Joi.object({
      [paramName]: Joi.string().uuid({ version: 'uuidv4' }).required()
    });

    return ValidationMiddleware.validateParams(uuidSchema);
  }

  // Pagination validation helper
  static validatePagination() {
    const paginationSchema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC').optional()
    });

    return ValidationMiddleware.validateQuery(paginationSchema);
  }

  // Custom validation function
  static custom(validatorFunction: (req: Request) => { isValid: boolean; errors?: any; data?: any }) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = validatorFunction(req);
        
        if (!result.isValid) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            error: 'Custom validation failed',
            details: result.errors || {}
          });
        }

        // Apply validated data if provided
        if (result.data) {
          Object.assign(req, result.data);
        }

        next();
      } catch (error) {
        console.error('Custom validation error:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Validation error'
        });
      }
    };
  }
}

// Additional HTTP status codes
declare module '../types/common' {
  namespace HttpStatus {
    const UNSUPPORTED_MEDIA_TYPE = 415;
    const REQUEST_ENTITY_TOO_LARGE = 413;
  }
}