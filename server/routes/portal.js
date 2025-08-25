const express = require('express');
const config = require('../config');

const router = express.Router();

// Mock customer portal endpoint
router.get('/:token', async (req, res) => {
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
    const result = await req.db.query(`
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
router.post('/generate', async (req, res) => {
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

module.exports = router;