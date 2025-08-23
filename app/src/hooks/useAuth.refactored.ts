/**
 * Refactored Authentication Hook - SOLID/DRY/KISS Compliant
 * Clean separation of concerns with proper error handling
 */
import { useState, useEffect, useCallback } from 'react';
import { storage } from '@/utils/storage';
import { apiClient } from '@/services/ApiClient';
import { 
  User, 
  AuthState, 
  AuthActions, 
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  AUTH_STORAGE_KEYS,
  AuthError
} from '@/types/auth.types';

// ==================== ERROR HANDLER (SOLID - Single Responsibility) ====================

class AuthErrorHandler {
  static handle(error: any): AuthError {
    if (error.status === 401) {
      return {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        details: error,
      };
    }
    
    if (error.message?.includes('Network')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
        details: error,
      };
    }
    
    return {
      code: 'UNKNOWN',
      message: error.message || 'An unexpected error occurred',
      details: error,
    };
  }
}

// ==================== TOKEN SERVICE (DRY - Reusable token operations) ====================

class TokenService {
  static async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      storage.set(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken),
      storage.set(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  }

  static async clearTokens(): Promise<void> {
    await Promise.all([
      storage.remove(AUTH_STORAGE_KEYS.ACCESS_TOKEN),
      storage.remove(AUTH_STORAGE_KEYS.REFRESH_TOKEN),
    ]);
  }

  static async getAccessToken(): Promise<string | null> {
    return storage.get(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
  }
}

// ==================== USER SERVICE (DRY - Reusable user operations) ====================

class UserService {
  static async saveUser(user: User): Promise<void> {
    await storage.setObject(AUTH_STORAGE_KEYS.USER_DATA, user);
  }

  static async getUser(): Promise<User | null> {
    return storage.getObject<User>(AUTH_STORAGE_KEYS.USER_DATA);
  }

  static async clearUser(): Promise<void> {
    await storage.remove(AUTH_STORAGE_KEYS.USER_DATA);
  }
}

// ==================== AUTH HOOK (KISS - Simple interface) ====================

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Helper to update state (DRY)
  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      updateState({ isLoading: true, error: null });

      const [token, user] = await Promise.all([
        TokenService.getAccessToken(),
        UserService.getUser(),
      ]);

      if (token && user) {
        // Verify token validity
        try {
          const response = await apiClient.get<User>('/auth/profile');
          const updatedUser = response.data;
          
          await UserService.saveUser(updatedUser);
          updateState({
            user: updatedUser,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Token invalid, clear auth
          await clearAuthData();
          updateState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        updateState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to check authentication status',
      });
    }
  }, [updateState]);

  // Login
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      const { user, accessToken, refreshToken } = response.data;

      // Save auth data
      await Promise.all([
        TokenService.saveTokens(accessToken, refreshToken),
        UserService.saveUser(user),
      ]);

      updateState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      const authError = AuthErrorHandler.handle(error);
      updateState({
        isLoading: false,
        error: authError.message,
      });
      throw authError;
    }
  }, [updateState]);

  // Register
  const register = useCallback(async (data: RegisterRequest) => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await apiClient.post<AuthResponse>('/auth/register', data);
      const { user, accessToken, refreshToken } = response.data;

      // Save auth data
      await Promise.all([
        TokenService.saveTokens(accessToken, refreshToken),
        UserService.saveUser(user),
      ]);

      updateState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      const authError = AuthErrorHandler.handle(error);
      updateState({
        isLoading: false,
        error: authError.message,
      });
      throw authError;
    }
  }, [updateState]);

  // Logout
  const logout = useCallback(async () => {
    try {
      updateState({ isLoading: true, error: null });

      // Call logout API (best effort)
      try {
        await apiClient.post('/auth/logout');
      } catch {
        // Continue logout even if API fails
      }

      // Clear local auth data
      await clearAuthData();

      updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      const authError = AuthErrorHandler.handle(error);
      updateState({
        isLoading: false,
        error: authError.message,
      });
      throw authError;
    }
  }, [updateState]);

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    try {
      const response = await apiClient.get<User>('/auth/profile');
      const user = response.data;

      await UserService.saveUser(user);
      updateState({ user, error: null });
    } catch (error) {
      const authError = AuthErrorHandler.handle(error);
      updateState({ error: authError.message });
      throw authError;
    }
  }, [updateState]);

  // Clear error
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Helper to clear all auth data
  const clearAuthData = async () => {
    await Promise.all([
      TokenService.clearTokens(),
      UserService.clearUser(),
    ]);
  };

  // Check auth on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return {
    ...state,
    login,
    logout,
    register,
    refreshProfile,
    clearError,
    checkAuthStatus,
  };
}

export default useAuth;