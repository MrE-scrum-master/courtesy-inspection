// Joi validation schemas for all DTOs
// Centralized input validation with custom error messages

import Joi from 'joi';

// Common validation patterns
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Custom validators
const uuid = Joi.string().pattern(uuidPattern).messages({
  'string.pattern.base': 'must be a valid UUID'
});

const phone = Joi.string().pattern(phonePattern).messages({
  'string.pattern.base': 'must be a valid phone number'
});

const email = Joi.string().pattern(emailPattern).messages({
  'string.pattern.base': 'must be a valid email address'
});

// Authentication Schemas
export const loginSchema = Joi.object({
  email: email.required(),
  password: Joi.string().min(6).max(100).required().messages({
    'string.min': 'password must be at least 6 characters long',
    'string.max': 'password must not exceed 100 characters'
  })
});

export const registerSchema = Joi.object({
  email: email.required(),
  password: Joi.string().min(8).max(100).required().messages({
    'string.min': 'password must be at least 8 characters long',
    'string.max': 'password must not exceed 100 characters'
  }),
  fullName: Joi.string().min(1).max(255).required().messages({
    'string.min': 'full name is required',
    'string.max': 'full name must not exceed 255 characters'
  }),
  phone: phone.optional(),
  role: Joi.string().valid('admin', 'shop_manager', 'mechanic').optional(),
  shopId: uuid.optional()
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'refresh token is required'
  })
});

// User Management Schemas
export const createUserSchema = Joi.object({
  email: email.required(),
  password: Joi.string().min(8).max(100).required(),
  full_name: Joi.string().min(1).max(255).required(),
  phone: phone.optional(),
  role: Joi.string().valid('admin', 'shop_manager', 'mechanic').required(),
  shop_id: uuid.optional()
});

export const updateUserSchema = Joi.object({
  full_name: Joi.string().min(1).max(255).optional(),
  phone: phone.optional(),
  role: Joi.string().valid('admin', 'shop_manager', 'mechanic').optional(),
  shop_id: uuid.optional(),
  active: Joi.boolean().optional()
}).min(1).messages({
  'object.min': 'at least one field must be provided for update'
});

// Customer Schemas
export const createCustomerSchema = Joi.object({
  shop_id: uuid.required(),
  first_name: Joi.string().min(1).max(255).required().messages({
    'string.min': 'first name is required',
    'string.max': 'first name must not exceed 255 characters'
  }),
  last_name: Joi.string().min(1).max(255).required().messages({
    'string.min': 'last name is required',
    'string.max': 'last name must not exceed 255 characters'
  }),
  phone: phone.required(),
  email: email.optional(),
  address: Joi.string().max(1000).optional().messages({
    'string.max': 'address must not exceed 1000 characters'
  }),
  notes: Joi.string().max(2000).optional().messages({
    'string.max': 'notes must not exceed 2000 characters'
  })
});

export const updateCustomerSchema = Joi.object({
  first_name: Joi.string().min(1).max(255).optional(),
  last_name: Joi.string().min(1).max(255).optional(),
  phone: phone.optional(),
  email: email.optional(),
  address: Joi.string().max(1000).optional(),
  notes: Joi.string().max(2000).optional()
}).min(1).messages({
  'object.min': 'at least one field must be provided for update'
});

// Vehicle Schemas
export const createVehicleSchema = Joi.object({
  customer_id: uuid.required(),
  shop_id: uuid.required(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 2).optional().messages({
    'number.min': 'year must be 1900 or later',
    'number.max': `year must not exceed ${new Date().getFullYear() + 2}`
  }),
  make: Joi.string().min(1).max(100).required().messages({
    'string.min': 'make is required',
    'string.max': 'make must not exceed 100 characters'
  }),
  model: Joi.string().min(1).max(100).required().messages({
    'string.min': 'model is required',
    'string.max': 'model must not exceed 100 characters'
  }),
  vin: Joi.string().length(17).optional().messages({
    'string.length': 'VIN must be exactly 17 characters'
  }),
  license_plate: Joi.string().max(20).optional().messages({
    'string.max': 'license plate must not exceed 20 characters'
  }),
  color: Joi.string().max(50).optional().messages({
    'string.max': 'color must not exceed 50 characters'
  }),
  mileage: Joi.number().integer().min(0).max(9999999).optional().messages({
    'number.min': 'mileage must be 0 or greater',
    'number.max': 'mileage must not exceed 9,999,999'
  }),
  notes: Joi.string().max(2000).optional().messages({
    'string.max': 'notes must not exceed 2000 characters'
  })
});

export const updateVehicleSchema = Joi.object({
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 2).optional(),
  make: Joi.string().min(1).max(100).optional(),
  model: Joi.string().min(1).max(100).optional(),
  vin: Joi.string().length(17).optional(),
  license_plate: Joi.string().max(20).optional(),
  color: Joi.string().max(50).optional(),
  mileage: Joi.number().integer().min(0).max(9999999).optional(),
  notes: Joi.string().max(2000).optional()
}).min(1).messages({
  'object.min': 'at least one field must be provided for update'
});

// Inspection Schemas
export const createInspectionSchema = Joi.object({
  shop_id: uuid.required(),
  customer_id: uuid.required(),
  vehicle_id: uuid.required(),
  technician_id: uuid.required(),
  template_id: uuid.optional(),
  inspection_number: Joi.string().min(1).max(50).required().messages({
    'string.min': 'inspection number is required',
    'string.max': 'inspection number must not exceed 50 characters'
  })
});

export const updateInspectionSchema = Joi.object({
  status: Joi.string().valid('draft', 'in_progress', 'completed', 'sent', 'archived').optional(),
  checklist_data: Joi.object().optional(),
  overall_condition: Joi.string().valid('excellent', 'good', 'fair', 'poor').optional(),
  recommendations: Joi.string().max(5000).optional().messages({
    'string.max': 'recommendations must not exceed 5000 characters'
  }),
  notes: Joi.string().max(5000).optional().messages({
    'string.max': 'notes must not exceed 5000 characters'
  })
}).min(1).messages({
  'object.min': 'at least one field must be provided for update'
});

export const inspectionItemUpdateSchema = Joi.object({
  item_id: Joi.string().required(),
  status: Joi.string().valid('green', 'yellow', 'red').required(),
  notes: Joi.string().max(1000).optional().messages({
    'string.max': 'notes must not exceed 1000 characters'
  }),
  measurement: Joi.object({
    value: Joi.number().required(),
    unit: Joi.string().required(),
    raw: Joi.string().required()
  }).optional(),
  voice_input: Joi.string().max(2000).optional().messages({
    'string.max': 'voice input must not exceed 2000 characters'
  })
});

// Voice Processing Schemas
export const voiceInputSchema = Joi.object({
  text: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'voice text is required',
    'string.max': 'voice text must not exceed 2000 characters'
  }),
  inspection_id: uuid.required(),
  item_id: Joi.string().optional()
});

// SMS Schemas
export const sendSMSSchema = Joi.object({
  to: phone.required(),
  template: Joi.string().valid(
    'inspection_started',
    'inspection_complete',
    'urgent_issue',
    'service_reminder',
    'approval_request'
  ).required(),
  data: Joi.object({
    customer_name: Joi.string().required(),
    shop_name: Joi.string().optional(),
    vehicle: Joi.string().optional(),
    link: Joi.string().uri().optional(),
    shop_phone: phone.optional(),
    service: Joi.string().optional(),
    price: Joi.number().min(0).optional(),
    customer_id: uuid.optional(),
    inspection_id: uuid.optional()
  }).required()
});

// File Upload Schemas
export const uploadPhotoSchema = Joi.object({
  inspection_id: uuid.required(),
  category: Joi.string().max(50).optional(),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'description must not exceed 500 characters'
  })
});

// Query Parameter Schemas
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional(),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC').optional()
});

export const inspectionQuerySchema = paginationSchema.keys({
  shop_id: uuid.optional(),
  status: Joi.string().valid('draft', 'in_progress', 'completed', 'sent', 'archived').optional(),
  technician_id: uuid.optional(),
  customer_id: uuid.optional(),
  from_date: Joi.date().iso().optional(),
  to_date: Joi.date().iso().optional(),
  search: Joi.string().max(100).optional()
});

export const customerQuerySchema = paginationSchema.keys({
  shop_id: uuid.required(),
  search: Joi.string().max(100).optional()
});

export const vehicleQuerySchema = paginationSchema.keys({
  shop_id: uuid.required(),
  customer_id: uuid.optional(),
  search: Joi.string().max(100).optional()
});

// ID Parameter Schemas
export const idParamSchema = Joi.object({
  id: uuid.required()
});

export const shopIdParamSchema = Joi.object({
  shopId: uuid.required()
});

// Validation helper function
export function validateSchema(schema: Joi.ObjectSchema, data: any): { isValid: boolean; errors: Record<string, string[]>; data?: any } {
  const result = schema.validate(data, { 
    abortEarly: false, 
    stripUnknown: true,
    convert: true
  });

  if (result.error) {
    const errors: Record<string, string[]> = {};
    
    result.error.details.forEach(detail => {
      const field = detail.path.join('.');
      if (!errors[field]) {
        errors[field] = [];
      }
      errors[field].push(detail.message);
    });

    return {
      isValid: false,
      errors
    };
  }

  return {
    isValid: true,
    errors: {},
    data: result.value
  };
}