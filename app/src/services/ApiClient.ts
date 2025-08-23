// Pure API client - NO business logic, just HTTP calls
import axios, { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosError 
} from 'axios';
import { storage } from '@/utils/storage';
import { 
  API_CONFIG, 
  HTTP_STATUS, 
  REQUEST_HEADERS, 
  CONTENT_TYPES,
  ERROR_MESSAGES 
} from '@/constants';
import { ENV } from '@/config/environment';
import type { ApiResponse, ApiError } from '@/types/common';

class ApiClient {
  private client: AxiosInstance;
  private refreshTokenPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        [REQUEST_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [REQUEST_HEADERS.ACCEPT]: CONTENT_TYPES.JSON,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await storage.getItemAsync(ENV.STORAGE_KEYS.ACCESS_TOKEN);
        if (token) {
          config.headers[REQUEST_HEADERS.AUTHORIZATION] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for token refresh and error handling
    this.client.interceptors.response.use(
      (response) => {
        // Transform backend response format {success: true/false, data: ...} to {status: 'success'/'error', data: ...}
        if (response.data && typeof response.data === 'object') {
          const backendResponse = response.data as any;
          if (backendResponse.hasOwnProperty('success')) {
            const transformedResponse = {
              status: backendResponse.success ? 'success' : 'error',
              data: backendResponse.data,
              message: backendResponse.message || backendResponse.error
            };
            
            // Handle pagination transformation
            if (backendResponse.pagination) {
              transformedResponse.data = {
                data: backendResponse.data || [],
                ...backendResponse.pagination,
                hasNext: backendResponse.pagination.page < backendResponse.pagination.pages,
                hasPrev: backendResponse.pagination.page > 1
              };
            }
            
            response.data = transformedResponse;
          }
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config;
        
        if (
          error.response?.status === HTTP_STATUS.UNAUTHORIZED &&
          originalRequest &&
          !(originalRequest as any)._retry
        ) {
          (originalRequest as any)._retry = true;
          
          try {
            const newToken = await this.refreshAccessToken();
            originalRequest.headers[REQUEST_HEADERS.AUTHORIZATION] = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            await this.clearTokens();
            throw refreshError;
          }
        }
        
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private async refreshAccessToken(): Promise<string> {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = this.performTokenRefresh();
    
    try {
      const newToken = await this.refreshTokenPromise;
      return newToken;
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    const refreshToken = await storage.getItemAsync(ENV.STORAGE_KEYS.REFRESH_TOKEN);
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(
        `${API_CONFIG.BASE_URL}/auth/refresh`,
        { refreshToken },
        { timeout: API_CONFIG.TIMEOUT }
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data.data;
      
      await storage.setItemAsync(ENV.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      if (newRefreshToken) {
        await storage.setItemAsync(ENV.STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
      }

      return accessToken;
    } catch (error) {
      await this.clearTokens();
      throw error;
    }
  }

  private async clearTokens(): Promise<void> {
    await storage.deleteMultipleAsync([
      ENV.STORAGE_KEYS.ACCESS_TOKEN,
      ENV.STORAGE_KEYS.REFRESH_TOKEN,
      ENV.STORAGE_KEYS.USER_DATA,
    ]);
  }

  private handleError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case HTTP_STATUS.BAD_REQUEST:
          return {
            message: (data as any)?.message || ERROR_MESSAGES.VALIDATION_ERROR,
            code: 'VALIDATION_ERROR',
            details: (data as any)?.details,
          };
        case HTTP_STATUS.UNAUTHORIZED:
          return {
            message: ERROR_MESSAGES.UNAUTHORIZED,
            code: 'UNAUTHORIZED',
          };
        case HTTP_STATUS.FORBIDDEN:
          return {
            message: ERROR_MESSAGES.FORBIDDEN,
            code: 'FORBIDDEN',
          };
        case HTTP_STATUS.NOT_FOUND:
          return {
            message: ERROR_MESSAGES.NOT_FOUND,
            code: 'NOT_FOUND',
          };
        case HTTP_STATUS.INTERNAL_SERVER_ERROR:
          return {
            message: ERROR_MESSAGES.SERVER_ERROR,
            code: 'SERVER_ERROR',
          };
        default:
          return {
            message: (data as any)?.message || ERROR_MESSAGES.UNKNOWN_ERROR,
            code: 'UNKNOWN_ERROR',
            details: data as Record<string, unknown>,
          };
      }
    } else if (error.request) {
      // Network error
      return {
        message: ERROR_MESSAGES.NETWORK,
        code: 'NETWORK_ERROR',
      };
    } else {
      // Something else happened
      return {
        message: error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
        code: 'UNKNOWN_ERROR',
      };
    }
  }

  // Generic HTTP methods - pure HTTP calls, no business logic
  async get<T = unknown>(
    endpoint: string, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.get(endpoint, config);
    return response.data;
  }

  async post<T = unknown>(
    endpoint: string, 
    data?: unknown, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.post(endpoint, data, config);
    return response.data;
  }

  async put<T = unknown>(
    endpoint: string, 
    data?: unknown, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.put(endpoint, data, config);
    return response.data;
  }

  async patch<T = unknown>(
    endpoint: string, 
    data?: unknown, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.patch(endpoint, data, config);
    return response.data;
  }

  async delete<T = unknown>(
    endpoint: string, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.delete(endpoint, config);
    return response.data;
  }

  // File upload method
  async upload<T = unknown>(
    endpoint: string,
    formData: FormData,
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void
  ): Promise<ApiResponse<T>> {
    const config: any = {
      headers: {
        [REQUEST_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.FORM_DATA,
      },
    };
    
    if (onUploadProgress) {
      config.onUploadProgress = onUploadProgress;
    }

    const response: AxiosResponse<ApiResponse<T>> = await this.client.post(
      endpoint,
      formData,
      config
    );
    return response.data;
  }

  // Get raw axios instance for advanced usage
  getClient(): AxiosInstance {
    return this.client;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;