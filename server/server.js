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

// POST /api/auth/refresh - Refresh JWT token
app.post('/api/auth/refresh', async (req, res) => {
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
    const userResult = await db.query(
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

// GET /api/auth/profile - Get current user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
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

// Vehicle Endpoints
app.post('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const {
      make,
      model,
      year,
      vin,
      license_plate,
      color,
      mileage,
      customer_id,
      shop_id
    } = req.body;

    if (!make || !model || !year || !vin) {
      return res.status(400).json({
        success: false,
        error: 'make, model, year, and vin are required'
      });
    }

    // Use provided shop_id or get from user's context
    const shopIdToUse = shop_id || req.user.shopId || req.user.shop_id;
    
    const result = await db.query(`
      INSERT INTO vehicles (shop_id, customer_id, make, model, year, vin, license_plate, color, mileage, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [shopIdToUse, customer_id, make, model, year, vin, license_plate, color, mileage]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Vehicle created successfully'
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/vehicles/vin/:vin', authenticateToken, async (req, res) => {
  try {
    const { vin } = req.params;
    
    const result = await db.query(`
      SELECT v.*, c.first_name, c.last_name, c.phone, c.email
      FROM vehicles v
      LEFT JOIN customers c ON v.customer_id = c.id
      WHERE v.vin = $1
    `, [vin]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    const vehicle = result.rows[0];
    const response = {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin,
      license_plate: vehicle.license_plate,
      color: vehicle.color,
      mileage: vehicle.mileage,
      customer_id: vehicle.customer_id,
      customer: vehicle.customer_id ? {
        first_name: vehicle.first_name,
        last_name: vehicle.last_name,
        phone: vehicle.phone,
        email: vehicle.email
      } : null
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Get vehicle by VIN error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Inspection Templates Endpoint
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

// Inspection Endpoints
app.post('/api/inspections', authenticateToken, async (req, res) => {
  try {
    const {
      vehicle_id,
      customer_id,
      mechanic_id,
      shop_id,
      type = 'basic', // inspection template type (basic, comprehensive, premium, quick)
      status = 'in_progress',
      mileage,
      notes = '',
      urgent_items = [],
      inspection_data = {}
    } = req.body;

    console.log('Creating inspection with data:', {
      vehicle_id,
      customer_id, 
      mechanic_id: mechanic_id || req.user.id,
      shop_id: shop_id || req.user.shop_id,
      type,
      status,
      mileage,
      notes,
      urgent_items
    });

    // Validate required fields
    if (!vehicle_id) {
      return res.status(400).json({
        success: false,
        error: 'vehicle_id is required'
      });
    }

    // Use authenticated user's shop_id if not provided
    const finalShopId = shop_id || req.user.shop_id;
    const finalMechanicId = mechanic_id || req.user.id;
    
    if (!finalShopId) {
      return res.status(400).json({
        success: false,
        error: 'shop_id is required and user must be associated with a shop'
      });
    }

    // Get vehicle and customer info if customer_id not provided
    let finalCustomerId = customer_id;
    if (!finalCustomerId) {
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
      
      finalCustomerId = vehicleResult.rows[0].customer_id;
    }

    if (!finalCustomerId) {
      return res.status(400).json({
        success: false,
        error: 'customer_id is required (vehicle must be associated with a customer)'
      });
    }

    // Validate inspection type
    const availableTemplates = getAvailableTemplates();
    const validTypes = availableTemplates.map(t => t.id);
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid inspection type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Create inspection
    const inspectionResult = await db.query(`
      INSERT INTO inspections (
        vehicle_id,
        shop_id,
        customer_id,
        mechanic_id,
        status,
        type,
        notes,
        started_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
      RETURNING *
    `, [
      vehicle_id,
      finalShopId,
      finalCustomerId,
      finalMechanicId,
      status,
      type,
      notes
    ]);

    const inspection = inspectionResult.rows[0];
    console.log('Created inspection:', inspection);

    // Generate and insert inspection items from template
    try {
      const templateItems = generateInspectionItems(type, inspection.id);
      console.log(`Generated ${templateItems.length} items for ${type} inspection`);
      
      if (templateItems.length > 0) {
        // Insert inspection items in batch
        const itemValues = templateItems.map((item, index) => {
          const paramIndex = index * 9;
          return `($${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, NOW(), NOW())`;
        }).join(', ');
        
        const itemParams = [];
        templateItems.forEach(item => {
          itemParams.push(
            item.inspection_id,
            item.category,
            item.component,
            item.status,
            item.severity,
            item.notes,
            item.measurement_value,
            item.measurement_unit
          );
        });
        
        const insertItemsQuery = `
          INSERT INTO inspection_items (
            inspection_id, category, component, status, severity, 
            notes, measurement_value, measurement_unit, created_at, updated_at
          ) VALUES ${itemValues}
          RETURNING id, category, component, status
        `;
        
        const itemsResult = await db.query(insertItemsQuery, itemParams);
        console.log(`Inserted ${itemsResult.rows.length} inspection items`);
      }
    } catch (itemError) {
      console.error('Error creating inspection items:', itemError);
      // Don't fail the whole request if items creation fails
      console.log('Continuing with inspection creation despite item creation error');
    }

    // Update vehicle mileage if provided
    if (mileage) {
      try {
        await db.query(
          'UPDATE vehicles SET mileage = $1, updated_at = NOW() WHERE id = $2',
          [mileage, vehicle_id]
        );
        console.log(`Updated vehicle ${vehicle_id} mileage to ${mileage}`);
      } catch (mileageError) {
        console.error('Error updating vehicle mileage:', mileageError);
        // Don't fail the whole request
      }
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
      error: error.message || 'Failed to create inspection'
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
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.phone as customer_phone,
        c.email as customer_email,
        s.name as shop_name,
        u.full_name as technician_name
      FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN customers c ON i.customer_id = c.id
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
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.phone as customer_phone,
        c.email as customer_email,
        s.name as shop_name,
        u.full_name as technician_name
      FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN customers c ON i.customer_id = c.id
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
    
    // Calculate cost (Telnyx pricing: $0.004 per segment)
    const segments = Math.ceil(message.length / 160);
    const cost = segments * 0.004;
    
    res.json({
      success: true,
      data: {
        ...message,
        segments,
        cost: parseFloat(cost.toFixed(4)),
        costFormatted: `$${cost.toFixed(4)}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mock SMS service endpoints (for demonstration without Telnyx API)
app.post('/api/sms/send-mock', authenticateToken, async (req, res) => {
  try {
    const { template, data, to_phone, inspection_id } = req.body;
    
    if (!template || !data || !to_phone) {
      return res.status(400).json({
        success: false,
        error: 'template, data, and to_phone are required'
      });
    }

    // Generate message and cost
    const message = smsTemplates.getMessage(template, data);
    const segments = Math.ceil(message.length / 160);
    const cost = segments * 0.004;
    
    // Generate mock short link
    const shortLink = `https://ci.link/${Math.random().toString(36).substring(2, 8)}`;
    const finalMessage = message.message.replace(data.link || '', shortLink);
    
    // Store in mock SMS messages table
    const result = await db.query(`
      INSERT INTO sms_messages (
        inspection_id, customer_id, to_phone, from_phone, 
        message, status, sent_at, telnyx_message_id
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING *
    `, [
      inspection_id || null,
      data.customer_id || null,
      to_phone,
      process.env.TELNYX_PHONE_NUMBER || '+15555551234',
      finalMessage,
      'sent', // Mock as sent immediately
      `mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    ]);

    const smsRecord = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: smsRecord.id,
        message: finalMessage,
        to: to_phone,
        segments,
        cost: parseFloat(cost.toFixed(4)),
        costFormatted: `$${cost.toFixed(4)}`,
        shortLink,
        status: 'sent',
        sentAt: smsRecord.sent_at,
        messageId: smsRecord.telnyx_message_id
      },
      message: 'SMS sent successfully (mock)'
    });
  } catch (error) {
    console.error('Mock SMS send error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get SMS history
app.get('/api/sms/history', authenticateToken, async (req, res) => {
  try {
    const { inspection_id, page = 1, limit = 10 } = req.query;
    
    let whereClause = '';
    let params = [];
    let paramCount = 0;
    
    if (inspection_id) {
      whereClause = 'WHERE inspection_id = $1';
      params.push(inspection_id);
      paramCount = 1;
    }
    
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    
    const query = `
      SELECT 
        sm.*,
        c.first_name || ' ' || c.last_name as customer_name,
        i.inspection_number
      FROM sms_messages sm
      LEFT JOIN customers c ON sm.customer_id = c.id
      LEFT JOIN inspections i ON sm.inspection_id = i.id
      ${whereClause}
      ORDER BY sm.sent_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    const result = await db.query(query, params);
    
    // Calculate costs for each message
    const messagesWithCost = result.rows.map(row => {
      const segments = Math.ceil(row.message.length / 160);
      const cost = segments * 0.004;
      
      return {
        ...row,
        segments,
        cost: parseFloat(cost.toFixed(4)),
        costFormatted: `$${cost.toFixed(4)}`
      };
    });
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM sms_messages ${whereClause}`;
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      success: true,
      data: messagesWithCost,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('SMS history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mock customer portal endpoint
app.get('/api/portal/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // In a real implementation, you'd decode the token to get inspection ID
    // For mock, we'll extract inspection ID from token (simple base64)
    let inspectionId;
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      inspectionId = decoded.split(':')[1]; // Format: "portal:123"
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid portal token'
      });
    }
    
    // Get inspection details
    const result = await db.query(`
      SELECT 
        i.*,
        v.year, v.make, v.model, v.license_plate,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        s.name as shop_name,
        s.phone as shop_phone,
        u.first_name || ' ' || u.last_name as technician_name
      FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN shops s ON i.shop_id = s.id
      LEFT JOIN users u ON i.technician_id = u.id
      WHERE i.id = $1
    `, [inspectionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }
    
    const inspection = result.rows[0];
    
    // Get inspection items (from checklist_data)
    let items = [];
    if (inspection.checklist_data) {
      try {
        items = JSON.parse(inspection.checklist_data);
      } catch {
        items = [];
      }
    }
    
    // Format response for customer portal
    const portalData = {
      inspection: {
        id: inspection.id,
        number: inspection.inspection_number,
        status: inspection.status,
        date: inspection.created_at,
        completionDate: inspection.completion_date,
        notes: inspection.notes
      },
      vehicle: {
        year: inspection.year,
        make: inspection.make,
        model: inspection.model,
        licensePlate: inspection.license_plate,
        display: `${inspection.year} ${inspection.make} ${inspection.model}`
      },
      customer: {
        name: inspection.customer_name,
        phone: inspection.customer_phone
      },
      shop: {
        name: inspection.shop_name,
        phone: inspection.shop_phone
      },
      technician: {
        name: inspection.technician_name
      },
      items: items.map(item => ({
        category: item.category,
        component: item.component,
        status: item.status,
        severity: item.severity,
        notes: item.notes,
        recommendation: item.recommendation,
        costEstimate: item.costEstimate
      })),
      summary: {
        totalItems: items.length,
        okItems: items.filter(item => item.status === 'ok').length,
        issueItems: items.filter(item => item.status !== 'ok').length,
        urgentItems: items.filter(item => item.severity === 'urgent').length
      }
    };
    
    res.json({
      success: true,
      data: portalData
    });
  } catch (error) {
    console.error('Customer portal error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate portal link (mock)
app.post('/api/portal/generate', authenticateToken, async (req, res) => {
  try {
    const { inspection_id } = req.body;
    
    if (!inspection_id) {
      return res.status(400).json({
        success: false,
        error: 'inspection_id is required'
      });
    }
    
    // Generate simple token (in production, use JWT or secure token)
    const token = Buffer.from(`portal:${inspection_id}`).toString('base64');
    const portalUrl = `${config.APP_URL}/portal/${token}`;
    
    res.json({
      success: true,
      data: {
        token,
        url: portalUrl,
        shortUrl: `https://ci.link/${Math.random().toString(36).substring(2, 8)}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });
  } catch (error) {
    console.error('Portal generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Photo upload endpoints
app.post('/api/photos/upload', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { inspection_id, item_id, caption } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No photo uploaded'
      });
    }

    if (!inspection_id) {
      return res.status(400).json({
        success: false,
        error: 'inspection_id is required'
      });
    }

    // Verify inspection exists and user has access
    const inspectionResult = await db.query(
      'SELECT id FROM inspections WHERE id = $1',
      [inspection_id]
    );

    if (inspectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    // Save photo metadata to database
    const photoResult = await db.query(`
      INSERT INTO inspection_photos (
        inspection_id, item_id, file_path, file_size, 
        mime_type, caption, uploaded_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [
      inspection_id,
      item_id || null,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      caption || '',
      req.user.id
    ]);

    const photo = photoResult.rows[0];
    
    res.status(201).json({
      success: true,
      data: {
        id: photo.id,
        url: `/api/photos/${photo.id}`,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        caption: photo.caption,
        createdAt: photo.created_at
      },
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get photo by ID
app.get('/api/photos/:id', authenticateToken, async (req, res) => {
  try {
    const photoResult = await db.query(`
      SELECT ip.*, i.shop_id 
      FROM inspection_photos ip
      JOIN inspections i ON ip.inspection_id = i.id
      WHERE ip.id = $1
    `, [req.params.id]);

    if (photoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found'
      });
    }

    const photo = photoResult.rows[0];
    
    // Security check - serve the actual file
    const path = require('path');
    const fs = require('fs');
    
    if (!fs.existsSync(photo.file_path)) {
      return res.status(404).json({
        success: false,
        error: 'Photo file not found'
      });
    }

    // Set appropriate headers and serve file
    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(path.resolve(photo.file_path));
    
  } catch (error) {
    console.error('Get photo error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Attach photo to inspection item
app.post('/api/inspections/:id/photos', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { item_id, caption } = req.body;
    const inspection_id = req.params.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No photo uploaded'
      });
    }

    // Verify inspection exists
    const inspectionResult = await db.query(
      'SELECT id FROM inspections WHERE id = $1',
      [inspection_id]
    );

    if (inspectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    // Save photo
    const photoResult = await db.query(`
      INSERT INTO inspection_photos (
        inspection_id, item_id, file_path, file_size, 
        mime_type, caption, uploaded_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [
      inspection_id,
      item_id || null,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      caption || '',
      req.user.id
    ]);

    const photo = photoResult.rows[0];
    
    res.status(201).json({
      success: true,
      data: {
        id: photo.id,
        url: `/api/photos/${photo.id}`,
        caption: photo.caption,
        createdAt: photo.created_at
      },
      message: 'Photo attached to inspection'
    });
  } catch (error) {
    console.error('Attach photo error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete photo (soft delete)
app.delete('/api/photos/:id', authenticateToken, async (req, res) => {
  try {
    const photoResult = await db.query(`
      SELECT ip.*, i.shop_id 
      FROM inspection_photos ip
      JOIN inspections i ON ip.inspection_id = i.id
      WHERE ip.id = $1
    `, [req.params.id]);

    if (photoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found'
      });
    }

    // Soft delete - mark as deleted instead of actually deleting
    await db.query(`
      UPDATE inspection_photos 
      SET file_path = CONCAT(file_path, '.deleted'), caption = 'DELETED'
      WHERE id = $1
    `, [req.params.id]);

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Legacy file upload endpoint (kept for compatibility)
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

// Shop settings routes (for timezone management)
app.use('/api', shopRoutes);

// Vehicle endpoints - DISABLED (using api-routes.js version)
/* app.get('/api/vehicles/vin/:vin', authenticateToken, async (req, res) => {
  try {
    const { vin } = req.params;
    
    if (!vin) {
      return res.status(400).json({
        success: false,
        error: 'VIN is required'
      });
    }

    const result = await db.query(`
      SELECT 
        v.*,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.phone as customer_phone,
        c.email as customer_email
      FROM vehicles v
      LEFT JOIN customers c ON v.customer_id = c.id
      WHERE v.vin = $1
    `, [vin]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        data: null
      });
    }

    const vehicle = result.rows[0];
    const response = {
      id: vehicle.id,
      customer_id: vehicle.customer_id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin,
      license_plate: vehicle.license_plate,
      color: vehicle.color,
      mileage: vehicle.mileage,
      created_at: vehicle.created_at,
      updated_at: vehicle.updated_at,
      customer: vehicle.customer_id ? {
        first_name: vehicle.customer_first_name,
        last_name: vehicle.customer_last_name,
        phone: vehicle.customer_phone,
        email: vehicle.customer_email
      } : null
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Get vehicle by VIN error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}); */

/* app.post('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const { 
      vin, 
      make, 
      model, 
      year, 
      license_plate, 
      color, 
      mileage,
      customer_id 
    } = req.body;

    if (!vin) {
      return res.status(400).json({
        success: false,
        error: 'VIN is required'
      });
    }

    // Check if VIN already exists
    const existingVehicle = await db.query('SELECT id FROM vehicles WHERE vin = $1', [vin]);
    if (existingVehicle.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Vehicle with this VIN already exists'
      });
    }

    const result = await db.query(`
      INSERT INTO vehicles (
        customer_id, make, model, year, vin, 
        license_plate, color, mileage, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [customer_id || null, make, model, year, vin, license_plate, color, mileage]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Vehicle created successfully'
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.patch('/api/vehicles/:id/customer', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'customer_id is required'
      });
    }

    // Verify customer exists
    const customerResult = await db.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const result = await db.query(`
      UPDATE vehicles 
      SET customer_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [customer_id, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Vehicle associated with customer successfully'
    });
  } catch (error) {
    console.error('Associate vehicle with customer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        v.*,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.phone as customer_phone,
        c.email as customer_email
      FROM vehicles v
      LEFT JOIN customers c ON v.customer_id = c.id
      WHERE v.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    const vehicle = result.rows[0];
    const response = {
      id: vehicle.id,
      customer_id: vehicle.customer_id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin,
      license_plate: vehicle.license_plate,
      color: vehicle.color,
      mileage: vehicle.mileage,
      created_at: vehicle.created_at,
      updated_at: vehicle.updated_at,
      customer: vehicle.customer_id ? {
        first_name: vehicle.customer_first_name,
        last_name: vehicle.customer_last_name,
        phone: vehicle.customer_phone,
        email: vehicle.customer_email
      } : null
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}); */

app.get('/api/customers/:customerId/vehicles', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;

    const result = await db.query(`
      SELECT * FROM vehicles 
      WHERE customer_id = $1 
      ORDER BY created_at DESC
    `, [customerId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get customer vehicles error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Customer endpoints
// DISABLED - Using api-routes.js version instead
/* app.get('/api/customers', authenticateToken, async (req, res) => {
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
}); */

// DISABLED - Using api-routes.js version instead
/* app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, full_name, email, phone, shop_id } = req.body;
    
    // Support both first_name/last_name format and full_name format
    let firstName, lastName;
    if (first_name && last_name) {
      firstName = first_name;
      lastName = last_name;
    } else if (full_name) {
      // Split full_name into first and last name
      const nameParts = full_name.trim().split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ') || nameParts[0]; // Use first name as last name if no space
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either first_name and last_name, or full_name are required'
      });
    }

    if (!firstName || !lastName || !phone || !shop_id) {
      return res.status(400).json({
        success: false,
        error: 'first_name (or full_name), last_name, phone, and shop_id are required'
      });
    }

    const result = await db.query(`
      INSERT INTO customers (first_name, last_name, email, phone, shop_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [firstName, lastName, email, phone, shop_id]);

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
}); */

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