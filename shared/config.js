/**
 * Centralized Configuration - Single Source of Truth
 * This file defines all environment-specific configuration
 */

const config = {
  production: {
    API_URL: 'https://api.courtesyinspection.com/api',
    APP_URL: 'https://app.courtesyinspection.com',
    CORS_ORIGINS: [
      'https://app.courtesyinspection.com',
      'https://courtesyinspection.com',
      'https://api.courtesyinspection.com'
    ],
    ENVIRONMENT: 'production'
  },
  development: {
    API_URL: 'http://localhost:8847/api',
    APP_URL: 'http://localhost:3000',
    CORS_ORIGINS: [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://localhost:8847',
      'http://localhost:19006',
      'exp://localhost:8081'
    ],
    ENVIRONMENT: 'development'
  }
};

// Determine environment
const getEnvironment = () => {
  // Server-side Node.js
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'production' ? 'production' : 'development';
  }
  
  // Client-side browser
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isProduction = !hostname.includes('localhost') && !hostname.includes('127.0.0.1');
    return isProduction ? 'production' : 'development';
  }
  
  // Default to development
  return 'development';
};

const currentEnv = getEnvironment();
const currentConfig = config[currentEnv];

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = currentConfig;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return currentConfig; });
}

// Also export as named exports for ES modules
export default currentConfig;
export const { API_URL, APP_URL, CORS_ORIGINS, ENVIRONMENT } = currentConfig;