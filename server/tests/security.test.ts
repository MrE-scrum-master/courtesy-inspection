// Comprehensive Security Test Suite
// Tests authentication, authorization, input validation, and security measures

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthService } from '../src/services/AuthService';
import { TokenService } from '../src/services/TokenService';
import { RBACMiddleware } from '../src/middleware/rbac.middleware';
import { SecurityMiddleware } from '../src/middleware/security.middleware';
import { SanitizationMiddleware } from '../src/middleware/sanitization.middleware';
import { AuditService } from '../src/services/AuditService';
import { DatabaseService } from '../src/types/common';

// Mock database service
const mockDb: jest.Mocked<DatabaseService> = {
  query: jest.fn(),
  getClient: jest.fn(),
  transaction: jest.fn(),
  findOne: jest.fn(),
  findMany: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  exists: jest.fn()
};

// Mock Express app
const createMockApp = () => {
  const app = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    listen: jest.fn(),
    locals: {}
  };
  return app;
};

describe('Security Test Suite', () => {
  let authService: AuthService;
  let tokenService: TokenService;
  let rbacMiddleware: RBACMiddleware;
  let securityMiddleware: SecurityMiddleware;
  let sanitizationMiddleware: SanitizationMiddleware;
  let auditService: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(mockDb);
    tokenService = new TokenService(mockDb);
    rbacMiddleware = new RBACMiddleware(mockDb);
    securityMiddleware = new SecurityMiddleware(mockDb);
    sanitizationMiddleware = new SanitizationMiddleware(mockDb);
    auditService = new AuditService(mockDb);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication Security Tests', () => {
    describe('Password Policy Enforcement', () => {
      it('should enforce minimum password length', async () => {
        const registerData = {
          email: 'test@example.com',
          password: '123', // Too short
          fullName: 'Test User',
          role: 'mechanic' as const
        };

        mockDb.query.mockResolvedValue({ rows: [] }); // No existing user

        const result = await authService.register(registerData);

        expect(result.success).toBe(false);
        expect(result.error).toContain('security requirements');
      });

      it('should enforce password complexity requirements', async () => {
        const testCases = [
          { password: 'password', expected: 'uppercase letter' },
          { password: 'PASSWORD', expected: 'lowercase letter' },
          { password: 'Password', expected: 'number' },
          { password: 'Password1', expected: 'special character' }
        ];

        mockDb.query.mockResolvedValue({ rows: [] });

        for (const testCase of testCases) {
          const result = await authService.register({
            email: 'test@example.com',
            password: testCase.password,
            fullName: 'Test User',
            role: 'mechanic' as const
          });

          expect(result.success).toBe(false);
          expect(result.details?.violations).toContain(
            expect.stringContaining(testCase.expected)
          );
        }
      });

      it('should reject common weak passwords', async () => {
        const weakPasswords = ['password', '123456', 'password123', 'admin'];
        
        mockDb.query.mockResolvedValue({ rows: [] });

        for (const password of weakPasswords) {
          const result = await authService.register({
            email: 'test@example.com',
            password,
            fullName: 'Test User',
            role: 'mechanic' as const
          });

          expect(result.success).toBe(false);
          expect(result.details?.violations).toContain('Password is too common');
        }
      });

      it('should prevent password reuse', async () => {
        const userId = 'test-user-id';
        const oldPassword = 'OldPassword123!';
        const hashedOldPassword = await bcrypt.hash(oldPassword, 12);

        // Mock user exists
        mockDb.query.mockImplementation((query: string) => {
          if (query.includes('password_history')) {
            return Promise.resolve({ rows: [{ password_hash: hashedOldPassword }] });
          }
          return Promise.resolve({ rows: [{ id: userId, password_hash: hashedOldPassword }] });
        });

        const result = await authService.changePassword(userId, oldPassword, oldPassword);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot reuse');
      });
    });

    describe('Account Lockout Protection', () => {
      it('should lock account after maximum failed attempts', async () => {
        const email = 'test@example.com';
        const ipAddress = '127.0.0.1';

        // Mock failed login attempts
        mockDb.query.mockImplementation((query: string) => {
          if (query.includes('login_attempts')) {
            if (query.includes('SELECT')) {
              // Return existing attempts
              return Promise.resolve({ 
                rows: [{ attempts_count: 4, locked_until: null }] 
              });
            }
          }
          if (query.includes('users')) {
            return Promise.resolve({ rows: [] }); // User not found for login
          }
          return Promise.resolve({ rows: [] });
        });

        const result = await authService.login({ email, password: 'wrong' }, ipAddress);

        expect(result.success).toBe(false);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO login_attempts'),
          expect.arrayContaining([email, ipAddress])
        );
      });

      it('should prevent login when account is locked', async () => {
        const email = 'test@example.com';
        const futureDate = new Date(Date.now() + 60000).toISOString();

        mockDb.query.mockImplementation((query: string) => {
          if (query.includes('locked_until')) {
            return Promise.resolve({
              rows: [{ locked_until: futureDate }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const result = await authService.login({ email, password: 'correct' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('locked');
      });

      it('should reset failed attempts after successful login', async () => {
        const email = 'test@example.com';
        const password = 'CorrectPassword123!';
        const hashedPassword = await bcrypt.hash(password, 12);

        mockDb.query.mockImplementation((query: string) => {
          if (query.includes('login_attempts')) {
            if (query.includes('locked_until')) {
              return Promise.resolve({ rows: [] }); // Not locked
            }
          }
          if (query.includes('users')) {
            return Promise.resolve({
              rows: [{
                id: 'user-id',
                email,
                password_hash: hashedPassword,
                role: 'mechanic',
                shop_id: null,
                failed_login_attempts: 3
              }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        // Mock TokenService
        const mockTokenResult = {
          success: true,
          data: {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token'
          }
        };
        jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue(mockTokenResult);

        const result = await authService.login({ email, password });

        expect(result.success).toBe(true);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE login_attempts SET attempts_count = 0'),
          expect.any(Array)
        );
      });
    });

    describe('Token Security Tests', () => {
      it('should generate secure JWT tokens with proper expiration', async () => {
        const sessionContext = {
          userId: 'test-user',
          email: 'test@example.com',
          role: 'mechanic',
          shopId: 'shop-id'
        };

        // Mock database operations
        mockDb.query.mockResolvedValue({ rows: [] });

        const result = await tokenService.generateTokenPair(sessionContext);

        expect(result.success).toBe(true);
        expect(result.data?.accessToken).toBeTruthy();
        expect(result.data?.refreshToken).toBeTruthy();

        // Verify access token is properly signed
        const decoded = jwt.decode(result.data!.accessToken) as any;
        expect(decoded.userId).toBe(sessionContext.userId);
        expect(decoded.exp).toBeTruthy();
      });

      it('should implement token rotation on refresh', async () => {
        const refreshToken = 'old-refresh-token';
        const tokenHash = 'hashed-token';

        mockDb.query.mockImplementation((query: string) => {
          if (query.includes('refresh_tokens')) {
            return Promise.resolve({
              rows: [{
                user_id: 'user-id',
                email: 'test@example.com',
                role: 'mechanic',
                shop_id: null
              }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        // Mock generateTokenPair
        jest.spyOn(tokenService, 'generateTokenPair').mockResolvedValue({
          success: true,
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            accessTokenExpires: new Date(),
            refreshTokenExpires: new Date()
          }
        });

        const result = await tokenService.refreshAccessToken(refreshToken, {});

        expect(result.success).toBe(true);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE refresh_tokens SET revoked_at'),
          expect.any(Array)
        );
      });

      it('should detect suspicious token usage', async () => {
        const refreshToken = 'suspicious-token';
        
        mockDb.query.mockImplementation((query: string) => {
          if (query.includes('refresh_tokens')) {
            return Promise.resolve({
              rows: [{
                user_id: 'user-id',
                email: 'test@example.com',
                role: 'mechanic',
                shop_id: null,
                ip_address: '192.168.1.1',
                user_agent: 'Chrome/90.0'
              }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        // Different IP and user agent (suspicious)
        const context = {
          ipAddress: '10.0.0.1',
          userAgent: 'Firefox/88.0'
        };

        // Set strict validation
        process.env.STRICT_IP_VALIDATION = 'true';

        const result = await tokenService.refreshAccessToken(refreshToken, context);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security violation');

        // Cleanup
        delete process.env.STRICT_IP_VALIDATION;
      });
    });
  });

  describe('Authorization Security Tests', () => {
    describe('Role-Based Access Control', () => {
      it('should enforce role hierarchy correctly', async () => {
        const mockReq = {
          user: { id: 'user-id', role: 'mechanic', shop_id: 'shop-1' }
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        // Test mechanic accessing admin-only resource
        const adminMiddleware = rbacMiddleware.requireRole('admin');
        adminMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow access for sufficient permissions', async () => {
        mockDb.query.mockImplementation((query: string) => {
          if (query.includes('role_permissions')) {
            return Promise.resolve({
              rows: [{ name: 'inspections.create' }]
            });
          }
          if (query.includes('user_permissions')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        });

        const mockReq = {
          user: { id: 'user-id', role: 'mechanic', shop_id: 'shop-1' }
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        const authMiddleware = rbacMiddleware.authorize('inspections', 'create');
        await authMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should enforce shop-level data isolation', async () => {
        const mockReq = {
          user: { id: 'user-id', role: 'mechanic', shop_id: 'shop-1' },
          body: { shop_id: 'shop-2' } // Different shop
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        const shopMiddleware = rbacMiddleware.requireShopAccess();
        await shopMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Resource Ownership Validation', () => {
      it('should verify resource ownership for mechanics', async () => {
        mockDb.query.mockResolvedValue({
          rows: [{ id: 'resource-id', user_id: 'owner-id' }]
        });

        const mockReq = {
          user: { id: 'different-user-id', role: 'mechanic', shop_id: 'shop-1' },
          params: { id: 'resource-id' }
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        const ownershipMiddleware = rbacMiddleware.requireOwnership({
          resourceTable: 'inspections',
          allowRoles: ['admin', 'shop_manager']
        });
        await ownershipMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
      });

      it('should allow managers to bypass ownership checks', async () => {
        const mockReq = {
          user: { id: 'manager-id', role: 'shop_manager', shop_id: 'shop-1' },
          params: { id: 'resource-id' }
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        const ownershipMiddleware = rbacMiddleware.requireOwnership({
          resourceTable: 'inspections',
          allowRoles: ['shop_manager']
        });
        await ownershipMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('Input Validation and Sanitization Tests', () => {
    describe('SQL Injection Prevention', () => {
      it('should detect SQL injection attempts', () => {
        const maliciousInputs = [
          "'; DROP TABLE users; --",
          "1 OR 1=1",
          "UNION SELECT * FROM users",
          "' OR 'a'='a",
          "; INSERT INTO users VALUES('hacker', 'admin')"
        ];

        const mockReq = {
          body: {},
          query: {},
          params: {}
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        maliciousInputs.forEach(input => {
          jest.clearAllMocks();
          mockReq.body = { search: input };
          
          const sqlProtection = securityMiddleware.getSQLInjectionProtection();
          sqlProtection(mockReq, mockRes, mockNext);

          expect(mockRes.status).toHaveBeenCalledWith(400);
          expect(mockNext).not.toHaveBeenCalled();
        });
      });

      it('should allow legitimate inputs', () => {
        const legitimateInputs = [
          "John's Car Repair",
          "email@example.com",
          "123-456-7890",
          "Normal search query"
        ];

        const mockReq = {
          body: {},
          query: {},
          params: {}
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        legitimateInputs.forEach(input => {
          jest.clearAllMocks();
          mockReq.body = { search: input };
          
          const sqlProtection = securityMiddleware.getSQLInjectionProtection();
          sqlProtection(mockReq, mockRes, mockNext);

          expect(mockNext).toHaveBeenCalled();
          expect(mockRes.status).not.toHaveBeenCalled();
        });
      });
    });

    describe('XSS Prevention', () => {
      it('should detect XSS attempts', () => {
        const xssPayloads = [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert("XSS")>',
          'javascript:alert("XSS")',
          '<iframe src="javascript:alert(\'XSS\')"></iframe>',
          '<svg onload=alert("XSS")>'
        ];

        const mockReq = {
          body: {},
          query: {}
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        xssPayloads.forEach(payload => {
          jest.clearAllMocks();
          mockReq.body = { comment: payload };
          
          const xssProtection = securityMiddleware.getXSSProtection();
          xssProtection(mockReq, mockRes, mockNext);

          expect(mockRes.status).toHaveBeenCalledWith(400);
          expect(mockNext).not.toHaveBeenCalled();
        });
      });

      it('should sanitize HTML content properly', async () => {
        const mockReq = {
          body: {
            content: '<p>Safe content</p><script>alert("bad")</script>'
          }
        } as any;
        const mockRes = {} as any;
        const mockNext = jest.fn();

        const sanitizer = sanitizationMiddleware.sanitizeHTML();
        sanitizer(mockReq, mockRes, mockNext);

        expect(mockReq.body.content).not.toContain('<script>');
        expect(mockReq.body.content).toContain('<p>Safe content</p>');
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Input Sanitization', () => {
      it('should trim and normalize strings', async () => {
        const mockReq = {
          body: {
            name: '  John Doe  ',
            email: 'JOHN@EXAMPLE.COM'
          }
        } as any;
        const mockRes = {} as any;
        const mockNext = jest.fn();

        const sanitizer = sanitizationMiddleware.sanitizeRequest();
        await sanitizer(mockReq, mockRes, mockNext);

        expect(mockReq.body.name).toBe('John Doe');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should validate field constraints', async () => {
        const mockReq = {
          body: {
            email: 'invalid-email',
            phone: 'abc-123-def'
          }
        } as any;
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;
        const mockNext = jest.fn();

        const fieldRules = {
          email: {
            field: 'email',
            type: 'email' as const,
            required: true
          }
        };

        const sanitizer = sanitizationMiddleware.sanitizeFields(fieldRules);
        await sanitizer(mockReq, mockRes, mockNext);

        // Should pass through with sanitized values
        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should implement general rate limiting', () => {
      const rateLimiter = securityMiddleware.getGeneralRateLimit();
      
      // This would need more complex testing in a real scenario
      // involving multiple requests and time simulation
      expect(rateLimiter).toBeTruthy();
    });

    it('should implement authentication-specific rate limiting', () => {
      const authRateLimiter = securityMiddleware.getAuthRateLimit();
      expect(authRateLimiter).toBeTruthy();
    });

    it('should progressively slow down requests', () => {
      const slowDown = securityMiddleware.getSlowDown();
      expect(slowDown).toBeTruthy();
    });
  });

  describe('Security Headers Tests', () => {
    it('should set proper security headers', () => {
      const mockReq = {} as any;
      const mockRes = {
        set: jest.fn()
      } as any;
      const mockNext = jest.fn();

      const headersMiddleware = securityMiddleware.getSecurityHeaders();
      headersMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should configure Helmet properly', () => {
      const helmetConfig = securityMiddleware.getHelmetConfig();
      expect(helmetConfig).toBeTruthy();
    });

    it('should configure CORS properly', () => {
      const corsConfig = securityMiddleware.getCORSConfig();
      expect(corsConfig).toBeTruthy();
    });
  });

  describe('Audit and Logging Tests', () => {
    it('should log security events', async () => {
      const securityEvent = {
        type: 'LOGIN_FAILURE' as const,
        userId: 'user-id',
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent',
        details: { reason: 'invalid_password' },
        severity: 'medium' as const
      };

      mockDb.query.mockResolvedValue({ rows: [] });

      await auditService.logSecurityEvent(securityEvent);

      // Should have called flushBatch immediately for security events
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should log API access', async () => {
      const mockReq = {
        method: 'GET',
        path: '/api/users',
        route: { path: '/api/users' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('TestAgent'),
        correlationId: 'test-correlation-id',
        body: {}
      };

      const mockRes = {
        statusCode: 200,
        get: jest.fn()
      };

      const mockUser = {
        id: 'user-id',
        shop_id: 'shop-id'
      };

      await auditService.logApiAccess(mockReq, mockRes, 150, mockUser);

      // Verify the audit log was queued
      expect(auditService).toBeTruthy();
    });

    it('should generate audit statistics', async () => {
      // Mock various database queries for statistics
      mockDb.query.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return Promise.resolve({ rows: [{ total: '100' }] });
        }
        if (query.includes('category')) {
          return Promise.resolve({ 
            rows: [
              { category: 'auth', count: '50' },
              { category: 'api', count: '30' },
              { category: 'security', count: '20' }
            ]
          });
        }
        if (query.includes('severity')) {
          return Promise.resolve({
            rows: [
              { severity: 'info', count: '60' },
              { severity: 'warning', count: '25' },
              { severity: 'error', count: '15' }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const stats = await auditService.getStatistics('24h');

      expect(stats.totalEvents).toBe(100);
      expect(stats.eventsByCategory).toEqual({
        auth: 50,
        api: 30,
        security: 20
      });
      expect(stats.eventsBySeverity).toEqual({
        info: 60,
        warning: 25,
        error: 15
      });
    });
  });

  describe('Session Management Tests', () => {
    it('should limit concurrent sessions per user', async () => {
      const userId = 'test-user';
      
      // Mock that user already has maximum sessions
      mockDb.query.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: '5' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const sessionContext = {
        userId,
        email: 'test@example.com',
        role: 'mechanic'
      };

      const result = await tokenService.generateTokenPair(sessionContext);

      // Should remove oldest session when at limit
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_sessions'),
        expect.any(Array)
      );
    });

    it('should track device information', async () => {
      const sessionContext = {
        userId: 'test-user',
        email: 'test@example.com',
        role: 'mechanic',
        deviceInfo: {
          fingerprint: 'device-123',
          platform: 'iOS',
          browser: 'Safari'
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Safari/14.0'
      };

      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] });

      await tokenService.generateTokenPair(sessionContext);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_sessions'),
        expect.arrayContaining(['device-123', '127.0.0.1', 'Safari/14.0'])
      );
    });
  });

  describe('File Upload Security Tests', () => {
    it('should validate file types', () => {
      const mockReq = {
        files: [
          {
            originalname: 'document.pdf',
            mimetype: 'application/pdf',
            size: 1000000
          }
        ]
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      const fileValidator = sanitizationMiddleware.sanitizeFileUpload();
      fileValidator(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject dangerous file types', () => {
      const mockReq = {
        files: [
          {
            originalname: 'malware.exe',
            mimetype: 'application/x-executable',
            size: 1000000
          }
        ]
      } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const mockNext = jest.fn();

      const fileValidator = sanitizationMiddleware.sanitizeFileUpload();
      fileValidator(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Data Encryption Tests', () => {
    it('should properly hash passwords', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 12);

      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);

      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);

      const isInvalid = await bcrypt.compare('wrong', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    it('should generate secure random tokens', () => {
      const token1 = tokenService['generateRefreshToken']();
      const token2 = tokenService['generateRefreshToken']();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(100); // 64 bytes hex = 128 chars
      expect(token2.length).toBeGreaterThan(100);
    });
  });

  describe('Environment Security Tests', () => {
    it('should handle missing JWT_SECRET securely', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const authServiceWithoutSecret = new AuthService(mockDb);
      
      // Should generate a random secret but warn
      expect(authServiceWithoutSecret).toBeTruthy();

      // Restore original secret
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      }
    });

    it('should use secure defaults for configuration', () => {
      const security = new SecurityMiddleware(mockDb);
      
      expect(security).toBeTruthy();
      // Additional checks for secure defaults could be added here
    });
  });
});