// Shop Settings Routes
// Handles shop timezone and settings management

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db');

// Get shop settings including timezone
router.get('/shops/:shopId/settings', authenticateToken, async (req, res) => {
  try {
    const { shopId } = req.params;
    
    // Verify user has access to this shop
    if (req.user.shopId !== shopId && req.user.shop_id !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this shop'
      });
    }
    
    const query = `
      SELECT 
        id,
        name,
        address,
        phone,
        email,
        timezone,
        business_hours,
        created_at,
        updated_at
      FROM shops
      WHERE id = $1
    `;
    
    const result = await db.query(query, [shopId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }
    
    const shop = result.rows[0];
    
    // Also get user preferences if they exist
    const userQuery = `
      SELECT timezone, date_format, use_24hour_time
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await db.query(userQuery, [req.user.id]);
    const userPrefs = userResult.rows[0] || {};
    
    res.json({
      success: true,
      data: {
        ...shop,
        // Include user preferences if they override shop defaults
        user_timezone: userPrefs.timezone,
        user_date_format: userPrefs.date_format,
        user_24hour_time: userPrefs.use_24hour_time
      }
    });
    
  } catch (error) {
    console.error('Error fetching shop settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop settings'
    });
  }
});

// Update shop settings
router.patch('/shops/:shopId/settings', authenticateToken, async (req, res) => {
  try {
    const { shopId } = req.params;
    const {
      timezone,
      business_hours,
      date_format,
      use_24hour_time
    } = req.body;
    
    // Verify user has manager/admin access to this shop
    if (req.user.shopId !== shopId && req.user.shop_id !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this shop'
      });
    }
    
    if (req.user.role !== 'shop_manager' && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only managers can update shop settings'
      });
    }
    
    // Validate timezone if provided
    if (timezone) {
      const tzCheckQuery = `SELECT NOW() AT TIME ZONE $1`;
      try {
        await db.query(tzCheckQuery, [timezone]);
      } catch (tzError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid timezone'
        });
      }
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (timezone !== undefined) {
      updates.push(`timezone = $${paramCount++}`);
      values.push(timezone);
    }
    
    if (business_hours !== undefined) {
      updates.push(`business_hours = $${paramCount++}`);
      values.push(JSON.stringify(business_hours));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided'
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(shopId);
    
    const updateQuery = `
      UPDATE shops
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }
    
    // Update user preferences if provided
    if (date_format !== undefined || use_24hour_time !== undefined) {
      const userUpdates = [];
      const userValues = [];
      let userParamCount = 1;
      
      if (date_format !== undefined) {
        userUpdates.push(`date_format = $${userParamCount++}`);
        userValues.push(date_format);
      }
      
      if (use_24hour_time !== undefined) {
        userUpdates.push(`use_24hour_time = $${userParamCount++}`);
        userValues.push(use_24hour_time);
      }
      
      userValues.push(req.user.id);
      
      const userUpdateQuery = `
        UPDATE users
        SET ${userUpdates.join(', ')}
        WHERE id = $${userParamCount}
      `;
      
      await db.query(userUpdateQuery, userValues);
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating shop settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update shop settings'
    });
  }
});

// Get list of supported timezones
router.get('/timezones', authenticateToken, async (req, res) => {
  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)', abbr: 'EST/EDT' },
    { value: 'America/Chicago', label: 'Central Time (CT)', abbr: 'CST/CDT' },
    { value: 'America/Denver', label: 'Mountain Time (MT)', abbr: 'MST/MDT' },
    { value: 'America/Phoenix', label: 'Arizona Time (AZ)', abbr: 'MST' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', abbr: 'PST/PDT' },
    { value: 'America/Anchorage', label: 'Alaska Time (AK)', abbr: 'AKST/AKDT' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HI)', abbr: 'HST' },
    { value: 'America/Puerto_Rico', label: 'Atlantic Time (PR)', abbr: 'AST' },
  ];
  
  res.json({
    success: true,
    data: timezones
  });
});

module.exports = router;