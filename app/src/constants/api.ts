// API endpoints and configuration
import ENV from '@/config/environment';

export const API_CONFIG = {
  BASE_URL: ENV.API_URL,
  TIMEOUT: ENV.API_TIMEOUT || 10000,
  RETRY_ATTEMPTS: 3,
} as const;

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
    PROFILE: '/api/auth/profile',
  },
  
  // Users
  USERS: {
    BASE: '/api/users',
    BY_ID: (id: string) => `/api/users/${id}`,
    BY_SHOP: (shopId: string) => `/api/users/shop/${shopId}`,
  },
  
  // Customers
  CUSTOMERS: {
    BASE: '/api/customers',
    BY_ID: (id: string) => `/api/customers/${id}`,
    BY_SHOP: (shopId: string) => `/api/customers/shop/${shopId}`,
    SEARCH: '/api/customers/search',
  },
  
  // Vehicles
  VEHICLES: {
    BASE: '/api/vehicles',
    BY_ID: (id: string) => `/api/vehicles/${id}`,
    BY_CUSTOMER: (customerId: string) => `/api/vehicles/customer/${customerId}`,
  },
  
  // Inspections
  INSPECTIONS: {
    BASE: '/api/inspections',
    BY_ID: (id: string) => `/api/inspections/${id}`,
    BY_CUSTOMER: (customerId: string) => `/api/inspections/customer/${customerId}`,
    BY_MECHANIC: (mechanicId: string) => `/api/inspections/mechanic/${mechanicId}`,
    BY_SHOP: (shopId: string) => `/api/inspections/shop/${shopId}`,
    TEMPLATES: '/api/inspections/templates',
    UPLOAD_PHOTO: (inspectionId: string) => `/api/inspections/${inspectionId}/photos`,
    UPLOAD_VOICE: (inspectionId: string) => `/api/inspections/${inspectionId}/voice`,
    SEND_REPORT: (inspectionId: string) => `/api/inspections/${inspectionId}/send`,
  },
  
  // Shops
  SHOPS: {
    BASE: '/api/shops',
    BY_ID: (id: string) => `/api/shops/${id}`,
    SETTINGS: (shopId: string) => `/api/shops/${shopId}/settings`,
  },
  
  // File uploads
  UPLOADS: {
    IMAGE: '/api/uploads/image',
    VOICE: '/api/uploads/voice',
    DOCUMENT: '/api/uploads/document',
  },
  
  // Notifications
  NOTIFICATIONS: {
    SEND_SMS: '/api/notifications/sms',
    SEND_EMAIL: '/api/notifications/email',
    SEND_REPORT: '/api/notifications/report',
  },
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Request headers
export const REQUEST_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
} as const;

// Content types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  URL_ENCODED: 'application/x-www-form-urlencoded',
  TEXT: 'text/plain',
} as const;