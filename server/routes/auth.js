const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

// Authentication routes
router.post('/register', async (req, res) => {
  try {
    const user = await req.auth.register(req.body);
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await req.auth.login({ email, password });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

// POST /refresh - Refresh JWT token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET || config.JWT_SECRET);
    
    // Get user from database
    const userResult = await req.db.query(
      'SELECT * FROM users WHERE id = $1 AND active = true',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    const user = userResult.rows[0];
    
    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        shopId: user.shop_id
      },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Optionally generate new refresh token
    const newRefreshToken = jwt.sign(
      { userId: user.id },
      config.JWT_REFRESH_SECRET || config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token'
    });
  }
});

// GET /profile - Get current user profile
router.get('/profile', (req, res, next) => {
  // Apply authentication middleware
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  const jwt = require('jsonwebtoken');
  const config = require('../config');
  
  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = {
      id: user.userId,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
      shop_id: user.shopId,
      ...user
    };
    next();
  });
}, async (req, res) => {
  try {
    const userResult = await req.db.query(
      `SELECT 
        u.id, u.email, u.full_name as name, u.role, u.shop_id as "shopId", 
        u.active as "isActive", u.created_at as "createdAt", u.updated_at as "updatedAt",
        s.name as shop_name
      FROM users u
      LEFT JOIN shops s ON u.shop_id = s.id
      WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;