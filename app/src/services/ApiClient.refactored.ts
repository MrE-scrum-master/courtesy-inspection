/**
 * Refactored API Client - SOLID/DRY/KISS Compliant
 * Implements interceptors, automatic token management, and error handling
 */
import { storage } from '@/utils/storage';
import { API_CONFIG, STORAGE_KEYS } from '@/constants';

// ==================== TYPES (SOLID - Interface Segregation) ====================

interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

// ==================== INTERCEPTORS (SOLID - Single Responsibility) ====================

class RequestInterceptor {
  async process(config: ApiRequestConfig): Promise<ApiRequestConfig> {
    // Add auth token
    const token = await storage.get(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    // Add default headers
    config.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...config.headers,
    };

    return config;
  }
}

class ResponseInterceptor {
  async process<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      throw await this.createError(response);
    }

    const data = await this.parseResponse<T>(response);
    
    return {
      data,
      status: response.status,
      headers: response.headers,
    };
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const json = await response.json();
      // Handle wrapped responses
      return json.data !== undefined ? json.data : json;
    }
    
    return response.text() as any;
  }

  private async createError(response: Response): Promise<ApiError> {
    let message = `Request failed with status ${response.status}`;
    let details = null;

    try {
      const errorData = await response.json();
      message = errorData.error || errorData.message || message;
      details = errorData;
    } catch {
      // Response wasn't JSON
    }

    return {
      message,
      status: response.status,
      code: response.status.toString(),
      details,
    };
  }
}

// ==================== TOKEN MANAGER (DRY - Centralized token logic) ====================

class TokenManager {
  private refreshPromise: Promise<void> | null = null;

  async refreshToken(): Promise<void> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();
    
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<void> {
    const refreshToken = await storage.get(STORAGE_KEYS.REFRESH_TOKEN);
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed, clear auth and redirect to login
      await this.clearAuth();
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    await storage.set(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
    await storage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
  }

  private async clearAuth(): Promise<void> {
    await storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
    await storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    await storage.remove(STORAGE_KEYS.USER_DATA);
  }
}

// ==================== API CLIENT (KISS - Simple public interface) ====================

class ApiClient {
  private requestInterceptor = new RequestInterceptor();
  private responseInterceptor = new ResponseInterceptor();
  private tokenManager = new TokenManager();
  private baseURL = API_CONFIG.BASE_URL;

  // Simple public methods
  async get<T = any>(url: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'GET', url, params });
  }

  async post<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data });
  }

  async delete<T = any>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', url });
  }

  async patch<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, data });
  }

  // Core request method
  private async request<T>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    // Apply request interceptor
    const processedConfig = await this.requestInterceptor.process(config);
    
    // Build URL
    const url = this.buildURL(processedConfig.url, processedConfig.params);
    
    // Make request
    const response = await this.executeRequest(url, processedConfig);
    
    // Handle 401 with token refresh
    if (response.status === 401) {
      try {
        await this.tokenManager.refreshToken();
        // Retry with new token
        const retryConfig = await this.requestInterceptor.process(config);
        const retryResponse = await this.executeRequest(url, retryConfig);
        return this.responseInterceptor.process<T>(retryResponse);
      } catch {
        // Refresh failed, return original 401
      }
    }
    
    // Process response
    return this.responseInterceptor.process<T>(response);
  }

  private buildURL(path: string, params?: Record<string, any>): string {
    const url = path.startsWith('http') ? path : `${this.baseURL}${path}`;
    
    if (!params) return url;
    
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  private async executeRequest(url: string, config: ApiRequestConfig): Promise<Response> {
    const controller = new AbortController();
    const timeout = config.timeout || API_CONFIG.TIMEOUT;
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      return await fetch(url, {
        method: config.method,
        headers: config.headers,
        body: config.data ? JSON.stringify(config.data) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ==================== EXPORT (YAGNI - Only essential exports) ====================

export const apiClient = new ApiClient();
export type { ApiResponse, ApiError };
export default apiClient;