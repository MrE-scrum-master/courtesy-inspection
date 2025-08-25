/**
 * Courtesy Inspection API Server - Production Ready
 * Express server with Railway PostgreSQL integration
 * Includes comprehensive inspection endpoints
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('./config');

// Import templates (local copies for Railway deployment)
const Database = require('./db');
const AuthService = require('./auth');
const FileUpload = require('./upload');
const VoiceParser = require('./voice-parser');
const SMSTemplates = require('./sms-templates');
const { generateInspectionItems, getAvailableTemplates } = require('./inspection-templates');
const { setupCustomerRoutes, setupVehicleRoutes } = require('./api-routes');
const createTimezoneMiddleware = require('./middleware/timezone');

// Import route modules
const authRoutes = require('./routes/auth');
const inspectionRoutes = require('./routes/inspections');
const inspectionItemRoutes = require('./routes/inspection-items');
const vehicleRoutes = require('./routes/vehicles');
const customerRoutes = require('./routes/customers');
const portalRoutes = require('./routes/portal');
const photoRoutes = require('./routes/photos');
const smsRoutes = require('./routes/sms');
const voiceRoutes = require('./routes/voice');
const uploadRoutes = require('./routes/upload');
const shopRoutes = require('./routes/shops');

// Initialize Express app
const app = express();
const PORT = config.PORT;

// Initialize services
const db = new Database();
const auth = new AuthService(db);
const upload = new FileUpload();
const voiceParser = new VoiceParser();
const smsTemplates = new SMSTemplates();

// Initialize timezone middleware
const { 
  attachTimezoneService, 
  formatResponseTimestamps, 
  parseRequestTimestamps,
  timezoneService 
} = createTimezoneMiddleware(db);

// Simple auth middleware
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

// Middleware to inject services into request object for route handlers
const injectServices = (req, res, next) => {
  req.db = db;
  req.auth = auth;
  req.upload = upload;
  req.voiceParser = voiceParser;
  req.smsTemplates = smsTemplates;
  next();
};

// Serve static files from public directory (Expo web build)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        config.APP_URL,
        ...config.CORS_ORIGINS,
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

// CORS configuration from centralized config
const allowedOrigins = config.CORS_ORIGINS;

console.log('✅ CORS Origins configured:', allowedOrigins);

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
  }
  res.sendStatus(204);
});

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('⚠️ CORS blocked origin:', origin);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Apply timezone middleware globally
app.use(attachTimezoneService);
app.use(formatResponseTimestamps);
app.use(parseRequestTimestamps);

// Apply services middleware globally
app.use(injectServices);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

app.options('*', cors());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await db.query('SELECT NOW() as time, version() as version');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      database: {
        connected: true,
        version: dbHealth.rows[0].version.split(' ')[1],
        time: dbHealth.rows[0].time
      },
      services: {
        auth: 'ready',
        inspections: 'ready',
        voice: 'ready',
        sms: config.ENABLE_SMS ? 'ready' : 'disabled',
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

// Mount route handlers
app.use('/api/auth', authRoutes);
app.get('/api/inspection-templates', (req, res) => {
  try {
    const templates = getAvailableTemplates();
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Get inspection templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get inspection templates'
    });
  }
});
app.use('/api/inspections', authenticateToken, inspectionRoutes);
app.use('/api/inspections', authenticateToken, inspectionItemRoutes);
app.use('/api/inspection-items', authenticateToken, inspectionItemRoutes);
app.use('/api/vehicles', authenticateToken, vehicleRoutes);
app.use('/api/customers', authenticateToken, customerRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/photos', authenticateToken, photoRoutes);
app.use('/api/sms', authenticateToken, smsRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/upload', upload.single('file'), uploadRoutes);
app.use('/api/shops', shopRoutes);


// Static file serving
app.use('/uploads', express.static(path.join(__dirname, config.UPLOAD_PATH)));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Fallback route for client-side routing
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
    return next();
  }
  
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

// Setup Customer and Vehicle routes from api-routes.js
// Create wrapper for authenticateToken to match authMiddleware interface
const authMiddlewareWrapper = {
  authenticate: () => authenticateToken
};
setupCustomerRoutes(app, authMiddlewareWrapper, db);
setupVehicleRoutes(app, authMiddlewareWrapper, db);

// Error handling
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.url,
    timestamp: new Date().toISOString()
  });
});

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
  await db.close();
  server.close(() => {
    console.log('Server closed successfully');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server only if not in test environment
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║   Courtesy Inspection API Server - Production Ready     ║
║   Running on: http://localhost:${PORT}                     ║
║   Environment: ${config.NODE_ENV}                           ║
║   Database: ${config.DATABASE_URL ? 'Connected' : 'Not configured'}                           ║
║                                                          ║
║   🚀 Full Inspection CRUD Endpoints Active              ║
║                                                          ║
║   Endpoints:                                             ║
║   • Health: GET /api/health                             ║
║   • Auth: POST /api/auth/login                         ║
║   • Inspections: GET/POST/PUT/PATCH /api/inspections   ║
║   • Voice Parse: POST /api/voice/parse                  ║
║   • File Upload: POST /api/upload                       ║
║                                                          ║
║   Press Ctrl+C to stop the server                       ║
╚══════════════════════════════════════════════════════════╝
    `);
  });

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
