// Authentication hook - manages auth state, NO business logic
import { useState, useEffect, useCallback } from 'react';
import { storage } from '@/utils/storage';
import { AuthApi } from '@/services';
import { STORAGE_KEYS } from '@/constants';
import type { User, LoginRequest, AsyncState } from '@/types/common';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: {
    name: string;
    email: string;
    password: string;
    shopId: string;
    role: 'mechanic' | 'manager';
  }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
  checkAuthStatus: () => Promise<void>;
}

export function useAuth(): AuthState & AuthActions {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Check if user is already authenticated on app start
  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const token = await storage.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      const userData = await storage.getObjectAsync<User>(STORAGE_KEYS.USER_DATA);

      if (token && userData) {
        try {
          // Verify token is still valid by fetching profile
          const response = await AuthApi.getProfile();
          const user = response.data;
          
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          // Token is invalid, clear stored data
          await clearStoredAuthData();
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to check authentication status',
      });
    }
  }, []);

  // Login user
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await AuthApi.login(credentials);
      const { user, accessToken, refreshToken } = response.data as any; // Server returns tokens directly, not wrapped

      // Store tokens and user data
      await storage.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      await storage.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      await storage.setObjectAsync(STORAGE_KEYS.USER_DATA, user);

      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed',
      }));
      throw error;
    }
  }, []);

  // Register user
  const register = useCallback(async (userData: {
    name: string;
    email: string;
    password: string;
    shopId: string;
    role: 'mechanic' | 'manager';
  }) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await AuthApi.register(userData);
      const { user, accessToken, refreshToken } = response.data as any; // Server returns tokens directly

      // Store tokens and user data
      await storage.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      await storage.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      await storage.setObjectAsync(STORAGE_KEYS.USER_DATA, user);

      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Registration failed',
      }));
      throw error;
    }
  }, []);

  // Logout user
  const logout = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // Call logout API to invalidate server-side session
      try {
        await AuthApi.logout();
      } catch (error) {
        // Continue with logout even if API call fails
        console.warn('Logout API call failed:', error);
      }

      // Clear local storage
      await clearStoredAuthData();

      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Logout failed',
      }));
      throw error;
    }
  }, []);

  // Refresh user profile
  const refreshProfile = useCallback(async () => {
    try {
      const response = await AuthApi.getProfile();
      const user = response.data;

      // Update stored user data
      await storage.setObjectAsync(STORAGE_KEYS.USER_DATA, user);

      setAuthState(prev => ({
        ...prev,
        user,
        error: null,
      }));
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to refresh profile',
      }));
      throw error;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Helper function to clear stored auth data
  const clearStoredAuthData = async () => {
    await storage.deleteMultipleAsync([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_DATA,
    ]);
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return {
    // State
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,
    
    // Actions
    login,
    logout,
    register,
    refreshProfile,
    clearError,
    checkAuthStatus,
  };
}