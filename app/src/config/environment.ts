// Simplified Environment Configuration - Using Centralized Config
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Import centralized config
const getConfig = () => {
  // Check for environment variable first
  if (process.env.EXPO_PUBLIC_API_URL) {
    return {
      API_URL: process.env.EXPO_PUBLIC_API_URL,
      APP_URL: process.env.EXPO_PUBLIC_APP_URL || 'https://app.courtesyinspection.com',
      ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || 'production'
    };
  }

  // Production detection
  const isProduction = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      return !hostname.includes('localhost') && !hostname.includes('127.0.0.1');
    }
    return !__DEV__;
  };

  // Return config based on environment
  if (isProduction()) {
    return {
      API_URL: 'https://api.courtesyinspection.com/api',
      APP_URL: 'https://app.courtesyinspection.com',
      ENVIRONMENT: 'production'
    };
  }

  // Development config with platform-specific API URLs
  const devApiUrl = Platform.OS === 'android' 
    ? 'http://10.0.2.2:8847/api'  // Android emulator
    : 'http://localhost:8847/api'; // iOS/Web

  return {
    API_URL: devApiUrl,
    APP_URL: 'http://localhost:3000',
    ENVIRONMENT: 'development'
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