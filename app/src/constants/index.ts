// Re-export all constants for easy importing
export * from './api';
export * from './theme';

// App-specific constants
export const APP_CONFIG = {
  NAME: 'Courtesy Inspection',
  VERSION: '1.0.0',
  DESCRIPTION: 'Digital Vehicle Inspection Platform',
  ENVIRONMENT: __DEV__ ? 'development' : 'production',
  ENABLE_LOGGING: __DEV__,
} as const;

// Storage keys for SecureStore and AsyncStorage
// Using consistent keys with @ prefix for Expo SecureStore
export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@courtesy/access_token',
  REFRESH_TOKEN: '@courtesy/refresh_token',
  USER_DATA: '@courtesy/user_data',
  SETTINGS: '@courtesy/app_settings',
  ONBOARDING_COMPLETE: '@courtesy/onboarding_complete',
  LAST_SYNC: '@courtesy/last_sync',
} as const;

// Default inspection categories and items
export const INSPECTION_CATEGORIES = {
  EXTERIOR: 'Exterior',
  INTERIOR: 'Interior',
  ENGINE: 'Engine',
  FLUIDS: 'Fluids',
  BRAKES: 'Brakes',
  TIRES: 'Tires',
  LIGHTS: 'Lights',
  ELECTRICAL: 'Electrical',
  SUSPENSION: 'Suspension',
  EXHAUST: 'Exhaust',
} as const;

export const DEFAULT_INSPECTION_ITEMS = [
  // Exterior
  { category: 'Exterior', name: 'Body Condition', priority: 'medium' },
  { category: 'Exterior', name: 'Paint Condition', priority: 'low' },
  { category: 'Exterior', name: 'Windshield', priority: 'high' },
  { category: 'Exterior', name: 'Windows', priority: 'medium' },
  { category: 'Exterior', name: 'Mirrors', priority: 'medium' },
  
  // Interior
  { category: 'Interior', name: 'Seats', priority: 'low' },
  { category: 'Interior', name: 'Dashboard', priority: 'medium' },
  { category: 'Interior', name: 'Air Conditioning', priority: 'medium' },
  { category: 'Interior', name: 'Audio System', priority: 'low' },
  
  // Engine
  { category: 'Engine', name: 'Engine Performance', priority: 'high' },
  { category: 'Engine', name: 'Belt Condition', priority: 'high' },
  { category: 'Engine', name: 'Hoses', priority: 'high' },
  { category: 'Engine', name: 'Battery', priority: 'high' },
  
  // Fluids
  { category: 'Fluids', name: 'Engine Oil', priority: 'high' },
  { category: 'Fluids', name: 'Coolant', priority: 'high' },
  { category: 'Fluids', name: 'Brake Fluid', priority: 'high' },
  { category: 'Fluids', name: 'Power Steering', priority: 'medium' },
  { category: 'Fluids', name: 'Transmission Fluid', priority: 'high' },
  
  // Brakes
  { category: 'Brakes', name: 'Brake Pads', priority: 'high' },
  { category: 'Brakes', name: 'Brake Rotors', priority: 'high' },
  { category: 'Brakes', name: 'Brake Lines', priority: 'high' },
  
  // Tires
  { category: 'Tires', name: 'Tire Tread', priority: 'high' },
  { category: 'Tires', name: 'Tire Pressure', priority: 'high' },
  { category: 'Tires', name: 'Wheel Alignment', priority: 'medium' },
  
  // Lights
  { category: 'Lights', name: 'Headlights', priority: 'high' },
  { category: 'Lights', name: 'Taillights', priority: 'high' },
  { category: 'Lights', name: 'Turn Signals', priority: 'high' },
  { category: 'Lights', name: 'Brake Lights', priority: 'high' },
  
  // Electrical
  { category: 'Electrical', name: 'Alternator', priority: 'high' },
  { category: 'Electrical', name: 'Starter', priority: 'high' },
  { category: 'Electrical', name: 'Wiring', priority: 'medium' },
  
  // Suspension
  { category: 'Suspension', name: 'Struts/Shocks', priority: 'medium' },
  { category: 'Suspension', name: 'Springs', priority: 'medium' },
  { category: 'Suspension', name: 'Ball Joints', priority: 'high' },
  
  // Exhaust
  { category: 'Exhaust', name: 'Exhaust System', priority: 'medium' },
  { category: 'Exhaust', name: 'Catalytic Converter', priority: 'high' },
] as const;

// File upload constraints
export const UPLOAD_CONSTRAINTS = {
  IMAGE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    MAX_DIMENSIONS: { width: 2048, height: 2048 },
  },
  VOICE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_DURATION: 300, // 5 minutes
    ALLOWED_TYPES: ['audio/mp4', 'audio/mpeg', 'audio/wav'],
  },
} as const;

// Validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[\+]?[\d\s\-\(\)]{10,}$/,
  VIN: /^[A-HJ-NPR-Z0-9]{17}$/,
  LICENSE_PLATE: /^[A-Z0-9\-\s]{2,8}$/,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN: 'Successfully logged in',
  LOGOUT: 'Successfully logged out',
  SAVE: 'Changes saved successfully',
  CREATE: 'Created successfully',
  UPDATE: 'Updated successfully',
  DELETE: 'Deleted successfully',
  SEND: 'Sent successfully',
} as const;