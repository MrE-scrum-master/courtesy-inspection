const express = require('express');

const router = express.Router();

// SMS preview endpoint
router.post('/preview', (req, res) => {
  try {
    const { template, data } = req.body;
    if (!template || !data) {
      return res.status(400).json({ error: 'Template and data are required' });
    }
    
    const message = req.smsTemplates.getMessage(template, data);
    
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
router.post('/send-mock', async (req, res) => {
  try {
    const { template, data, to_phone, inspection_id } = req.body;
    
    if (!template || !data || !to_phone) {
      return res.status(400).json({
        success: false,
        error: 'template, data, and to_phone are required'
      });
    }

    // Generate message and cost
    const message = req.smsTemplates.getMessage(template, data);
    const segments = Math.ceil(message.length / 160);
    const cost = segments * 0.004;
    
    // Generate mock short link
    const shortLink = `https://ci.link/${Math.random().toString(36).substring(2, 8)}`;
    const finalMessage = message.message.replace(data.link || '', shortLink);
    
    // Store in mock SMS messages table
    const result = await req.db.query(`
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
router.get('/history', async (req, res) => {
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
    
    const result = await req.db.query(query, params);
    
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
    const countResult = await req.db.query(countQuery, params.slice(0, -2));
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

module.exports = router;