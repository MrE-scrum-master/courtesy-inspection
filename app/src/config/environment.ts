// Simplified Environment Configuration
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Simple production detection
const isProduction = () => {
  // For web, check if we're NOT on localhost
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return !hostname.includes('localhost') && !hostname.includes('127.0.0.1');
  }
  // For mobile, use __DEV__ flag
  return !__DEV__;
};

// Get the appropriate API URL
const getApiUrl = () => {
  // First check if we have an explicit EXPO_PUBLIC_API_URL
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Force production URL for now since we're deployed
  // This ensures the correct API URL is used
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If we're on the production domain, use production API
    if (hostname === 'app.courtesyinspection.com' || hostname.includes('railway.app')) {
      return 'https://api.courtesyinspection.com/api';
    }
  }
  
  const isProd = isProduction();
  
  // Production - use new API domain
  if (isProd) {
    return 'https://api.courtesyinspection.com/api';
  }
  
  // Development URLs by platform
  switch (Platform.OS) {
    case 'web':
      return 'http://localhost:8847/api';
    case 'ios':
      return 'http://localhost:8847/api';
    case 'android':
      return 'http://10.0.2.2:8847/api'; // Android emulator localhost
    default:
      return 'http://localhost:8847/api';
  }
};

export const ENV = {
  // Core configuration
  API_URL: getApiUrl(),
  IS_PRODUCTION: isProduction(),
  IS_DEVELOPMENT: !isProduction(),
  IS_EXPO_GO: Constants.appOwnership === 'expo',
  PLATFORM: Platform.OS,
  
  // Feature flags
  ENABLE_SMS: true,
  ENABLE_VOICE: true,
  ENABLE_DEBUG_LOGGING: !isProduction(),
  
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
if (!isProduction() && Platform.OS === 'web') {
  console.log('🚀 Environment Configuration:', {
    API_URL: ENV.API_URL,
    Platform: Platform.OS,
    IsProduction: ENV.IS_PRODUCTION,
    Hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
  });
}

export default ENV;