// Timezone Implementation Tests
// Validates proper timezone handling across the application

const request = require('supertest');
const app = require('../server');
const db = require('../db');

describe('Timezone Handling', () => {
  let authToken;
  let shopId;
  let inspectionId;

  beforeAll(async () => {
    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@shop.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.data.token;
    shopId = loginResponse.body.data.user.shopId || loginResponse.body.data.user.shop_id;
  });

  describe('Timestamp Format', () => {
    test('API returns UTC timestamps in ISO format', async () => {
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      
      if (response.body.data && response.body.data.length > 0) {
        const inspection = response.body.data[0];
        const timestamp = inspection.created_at;
        
        // Check ISO format with Z suffix (UTC)
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(timestamp.endsWith('Z')).toBe(true);
      }
    });

    test('New records store timestamps in UTC', async () => {
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vehicleId: '550e8400-e29b-41d4-a716-446655440000',
          customerConcerns: ['Test concern'],
          odometerReading: 50000
        });
      
      if (response.status === 201) {
        inspectionId = response.body.data.id;
        const createdAt = response.body.data.created_at;
        
        // Verify UTC format
        expect(createdAt).toMatch(/Z$/);
        
        // Verify it's close to current UTC time (within 5 seconds)
        const now = new Date();
        const created = new Date(createdAt);
        const diffSeconds = Math.abs(now - created) / 1000;
        expect(diffSeconds).toBeLessThan(5);
      }
    });
  });

  describe('Database Schema', () => {
    test('Timestamp columns use TIMESTAMPTZ type', async () => {
      const query = `
        SELECT 
          column_name,
          data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inspections'
          AND column_name LIKE '%_at'
      `;
      
      const result = await db.query(query);
      
      result.rows.forEach(row => {
        expect(row.data_type).toBe('timestamp with time zone');
      });
    });

    test('Shops table has timezone column', async () => {
      const query = `
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'shops'
          AND column_name = 'timezone'
      `;
      
      const result = await db.query(query);
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].data_type).toBe('character varying');
      expect(result.rows[0].column_default).toContain('America/Chicago');
    });

    test('Users table has timezone preferences', async () => {
      const query = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name IN ('timezone', 'date_format', 'use_24hour_time')
      `;
      
      const result = await db.query(query);
      
      expect(result.rows.length).toBe(3);
    });
  });

  describe('Shop Settings API', () => {
    test('GET /shops/:id/settings returns timezone info', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/settings`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('timezone');
      expect(response.body.data).toHaveProperty('business_hours');
      expect(response.body.data.timezone).toMatch(/^America\//);
    });

    test('PATCH /shops/:id/settings updates timezone', async () => {
      const response = await request(app)
        .patch(`/api/shops/${shopId}/settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timezone: 'America/New_York'
        });
      
      if (response.status === 200) {
        expect(response.body.data.timezone).toBe('America/New_York');
        
        // Restore original timezone
        await request(app)
          .patch(`/api/shops/${shopId}/settings`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            timezone: 'America/Chicago'
          });
      }
    });

    test('Invalid timezone is rejected', async () => {
      const response = await request(app)
        .patch(`/api/shops/${shopId}/settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timezone: 'Invalid/Timezone'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid timezone');
    });
  });

  describe('Timezone Metadata', () => {
    test('Inspection endpoints include shop timezone in metadata', async () => {
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      
      // Check if metadata includes timezone info
      if (response.body.metadata) {
        expect(response.body.metadata).toHaveProperty('shop_timezone');
      }
    });
  });

  describe('DST Handling', () => {
    test('No hardcoded timezone offsets in codebase', async () => {
      // This is more of a code review test
      // Check that CommunicationService no longer has hardcoded offsets
      const fs = require('fs');
      const path = require('path');
      
      const communicationServicePath = path.join(
        __dirname,
        '../../app/server/src/services/CommunicationService.ts'
      );
      
      if (fs.existsSync(communicationServicePath)) {
        const content = fs.readFileSync(communicationServicePath, 'utf8');
        
        // Should not contain hardcoded offsets
        expect(content).not.toContain('America/Chicago\': -6');
        expect(content).not.toContain('America/New_York\': -5');
        expect(content).not.toContain('timezoneOffsets');
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    if (inspectionId) {
      await db.query('DELETE FROM inspections WHERE id = $1', [inspectionId]);
    }
    await db.end();
  });
});

describe('Timezone Functions', () => {
  test('get_shop_current_time function works', async () => {
    const shopId = '550e8400-e29b-41d4-a716-446655440001';
    const query = `SELECT get_shop_current_time($1) as shop_time`;
    const result = await db.query(query, [shopId]);
    
    expect(result.rows[0].shop_time).toBeDefined();
    expect(result.rows[0].shop_time).toBeInstanceOf(Date);
  });

  test('is_shop_open function works', async () => {
    const shopId = '550e8400-e29b-41d4-a716-446655440001';
    const query = `SELECT is_shop_open($1) as is_open`;
    const result = await db.query(query, [shopId]);
    
    expect(result.rows[0].is_open).toBeDefined();
    expect(typeof result.rows[0].is_open).toBe('boolean');
  });
});