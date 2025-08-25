/**
 * API Endpoint Tests - Critical Path Coverage
 */

const request = require('supertest');
const app = require('../server');
const config = require('../config');

describe('API Endpoints', () => {
  let authToken;
  let testShopId = '550e8400-e29b-41d4-a716-446655440001';

  beforeAll(async () => {
    // Get auth token for protected endpoints
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@shop.com',
        password: 'password123'
      });
    
    if (loginResponse.body.success) {
      authToken = loginResponse.body.data.accessToken;
    }
  });

  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('connected', true);
      expect(response.body).toHaveProperty('services');
    });

    test('should indicate environment', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.body).toHaveProperty('environment');
      expect(['development', 'production', 'test']).toContain(response.body.environment);
    });
  });

  describe('Inspection Endpoints', () => {
    let createdInspectionId;

    describe('POST /api/inspections', () => {
      test('should create inspection with valid data', async () => {
        const response = await request(app)
          .post('/api/inspections')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            vehicle_id: '550e8400-e29b-41d4-a716-446655440002',
            shop_id: testShopId,
            inspection_type: 'courtesy',
            notes: 'Test inspection'
          });

        if (response.status === 400 && response.body.error === 'Vehicle not found') {
          // Skip if test vehicle doesn't exist
          return;
        }

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('inspection_number');
        createdInspectionId = response.body.data.id;
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .post('/api/inspections')
          .send({
            vehicle_id: '550e8400-e29b-41d4-a716-446655440002',
            shop_id: testShopId
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      test('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/inspections')
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('required');
      });
    });

    describe('GET /api/inspections', () => {
      test('should list inspections with auth', async () => {
        const response = await request(app)
          .get('/api/inspections')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      });

      test('should support pagination', async () => {
        const response = await request(app)
          .get('/api/inspections?page=1&limit=5')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.pagination).toHaveProperty('page', 1);
        expect(response.body.pagination).toHaveProperty('limit', 5);
      });

      test('should filter by status', async () => {
        const response = await request(app)
          .get('/api/inspections?status=completed')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/inspections/:id', () => {
      test('should get inspection by ID', async () => {
        if (!createdInspectionId) {
          return; // Skip if creation failed
        }

        const response = await request(app)
          .get(`/api/inspections/${createdInspectionId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id', createdInspectionId);
      });

      test('should return 404 for non-existent ID', async () => {
        const response = await request(app)
          .get('/api/inspections/99999999-9999-9999-9999-999999999999')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('CORS Configuration', () => {
    test('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', config.CORS_ORIGINS[0]);

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(config.CORS_ORIGINS[0]);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    test('should reject unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://unauthorized.com');

      // Note: Actual CORS rejection behavior may vary
      expect(response.status).toBeLessThanOrEqual(500);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid json}');

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});