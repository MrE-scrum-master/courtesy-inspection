// Test setup configuration
// Global test configuration and utilities

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_courtesy_inspection';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.testUtils = {
  generateUUID: () => '12345678-1234-4567-8901-123456789012',
  mockUser: {
    id: '12345678-1234-4567-8901-123456789012',
    email: 'test@example.com',
    full_name: 'Test User',
    phone: '+1234567890',
    role: 'mechanic',
    shop_id: '87654321-4321-7654-0987-210987654321'
  },
  mockInspection: {
    id: '12345678-1234-4567-8901-123456789012',
    shop_id: '87654321-4321-7654-0987-210987654321',
    customer_id: '11111111-1111-1111-1111-111111111111',
    vehicle_id: '22222222-2222-2222-2222-222222222222',
    technician_id: '12345678-1234-4567-8901-123456789012',
    inspection_number: '24-0001',
    status: 'in_progress',
    checklist_data: {},
    started_at: new Date(),
    created_at: new Date(),
    updated_at: new Date()
  }
};

// Declare global types
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        generateUUID: () => string;
        mockUser: any;
        mockInspection: any;
      };
    }
  }
  
  var testUtils: {
    generateUUID: () => string;
    mockUser: any;
    mockInspection: any;
  };
}