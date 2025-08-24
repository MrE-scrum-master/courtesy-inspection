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
  name?: string;
  full_name?: string;
  role: 'admin' | 'manager' | 'mechanic' | 'shop_manager';
  shopId?: string;
  shop_id?: string;
  isActive?: boolean;
  active?: boolean;
  phone?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  last_login_at?: string;
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
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone: string;
  address?: string;
  shopId?: string;
  shop_id?: string;
  isActive?: boolean;
  notes?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

// Vehicle types
export interface Vehicle {
  id: string;
  customerId?: string;
  customer_id?: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  licensePlate?: string;
  license_plate?: string;
  color?: string;
  mileage?: number;
  notes?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
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
  
  // Support both camelCase and snake_case field naming
  customerId?: string;
  customer_id?: string;
  vehicleId?: string;
  vehicle_id?: string;
  mechanicId?: string;
  technician_id?: string;
  
  // Core inspection fields
  shop_id?: string;
  inspection_number?: string;
  status: 'draft' | 'in_progress' | 'completed' | 'sent' | 'archived';
  type?: 'courtesy' | 'detailed' | 'follow_up';
  
  // Checklist data (from server) vs items array (app format)
  checklist_data?: Record<string, ChecklistItemResult>;
  items?: InspectionItem[];
  
  // Optional fields
  summary?: string;
  recommendations?: string;
  notes?: string;
  totalEstimatedCost?: number;
  scheduledDate?: string;
  completedDate?: string;
  completed_at?: string;
  sentDate?: string;
  sent_at?: string;
  customerNotified?: boolean;
  priority?: 'low' | 'medium' | 'high';
  overall_condition?: 'excellent' | 'good' | 'fair' | 'poor';
  
  // Timestamps - support both formats
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  started_at?: string;
  
  // Navigation properties (populated from API joins)
  customer?: Customer & {
    first_name?: string;
    last_name?: string;
  };
  vehicle?: Vehicle & {
    license_plate?: string;
    licensePlate?: string;
  };
  mechanic?: User & {
    full_name?: string;
  };
}

export interface ChecklistItemResult {
  status: 'green' | 'yellow' | 'red';
  notes?: string;
  measurement?: {
    value: number;
    unit: string;
    raw: string;
  };
  voice_input?: string;
  photos?: string[];
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