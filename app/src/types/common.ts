// Common types used throughout the application
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Authentication types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'mechanic';
  shopId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// Customer types
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  shopId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Vehicle types
export interface Vehicle {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  licensePlate?: string;
  color?: string;
  mileage?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Inspection types
export interface InspectionItem {
  id: string;
  category: string;
  name: string;
  status: 'good' | 'fair' | 'poor' | 'needs_attention';
  notes?: string;
  photos?: string[];
  voiceNote?: string;
  priority: 'low' | 'medium' | 'high';
  estimatedCost?: number;
  recommendedAction?: string;
}

export interface Inspection {
  id: string;
  customerId: string;
  vehicleId: string;
  mechanicId: string;
  status: 'draft' | 'in_progress' | 'completed' | 'sent' | 'archived';
  type: 'courtesy' | 'detailed' | 'follow_up';
  items: InspectionItem[];
  summary?: string;
  totalEstimatedCost?: number;
  scheduledDate?: string;
  completedDate?: string;
  sentDate?: string;
  customerNotified: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
  
  // Navigation properties (populated from API)
  customer?: Customer;
  vehicle?: Vehicle;
  mechanic?: User;
}

// Shop types
export interface Shop {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logoUrl?: string;
  settings: ShopSettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopSettings {
  defaultInspectionItems: string[];
  emailNotifications: boolean;
  smsNotifications: boolean;
  autoSendReports: boolean;
  reportFormat: 'pdf' | 'email' | 'both';
  theme: 'light' | 'dark';
  language: 'en' | 'es' | 'fr';
}

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Auth: undefined;
  CreateCustomer: {
    vehicleId?: number;
    vehicleInfo?: string;
    onCustomerCreated?: (customerId: number) => void;
  };
  CreateInspection: {
    customerId?: string;
    vehicleId?: string;
    vehicle?: any;
    customer?: any;
  };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Inspections: undefined;
  VINScanner: undefined;
  Customers: undefined;
  Settings: undefined;
};

export type InspectionStackParamList = {
  InspectionList: undefined;
  InspectionDetail: { inspectionId: string };
  CreateInspection: { customerId?: string; vehicleId?: string; vehicle?: any; customer?: any };
  InspectionForm: { inspectionId: string };
  VINScanner: undefined;
};

export type CustomerStackParamList = {
  CustomerList: undefined;
  CustomerDetail: { customerId: string };
  CreateCustomer: undefined;
  VehicleDetail: { vehicleId: string };
  CreateVehicle: { customerId: string };
};

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'phone' | 'number' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

// Voice recording types
export interface VoiceRecording {
  uri: string;
  duration: number;
  size: number;
  type: string;
}

// Photo types
export interface PhotoCapture {
  uri: string;
  width: number;
  height: number;
  type: string;
  base64?: string | undefined;
}

// Utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Environment types
export interface AppConfig {
  apiUrl: string;
  environment: 'development' | 'staging' | 'production';
  version: string;
  enableLogging: boolean;
}