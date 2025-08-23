const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const puppeteer = require('puppeteer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');

// Import Railway PostgreSQL modules
const createDatabase = require('./db');
const AuthService = require('./auth');
const UploadService = require('./upload');

// Initialize database and services
const db = createDatabase();
const auth = new AuthService(db);
const upload = new UploadService(db);

const app = express();
const PORT = process.env.PORT || 3000;

// Unified deployment configuration
const WEB_BUILD_PATH = path.join(__dirname, 'web-build');
const PUBLIC_PATH = path.join(__dirname, 'public');
const LANDING_PAGE = path.join(PUBLIC_PATH, 'landing.html');

// Database health check on startup
setTimeout(async () => {
  try {
    const health = await db.healthCheck();
    console.log('Database health:', health);
  } catch (error) {
    console.error('Database health check failed:', error);
  }
}, 1000);

// Initialize Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Middleware
app.use(cors());
app.use(express.json());

// Trust proxy for Railway deployment
app.set('trust proxy', true);

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: dbHealth
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================
// AUTHENTICATION ROUTES
// =============================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await auth.register(req.body);
    res.json(result);
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const result = await auth.login(req.body);
    res.json(result);
  } catch (error) {
    console.error('Login Error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Refresh token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await auth.refreshToken(refreshToken);
    res.json(result);
  } catch (error) {
    console.error('Token Refresh Error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Logout user
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    await auth.logout(refreshToken);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', auth.authenticate(), async (req, res) => {
  res.json({ user: req.user });
});

// =============================================
// FILE UPLOAD ROUTES
// =============================================

// Upload inspection photo
app.post('/api/inspections/photos', 
  auth.authenticate(),
  upload.single('photo'),
  upload.handleInspectionPhotoUpload()
);

// Serve uploaded files
app.get('/api/uploads/:filename', upload.serveStaticFiles());

// Delete photo
app.delete('/api/inspections/photos/:photoId', auth.authenticate(), async (req, res) => {
  try {
    const { photoId } = req.params;
    await upload.deletePhoto(photoId, req.user.id, req.user.shop_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Photo Delete Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// INSPECTION ROUTES
// =============================================

// Create new inspection
app.post('/api/inspections', auth.authenticate(), async (req, res) => {
  try {
    const inspectionData = {
      ...req.body,
      shop_id: req.user.shop_id,
      technician_id: req.user.id,
      inspection_number: `INS-${Date.now()}`,
      status: 'in_progress'
    };
    
    const inspection = await db.insert('inspections', inspectionData);
    res.json({ success: true, inspection });
  } catch (error) {
    console.error('Inspection Creation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get inspections for shop
app.get('/api/inspections', auth.authenticate(), async (req, res) => {
  try {
    const inspections = await db.query(`
      SELECT 
        i.*,
        c.first_name, c.last_name,
        v.year, v.make, v.model,
        u.full_name as technician_name
      FROM inspections i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN users u ON i.technician_id = u.id
      WHERE i.shop_id = $1
      ORDER BY i.created_at DESC
    `, [req.user.shop_id]);
    
    res.json({ inspections: inspections.rows });
  } catch (error) {
    console.error('Inspections Fetch Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate short link for report
function generateShortCode() {
  return crypto.randomBytes(6).toString('base64url');
}

// SMS endpoint
app.post('/api/sms/send', async (req, res) => {
  try {
    const { to, message, reportId } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    // Send SMS via Twilio
    const twilioMessage = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    // Update report if reportId provided
    if (reportId) {
      await db.update('reports', {
        sent_at: new Date().toISOString(),
        sent_via: ['sms'],
        sent_to: { phone: to }
      }, { id: reportId });
    }

    res.json({ 
      success: true, 
      messageId: twilioMessage.sid,
      status: twilioMessage.status 
    });

  } catch (error) {
    console.error('SMS Error:', error);
    res.status(500).json({ 
      error: 'Failed to send SMS',
      details: error.message 
    });
  }
});

// Generate and send report
app.post('/api/reports/generate', async (req, res) => {
  try {
    const { inspectionId } = req.body;

    if (!inspectionId) {
      return res.status(400).json({ error: 'Inspection ID is required' });
    }

    // Fetch inspection data with related information
    const inspectionResult = await db.query(`
      SELECT 
        i.*,
        c.first_name, c.last_name, c.phone, c.email,
        v.year, v.make, v.model, v.vin, v.license_plate, v.color, v.mileage,
        u.full_name as technician_name,
        s.name as shop_name, s.phone as shop_phone, s.address as shop_address
      FROM inspections i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN users u ON i.technician_id = u.id
      LEFT JOIN shops s ON i.shop_id = s.id
      WHERE i.id = $1
    `, [inspectionId]);

    if (inspectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const inspection = inspectionResult.rows[0];

    // Fetch photos
    const photosResult = await db.query(
      'SELECT * FROM inspection_photos WHERE inspection_id = $1 ORDER BY sort_order, created_at',
      [inspectionId]
    );
    inspection.photos = photosResult.rows;

    // Generate HTML report
    const htmlContent = generateReportHTML(inspection);

    // Generate short link
    const shortCode = generateShortCode();
    const baseUrl = process.env.BASE_URL || process.env.PUBLIC_URL || `https://${req.get('host')}`;
    const shortLink = `${baseUrl}/l/${shortCode}`;

    // Save report to database
    const report = await db.insert('reports', {
      inspection_id: inspectionId,
      shop_id: inspection.shop_id,
      short_link: shortCode,
      html_content: htmlContent,
      report_url: shortLink
    });

    res.json({ 
      success: true, 
      reportId: report.id,
      shortLink: shortLink,
      reportUrl: shortLink
    });

  } catch (error) {
    console.error('Report Generation Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate report',
      details: error.message 
    });
  }
});

// View report by short link (changed from /r/ to /l/ for "link")
app.get('/l/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    // Fetch report by short link
    const report = await db.findOne('reports', { short_link: shortCode });

    if (!report) {
      return res.status(404).send(`
        <html>
          <head><title>Report Not Found</title></head>
          <body>
            <h1>Report Not Found</h1>
            <p>The requested report could not be found.</p>
          </body>
        </html>
      `);
    }

    // Update view count
    await db.update('reports', {
      view_count: (report.view_count || 0) + 1,
      viewed_at: new Date().toISOString()
    }, { id: report.id });

    // Serve HTML content
    res.send(report.html_content);

  } catch (error) {
    console.error('Report View Error:', error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error Loading Report</h1>
          <p>An error occurred while loading the report.</p>
        </body>
      </html>
    `);
  }
});

// Generate PDF report
app.post('/api/reports/pdf', async (req, res) => {
  try {
    const { reportId } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required' });
    }

    // Fetch report
    const report = await db.findOne('reports', { id: reportId });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(report.html_content);
    
    const pdf = await page.pdf({ 
      format: 'A4',
      printBackground: true,
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inspection-report-${reportId}.pdf"`
    });

    res.send(pdf);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message 
    });
  }
});

// =============================================
// HTML REPORT GENERATION
// =============================================

// Generate HTML content for report
function generateReportHTML(inspection) {
  const checklistItems = inspection.checklist_data || {};
  const photos = inspection.photos || [];
  
  // Get base URL for consistent linking
  const baseUrl = process.env.BASE_URL || process.env.PUBLIC_URL || 'https://your-domain.com';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inspection Report - ${inspection.inspection_number}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
                color: #333;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #007bff;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .shop-name {
                font-size: 28px;
                font-weight: bold;
                color: #007bff;
                margin-bottom: 5px;
            }
            .report-title {
                font-size: 24px;
                color: #333;
                margin: 10px 0;
            }
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
            }
            .info-section {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 6px;
                border-left: 4px solid #007bff;
            }
            .info-section h3 {
                margin: 0 0 15px 0;
                color: #007bff;
                font-size: 18px;
            }
            .info-item {
                margin-bottom: 8px;
                display: flex;
                justify-content: space-between;
            }
            .label {
                font-weight: 600;
                color: #555;
            }
            .value {
                color: #333;
            }
            .checklist {
                margin: 30px 0;
            }
            .checklist-category {
                background: white;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                margin-bottom: 20px;
                overflow: hidden;
            }
            .category-header {
                background: #007bff;
                color: white;
                padding: 15px 20px;
                font-weight: bold;
                font-size: 18px;
            }
            .checklist-items {
                padding: 20px;
            }
            .checklist-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            .checklist-item:last-child {
                border-bottom: none;
            }
            .status-good { color: #28a745; font-weight: bold; }
            .status-poor { color: #dc3545; font-weight: bold; }
            .status-fair { color: #ffc107; font-weight: bold; }
            .overall-condition {
                text-align: center;
                padding: 30px;
                background: linear-gradient(135deg, #007bff, #0056b3);
                color: white;
                border-radius: 8px;
                margin: 30px 0;
            }
            .condition-excellent { background: linear-gradient(135deg, #28a745, #1e7e34) !important; }
            .condition-good { background: linear-gradient(135deg, #17a2b8, #138496) !important; }
            .condition-fair { background: linear-gradient(135deg, #ffc107, #e0a800) !important; }
            .condition-poor { background: linear-gradient(135deg, #dc3545, #c82333) !important; }
            .photos {
                margin: 30px 0;
            }
            .photo-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            .photo {
                text-align: center;
                background: #f8f9fa;
                padding: 10px;
                border-radius: 6px;
            }
            .photo img {
                max-width: 100%;
                height: 150px;
                object-fit: cover;
                border-radius: 4px;
            }
            .photo-caption {
                margin-top: 10px;
                font-size: 14px;
                color: #666;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #dee2e6;
                text-align: center;
                font-size: 12px;
                color: #666;
            }
            .recommendations {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 6px;
                padding: 20px;
                margin: 30px 0;
            }
            .recommendations h3 {
                color: #856404;
                margin: 0 0 15px 0;
            }
            @media print {
                body { background: white; }
                .container { box-shadow: none; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="shop-name">${inspection.shop_name || 'Auto Shop'}</div>
                <div class="report-title">Vehicle Inspection Report</div>
                <div style="color: #666; margin-top: 10px;">Report #${inspection.inspection_number}</div>
            </div>

            <div class="info-grid">
                <div class="info-section">
                    <h3>Customer Information</h3>
                    <div class="info-item">
                        <span class="label">Name:</span>
                        <span class="value">${inspection.first_name} ${inspection.last_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Phone:</span>
                        <span class="value">${inspection.phone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Email:</span>
                        <span class="value">${inspection.email || 'N/A'}</span>
                    </div>
                </div>

                <div class="info-section">
                    <h3>Vehicle Information</h3>
                    <div class="info-item">
                        <span class="label">Year:</span>
                        <span class="value">${inspection.year || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Make/Model:</span>
                        <span class="value">${inspection.make} ${inspection.model}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">VIN:</span>
                        <span class="value">${inspection.vin || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Mileage:</span>
                        <span class="value">${inspection.mileage ? inspection.mileage.toLocaleString() + ' miles' : 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div class="info-grid">
                <div class="info-section">
                    <h3>Inspection Details</h3>
                    <div class="info-item">
                        <span class="label">Technician:</span>
                        <span class="value">${inspection.technician_name || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Date:</span>
                        <span class="value">${new Date(inspection.completed_at || inspection.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Status:</span>
                        <span class="value">${inspection.status.charAt(0).toUpperCase() + inspection.status.slice(1)}</span>
                    </div>
                </div>

                <div class="info-section">
                    <h3>Shop Information</h3>
                    <div class="info-item">
                        <span class="label">Shop:</span>
                        <span class="value">${inspection.shop_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Phone:</span>
                        <span class="value">${inspection.shop_phone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Address:</span>
                        <span class="value">${inspection.shop_address || 'N/A'}</span>
                    </div>
                </div>
            </div>

            ${inspection.overall_condition ? `
            <div class="overall-condition condition-${inspection.overall_condition}">
                <h2 style="margin: 0 0 10px 0;">Overall Vehicle Condition</h2>
                <div style="font-size: 24px; font-weight: bold; text-transform: uppercase;">
                    ${inspection.overall_condition}
                </div>
            </div>
            ` : ''}

            ${Object.keys(checklistItems).length > 0 ? `
            <div class="checklist">
                <h2>Inspection Checklist</h2>
                ${Object.entries(checklistItems).map(([category, items]) => `
                    <div class="checklist-category">
                        <div class="category-header">${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
                        <div class="checklist-items">
                            ${Object.entries(items).map(([item, status]) => `
                                <div class="checklist-item">
                                    <span>${item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                                    <span class="status-${status}">${status.toUpperCase()}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            ${inspection.recommendations ? `
            <div class="recommendations">
                <h3>Recommendations</h3>
                <p>${inspection.recommendations}</p>
            </div>
            ` : ''}

            ${photos.length > 0 ? `
            <div class="photos">
                <h2>Inspection Photos</h2>
                <div class="photo-grid">
                    ${photos.map(photo => `
                        <div class="photo">
                            <img src="${photo.file_url}" alt="Inspection Photo">
                            <div class="photo-caption">${photo.description || 'Inspection Photo'}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <div class="footer">
                <p>Report generated on ${new Date().toLocaleString()}</p>
                <p>${inspection.shop_name || 'Courtesy Inspection'} - Professional Vehicle Inspection Services</p>
                <p style="margin-top: 15px;">
                    <a href="${baseUrl}/app" style="color: #007bff; text-decoration: none;">📱 Open App</a> | 
                    <a href="${baseUrl}/" style="color: #007bff; text-decoration: none;">🏠 Home</a>
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
}

// =============================================
// UNIFIED DEPLOYMENT ROUTING
// =============================================

// 1. API Routes (highest priority - must come first)
// Already defined above: /api/sms/send, /api/reports/*, etc.

// 2. Short links for SMS cost optimization
// Already defined above: /l/:shortCode

// 3. Expo Web App - Serve at /app
app.use('/app', express.static(WEB_BUILD_PATH, {
  index: 'index.html',
  setHeaders: (res, filePath) => {
    // Cache static assets for 1 year
    if (filePath.includes('/static/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // Don't cache HTML files
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

// Handle client-side routing for Expo Web app
app.get('/app/*', (req, res) => {
  const indexPath = path.join(WEB_BUILD_PATH, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <html>
        <head><title>App Not Found</title></head>
        <body>
          <h1>App Not Built</h1>
          <p>The Expo web build was not found. Run 'expo export --platform web' first.</p>
          <p>Looking for: ${WEB_BUILD_PATH}</p>
        </body>
      </html>
    `);
  }
});

// 4. Landing Page - Serve at root
app.get('/', (req, res) => {
  if (fs.existsSync(LANDING_PAGE)) {
    res.sendFile(LANDING_PAGE);
  } else {
    // Fallback landing page if none exists
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Courtesy Inspection</title>
          <style>
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  max-width: 600px; 
                  margin: 100px auto; 
                  padding: 40px;
                  text-align: center;
                  background: #f8f9fa;
              }
              .container {
                  background: white;
                  padding: 60px 40px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              h1 { color: #007bff; margin-bottom: 20px; }
              .btn { 
                  display: inline-block;
                  background: #007bff; 
                  color: white; 
                  padding: 15px 30px; 
                  text-decoration: none; 
                  border-radius: 8px;
                  margin: 10px;
                  font-weight: 500;
              }
              .btn:hover { background: #0056b3; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🔧 Courtesy Inspection</h1>
              <p>Professional vehicle inspection services for auto shops.</p>
              <a href="/app" class="btn">Open App</a>
              <p style="margin-top: 40px; color: #666; font-size: 14px;">
                  Server Status: ✅ Running<br>
                  Environment: ${process.env.NODE_ENV || 'development'}
              </p>
          </div>
      </body>
      </html>
    `);
  }
});

// 5. Static assets (CSS, JS, images) - serve from public folder
app.use(express.static(PUBLIC_PATH, {
  setHeaders: (res, filePath) => {
    // Cache static assets
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  }
}));

// 6. 404 handler - must be last
app.get('*', (req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>404 - Not Found</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 500px; 
                margin: 100px auto; 
                padding: 40px;
                text-align: center;
                background: #f8f9fa;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #dc3545; }
            .links a { 
                display: inline-block;
                margin: 10px;
                color: #007bff;
                text-decoration: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>404 - Page Not Found</h1>
            <p>The requested page <code>${req.path}</code> could not be found.</p>
            <div class="links">
                <a href="/">← Home</a> |
                <a href="/app">📱 Open App</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  const baseUrl = process.env.BASE_URL || process.env.PUBLIC_URL || `http://localhost:${PORT}`;
  
  console.log('\n🚀 Courtesy Inspection Server Started');
  console.log('=====================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Base URL: ${baseUrl}`);
  console.log('\n📡 Available Routes:');
  console.log(`   🏠 Landing:    ${baseUrl}/`);
  console.log(`   📱 Web App:    ${baseUrl}/app`);
  console.log(`   🔌 API:        ${baseUrl}/api/*`);
  console.log(`   🔗 Links:      ${baseUrl}/l/*`);
  console.log('\n📂 Static Files:');
  console.log(`   📁 Web Build:  ${WEB_BUILD_PATH}`);
  console.log(`   📁 Public:     ${PUBLIC_PATH}`);
  
  // Check if web-build exists
  if (!fs.existsSync(WEB_BUILD_PATH)) {
    console.log('\n⚠️  WARNING: Expo web-build not found!');
    console.log('   Run: expo export --platform web');
  }
  
  console.log('\n✅ Server ready for requests\n');
});