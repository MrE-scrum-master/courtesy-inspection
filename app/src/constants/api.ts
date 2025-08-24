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
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    PROFILE: '/auth/profile',
  },
  
  // Users
  USERS: {
    BASE: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    BY_SHOP: (shopId: string) => `/users/shop/${shopId}`,
  },
  
  // Customers
  CUSTOMERS: {
    BASE: '/customers',
    BY_ID: (id: string) => `/customers/${id}`,
    BY_SHOP: (shopId: string) => `/customers/shop/${shopId}`,
    SEARCH: '/customers/search',
  },
  
  // Vehicles
  VEHICLES: {
    BASE: '/vehicles',
    BY_ID: (id: string) => `/vehicles/${id}`,
    BY_CUSTOMER: (customerId: string) => `/vehicles/customer/${customerId}`,
  },
  
  // Inspections
  INSPECTIONS: {
    BASE: '/inspections',
    BY_ID: (id: string) => `/inspections/${id}`,
    BY_CUSTOMER: (customerId: string) => `/inspections/customer/${customerId}`,
    BY_MECHANIC: (mechanicId: string) => `/inspections/mechanic/${mechanicId}`,
    BY_SHOP: (shopId: string) => `/inspections/shop/${shopId}`,
    TEMPLATES: '/inspection-templates',
    UPLOAD_PHOTO: (inspectionId: string) => `/inspections/${inspectionId}/photos`,
    UPLOAD_VOICE: (inspectionId: string) => `/inspections/${inspectionId}/voice`,
    SEND_REPORT: (inspectionId: string) => `/inspections/${inspectionId}/send`,
  },
  
  // Shops
  SHOPS: {
    BASE: '/shops',
    BY_ID: (id: string) => `/shops/${id}`,
    SETTINGS: (shopId: string) => `/shops/${shopId}/settings`,
  },
  
  // File uploads
  UPLOADS: {
    IMAGE: '/uploads/image',
    VOICE: '/uploads/voice',
    DOCUMENT: '/uploads/document',
  },
  
  // Notifications
  NOTIFICATIONS: {
    SEND_SMS: '/notifications/sms',
    SEND_EMAIL: '/notifications/email',
    SEND_REPORT: '/notifications/report',
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