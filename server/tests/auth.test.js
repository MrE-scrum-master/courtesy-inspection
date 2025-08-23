/**
 * Authentication Tests - Critical Path Coverage
 */

const request = require('supertest');
const app = require('../server');
const Database = require('../db');

// Test database connection
const db = new Database();

describe('Authentication Endpoints', () => {
  // Use existing admin user for tests
  const testUser = {
    email: 'admin@shop.com',
    password: 'password123'
  };

  afterAll(async () => {
    await db.close();
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUser);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toHaveProperty('email', testUser.email);
    });

    test('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@shop.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should require email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('JWT Token Validation', () => {
    let validToken;

    beforeAll(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(testUser);
      validToken = loginResponse.body.data.accessToken;
    });

    test('should accept valid JWT token', async () => {
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should reject missing JWT token', async () => {
      const response = await request(app)
        .get('/api/inspections');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });
  });
});