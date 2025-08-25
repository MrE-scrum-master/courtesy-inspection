// Simplified Environment Configuration - Using Centralized Config
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Import centralized config
const getConfig = () => {
  // Production detection - check this FIRST before env vars
  const isProduction = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      return !hostname.includes('localhost') && !hostname.includes('127.0.0.1');
    }
    return !__DEV__;
  };

  // For localhost, ALWAYS use development config
  if (!isProduction()) {
    // Development config with platform-specific API URLs
    const devApiUrl = Platform.OS === 'android' 
      ? 'http://10.0.2.2:8847/api'  // Android emulator
      : 'http://localhost:8847/api'; // iOS/Web - Server running on 8847

    return {
      API_URL: devApiUrl,
      APP_URL: 'http://localhost:9546', // Canonical web port
      ENVIRONMENT: 'development'
    };
  }

  // Check for environment variable for production builds
  if (process.env.EXPO_PUBLIC_API_URL) {
    return {
      API_URL: process.env.EXPO_PUBLIC_API_URL,
      APP_URL: process.env.EXPO_PUBLIC_APP_URL || 'https://app.courtesyinspection.com',
      ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || 'production'
    };
  }

  // Default production config
  return {
    API_URL: 'https://api.courtesyinspection.com/api',
    APP_URL: 'https://app.courtesyinspection.com',
    ENVIRONMENT: 'production'
  };
};

const config = getConfig();

export const ENV = {
  // Core configuration from centralized config
  API_URL: config.API_URL,
  APP_URL: config.APP_URL,
  ENVIRONMENT: config.ENVIRONMENT,
  IS_PRODUCTION: config.ENVIRONMENT === 'production',
  IS_DEVELOPMENT: config.ENVIRONMENT === 'development',
  IS_EXPO_GO: Constants.appOwnership === 'expo',
  PLATFORM: Platform.OS,
  
  // Feature flags
  ENABLE_SMS: true,
  ENABLE_VOICE: true,
  ENABLE_DEBUG_LOGGING: config.ENVIRONMENT === 'development',
  
  // Timeouts
  API_TIMEOUT: 10000,
  UPLOAD_TIMEOUT: 30000,
  
  // Storage keys (consistent across platforms)
  STORAGE_KEYS: {
    ACCESS_TOKEN: '@courtesy/access_token',
    REFRESH_TOKEN: '@courtesy/refresh_token',
    USER_DATA: '@courtesy/user_data',
    THEME: '@courtesy/theme',
    SETTINGS: '@courtesy/settings',
  }
};

// Log configuration in development only
if (ENV.IS_DEVELOPMENT && Platform.OS === 'web') {
  console.log('🚀 Environment Configuration:', {
    API_URL: ENV.API_URL,
    APP_URL: ENV.APP_URL,
    Platform: Platform.OS,
    Environment: ENV.ENVIRONMENT,
    Hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
  });
}

export default ENV;