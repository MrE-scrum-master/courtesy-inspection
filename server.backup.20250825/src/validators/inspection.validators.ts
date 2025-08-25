// Comprehensive Validation Layer for Inspection Operations
// Implements business rules validation, data integrity checks, and security validation
// Supports all CRUD operations with detailed error reporting

import { Request } from 'express';
import * as Joi from 'joi';

// Validation schemas
const workflowStateSchema = Joi.string().valid(
  'draft', 'in_progress', 'pending_review', 'approved', 'rejected', 'sent_to_customer', 'completed'
);

const urgencyLevelSchema = Joi.string().valid('low', 'normal', 'high', 'critical');

const conditionSchema = Joi.string().valid('good', 'fair', 'poor', 'needs_immediate');

const measurementSchema = Joi.object({
  value: Joi.number().required(),
  unit: Joi.string().required(),
  raw: Joi.string().optional()
});

const customerConcernsSchema = Joi.array().items(
  Joi.object({
    category: Joi.string().required(),
    description: Joi.string().required(),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium')
  })
);

// Create inspection validation
export const validateCreateInspection = Joi.object({
  vehicleId: Joi.string().uuid().required()
    .messages({
      'string.uuid': 'Vehicle ID must be a valid UUID',
      'any.required': 'Vehicle ID is required'
    }),
    
  assignedTo: Joi.string().uuid().optional()
    .messages({
      'string.uuid': 'Assigned user ID must be a valid UUID'
    }),
    
  customerConcerns: customerConcernsSchema.optional().default([]),
  
  odometerReading: Joi.number().integer().min(0).max(999999).optional()
    .messages({
      'number.min': 'Odometer reading cannot be negative',
      'number.max': 'Odometer reading seems unrealistic (max 999,999)'
    }),
    
  internalNotes: Joi.string().max(2000).optional()
    .messages({
      'string.max': 'Internal notes cannot exceed 2000 characters'
    }),
    
  initializeWithDefaults: Joi.boolean().optional().default(false)
});

// Update inspection validation
export const validateUpdateInspection = Joi.object({
  workflowState: workflowStateSchema.optional(),
  
  assignedTo: Joi.string().uuid().allow(null).optional()
    .messages({
      'string.uuid': 'Assigned user ID must be a valid UUID'
    }),
    
  customerConcerns: customerConcernsSchema.optional(),
  
  odometerReading: Joi.number().integer().min(0).max(999999).optional()
    .messages({
      'number.min': 'Odometer reading cannot be negative',
      'number.max': 'Odometer reading seems unrealistic (max 999,999)'
    }),
    
  internalNotes: Joi.string().max(2000).allow('').optional()
    .messages({
      'string.max': 'Internal notes cannot exceed 2000 characters'
    }),
    
  completedAt: Joi.date().iso().optional(),
  
  urgencyLevel: urgencyLevelSchema.optional(),
  
  estimatedCost: Joi.number().min(0).max(50000).optional()
    .messages({
      'number.min': 'Estimated cost cannot be negative',
      'number.max': 'Estimated cost seems unrealistic (max $50,000)'
    }),
    
  nextServiceDate: Joi.date().iso().min('now').optional()
    .messages({
      'date.min': 'Next service date cannot be in the past'
    }),
    
  warrantyInfo: Joi.object().optional(),
  
  userRole: Joi.string().valid('mechanic', 'shop_manager', 'admin').optional(),
  
  version: Joi.number().integer().min(1).optional()
    .messages({
      'number.min': 'Version must be a positive integer'
    })
});

// Create inspection item validation
export const validateCreateInspectionItem = Joi.object({
  category: Joi.string().min(1).max(100).required()
    .messages({
      'string.min': 'Category cannot be empty',\n      'string.max': 'Category cannot exceed 100 characters',\n      'any.required': 'Category is required'\n    }),\n    \n  component: Joi.string().min(1).max(200).required()\n    .messages({\n      'string.min': 'Component cannot be empty',\n      'string.max': 'Component cannot exceed 200 characters',\n      'any.required': 'Component is required'\n    }),\n    \n  condition: conditionSchema.optional().default('good'),\n  \n  notes: Joi.string().max(1000).allow('').optional()\n    .messages({\n      'string.max': 'Notes cannot exceed 1000 characters'\n    }),\n    \n  measurements: Joi.object().optional(),\n  \n  recommendations: Joi.string().max(500).allow('').optional()\n    .messages({\n      'string.max': 'Recommendations cannot exceed 500 characters'\n    }),\n    \n  estimatedCost: Joi.number().min(0).max(10000).optional()\n    .messages({\n      'number.min': 'Estimated cost cannot be negative',\n      'number.max': 'Estimated cost seems unrealistic for a single item (max $10,000)'\n    }),\n    \n  priority: Joi.number().integer().min(1).max(10).optional().default(1)\n    .messages({\n      'number.min': 'Priority must be between 1 and 10',\n      'number.max': 'Priority must be between 1 and 10'\n    }),\n    \n  sortOrder: Joi.number().integer().min(0).optional().default(0)\n    .messages({\n      'number.min': 'Sort order cannot be negative'\n    })\n});\n\n// Update inspection item validation\nexport const validateUpdateInspectionItem = Joi.object({\n  condition: conditionSchema.optional(),\n  \n  notes: Joi.string().max(1000).allow('').optional()\n    .messages({\n      'string.max': 'Notes cannot exceed 1000 characters'\n    }),\n    \n  measurements: Joi.object().optional(),\n  \n  recommendations: Joi.string().max(500).allow('').optional()\n    .messages({\n      'string.max': 'Recommendations cannot exceed 500 characters'\n    }),\n    \n  estimatedCost: Joi.number().min(0).max(10000).allow(null).optional()\n    .messages({\n      'number.min': 'Estimated cost cannot be negative',\n      'number.max': 'Estimated cost seems unrealistic for a single item (max $10,000)'\n    }),\n    \n  priority: Joi.number().integer().min(1).max(10).optional()\n    .messages({\n      'number.min': 'Priority must be between 1 and 10',\n      'number.max': 'Priority must be between 1 and 10'\n    }),\n    \n  voiceNotes: Joi.array().items(Joi.string().max(2000)).max(20).optional()\n    .messages({\n      'string.max': 'Individual voice note cannot exceed 2000 characters',\n      'array.max': 'Cannot have more than 20 voice notes per item'\n    }),\n    \n  photoIds: Joi.array().items(Joi.string().uuid()).max(10).optional()\n    .messages({\n      'string.uuid': 'Photo IDs must be valid UUIDs',\n      'array.max': 'Cannot have more than 10 photos per item'\n    }),\n    \n  sortOrder: Joi.number().integer().min(0).optional()\n    .messages({\n      'number.min': 'Sort order cannot be negative'\n    })\n});\n\n// Voice processing validation\nexport const validateVoiceProcessing = Joi.object({\n  originalText: Joi.string().min(1).max(5000).required()\n    .messages({\n      'string.min': 'Voice text cannot be empty',\n      'string.max': 'Voice text cannot exceed 5000 characters',\n      'any.required': 'Voice text is required'\n    }),\n    \n  audioFilePath: Joi.string().optional(),\n  \n  audioDuration: Joi.number().min(0).max(600).optional()\n    .messages({\n      'number.min': 'Audio duration cannot be negative',\n      'number.max': 'Audio duration cannot exceed 10 minutes'\n    })\n});\n\n// Photo upload validation\nexport const validatePhotoUpload = Joi.object({\n  category: Joi.string().valid('general', 'before', 'after', 'damage', 'detail').optional().default('general'),\n  \n  description: Joi.string().max(500).allow('').optional()\n    .messages({\n      'string.max': 'Photo description cannot exceed 500 characters'\n    }),\n    \n  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()\n    .messages({\n      'string.max': 'Individual tags cannot exceed 50 characters',\n      'array.max': 'Cannot have more than 10 tags per photo'\n    }),\n    \n  processingOptions: Joi.object({\n    generateThumbnail: Joi.boolean().optional().default(true),\n    compressOriginal: Joi.boolean().optional().default(false),\n    extractExif: Joi.boolean().optional().default(true),\n    maxWidth: Joi.number().integer().min(100).max(4000).optional().default(1920),\n    maxHeight: Joi.number().integer().min(100).max(4000).optional().default(1080),\n    quality: Joi.number().integer().min(10).max(100).optional().default(85)\n  }).optional()\n});\n\n// Query parameters validation\nexport const validateInspectionQuery = Joi.object({\n  page: Joi.number().integer().min(1).optional().default(1)\n    .messages({\n      'number.min': 'Page must be a positive integer'\n    }),\n    \n  limit: Joi.number().integer().min(1).max(100).optional().default(50)\n    .messages({\n      'number.min': 'Limit must be at least 1',\n      'number.max': 'Limit cannot exceed 100'\n    }),\n    \n  sortBy: Joi.string().valid(\n    'created_at', 'updated_at', 'workflow_state', 'urgency_level', 'customer_name'\n  ).optional().default('created_at'),\n  \n  sortOrder: Joi.string().valid('ASC', 'DESC').optional().default('DESC'),\n  \n  workflowState: Joi.alternatives().try(\n    workflowStateSchema,\n    Joi.array().items(workflowStateSchema)\n  ).optional(),\n  \n  assignedTo: Joi.string().uuid().optional(),\n  \n  urgencyLevel: Joi.alternatives().try(\n    urgencyLevelSchema,\n    Joi.array().items(urgencyLevelSchema)\n  ).optional(),\n  \n  dateFrom: Joi.date().iso().optional(),\n  \n  dateTo: Joi.date().iso().optional(),\n  \n  customerId: Joi.string().uuid().optional(),\n  \n  vehicleId: Joi.string().uuid().optional(),\n  \n  searchTerm: Joi.string().min(2).max(100).optional()\n    .messages({\n      'string.min': 'Search term must be at least 2 characters',\n      'string.max': 'Search term cannot exceed 100 characters'\n    })\n});\n\n// Workflow transition validation\nexport const validateWorkflowTransition = Joi.object({\n  toState: workflowStateSchema.required(),\n  \n  reason: Joi.string().max(500).optional()\n    .messages({\n      'string.max': 'Reason cannot exceed 500 characters'\n    })\n});\n\n// Bulk operations validation\nexport const validateBulkOperation = Joi.object({\n  action: Joi.string().valid('create', 'update', 'delete', 'condition_update').required(),\n  \n  items: Joi.array().items(\n    Joi.object({\n      id: Joi.string().uuid().optional(),\n      data: Joi.object().required()\n    })\n  ).min(1).max(50).required()\n    .messages({\n      'array.min': 'At least one item is required for bulk operation',\n      'array.max': 'Cannot perform bulk operation on more than 50 items at once'\n    })\n});\n\n// Business rule validation functions\n\nexport interface ValidationResult {\n  isValid: boolean;\n  errors: string[];\n  warnings: string[];\n}\n\n// Validate business rules for inspection creation\nexport function validateInspectionBusinessRules(\n  data: any,\n  existingInspections: any[] = []\n): ValidationResult {\n  \n  const errors: string[] = [];\n  const warnings: string[] = [];\n  \n  // Check for duplicate active inspections on same vehicle\n  const activeInspection = existingInspections.find(\n    insp => insp.vehicle_id === data.vehicleId && \n           ['draft', 'in_progress', 'pending_review'].includes(insp.workflow_state)\n  );\n  \n  if (activeInspection) {\n    errors.push('Vehicle already has an active inspection in progress');\n  }\n  \n  // Check odometer reading consistency\n  const lastInspection = existingInspections\n    .filter(insp => insp.vehicle_id === data.vehicleId && insp.odometer_reading)\n    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];\n    \n  if (lastInspection && data.odometerReading) {\n    const lastReading = lastInspection.odometer_reading;\n    \n    if (data.odometerReading < lastReading) {\n      warnings.push(`Odometer reading (${data.odometerReading}) is lower than previous reading (${lastReading})`);\n    }\n    \n    const difference = data.odometerReading - lastReading;\n    if (difference > 50000) {\n      warnings.push(`Large odometer increase (${difference} miles) since last inspection`);\n    }\n  }\n  \n  return {\n    isValid: errors.length === 0,\n    errors,\n    warnings\n  };\n}\n\n// Validate condition changes\nexport function validateConditionChange(\n  oldCondition: string,\n  newCondition: string,\n  component: string\n): ValidationResult {\n  \n  const errors: string[] = [];\n  const warnings: string[] = [];\n  \n  // Define condition severity levels\n  const severityMap: Record<string, number> = {\n    'good': 1,\n    'fair': 2,\n    'poor': 3,\n    'needs_immediate': 4\n  };\n  \n  const oldSeverity = severityMap[oldCondition] || 1;\n  const newSeverity = severityMap[newCondition] || 1;\n  \n  // Check for dramatic improvements (might indicate error)\n  if (oldSeverity >= 3 && newSeverity === 1) {\n    warnings.push(\n      `${component} condition improved dramatically from ${oldCondition} to ${newCondition}. ` +\n      'Please verify this change is correct.'\n    );\n  }\n  \n  // Check for critical deterioration\n  if (newSeverity === 4) {\n    warnings.push(\n      `${component} marked as needs immediate attention. ` +\n      'This will require manager approval.'\n    );\n  }\n  \n  // Check for skipping condition levels\n  if (Math.abs(newSeverity - oldSeverity) > 1) {\n    warnings.push(\n      `${component} condition changed by multiple levels. ` +\n      'Please verify this assessment is accurate.'\n    );\n  }\n  \n  return {\n    isValid: errors.length === 0,\n    errors,\n    warnings\n  };\n}\n\n// Validate measurement values\nexport function validateMeasurements(\n  measurements: Record<string, any>,\n  component: string,\n  category: string\n): ValidationResult {\n  \n  const errors: string[] = [];\n  const warnings: string[] = [];\n  \n  // Component-specific measurement validation\n  if (category.toLowerCase().includes('brake') && component.toLowerCase().includes('pad')) {\n    if (measurements.thickness && typeof measurements.thickness === 'number') {\n      if (measurements.thickness < 0) {\n        errors.push('Brake pad thickness cannot be negative');\n      } else if (measurements.thickness < 2) {\n        warnings.push(`Brake pad thickness (${measurements.thickness}mm) is below safe minimum`);\n      } else if (measurements.thickness > 20) {\n        warnings.push(`Brake pad thickness (${measurements.thickness}mm) seems unusually high`);\n      }\n    }\n  }\n  \n  if (category.toLowerCase().includes('tire')) {\n    if (measurements.tread_depth && typeof measurements.tread_depth === 'number') {\n      if (measurements.tread_depth < 0) {\n        errors.push('Tire tread depth cannot be negative');\n      } else if (measurements.tread_depth < 2) {\n        warnings.push(`Tire tread depth (${measurements.tread_depth}/32\") is at or below legal limit`);\n      }\n    }\n    \n    if (measurements.pressure && typeof measurements.pressure === 'number') {\n      if (measurements.pressure < 0) {\n        errors.push('Tire pressure cannot be negative');\n      } else if (measurements.pressure < 20 || measurements.pressure > 80) {\n        warnings.push(`Tire pressure (${measurements.pressure} PSI) is outside normal range`);\n      }\n    }\n  }\n  \n  return {\n    isValid: errors.length === 0,\n    errors,\n    warnings\n  };\n}\n\n// Express middleware for validation\nexport function validateRequest(\n  schema: Joi.ObjectSchema,\n  property: 'body' | 'query' | 'params' = 'body'\n) {\n  return (req: Request, res: any, next: any) => {\n    const { error, value } = schema.validate(req[property], {\n      abortEarly: false,\n      stripUnknown: true,\n      convert: true\n    });\n    \n    if (error) {\n      const errors = error.details.map(detail => detail.message);\n      return res.status(400).json({\n        success: false,\n        error: 'Validation failed',\n        details: errors\n      });\n    }\n    \n    // Replace the request property with validated and sanitized data\n    req[property] = value;\n    next();\n  };\n}\n\n// Security validation\nexport function validateSecurityConstraints(\n  req: Request,\n  allowedRoles: string[] = [],\n  requireSameShop: boolean = true\n): ValidationResult {\n  \n  const errors: string[] = [];\n  const warnings: string[] = [];\n  \n  // Check user authentication\n  if (!req.user?.id) {\n    errors.push('User authentication required');\n    return { isValid: false, errors, warnings };\n  }\n  \n  // Check role authorization\n  if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {\n    errors.push(`Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`);\n  }\n  \n  // Check shop isolation\n  if (requireSameShop && req.params.shopId && req.user.shop_id !== req.params.shopId) {\n    errors.push('Access denied: resource belongs to different shop');\n  }\n  \n  // Rate limiting check (would be implemented with actual rate limiter)\n  // This is a placeholder for rate limiting logic\n  \n  return {\n    isValid: errors.length === 0,\n    errors,\n    warnings\n  };\n}\n\n// Input sanitization\nexport function sanitizeInput(input: any): any {\n  if (typeof input === 'string') {\n    // Remove potentially dangerous characters\n    return input.replace(/[<>\"'&]/g, '').trim();\n  }\n  \n  if (Array.isArray(input)) {\n    return input.map(sanitizeInput);\n  }\n  \n  if (typeof input === 'object' && input !== null) {\n    const sanitized: any = {};\n    for (const [key, value] of Object.entries(input)) {\n      sanitized[key] = sanitizeInput(value);\n    }\n    return sanitized;\n  }\n  \n  return input;\n}