const express = require('express');

const router = express.Router();

// Vehicle Endpoints
router.post('/', async (req, res) => {
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
    
    const result = await req.db.query(`
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

router.get('/vin/:vin', async (req, res) => {
  try {
    const { vin } = req.params;
    
    const result = await req.db.query(`
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

router.patch('/:id/customer', async (req, res) => {
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
    const customerResult = await req.db.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const result = await req.db.query(`
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

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await req.db.query(`
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
});

module.exports = router;