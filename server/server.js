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

// Import templates (local copies for Railway deployment)
const Database = require('./db');
const AuthService = require('./auth');
const FileUpload = require('./upload');
const VoiceParser = require('./voice-parser');
const SMSTemplates = require('./sms-templates');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8847;

// Initialize services
const db = new Database();
const auth = new AuthService(db);
const upload = new FileUpload();
const voiceParser = new VoiceParser();
const smsTemplates = new SMSTemplates();

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

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
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
      ...user
    };
    next();
  });
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
  'http://localhost:8847',
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
        inspections: 'ready',
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

// Inspection Endpoints
app.post('/api/inspections', authenticateToken, async (req, res) => {
  try {
    const {
      vehicle_id,
      shop_id,
      inspection_type = 'courtesy',
      notes = '',
      items = []
    } = req.body;

    // Validate required fields
    if (!vehicle_id || !shop_id) {
      return res.status(400).json({
        success: false,
        error: 'vehicle_id and shop_id are required'
      });
    }

    // Get customer_id from vehicle
    const vehicleResult = await db.query(
      'SELECT customer_id FROM vehicles WHERE id = $1',
      [vehicle_id]
    );
    
    if (vehicleResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle not found'
      });
    }
    
    const customer_id = vehicleResult.rows[0].customer_id;

    // Generate inspection number
    const inspectionNumberResult = await db.query(
      `SELECT 'CI-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
       LPAD(CAST(COALESCE(MAX(CAST(SPLIT_PART(inspection_number, '-', 3) AS INTEGER)), 0) + 1 AS TEXT), 6, '0') as number
       FROM inspections WHERE shop_id = $1`,
      [shop_id]
    );
    const inspection_number = inspectionNumberResult.rows[0].number;

    // Create inspection
    const inspectionResult = await db.query(`
      INSERT INTO inspections (
        inspection_number,
        vehicle_id,
        shop_id,
        customer_id,
        technician_id,
        status,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      inspection_number,
      vehicle_id,
      shop_id,
      customer_id,
      req.user.id,
      'in_progress',
      notes
    ]);

    const inspection = inspectionResult.rows[0];

    // Update inspection with checklist data if provided
    if (items && items.length > 0) {
      await db.query(`
        UPDATE inspections 
        SET checklist_data = $1
        WHERE id = $2
      `, [JSON.stringify(items), inspection.id]);
    }

    res.status(201).json({
      success: true,
      data: inspection,
      message: 'Inspection created successfully'
    });

  } catch (error) {
    console.error('Create inspection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/inspections/:id', authenticateToken, async (req, res) => {
  try {
    const inspectionResult = await db.query(`
      SELECT 
        i.*,
        v.year, v.make, v.model, v.license_plate,
        s.name as shop_name,
        u.full_name
      FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN shops s ON i.shop_id = s.id
      LEFT JOIN users u ON i.technician_id = u.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (inspectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    res.json({
      success: true,
      data: inspectionResult.rows[0]
    });
  } catch (error) {
    console.error('Get inspection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Shop-specific inspections endpoint (needed by frontend)
app.get('/api/inspections/shop/:shopId', authenticateToken, async (req, res) => {
  try {
    const { shopId } = req.params;
    const { 
      status, 
      page = 1, 
      limit = 10,
      start_date,
      end_date 
    } = req.query;

    let whereClause = 'WHERE i.shop_id = $1';
    let params = [shopId];
    let paramCount = 1;

    if (status) {
      whereClause += ` AND i.status = $${++paramCount}`;
      params.push(status);
    }

    if (start_date) {
      whereClause += ` AND i.created_at >= $${++paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND i.created_at <= $${++paramCount}`;
      params.push(end_date);
    }

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const query = `
      SELECT 
        i.*,
        v.year, v.make, v.model, v.license_plate,
        s.name as shop_name,
        u.full_name
      FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN shops s ON i.shop_id = s.id
      LEFT JOIN users u ON i.technician_id = u.id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const result = await db.query(query, params);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM inspections i
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('List shop inspections error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/inspections', authenticateToken, async (req, res) => {
  try {
    const { 
      shop_id, 
      status, 
      page = 1, 
      limit = 10,
      start_date,
      end_date 
    } = req.query;

    let whereClause = '';
    let params = [];
    let paramCount = 0;

    if (shop_id) {
      whereClause += ` AND i.shop_id = $${++paramCount}`;
      params.push(shop_id);
    }

    if (status) {
      whereClause += ` AND i.status = $${++paramCount}`;
      params.push(status);
    }

    if (start_date) {
      whereClause += ` AND i.created_at >= $${++paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND i.created_at <= $${++paramCount}`;
      params.push(end_date);
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        i.*,
        v.year, v.make, v.model, v.license_plate,
        s.name as shop_name,
        u.full_name
      FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN shops s ON i.shop_id = s.id
      LEFT JOIN users u ON i.technician_id = u.id
      WHERE 1=1 ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    params.push(limit, offset);

    const result = await db.query(query, params);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inspections i
      WHERE 1=1 ${whereClause}
    `;
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('List inspections error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/inspections/:id', authenticateToken, async (req, res) => {
  try {
    const { status, notes, completion_date } = req.body;
    
    const updateFields = [];
    const params = [];
    let paramCount = 0;

    if (status !== undefined) {
      updateFields.push(`status = $${++paramCount}`);
      params.push(status);
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${++paramCount}`);
      params.push(notes);
    }

    if (completion_date !== undefined) {
      updateFields.push(`completion_date = $${++paramCount}`);
      params.push(completion_date);
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const query = `
      UPDATE inspections 
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Inspection updated successfully'
    });

  } catch (error) {
    console.error('Update inspection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.patch('/api/inspections/:id/items', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required'
      });
    }

    // Update checklist_data
    const result = await db.query(`
      UPDATE inspections 
      SET checklist_data = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [JSON.stringify(items), req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Inspection items updated successfully'
    });

  } catch (error) {
    console.error('Update inspection items error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Voice and other endpoints (existing)
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

// Customer endpoints
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { search, shop_id, page = 1, limit = 10 } = req.query;
    
    let whereClause = '';
    let params = [];
    let paramCount = 0;

    if (shop_id) {
      whereClause = `WHERE shop_id = $${++paramCount}`;
      params.push(shop_id);
    }

    if (search) {
      const searchCondition = shop_id ? ' AND' : ' WHERE';
      whereClause += `${searchCondition} (
        full_name ILIKE $${++paramCount} OR 
        email ILIKE $${paramCount} OR 
        phone ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const query = `
      SELECT * FROM customers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const result = await db.query(query, params);

    const countQuery = `SELECT COUNT(*) as total FROM customers ${whereClause}`;
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List customers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { full_name, email, phone, shop_id, address } = req.body;

    if (!full_name || !phone || !shop_id) {
      return res.status(400).json({
        success: false,
        error: 'full_name, phone, and shop_id are required'
      });
    }

    const result = await db.query(`
      INSERT INTO customers (full_name, email, phone, shop_id, address, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [full_name, email, phone, shop_id, address]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Customer created successfully'
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/customers/search', authenticateToken, async (req, res) => {
  try {
    const { q, shop_id } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    let query = `
      SELECT * FROM customers
      WHERE (full_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)
    `;
    const params = [`%${q}%`];

    if (shop_id) {
      query += ' AND shop_id = $2';
      params.push(shop_id);
    }

    query += ' LIMIT 10';

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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
║   Courtesy Inspection API Server - Production Ready     ║
║   Running on: http://localhost:${PORT}                     ║
║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
║   Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}                           ║
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

module.exports = app;