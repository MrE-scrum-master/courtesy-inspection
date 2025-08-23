/**
 * Courtesy Inspection API Server
 * Express server with Railway PostgreSQL integration
 * Production-ready with security, logging, and error handling
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import templates (local copies for Railway deployment)
const Database = require('./db');
const AuthService = require('./auth');
const FileUpload = require('./upload');
const VoiceParser = require('./voice-parser');
const SMSTemplates = require('./sms-templates');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const db = new Database();
const auth = new AuthService(db);
const upload = new FileUpload();
const voiceParser = new VoiceParser();
const smsTemplates = new SMSTemplates();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://courtesy-inspection.up.railway.app",
        "https://app.courtesyinspection.com",
        // Allow localhost for development
        "http://localhost:3000",
        "http://localhost:8081",
        "ws://localhost:*"
      ],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:"],
      mediaSrc: ["'self'", "blob:"],
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

// CORS configuration - Simple and bulletproof
const allowedOrigins = [
  'https://app.courtesyinspection.com',
  'https://courtesyinspection.com',
  'https://courtesy-inspection.up.railway.app',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
  'exp://localhost:8081'
];

// Add any additional origins from environment
if (process.env.CORS_ORIGINS) {
  const envOrigins = process.env.CORS_ORIGINS.split(',').map(o => o.trim());
  envOrigins.forEach(origin => {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

console.log('✅ CORS Origins configured:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('⚠️ CORS blocked origin:', origin);
      // In production, we might want to be more permissive
      // For now, block unknown origins
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // Cache preflight requests for 24 hours
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// Add OPTIONS handler for preflight requests
app.options('*', cors());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const dbHealth = await db.query('SELECT NOW() as time, version() as version');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: true,
        version: dbHealth.rows[0].version.split(' ')[1],
        time: dbHealth.rows[0].time
      },
      services: {
        auth: 'ready',
        voice: 'ready',
        sms: process.env.ENABLE_SMS === 'true' ? 'ready' : 'disabled',
        upload: 'ready'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database test endpoint
app.get('/api/db/test', async (req, res) => {
  try {
    const users = await db.query('SELECT COUNT(*) as count FROM users');
    const shops = await db.query('SELECT COUNT(*) as count FROM shops');
    const vehicles = await db.query('SELECT COUNT(*) as count FROM vehicles');
    
    res.json({
      success: true,
      data: {
        users: parseInt(users.rows[0].count),
        shops: parseInt(shops.rows[0].count),
        vehicles: parseInt(vehicles.rows[0].count)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Voice parser test endpoint
app.post('/api/voice/parse', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const result = voiceParser.parse(text);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// SMS template preview endpoint
app.post('/api/sms/preview', (req, res) => {
  try {
    const { template, data } = req.body;
    if (!template || !data) {
      return res.status(400).json({ error: 'Template and data are required' });
    }
    
    const message = smsTemplates.getMessage(template, data);
    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Authentication endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const user = await auth.register(req.body);
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

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await auth.login({ email, password });
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

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/${req.file.filename}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_PATH || 'data/uploads')));

// Serve Expo web app static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache static assets for 1 day
  setHeaders: (res, path) => {
    // Don't cache HTML files
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Fallback route for client-side routing (serve index.html for all non-API routes)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
    return next();
  }
  
  // Serve index.html for client-side routing
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      // If index.html doesn't exist, continue to 404 handler
      next();
    }
  });
});

// Inspection endpoints (MVP stubs)
app.get('/api/inspections', async (req, res) => {
  try {
    // TODO: Implement full inspection listing
    // For now, return empty array to prevent 404 errors
    res.json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/inspections/:id', async (req, res) => {
  res.json({
    success: true,
    data: null,
    message: 'Inspection endpoint not yet implemented'
  });
});

app.post('/api/inspections', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Inspection creation not yet implemented'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.url,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Close database connection
  await db.close();
  
  // Close server
  server.close(() => {
    console.log('Server closed successfully');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   Courtesy Inspection API Server                        ║
║   Running on: http://localhost:${PORT}                      ║
║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
║   Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}                           ║
║                                                          ║
║   Endpoints:                                             ║
║   • Health: GET /api/health                             ║
║   • DB Test: GET /api/db/test                          ║
║   • Voice Parse: POST /api/voice/parse                  ║
║   • SMS Preview: POST /api/sms/preview                  ║
║   • Auth: POST /api/auth/login                         ║
║                                                          ║
║   Press Ctrl+C to stop the server                       ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;