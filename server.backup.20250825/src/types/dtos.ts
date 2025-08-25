// Data Transfer Object types for API requests and responses
// Strong typing for all input/output operations

// Authentication DTOs
export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: 'admin' | 'shop_manager' | 'mechanic';
  shopId?: string;
}

export interface RefreshTokenDTO {
  refreshToken: string;
}

export interface AuthResponseDTO {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    role: string;
    shopId: string | null;
    shopName?: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

// User Management DTOs
export interface CreateUserDTO {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'shop_manager' | 'mechanic';
  shop_id?: string;
}

export interface UpdateUserDTO {
  full_name?: string;
  phone?: string;
  role?: 'admin' | 'shop_manager' | 'mechanic';
  shop_id?: string;
  active?: boolean;
}

// Customer DTOs
export interface CreateCustomerDTO {
  shop_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerDTO {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

// Vehicle DTOs
export interface CreateVehicleDTO {
  customer_id: string;
  shop_id: string;
  year?: number;
  make: string;
  model: string;
  vin?: string;
  license_plate?: string;
  color?: string;
  mileage?: number;
  notes?: string;
}

export interface UpdateVehicleDTO {
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  license_plate?: string;
  color?: string;
  mileage?: number;
  notes?: string;
}

// Inspection DTOs
export interface CreateInspectionDTO {
  shop_id: string;
  customer_id: string;
  vehicle_id: string;
  technician_id: string;
  template_id?: string;
  inspection_number: string;
}

export interface UpdateInspectionDTO {
  status?: 'draft' | 'in_progress' | 'completed' | 'sent' | 'archived';
  checklist_data?: Record<string, any>;
  overall_condition?: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations?: string;
  notes?: string;
}

export interface InspectionItemUpdateDTO {
  item_id: string;
  status: 'green' | 'yellow' | 'red';
  notes?: string;
  measurement?: {
    value: number;
    unit: string;
    raw: string;
  };
  voice_input?: string;
}

// Voice Processing DTOs
export interface VoiceInputDTO {
  text: string;
  inspection_id: string;
  item_id?: string;
}

export interface VoiceParsingResponseDTO {
  original: string;
  component: string | null;
  status: string | null;
  measurement: {
    value: number;
    unit: string;
    raw: string;
  } | null;
  action: string | null;
  confidence: number;
  timestamp: string;
  suggestions: string[];
}

// SMS DTOs
export interface SendSMSDTO {
  to: string;
  template: string;
  data: Record<string, string | number>;
}

export interface SMSTemplateDataDTO {
  customer_name: string;
  shop_name: string;
  vehicle: string;
  link: string;
  shop_phone?: string;
  service?: string;
  price?: number;
  customer_id?: string;
  inspection_id?: string;
}

// File Upload DTOs
export interface UploadPhotoDTO {
  inspection_id: string;
  category?: string;
  description?: string;
}

export interface PhotoResponseDTO {
  id: string;
  file_url: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  category: string | null;
  description: string | null;
}

// API Response DTOs
export interface ApiResponseDTO<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponseDTO {
  success: false;
  error: string;
  message?: string;
  details?: Record<string, string[]>;
}

// Query DTOs
export interface PaginationDTO {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface InspectionQueryDTO extends PaginationDTO {
  shop_id?: string;
  status?: string;
  technician_id?: string;
  customer_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface CustomerQueryDTO extends PaginationDTO {
  shop_id: string;
  search?: string;
}

export interface VehicleQueryDTO extends PaginationDTO {
  shop_id: string;
  customer_id?: string;
  search?: string;
}