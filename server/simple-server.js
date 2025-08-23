// SIMPLE WORKING SERVER - NO DEPENDENCIES ON ENVIRONMENT VARIABLES
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 8080;

// HARDCODED for now - just to make it WORK
const JWT_SECRET = process.env.JWT_SECRET || 'temporary-secret-just-to-make-it-work';

// Enable CORS for EVERYTHING - we'll fix security later
app.use(cors({
  origin: true, // Allow ALL origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json());

// Simple in-memory user store (no database needed for testing)
const TEST_USERS = [
  {
    id: '1',
    email: 'admin@shop.com',
    password: '$2b$12$IXn1nJqfUKCLwvLaQDBSlusCUVZCJpcdzm8UzDdd25qluTScpLV6W', // password123
    fullName: 'Admin User',
    role: 'manager',
    shopId: '550e8400-e29b-41d4-a716-446655440001'
  }
];

// Health check - MUST WORK
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Simple server is running!',
    cors: 'enabled for all origins'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Courtesy Inspection API',
    endpoints: {
      health: '/api/health',
      login: '/api/auth/login'
    }
  });
});

// Login endpoint - SIMPLIFIED
app.post('/api/auth/login', async (req, res) => {
  console.log('Login attempt:', req.body.email);
  
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = TEST_USERS.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Generate token
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Return success
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          shopId: user.shopId
        },
        accessToken,
        refreshToken: accessToken // Same for now
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 SIMPLE SERVER RUNNING ON PORT ${PORT}                  ║
║                                                          ║
║   Health: http://localhost:${PORT}/api/health            ║
║   Login:  http://localhost:${PORT}/api/auth/login        ║
║                                                          ║
║   CORS: ENABLED FOR ALL ORIGINS                         ║
║   Database: NOT NEEDED (using test users)               ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;