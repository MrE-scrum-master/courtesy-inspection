/**
 * Authentication Middleware
 * JWT token verification for protected routes
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    // Map JWT fields to expected user object
    req.user = {
      id: user.userId,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
      shop_id: user.shopId, // Add snake_case version for compatibility
      ...user
    };
    next();
  });
};

module.exports = {
  authenticateToken
};