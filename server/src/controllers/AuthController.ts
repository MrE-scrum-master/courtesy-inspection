// Auth Controller - HTTP request handling for authentication
// Thin controller layer - delegates to AuthService for business logic

import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { LoginDTO, RegisterDTO, RefreshTokenDTO } from '../types/dtos';
import { HttpStatus } from '../types/common';

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  // POST /auth/register
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: RegisterDTO = req.body;
      const result = await this.authService.register(data);

      if (result.success) {
        res.status(HttpStatus.CREATED).json({
          success: true,
          data: result.data,
          message: 'User registered successfully'
        });
      } else {
        res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Register controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Registration failed'
      });
    }
  };

  // POST /auth/login
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: LoginDTO = req.body;
      const result = await this.authService.login(data);

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data,
          message: 'Login successful'
        });
      } else {
        res.status(result.statusCode || HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Login controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Login failed'
      });
    }
  };

  // POST /auth/refresh
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: RefreshTokenDTO = req.body;
      const result = await this.authService.refreshToken(data);

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data,
          message: 'Token refreshed successfully'
        });
      } else {
        res.status(result.statusCode || HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Refresh token controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Token refresh failed'
      });
    }
  };

  // POST /auth/logout
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Refresh token required'
        });
        return;
      }

      const result = await this.authService.logout(refreshToken);

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          message: 'Logout successful'
        });
      } else {
        res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Logout controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Logout failed'
      });
    }
  };

  // GET /auth/me
  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          id: req.user.id,
          email: req.user.email,
          fullName: req.user.full_name,
          phone: req.user.phone,
          role: req.user.role,
          shopId: req.user.shop_id
        }
      });
    } catch (error) {
      console.error('Get profile controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to retrieve profile'
      });
    }
  };

  // POST /auth/change-password
  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Both old and new passwords are required'
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'New password must be at least 8 characters long'
        });
        return;
      }

      const result = await this.authService.changePassword(
        req.user.id,
        oldPassword,
        newPassword
      );

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          message: 'Password changed successfully'
        });
      } else {
        res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Change password controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Password change failed'
      });
    }
  };

  // POST /auth/revoke-sessions
  revokeSessions = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const result = await this.authService.revokeAllSessions(req.user.id);

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          message: 'All sessions revoked successfully'
        });
      } else {
        res.status(result.statusCode || HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Revoke sessions controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to revoke sessions'
      });
    }
  };

  // GET /auth/validate
  validateToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'No token provided',
          valid: false
        });
        return;
      }

      const token = authHeader.substring(7);
      const result = await this.authService.getUserFromToken(token);

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          valid: true,
          data: {
            id: result.data.id,
            email: result.data.email,
            role: result.data.role,
            shopId: result.data.shop_id
          }
        });
      } else {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: result.error,
          valid: false
        });
      }
    } catch (error) {
      console.error('Validate token controller error:', error);
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        error: 'Token validation failed',
        valid: false
      });
    }
  };
}