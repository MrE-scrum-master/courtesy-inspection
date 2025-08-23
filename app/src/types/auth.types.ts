/**
 * Authentication Type Definitions - SOLID/DRY Compliant
 * Single source of truth for auth-related types
 */

// ==================== USER TYPES ====================

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  shopId: string;
  shopName?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = 'admin' | 'shop_manager' | 'mechanic';

// ==================== AUTH TYPES ====================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: UserRole;
  shopId: string;
}

// Server response structure (matches actual API)
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ==================== STATE TYPES ====================

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
  checkAuthStatus: () => Promise<void>;
}

export type AuthContextType = AuthState & AuthActions;

// ==================== ERROR TYPES ====================

export interface AuthError {
  code: 'INVALID_CREDENTIALS' | 'NETWORK_ERROR' | 'TOKEN_EXPIRED' | 'UNKNOWN';
  message: string;
  details?: any;
}

// ==================== STORAGE KEYS (DRY - Single definition) ====================

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
} as const;

export type AuthStorageKey = typeof AUTH_STORAGE_KEYS[keyof typeof AUTH_STORAGE_KEYS];