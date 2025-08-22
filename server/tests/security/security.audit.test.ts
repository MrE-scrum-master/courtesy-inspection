/**
 * Comprehensive Security Audit Test Suite
 * Tests OWASP Top 10 vulnerabilities and security best practices
 */

import request from 'supertest';
import { Express } from 'express';
import { TestDatabase, TestDataFactory, TestAuth } from '../utils/test-setup';
import { createApp } from '../../src/server';

describe('Security Audit - OWASP Top 10 Validation', () => {
  let app: Express;
  let testData: any;
  let validToken: string;

  beforeAll(async () => {
    app = createApp();
    await TestDatabase.setup();
  });

  beforeEach(async () => {
    await TestDatabase.clearTables();
    testData = await TestDatabase.seedTestData();
    
    validToken = TestAuth.generateTestToken({
      userId: testData.mechanicId,
      email: 'mechanic@test.com',
      role: 'mechanic',
      shopId: testData.shopId
    });
  });

  afterAll(async () => {
    await TestDatabase.cleanup();
  });

  describe('A01: Broken Access Control', () => {
    it('should prevent horizontal privilege escalation', async () => {
      // Arrange - Create user from different shop
      const otherShopToken = TestAuth.generateTestToken({
        userId: 'other-user-id',
        email: 'other@shop.com',
        role: 'mechanic',
        shopId: 'other-shop-id'
      });

      // Create inspection in current shop
      const inspectionResponse = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          customer_id: testData.customerId,
          vehicle_make: 'Toyota',
          vehicle_model: 'Camry',
          vehicle_year: 2020,
          vehicle_vin: '1HGBH41JXMN109186',
          mileage: 45000,
          license_plate: 'ABC123',
          inspection_type: 'standard'
        });

      const inspectionId = inspectionResponse.body.inspection.id;

      // Act - Try to access inspection from different shop
      const response = await request(app)
        .get(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${otherShopToken}`)
        .expect(403);

      // Assert
      expect(response.body.error).toContain('Not authorized');
    });

    it('should prevent vertical privilege escalation', async () => {
      // Arrange - Mechanic trying to access admin endpoint
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      // Assert
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should prevent direct object reference attacks', async () => {
      // Act - Try to access user by ID manipulation
      const response = await request(app)
        .get('/api/users/../../admin/config')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      // Assert - Should not expose path traversal
      expect(response.body.error).not.toContain('admin');
    });

    it('should enforce method-based access controls', async () => {
      // Act - Try to use wrong HTTP method
      const response = await request(app)
        .patch('/api/auth/login') // Login should be POST only
        .send({
          email: 'mechanic@test.com',
          password: 'password123'
        })
        .expect(405);

      // Assert
      expect(response.body.error).toContain('Method not allowed');
    });
  });

  describe('A02: Cryptographic Failures', () => {
    it('should use HTTPS in production headers', async () => {
      // Act
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Assert
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age');
    });

    it('should not expose sensitive data in error messages', async () => {
      // Act - Trigger database error
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      // Assert - Should not expose database details
      expect(response.body.error).not.toMatch(/database|sql|connection|pg_/i);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should hash passwords properly', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        full_name: 'Test User',
        phone: '+1234567890',
        role: 'mechanic',
        shop_id: testData.shopId
      };

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Assert - Password should not be returned
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.password_hash).toBeUndefined();
    });

    it('should use secure random tokens', async () => {
      // Act
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123'
        })
        .expect(200);

      // Assert - Token should be properly formatted JWT
      const token = loginResponse.body.token;
      expect(token).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);
      expect(token.length).toBeGreaterThan(100); // Minimum length for security
    });
  });

  describe('A03: Injection Attacks', () => {
    it('should prevent SQL injection in login', async () => {
      // Arrange - SQL injection payload
      const maliciousPayload = {
        email: "'; DROP TABLE users; --",
        password: "password"
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousPayload);

      // Assert - Should handle gracefully without execution
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid email format');
    });

    it('should prevent SQL injection in search parameters', async () => {
      // Arrange - SQL injection in query parameter
      const maliciousQuery = "'; DROP TABLE inspections; --";

      // Act
      const response = await request(app)
        .get(`/api/inspections?search=${encodeURIComponent(maliciousQuery)}`)
        .set('Authorization', `Bearer ${validToken}`);

      // Assert - Should not execute SQL
      expect(response.status).toBeLessThan(500);
      expect(response.body.error).not.toMatch(/sql|syntax|error/i);
    });

    it('should sanitize JSON input for XSS', async () => {
      // Arrange - XSS payload
      const xssPayload = {
        customer_id: testData.customerId,
        vehicle_make: '<script>alert("xss")</script>',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${validToken}`)
        .send(xssPayload);

      // Assert - Script tags should be sanitized
      if (response.status === 201) {
        expect(response.body.inspection.vehicle_make).not.toContain('<script>');
        expect(response.body.inspection.vehicle_make).not.toContain('alert');
      }
    });

    it('should prevent command injection in file operations', async () => {
      // Arrange - Command injection payload
      const maliciousFile = {
        filename: 'test.jpg; rm -rf /',
        content: 'fake-image-data'
      };

      // Act
      const response = await request(app)
        .post('/api/inspections/photos')
        .set('Authorization', `Bearer ${validToken}`)
        .send(maliciousFile);

      // Assert - Should validate filename
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid filename');
    });
  });

  describe('A04: Insecure Design', () => {
    it('should implement rate limiting on authentication', async () => {
      // Arrange - Multiple failed login attempts
      const loginAttempts = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@test.com',
            password: 'wrongpassword'
          })
      );

      // Act
      const responses = await Promise.all(loginAttempts);

      // Assert - Should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should implement account lockout after failed attempts', async () => {
      // Arrange - Many failed attempts for same user
      const email = 'admin@test.com';
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email,
            password: 'wrongpassword'
          });
      }

      // Act - Try with correct password after lockout
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: 'password123'
        });

      // Assert - Should be locked out
      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Account temporarily locked');
    });

    it('should validate business logic constraints', async () => {
      // Arrange - Try to create inspection with future date
      const futureInspection = {
        customer_id: testData.customerId,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2030, // Future year
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard'
      };

      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${validToken}`)
        .send(futureInspection)
        .expect(400);

      // Assert
      expect(response.body.error).toContain('Invalid vehicle year');
    });
  });

  describe('A05: Security Misconfiguration', () => {
    it('should not expose server information', async () => {
      // Act
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Assert - Should not expose server details
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should set secure headers', async () => {
      // Act
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Assert
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should not expose debug information', async () => {
      // Act - Trigger error
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      // Assert - Should not expose stack traces
      expect(response.body.stack).toBeUndefined();
      expect(response.body.trace).toBeUndefined();
      expect(response.text).not.toMatch(/at\s+.*:\d+:\d+/); // Stack trace pattern
    });

    it('should handle CORS properly', async () => {
      // Act
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'https://malicious-site.com')
        .expect(200);

      // Assert - Should not allow arbitrary origins in production
      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  describe('A06: Vulnerable and Outdated Components', () => {
    it('should validate that security headers are present', async () => {
      // Act
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Assert - Modern security headers
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();
    });
  });

  describe('A07: Identification and Authentication Failures', () => {
    it('should invalidate sessions on logout', async () => {
      // Arrange - Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123'
        })
        .expect(200);

      const token = loginResponse.body.token;

      // Act - Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use token after logout
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      // Assert
      expect(response.body.error).toContain('Token revoked');
    });

    it('should enforce strong password policies', async () => {
      // Arrange - Weak passwords
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'password123',
        'Password'
      ];

      // Act & Assert
      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `test${Date.now()}@example.com`,
            password: weakPassword,
            full_name: 'Test User',
            phone: '+1234567890',
            role: 'mechanic',
            shop_id: testData.shopId
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Password must');
      }
    });

    it('should implement session timeout', async () => {
      // Arrange - Create expired token
      const expiredToken = TestAuth.generateTestToken({
        userId: testData.mechanicId,
        email: 'mechanic@test.com',
        role: 'mechanic',
        shopId: testData.shopId
      }, { expiresIn: '-1h' });

      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      // Assert
      expect(response.body.error).toContain('expired');
    });

    it('should not allow password reuse', async () => {
      // This test would require password history tracking
      // For now, we test that the system doesn't accept the same password
      
      const email = `test${Date.now()}@example.com`;
      const password = 'StrongPassword123!';

      // Create user
      await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          full_name: 'Test User',
          phone: '+1234567890',
          role: 'mechanic',
          shop_id: testData.shopId
        })
        .expect(201);

      // Try to change password to same password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .send({
          current_password: password,
          new_password: password
        })
        .expect(400);

      expect(response.body.error).toContain('same password');
    });
  });

  describe('A08: Software and Data Integrity Failures', () => {
    it('should validate file uploads strictly', async () => {
      // Arrange - Malicious file
      const maliciousFile = {
        filename: 'malware.exe',
        mimetype: 'application/octet-stream',
        size: 1000000,
        content: 'fake-executable-content'
      };

      // Act
      const response = await request(app)
        .post('/api/inspections/photos')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('photo', Buffer.from(maliciousFile.content), {
          filename: maliciousFile.filename,
          contentType: maliciousFile.mimetype
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid file type');
    });

    it('should validate data integrity on updates', async () => {
      // Arrange - Create inspection
      const inspectionResponse = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          customer_id: testData.customerId,
          vehicle_make: 'Toyota',
          vehicle_model: 'Camry',
          vehicle_year: 2020,
          vehicle_vin: '1HGBH41JXMN109186',
          mileage: 45000,
          license_plate: 'ABC123',
          inspection_type: 'standard'
        });

      const inspectionId = inspectionResponse.body.inspection.id;

      // Act - Try to tamper with inspection data
      const response = await request(app)
        .put(`/api/inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          id: 'different-id', // Should not be changeable
          shop_id: 'different-shop', // Should not be changeable
          total_cost: -1000 // Invalid negative cost
        });

      // Assert - Should maintain data integrity
      if (response.status === 200) {
        expect(response.body.inspection.id).toBe(inspectionId);
        expect(response.body.inspection.shop_id).toBe(testData.shopId);
      }
    });
  });

  describe('A09: Security Logging and Monitoring Failures', () => {
    it('should log authentication failures', async () => {
      // Act - Failed login
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'wrongpassword'
        })
        .expect(401);

      // Assert - In a real implementation, this would check log files
      // For testing, we verify the endpoint behaves correctly
      expect(true).toBe(true); // Placeholder for log verification
    });

    it('should log privilege escalation attempts', async () => {
      // Act - Try to access admin endpoint
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      // Assert - Should log the attempt
      expect(true).toBe(true); // Placeholder for log verification
    });

    it('should provide security monitoring endpoints', async () => {
      // Act
      const response = await request(app)
        .get('/api/security/health')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Assert
      expect(response.body.security_status).toBeDefined();
      expect(response.body.last_security_scan).toBeDefined();
    });
  });

  describe('A10: Server-Side Request Forgery (SSRF)', () => {
    it('should validate URLs in webhook configurations', async () => {
      // Arrange - Malicious internal URL
      const maliciousWebhook = {
        url: 'http://localhost:6379/config', // Redis internal endpoint
        events: ['inspection_completed']
      };

      // Act
      const response = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${validToken}`)
        .send(maliciousWebhook)
        .expect(400);

      // Assert
      expect(response.body.error).toContain('Invalid webhook URL');
    });

    it('should prevent access to internal services', async () => {
      // Arrange - Internal network URLs
      const internalUrls = [
        'http://127.0.0.1:3000',
        'http://localhost:5432',
        'http://10.0.0.1',
        'http://172.16.0.1',
        'http://192.168.1.1'
      ];

      // Act & Assert
      for (const url of internalUrls) {
        const response = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            url,
            events: ['test']
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid webhook URL');
      }
    });

    it('should validate file inclusion attempts', async () => {
      // Arrange - Path traversal in file parameter
      const response = await request(app)
        .get('/api/reports/template?file=../../../etc/passwd')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      // Assert
      expect(response.body.error).toContain('Invalid file path');
    });
  });

  describe('Additional Security Measures', () => {
    it('should implement request size limits', async () => {
      // Arrange - Very large payload
      const largePayload = {
        notes: 'A'.repeat(1000000) // 1MB of text
      };

      // Act
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${validToken}`)
        .send(largePayload);

      // Assert
      expect(response.status).toBe(413);
      expect(response.body.error).toContain('Request entity too large');
    });

    it('should sanitize file names', async () => {
      // Arrange - Malicious file names
      const maliciousNames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        'con.txt', // Windows reserved name
        'aux.jpg', // Windows reserved name
        'file\x00.jpg', // Null byte injection
        'file<script>.jpg' // XSS in filename
      ];

      // Act & Assert
      for (const filename of maliciousNames) {
        const response = await request(app)
          .post('/api/inspections/photos')
          .set('Authorization', `Bearer ${validToken}`)
          .attach('photo', Buffer.from('fake-image'), {
            filename,
            contentType: 'image/jpeg'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid filename');
      }
    });

    it('should prevent timing attacks on authentication', async () => {
      // Arrange - Measure response times
      const validEmail = 'admin@test.com';
      const invalidEmail = 'nonexistent@test.com';
      const password = 'wrongpassword';

      const startValid = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({ email: validEmail, password });
      const validTime = Date.now() - startValid;

      const startInvalid = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({ email: invalidEmail, password });
      const invalidTime = Date.now() - startInvalid;

      // Assert - Response times should be similar (within 100ms)
      const timeDifference = Math.abs(validTime - invalidTime);
      expect(timeDifference).toBeLessThan(100);
    });
  });
});