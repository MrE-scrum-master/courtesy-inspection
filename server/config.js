/**
 * Server Configuration - Single Source of Truth
 * Centralized configuration for the backend server
 */

require('dotenv').config();

const isDevelopment = process.env.NODE_ENV !== 'production';

const config = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 8847,
  
  // URLs
  API_URL: isDevelopment 
    ? 'http://localhost:8847/api'
    : 'https://api.courtesyinspection.com/api',
  
  APP_URL: isDevelopment
    ? 'http://localhost:3000'
    : 'https://app.courtesyinspection.com',
  
  // CORS Origins
  CORS_ORIGINS: isDevelopment ? [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://localhost:8847',
    'http://localhost:19006',
    'exp://localhost:8081'
  ] : [
    'https://app.courtesyinspection.com',
    'https://courtesyinspection.com',
    'https://api.courtesyinspection.com'
  ],
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  
  // Features
  ENABLE_SMS: process.env.ENABLE_SMS === 'true',
  
  // File Upload
  UPLOAD_PATH: process.env.UPLOAD_PATH || 'data/uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100')
};

// Add any additional origins from environment
if (process.env.CORS_ORIGINS) {
  const envOrigins = process.env.CORS_ORIGINS.split(',').map(o => o.trim());
  envOrigins.forEach(origin => {
    if (!config.CORS_ORIGINS.includes(origin)) {
      config.CORS_ORIGINS.push(origin);
    }
  });
}

module.exports = config;