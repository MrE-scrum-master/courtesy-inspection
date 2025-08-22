/**
 * Unit tests for AuthService
 * Tests authentication logic, password handling, and token management
 */

import { AuthService } from '../../src/services/AuthService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { TokenRepository } from '../../src/repositories/TokenRepository';
import { TestDataFactory, MockServices } from '../utils/test-setup';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../src/repositories/UserRepository');
jest.mock('../../src/repositories/TokenRepository');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockUserRepository = UserRepository as jest.Mocked<typeof UserRepository>;
const mockTokenRepository = TokenRepository as jest.Mocked<typeof TokenRepository>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockUser: any;
  let mockToken: string;

  beforeEach(() => {
    authService = new AuthService();
    mockUser = TestDataFactory.user({
      email: 'test@shop.com',
      password_hash: '$2a$10$hashedpassword',
      role: 'mechanic',
      is_active: true
    });
    mockToken = 'mock-jwt-token';

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      // Arrange
      const email = 'test@shop.com';
      const password = 'password123';

      mockUserRepository.prototype.findByEmail = jest.fn().mockResolvedValue(mockUser);
      mockBcrypt.compare = jest.fn().mockResolvedValue(true);
      mockJwt.sign = jest.fn().mockReturnValue(mockToken);
      mockTokenRepository.prototype.create = jest.fn().mockResolvedValue({
        id: 'token-id',
        user_id: mockUser.id,
        token: mockToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      // Act
      const result = await authService.login(email, password);

      // Assert
      expect(result.success).toBe(true);
      expect(result.token).toBe(mockToken);
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        full_name: mockUser.full_name,
        role: mockUser.role,
        shop_id: mockUser.shop_id
      });
      expect(mockUserRepository.prototype.findByEmail).toHaveBeenCalledWith(email);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, mockUser.password_hash);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          shopId: mockUser.shop_id
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    });

    it('should fail authentication with invalid email', async () => {
      // Arrange
      const email = 'nonexistent@shop.com';
      const password = 'password123';

      mockUserRepository.prototype.findByEmail = jest.fn().mockResolvedValue(null);

      // Act
      const result = await authService.login(email, password);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.token).toBeUndefined();
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should fail authentication with invalid password', async () => {
      // Arrange
      const email = 'test@shop.com';
      const password = 'wrongpassword';

      mockUserRepository.prototype.findByEmail = jest.fn().mockResolvedValue(mockUser);
      mockBcrypt.compare = jest.fn().mockResolvedValue(false);

      // Act
      const result = await authService.login(email, password);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.token).toBeUndefined();
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, mockUser.password_hash);
    });

    it('should fail authentication for inactive user', async () => {
      // Arrange
      const email = 'test@shop.com';
      const password = 'password123';
      const inactiveUser = { ...mockUser, is_active: false };

      mockUserRepository.prototype.findByEmail = jest.fn().mockResolvedValue(inactiveUser);
      mockBcrypt.compare = jest.fn().mockResolvedValue(true);

      // Act
      const result = await authService.login(email, password);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is inactive');
      expect(result.token).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const email = 'test@shop.com';
      const password = 'password123';

      mockUserRepository.prototype.findByEmail = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      const result = await authService.login(email, password);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  describe('register', () => {
    it('should successfully register new user', async () => {
      // Arrange
      const userData = {
        email: 'newuser@shop.com',
        password: 'password123',
        full_name: 'New User',
        phone: '+1234567890',
        role: 'mechanic' as const,
        shop_id: 'shop-id'
      };

      const hashedPassword = '$2a$10$hashedpassword';

      mockUserRepository.prototype.findByEmail = jest.fn().mockResolvedValue(null);
      mockBcrypt.hash = jest.fn().mockResolvedValue(hashedPassword);
      mockUserRepository.prototype.create = jest.fn().mockResolvedValue({
        ...mockUser,
        ...userData,
        password_hash: hashedPassword
      });

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user.email).toBe(userData.email);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(mockUserRepository.prototype.create).toHaveBeenCalledWith({
        ...userData,
        password_hash: hashedPassword
      });
    });

    it('should fail registration for existing email', async () => {
      // Arrange
      const userData = {
        email: 'existing@shop.com',
        password: 'password123',
        full_name: 'New User',
        phone: '+1234567890',
        role: 'mechanic' as const,
        shop_id: 'shop-id'
      };

      mockUserRepository.prototype.findByEmail = jest.fn().mockResolvedValue(mockUser);

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already registered');
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
    });

    it('should validate password strength', async () => {
      // Arrange
      const userData = {
        email: 'newuser@shop.com',
        password: '123', // Too weak
        full_name: 'New User',
        phone: '+1234567890',
        role: 'mechanic' as const,
        shop_id: 'shop-id'
      };

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Password must be at least');
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token', async () => {
      // Arrange
      const tokenPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        shopId: mockUser.shop_id
      };

      mockJwt.verify = jest.fn().mockReturnValue(tokenPayload);
      mockTokenRepository.prototype.findByToken = jest.fn().mockResolvedValue({
        id: 'token-id',
        user_id: mockUser.id,
        token: mockToken,
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        is_active: true
      });
      mockUserRepository.prototype.findById = jest.fn().mockResolvedValue(mockUser);

      // Act
      const result = await authService.verifyToken(mockToken);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
      expect(mockJwt.verify).toHaveBeenCalledWith(mockToken, process.env.JWT_SECRET);
    });

    it('should reject invalid token', async () => {
      // Arrange
      mockJwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = await authService.verifyToken('invalid-token');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should reject expired token', async () => {
      // Arrange
      const tokenPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        shopId: mockUser.shop_id
      };

      mockJwt.verify = jest.fn().mockReturnValue(tokenPayload);
      mockTokenRepository.prototype.findByToken = jest.fn().mockResolvedValue({
        id: 'token-id',
        user_id: mockUser.id,
        token: mockToken,
        expires_at: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        is_active: true
      });

      // Act
      const result = await authService.verifyToken(mockToken);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should reject revoked token', async () => {
      // Arrange
      const tokenPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        shopId: mockUser.shop_id
      };

      mockJwt.verify = jest.fn().mockReturnValue(tokenPayload);
      mockTokenRepository.prototype.findByToken = jest.fn().mockResolvedValue({
        id: 'token-id',
        user_id: mockUser.id,
        token: mockToken,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        is_active: false // Revoked
      });

      // Act
      const result = await authService.verifyToken(mockToken);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token revoked');
    });
  });

  describe('logout', () => {
    it('should successfully revoke token', async () => {
      // Arrange
      mockTokenRepository.prototype.revokeToken = jest.fn().mockResolvedValue(true);

      // Act
      const result = await authService.logout(mockToken);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTokenRepository.prototype.revokeToken).toHaveBeenCalledWith(mockToken);
    });

    it('should handle token revocation failure', async () => {
      // Arrange
      mockTokenRepository.prototype.revokeToken = jest.fn().mockResolvedValue(false);

      // Act
      const result = await authService.logout(mockToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to revoke token');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh valid token', async () => {
      // Arrange
      const newToken = 'new-jwt-token';
      const tokenPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        shopId: mockUser.shop_id
      };

      mockJwt.verify = jest.fn().mockReturnValue(tokenPayload);
      mockTokenRepository.prototype.findByToken = jest.fn().mockResolvedValue({
        id: 'token-id',
        user_id: mockUser.id,
        token: mockToken,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        is_active: true
      });
      mockUserRepository.prototype.findById = jest.fn().mockResolvedValue(mockUser);
      mockJwt.sign = jest.fn().mockReturnValue(newToken);
      mockTokenRepository.prototype.revokeToken = jest.fn().mockResolvedValue(true);
      mockTokenRepository.prototype.create = jest.fn().mockResolvedValue({
        id: 'new-token-id',
        user_id: mockUser.id,
        token: newToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      // Act
      const result = await authService.refreshToken(mockToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.token).toBe(newToken);
      expect(mockTokenRepository.prototype.revokeToken).toHaveBeenCalledWith(mockToken);
    });

    it('should fail to refresh invalid token', async () => {
      // Arrange
      mockJwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = await authService.refreshToken('invalid-token');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('password validation', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = [
        'Password123!',
        'MySecur3P@ssw0rd',
        'Str0ng!Password'
      ];

      strongPasswords.forEach(password => {
        const isValid = authService.validatePassword(password);
        expect(isValid).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        '123456',
        'password',
        'PASSWORD',
        'Pass123',
        '12345678'
      ];

      weakPasswords.forEach(password => {
        const isValid = authService.validatePassword(password);
        expect(isValid).toBe(false);
      });
    });
  });
});