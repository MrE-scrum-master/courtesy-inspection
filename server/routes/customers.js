const express = require('express');

const router = express.Router();

// Customer search endpoint
router.get('/search', async (req, res) => {
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

    const result = await req.db.query(query, params);

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

// Get customer vehicles
router.get('/:customerId/vehicles', async (req, res) => {
  try {
    const { customerId } = req.params;

    const result = await req.db.query(`
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

module.exports = router;