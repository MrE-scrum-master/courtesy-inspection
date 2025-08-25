// Entity interfaces for Courtesy Inspection MVP
// Based on PostgreSQL schema from templates/db.js

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  phone: string | null;
  role: 'admin' | 'shop_manager' | 'mechanic';
  shop_id: string | null;
  active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  refresh_token: string;
  expires_at: Date;
  created_at: Date;
}

export interface Shop {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  owner_id: string | null;
  settings: Record<string, any>;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Customer {
  id: string;
  shop_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  shop_id: string;
  year: number | null;
  make: string;
  model: string;
  vin: string | null;
  license_plate: string | null;
  color: string | null;
  mileage: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InspectionTemplate {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  checklist_items: Array<ChecklistItem>;
  is_default: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ChecklistItem {
  id: string;
  category: string;
  name: string;
  description?: string;
  required: boolean;
  position: number;
}

export interface Inspection {
  id: string;
  shop_id: string;
  customer_id: string;
  vehicle_id: string;
  technician_id: string;
  template_id: string | null;
  inspection_number: string;
  status: 'draft' | 'in_progress' | 'completed' | 'sent' | 'archived';
  checklist_data: Record<string, ChecklistItemResult>;
  overall_condition: 'excellent' | 'good' | 'fair' | 'poor' | null;
  recommendations: string | null;
  notes: string | null;
  started_at: Date;
  completed_at: Date | null;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChecklistItemResult {
  status: 'green' | 'yellow' | 'red';
  notes?: string;
  measurement?: Measurement;
  voice_input?: string;
  photos?: string[];
}

export interface Measurement {
  value: number;
  unit: string;
  raw: string;
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  file_url: string;
  file_path: string;
  original_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  description: string | null;
  sort_order: number;
  created_at: Date;
}

export interface Report {
  id: string;
  inspection_id: string;
  shop_id: string;
  report_url: string | null;
  short_link: string | null;
  pdf_path: string | null;
  html_content: string | null;
  sent_via: string[];
  sent_to: Record<string, any>;
  sent_at: Date | null;
  viewed_at: Date | null;
  view_count: number;
  created_at: Date;
  updated_at: Date;
}

// Voice parsing result
export interface VoiceParsingResult {
  original: string;
  component: string | null;
  status: string | null;
  measurement: Measurement | null;
  action: string | null;
  confidence: number;
  timestamp: string;
}