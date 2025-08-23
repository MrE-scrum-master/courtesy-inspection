/**
 * Courtesy Inspection API Server - Hybrid TypeScript/JavaScript
 * Express server with Railway PostgreSQL integration
 * Production-ready with security, logging, and error handling
 * Integrates TypeScript inspection controllers with JavaScript base
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import JavaScript templates (local copies for Railway deployment)
const Database = require('./db');
const AuthService = require('./auth');
const FileUpload = require('./upload');
const VoiceParser = require('./voice-parser');
const SMSTemplates = require('./sms-templates');

// Import TypeScript compiled controllers
const { InspectionController } = require('./dist/controllers/InspectionController');
const { AuthController } = require('./dist/controllers/AuthController');
const { InspectionService } = require('./dist/services/InspectionService');
const { AuthService: TSAuthService } = require('./dist/services/AuthService');
const { AuthMiddleware } = require('./dist/middleware/auth');
const { ValidationMiddleware } = require('./dist/middleware/validation');
const { ErrorMiddleware } = require('./dist/middleware/error');
const schemas = require('./dist/validators/schemas');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize JavaScript services (working database connection)
const db = new Database();
const auth = new AuthService(db);
const upload = new FileUpload();
const voiceParser = new VoiceParser();
const smsTemplates = new SMSTemplates();

// Initialize TypeScript services
const tsAuthService = new TSAuthService(db);
const inspectionService = new InspectionService(db);
const authMiddleware = new AuthMiddleware(tsAuthService);
const authController = new AuthController(tsAuthService);
const inspectionController = new InspectionController(inspectionService);

// Serve static files from public directory (Expo web build)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://courtesy-inspection.up.railway.app",
        "https://app.courtesyinspection.com",
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

// CORS configuration
const allowedOrigins = [
  'https://app.courtesyinspection.com',
  'https://courtesyinspection.com',
  'https://courtesy-inspection.up.railway.app',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
  'exp://localhost:8081'
];

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
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
        upload: 'ready',
        inspections: 'typescript-ready'
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

// Legacy JavaScript Authentication endpoints
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

// TypeScript Inspection endpoints with proper middleware
app.post('/api/inspections', 
  authMiddleware.authenticate(),
  ValidationMiddleware.validateBody(schemas.createInspectionSchema),
  ErrorMiddleware.asyncHandler(inspectionController.createInspection.bind(inspectionController))
);

app.get('/api/inspections/:id',
  authMiddleware.authenticate(),
  ValidationMiddleware.validateParams(schemas.idParamSchema),
  ErrorMiddleware.asyncHandler(inspectionController.getInspectionById.bind(inspectionController))
);

app.get('/api/inspections',
  authMiddleware.authenticate(),
  ValidationMiddleware.validateQuery(schemas.inspectionQuerySchema),
  ErrorMiddleware.asyncHandler(inspectionController.getInspections.bind(inspectionController))
);

app.put('/api/inspections/:id',
  authMiddleware.authenticate(),
  ValidationMiddleware.validateParams(schemas.idParamSchema),
  ValidationMiddleware.validateBody(schemas.updateInspectionSchema),
  ErrorMiddleware.asyncHandler(inspectionController.updateInspection.bind(inspectionController))
);

app.patch('/api/inspections/:id/items',
  authMiddleware.authenticate(),
  ValidationMiddleware.validateParams(schemas.idParamSchema),
  ValidationMiddleware.validateBody(schemas.inspectionItemUpdateSchema),
  ErrorMiddleware.asyncHandler(inspectionController.updateInspectionItem.bind(inspectionController))
);

app.delete('/api/inspections/:id',
  authMiddleware.authenticate(),
  authMiddleware.authorize('admin'),
  ValidationMiddleware.validateParams(schemas.idParamSchema),
  ErrorMiddleware.asyncHandler(inspectionController.deleteInspection.bind(inspectionController))
);

app.get('/api/inspections/statistics/:shopId',
  authMiddleware.authenticate(),
  authMiddleware.requireShopAccess(),
  ErrorMiddleware.asyncHandler(inspectionController.getShopStatistics.bind(inspectionController))
);

// Legacy JavaScript endpoints
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

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_PATH || 'data/uploads')));
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

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   Courtesy Inspection API Server (Hybrid TS/JS)         ║
║   Running on: http://localhost:${PORT}                      ║
║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
║   Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}                           ║
║                                                          ║
║   🚀 TypeScript Inspection Endpoints Active             ║
║   🔧 JavaScript Base Services Active                    ║
║                                                          ║
║   Endpoints:                                             ║
║   • Health: GET /api/health                             ║
║   • Auth: POST /api/auth/login                         ║
║   • Inspections: GET/POST /api/inspections             ║
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

module.exports = app;