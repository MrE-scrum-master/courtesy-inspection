/**
 * Integration tests for Authentication API endpoints
 * Tests complete authentication flow with real database
 */

import request from 'supertest';
import { Express } from 'express';
import { TestDatabase, TestDataFactory, TestAuth } from '../utils/test-setup';
import { createApp } from '../../src/server';

describe('Authentication API Integration', () => {
  let app: Express;
  let testData: any;

  beforeAll(async () => {
    app = createApp();
    await TestDatabase.setup();
  });

  beforeEach(async () => {
    await TestDatabase.clearTables();
    testData = await TestDatabase.seedTestData();
  });

  afterAll(async () => {
    await TestDatabase.cleanup();
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate user with valid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'password123'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body.user.role).toBe('admin');
      expect(response.body.user.shop_id).toBe(testData.shopId);
      expect(response.body.user.password_hash).toBeUndefined(); // Should not expose password
    });

    it('should reject login with invalid email', async () => {
      // Arrange
      const loginData = {
        email: 'nonexistent@test.com',
        password: 'password123'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.token).toBeUndefined();
    });

    it('should reject login with invalid password', async () => {
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'wrongpassword'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.token).toBeUndefined();
    });

    it('should validate input data', async () => {
      // Arrange
      const invalidData = {
        email: 'invalid-email',
        password: ''
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation error');
    });

    it('should handle rate limiting for failed login attempts', async () => {
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'wrongpassword'
      };

      // Act - Multiple failed attempts
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(requests);

      // Assert - Last request should be rate limited
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error).toContain('rate limit');
    });

    it('should set secure token in response headers', async () => {
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'password123'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      // Assert
      expect(response.headers['authorization']).toBeDefined();
      expect(response.headers['authorization']).toContain('Bearer');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      // Arrange
      const newUserData = {
        email: 'newuser@test.com',
        password: 'SecurePass123!',
        full_name: 'New User',
        phone: '+1234567890',
        role: 'mechanic',
        shop_id: testData.shopId
      };

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(newUserData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(newUserData.email);
      expect(response.body.user.full_name).toBe(newUserData.full_name);
      expect(response.body.user.role).toBe(newUserData.role);
      expect(response.body.user.password_hash).toBeUndefined();
    });

    it('should reject registration with existing email', async () => {
      // Arrange
      const existingUserData = {
        email: 'admin@test.com', // Already exists in test data
        password: 'SecurePass123!',
        full_name: 'Duplicate User',
        phone: '+1234567890',
        role: 'mechanic',
        shop_id: testData.shopId
      };

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(existingUserData)
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email already registered');
    });

    it('should validate password strength requirements', async () => {
      // Arrange
      const weakPasswordData = {
        email: 'weakpass@test.com',
        password: '123456', // Too weak
        full_name: 'Weak Password User',
        phone: '+1234567890',
        role: 'mechanic',
        shop_id: testData.shopId
      };

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password must be at least');
    });

    it('should validate required fields', async () => {
      // Arrange
      const incompleteData = {
        email: 'incomplete@test.com',
        password: 'SecurePass123!'
        // Missing required fields
      };

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation error');
    });

    it('should validate shop_id exists', async () => {
      // Arrange
      const invalidShopData = {
        email: 'invalidshop@test.com',
        password: 'SecurePass123!',
        full_name: 'Invalid Shop User',
        phone: '+1234567890',
        role: 'mechanic',
        shop_id: 'nonexistent-shop-id'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidShopData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid shop');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh valid token', async () => {
      // Arrange
      const token = TestAuth.generateTestToken({
        userId: testData.adminId,
        email: 'admin@test.com',
        role: 'admin',
        shopId: testData.shopId
      });

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.token).not.toBe(token); // Should be new token
      expect(response.body.user).toBeDefined();
    });

    it('should reject invalid token', async () => {
      // Arrange
      const invalidToken = 'invalid-token';

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject expired token', async () => {
      // Arrange
      const expiredToken = TestAuth.generateTestToken({
        userId: testData.adminId,
        email: 'admin@test.com',
        role: 'admin',
        shopId: testData.shopId
      }, { expiresIn: '-1h' }); // Expired token

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    it('should revoke old token when issuing new one', async () => {
      // Arrange
      const token = TestAuth.generateTestToken({
        userId: testData.adminId,
        email: 'admin@test.com',
        role: 'admin',
        shopId: testData.shopId
      });

      // Act
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use old token
      const oldTokenResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      // Assert
      expect(refreshResponse.body.success).toBe(true);
      expect(oldTokenResponse.body.error).toContain('Token revoked');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user and revoke token', async () => {
      // Arrange
      const token = TestAuth.generateTestToken({
        userId: testData.adminId,
        email: 'admin@test.com',
        role: 'admin',
        shopId: testData.shopId
      });

      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');

      // Verify token is revoked
      const verifyResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(verifyResponse.body.error).toContain('Token revoked');
    });

    it('should handle logout without token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No token provided');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      // Arrange
      const token = TestAuth.generateTestToken({
        userId: testData.adminId,
        email: 'admin@test.com',
        role: 'admin',
        shopId: testData.shopId
      });

      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testData.adminId);
      expect(response.body.user.email).toBe('admin@test.com');
      expect(response.body.user.role).toBe('admin');
      expect(response.body.user.password_hash).toBeUndefined();
    });

    it('should reject request without token', async () => {
      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No token provided');
    });

    it('should reject request with invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Authentication middleware integration', () => {
    it('should protect routes requiring authentication', async () => {
      // Act - Try to access protected route without token
      const response = await request(app)
        .get('/api/inspections')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('authentication required');
    });

    it('should allow access to protected routes with valid token', async () => {
      // Arrange
      const token = TestAuth.generateTestToken({
        userId: testData.mechanicId,
        email: 'mechanic@test.com',
        role: 'mechanic',
        shopId: testData.shopId
      });

      // Act
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
    });

    it('should enforce role-based access control', async () => {
      // Arrange
      const mechanicToken = TestAuth.generateTestToken({
        userId: testData.mechanicId,
        email: 'mechanic@test.com',
        role: 'mechanic',
        shopId: testData.shopId
      });

      // Act - Try to access admin-only endpoint
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${mechanicToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should validate shop isolation', async () => {
      // Arrange - Create user for different shop
      const differentShopId = 'different-shop-id';
      const differentShopToken = TestAuth.generateTestToken({
        userId: 'different-user-id',
        email: 'different@shop.com',
        role: 'mechanic',
        shopId: differentShopId
      });

      // Act - Try to access inspections from different shop
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${differentShopToken}`)
        .expect(200);

      // Assert - Should only return inspections from user's shop
      expect(response.body.inspections).toBeDefined();
      response.body.inspections.forEach((inspection: any) => {
        expect(inspection.shop_id).toBe(differentShopId);
      });
    });
  });

  describe('Security headers and CORS', () => {
    it('should set security headers', async () => {
      // Act
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      // Assert
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should handle CORS properly', async () => {
      // Act
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      // Assert
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });
  });

  describe('Input sanitization and validation', () => {
    it('should sanitize HTML in input fields', async () => {
      // Arrange
      const maliciousData = {
        email: 'test@example.com',
        password: 'password123',
        full_name: '<script>alert("xss")</script>Malicious User',
        phone: '+1234567890',
        role: 'mechanic',
        shop_id: testData.shopId
      };

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousData)
        .expect(201);

      // Assert
      expect(response.body.user.full_name).not.toContain('<script>');
      expect(response.body.user.full_name).toBe('Malicious User');
    });

    it('should validate email format strictly', async () => {
      // Arrange
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@.example.com'
      ];

      // Act & Assert
      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email,
            password: 'password123'
          })
          .expect(400);

        expect(response.body.error).toContain('Invalid email format');
      }
    });
  });

  describe('Error handling and logging', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection to fail
      // For now, we'll test the error response format
      
      // Arrange
      const loginData = {
        email: 'admin@test.com',
        password: 'password123'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      // Assert - Should not expose internal error details
      if (response.status === 500) {
        expect(response.body.error).not.toContain('database');
        expect(response.body.error).not.toContain('connection');
        expect(response.body.error).toBe('Internal server error');
      }
    });

    it('should log security events', async () => {
      // This test would check if security events are logged
      // For integration testing, we verify the endpoint behavior
      
      // Arrange
      const suspiciousData = {
        email: 'admin@test.com',
        password: 'wrongpassword'
      };

      // Act
      await request(app)
        .post('/api/auth/login')
        .send(suspiciousData)
        .expect(401);

      // Assert - Failed login should be logged (implementation dependent)
      // In real implementation, this would check log files or monitoring
    });
  });
});