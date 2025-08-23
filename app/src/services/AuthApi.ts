// Authentication API service - pure API calls, NO business logic
import { apiClient } from './ApiClient';
import { API_ENDPOINTS } from '@/constants';
import type { 
  LoginRequest, 
  LoginResponse, 
  User, 
  ApiResponse 
} from '@/types/common';

export class AuthApi {
  // Login user - just makes HTTP call and returns data
  static async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials);
  }

  // Register user
  static async register(userData: {
    name: string;
    email: string;
    password: string;
    shopId: string;
    role: 'mechanic' | 'manager';
  }): Promise<ApiResponse<LoginResponse>> {
    return apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.REGISTER, userData);
  }

  // Refresh authentication token
  static async refreshToken(refreshToken: string): Promise<ApiResponse<{
    accessToken: string;
    refreshToken: string;
  }>> {
    return apiClient.post(API_ENDPOINTS.AUTH.REFRESH, { refreshToken });
  }

  // Logout user
  static async logout(): Promise<ApiResponse<void>> {
    return apiClient.post<void>(API_ENDPOINTS.AUTH.LOGOUT);
  }

  // Get current user profile
  static async getProfile(): Promise<ApiResponse<User>> {
    return apiClient.get<User>(API_ENDPOINTS.AUTH.PROFILE);
  }

  // Update user profile
  static async updateProfile(profileData: Partial<User>): Promise<ApiResponse<User>> {
    return apiClient.put<User>(API_ENDPOINTS.AUTH.PROFILE, profileData);
  }

  // Change password
  static async changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`${API_ENDPOINTS.AUTH.PROFILE}/password`, passwordData);
  }

  // Request password reset
  static async requestPasswordReset(email: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/password-reset/request', { email });
  }

  // Reset password with token
  static async resetPassword(data: {
    token: string;
    newPassword: string;
  }): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/password-reset/confirm', data);
  }

  // Verify email address
  static async verifyEmail(token: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/verify-email', { token });
  }

  // Resend email verification
  static async resendEmailVerification(): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/verify-email/resend');
  }
}

export default AuthApi;