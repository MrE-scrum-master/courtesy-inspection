/**
 * Comprehensive test setup configuration
 * Provides utilities for database testing, mocking, and test data
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_courtesy_inspection';

// Global test timeout
jest.setTimeout(30000);

// Database connection for tests
let testDbPool: Pool;

// Mock console methods in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Test database utilities
export class TestDatabase {
  static async setup(): Promise<Pool> {
    if (!testDbPool) {
      testDbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });
    }
    return testDbPool;
  }

  static async cleanup(): Promise<void> {
    if (testDbPool) {
      await testDbPool.end();
    }
  }

  static async clearTables(): Promise<void> {
    const pool = await TestDatabase.setup();
    
    // Clear all test data in reverse dependency order
    const tables = [
      'inspection_items',
      'photos',
      'inspections', 
      'customers',
      'users',
      'shops'
    ];

    for (const table of tables) {
      await pool.query(`DELETE FROM ${table} WHERE 1=1`);
    }
  }

  static async seedTestData(): Promise<any> {
    const pool = await TestDatabase.setup();
    
    // Create test shop
    const shopId = uuidv4();
    await pool.query(`
      INSERT INTO shops (id, name, address, phone, email) 
      VALUES ($1, 'Test Auto Shop', '123 Test St', '+1234567890', 'test@shop.com')
    `, [shopId]);

    // Create test users
    const adminId = uuidv4();
    const mechanicId = uuidv4();
    
    await pool.query(`
      INSERT INTO users (id, email, password_hash, full_name, role, shop_id, phone, is_active) 
      VALUES 
        ($1, 'admin@test.com', '$2a$10$hashedpassword', 'Test Admin', 'admin', $2, '+1234567890', true),
        ($3, 'mechanic@test.com', '$2a$10$hashedpassword', 'Test Mechanic', 'mechanic', $2, '+1234567891', true)
    `, [adminId, shopId, mechanicId]);

    // Create test customer
    const customerId = uuidv4();
    await pool.query(`
      INSERT INTO customers (id, shop_id, first_name, last_name, email, phone, address)
      VALUES ($1, $2, 'John', 'Doe', 'john@example.com', '+1234567892', '456 Customer St')
    `, [customerId, shopId]);

    return {
      shopId,
      adminId,
      mechanicId,
      customerId
    };
  }
}

// Test data factories
export const TestDataFactory = {
  user: (overrides: any = {}) => ({
    id: uuidv4(),
    email: 'test@example.com',
    password_hash: '$2a$10$hashedpassword',
    full_name: 'Test User',
    phone: '+1234567890',
    role: 'mechanic',
    shop_id: uuidv4(),
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  }),

  customer: (overrides: any = {}) => ({
    id: uuidv4(),
    shop_id: uuidv4(),
    first_name: 'John',
    last_name: 'Doe',
    email: 'customer@example.com',
    phone: '+1234567890',
    address: '123 Customer St',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  }),

  inspection: (overrides: any = {}) => ({
    id: uuidv4(),
    shop_id: uuidv4(),
    customer_id: uuidv4(),
    vehicle_id: uuidv4(),
    technician_id: uuidv4(),
    inspection_number: `24-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
    status: 'in_progress',
    checklist_data: {},
    started_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  }),

  inspectionItem: (overrides: any = {}) => ({
    id: uuidv4(),
    inspection_id: uuidv4(),
    category: 'brakes',
    item_name: 'Brake Pads',
    status: 'good',
    notes: 'Test notes',
    urgency_level: 'low',
    recommendation: 'monitor',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  })
};

// JWT Token utilities for testing
export const TestAuth = {
  generateTestToken: (payload: any = {}) => {
    const jwt = require('jsonwebtoken');
    const defaultPayload = {
      userId: uuidv4(),
      email: 'test@example.com',
      role: 'mechanic',
      shopId: uuidv4()
    };
    
    return jwt.sign(
      { ...defaultPayload, ...payload },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },

  createAuthHeaders: (token?: string) => ({
    Authorization: `Bearer ${token || TestAuth.generateTestToken()}`
  })
};

// Mock services for testing
export const MockServices = {
  smsService: {
    sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'test-msg-id' }),
    generateShortLink: jest.fn().mockResolvedValue('https://short.ly/test123'),
    calculateCost: jest.fn().mockReturnValue(0.02)
  },

  voiceService: {
    processVoiceInput: jest.fn().mockResolvedValue({
      category: 'brakes',
      item: 'brake_pads',
      status: 'worn',
      notes: 'Test voice note',
      confidence: 0.95
    })
  },

  fileUploadService: {
    uploadPhoto: jest.fn().mockResolvedValue({
      id: uuidv4(),
      filename: 'test-photo.jpg',
      url: 'https://example.com/photos/test.jpg'
    })
  }
};

// Global test utilities
global.testUtils = {
  TestDatabase,
  TestDataFactory,
  TestAuth,
  MockServices,
  generateUUID: uuidv4,
  
  // Helper for creating test requests
  createTestRequest: (method: string, path: string, data?: any, headers?: any) => ({
    method,
    path,
    body: data,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }),
  
  // Helper for asserting API responses
  expectApiSuccess: (response: any, expectedStatus = 200) => {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toBeDefined();
    if (response.body.error) {
      throw new Error(`API Error: ${response.body.error}`);
    }
  },
  
  expectApiError: (response: any, expectedStatus: number, expectedMessage?: string) => {
    expect(response.status).toBe(expectedStatus);
    expect(response.body.error).toBeDefined();
    if (expectedMessage) {
      expect(response.body.error).toContain(expectedMessage);
    }
  }
};

// Setup and teardown hooks
beforeAll(async () => {
  await TestDatabase.setup();
});

afterAll(async () => {
  await TestDatabase.cleanup();
});

beforeEach(async () => {
  // Clear database before each test
  await TestDatabase.clearTables();
  
  // Reset all mocks
  jest.clearAllMocks();
});

// Declare global types
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        TestDatabase: typeof TestDatabase;
        TestDataFactory: typeof TestDataFactory;
        TestAuth: typeof TestAuth;
        MockServices: typeof MockServices;
        generateUUID: typeof uuidv4;
        createTestRequest: (method: string, path: string, data?: any, headers?: any) => any;
        expectApiSuccess: (response: any, expectedStatus?: number) => void;
        expectApiError: (response: any, expectedStatus: number, expectedMessage?: string) => void;
      };
    }
  }
  
  var testUtils: {
    TestDatabase: typeof TestDatabase;
    TestDataFactory: typeof TestDataFactory;
    TestAuth: typeof TestAuth;
    MockServices: typeof MockServices;
    generateUUID: typeof uuidv4;
    createTestRequest: (method: string, path: string, data?: any, headers?: any) => any;
    expectApiSuccess: (response: any, expectedStatus?: number) => void;
    expectApiError: (response: any, expectedStatus: number, expectedMessage?: string) => void;
  };
}

export default global.testUtils;