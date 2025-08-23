// Authentication Module for Railway PostgreSQL
// Complete JWT authentication with role-based access control
// KISS, DRY, SOLID principles

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthService {
  constructor(db) {
    this.db = db;
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    this.jwtExpires = process.env.JWT_EXPIRES || '24h';
    this.refreshExpires = process.env.REFRESH_EXPIRES || '7d';
    this.saltRounds = 12;
  }

  // Hash password with bcrypt
  async hashPassword(password) {
    return await bcrypt.hash(password, this.saltRounds);
  }

  // Verify password
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT token
  generateToken(payload, expiresIn = this.jwtExpires) {
    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Register new user
  async register({ email, password, fullName, phone, role = 'mechanic', shopId }) {
    try {
      // Check if user exists
      const existingUser = await this.db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        throw new Error('User already exists');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);
      
      // Create user
      const result = await this.db.query(`
        INSERT INTO users (email, password_hash, full_name, phone, role, shop_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, full_name, phone, role, shop_id, created_at
      `, [email, hashedPassword, fullName, phone, role, shopId]);

      const user = result.rows[0];
      
      // Generate tokens
      const accessToken = this.generateToken({ userId: user.id, email: user.email, role: user.role });
      const refreshToken = this.generateToken({ userId: user.id, type: 'refresh' }, this.refreshExpires);
      
      // Store refresh token
      await this.db.query(
        'INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
        [user.id, refreshToken]
      );

      return {
        user: { ...user, password_hash: undefined },
        accessToken,
        refreshToken
      };
    } catch (error) {
      throw error;
    }
  }

  // Login user
  async login({ email, password }) {
    try {
      // Get user with password
      const result = await this.db.query(`
        SELECT u.*, s.name as shop_name 
        FROM users u 
        LEFT JOIN shops s ON u.shop_id = s.id 
        WHERE u.email = $1 AND u.active = true
      `, [email]);
      
      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = result.rows[0];
      
      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const accessToken = this.generateToken({ 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        shopId: user.shop_id 
      });
      const refreshToken = this.generateToken({ userId: user.id, type: 'refresh' }, this.refreshExpires);
      
      // Store refresh token
      await this.db.query(
        'INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
        [user.id, refreshToken]
      );

      // Update last login
      await this.db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

      return {
        user: { 
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          role: user.role,
          shopId: user.shop_id,
          shopName: user.shop_name
        },
        accessToken,
        refreshToken
      };
    } catch (error) {
      throw error;
    }
  }

  // Refresh access token
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const payload = this.verifyToken(refreshToken);
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists and is valid
      const sessionResult = await this.db.query(
        'SELECT user_id FROM user_sessions WHERE refresh_token = $1 AND expires_at > NOW()',
        [refreshToken]
      );
      
      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid refresh token');
      }

      // Get user data
      const userResult = await this.db.query(
        'SELECT id, email, role, shop_id FROM users WHERE id = $1 AND active = true',
        [payload.userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      
      // Generate new access token
      const accessToken = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        shopId: user.shop_id
      });

      return { accessToken };
    } catch (error) {
      throw error;
    }
  }

  // Logout user (invalidate refresh token)
  async logout(refreshToken) {
    try {
      await this.db.query(
        'DELETE FROM user_sessions WHERE refresh_token = $1',
        [refreshToken]
      );
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Middleware for authentication
  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const payload = this.verifyToken(token);
        
        // Get full user data
        const result = await this.db.query(
          'SELECT id, email, full_name, phone, role, shop_id FROM users WHERE id = $1 AND active = true',
          [payload.userId]
        );
        
        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'User not found' });
        }

        req.user = result.rows[0];
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    };
  }

  // Middleware for role-based authorization
  authorize(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      if (roles.length === 0 || roles.includes(req.user.role)) {
        return next();
      }

      return res.status(403).json({ error: 'Insufficient permissions' });
    };
  }

  // Middleware for shop-based access control
  requireShopAccess() {
    return async (req, res, next) => {
      try {
        const shopId = req.params.shopId || req.body.shopId || req.query.shopId;
        
        if (!shopId) {
          return res.status(400).json({ error: 'Shop ID required' });
        }

        // Admin can access any shop
        if (req.user.role === 'admin') {
          return next();
        }

        // Check if user belongs to the shop
        if (req.user.shop_id !== shopId) {
          return res.status(403).json({ error: 'Access denied to this shop' });
        }

        next();
      } catch (error) {
        return res.status(500).json({ error: 'Server error' });
      }
    };
  }
}

module.exports = AuthService;