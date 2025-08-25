// Customer and Vehicle API Routes
const express = require('express');
const bcrypt = require('bcryptjs');

// Helper function to validate phone numbers
function validatePhone(phone) {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  // Check if it's a valid phone number (7-15 digits to allow various formats)
  return cleaned.length >= 7 && cleaned.length <= 15;
}

// Helper function to format phone for storage
function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  // Store as simple 10-digit format
  return cleaned.slice(-10);
}

// Customer endpoints
async function setupCustomerRoutes(app, authMiddleware, db) {
  // Get all customers for a shop
  app.get('/api/customers', authMiddleware.authenticate(), async (req, res) => {
    try {
      const { shop_id, limit = 100, offset = 0 } = req.query;
      
      // Get customers with counts
      const customersQuery = `
        SELECT 
          c.id, 
          c.first_name, 
          c.last_name, 
          c.phone, 
          c.email, 
          c.shop_id, 
          c.created_at,
          COUNT(DISTINCT v.id) as vehicle_count,
          COUNT(DISTINCT i.id) as inspection_count,
          MAX(i.created_at) as last_inspection_date
        FROM customers c
        LEFT JOIN vehicles v ON c.id = v.customer_id
        LEFT JOIN inspections i ON c.id = i.customer_id
        WHERE c.shop_id = $1
        GROUP BY c.id, c.first_name, c.last_name, c.phone, c.email, c.shop_id, c.created_at
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const customersResult = await db.query(customersQuery, [shop_id || req.user.shop_id, limit, offset]);
      
      // Get vehicles for each customer
      const customerIds = customersResult.rows.map(c => c.id);
      let vehiclesMap = {};
      
      if (customerIds.length > 0) {
        const vehiclesQuery = `
          SELECT id, customer_id, make, model, year, license_plate, vin
          FROM vehicles
          WHERE customer_id = ANY($1)
          ORDER BY created_at DESC
        `;
        const vehiclesResult = await db.query(vehiclesQuery, [customerIds]);
        
        // Group vehicles by customer_id
        vehiclesResult.rows.forEach(vehicle => {
          if (!vehiclesMap[vehicle.customer_id]) {
            vehiclesMap[vehicle.customer_id] = [];
          }
          vehiclesMap[vehicle.customer_id].push(vehicle);
        });
      }
      
      // Combine customers with their vehicles
      const customersWithVehicles = customersResult.rows.map(customer => ({
        ...customer,
        vehicles: vehiclesMap[customer.id] || []
      }));
      
      res.json({
        success: true,
        data: customersWithVehicles
      });
    } catch (error) {
      console.error('Get customers error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch customers' });
    }
  });

  // Create a new customer
  app.post('/api/customers', authMiddleware.authenticate(), async (req, res) => {
    try {
      console.log('Create customer request body:', req.body);
      console.log('User from auth:', req.user);
      
      const { first_name, last_name, phone, email, shop_id } = req.body;
      
      // Validation
      if (!first_name || !last_name || !phone) {
        console.log('Missing required fields:', { first_name, last_name, phone });
        return res.status(400).json({ 
          success: false, 
          error: 'First name, last name, and phone are required' 
        });
      }
      
      if (!validatePhone(phone)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid phone number format' 
        });
      }
      
      const formattedPhone = formatPhone(phone);
      const shopIdToUse = shop_id || req.user.shop_id;
      
      // Check if customer already exists with this phone in this shop
      const existingCheck = await db.query(
        'SELECT id FROM customers WHERE phone = $1 AND shop_id = $2',
        [formattedPhone, shopIdToUse]
      );
      
      if (existingCheck.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          error: 'Customer with this phone number already exists' 
        });
      }
      
      // Insert new customer
      const insertQuery = `
        INSERT INTO customers (first_name, last_name, phone, email, shop_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, first_name, last_name, phone, email, shop_id, created_at
      `;
      
      const result = await db.query(insertQuery, [
        first_name,
        last_name,
        formattedPhone,
        email || null,
        shopIdToUse
      ]);
      
      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create customer error:', error);
      res.status(500).json({ success: false, error: 'Failed to create customer' });
    }
  });

  // Get a specific customer
  app.get('/api/customers/:id', authMiddleware.authenticate(), async (req, res) => {
    try {
      const { id } = req.params;
      
      const query = `
        SELECT c.*, 
               COUNT(DISTINCT v.id) as vehicle_count,
               COUNT(DISTINCT i.id) as inspection_count
        FROM customers c
        LEFT JOIN vehicles v ON v.customer_id = c.id
        LEFT JOIN inspections i ON i.customer_id = c.id
        WHERE c.id = $1 AND c.shop_id = $2
        GROUP BY c.id
      `;
      
      const result = await db.query(query, [id, req.user.shop_id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get customer error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch customer' });
    }
  });

  // Update a customer
  app.patch('/api/customers/:id', authMiddleware.authenticate(), async (req, res) => {
    try {
      const { id } = req.params;
      const { first_name, last_name, phone, email } = req.body;
      
      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (first_name !== undefined) {
        updates.push(`first_name = $${paramCount++}`);
        values.push(first_name);
      }
      if (last_name !== undefined) {
        updates.push(`last_name = $${paramCount++}`);
        values.push(last_name);
      }
      if (phone !== undefined) {
        if (!validatePhone(phone)) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid phone number format' 
          });
        }
        updates.push(`phone = $${paramCount++}`);
        values.push(formatPhone(phone));
      }
      if (email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(email || null);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }
      
      values.push(id);
      values.push(req.user.shop_id);
      
      const updateQuery = `
        UPDATE customers 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount} AND shop_id = $${paramCount + 1}
        RETURNING id, first_name, last_name, phone, email, shop_id, created_at, updated_at
      `;
      
      const result = await db.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update customer error:', error);
      res.status(500).json({ success: false, error: 'Failed to update customer' });
    }
  });
}

// Vehicle endpoints
async function setupVehicleRoutes(app, authMiddleware, db) {
  // Get all vehicles
  app.get('/api/vehicles', authMiddleware.authenticate(), async (req, res) => {
    try {
      const { customer_id, limit = 100, offset = 0 } = req.query;
      
      let query;
      let params;
      
      if (customer_id) {
        query = `
          SELECT v.*, c.first_name, c.last_name, c.phone, c.email
          FROM vehicles v
          LEFT JOIN customers c ON v.customer_id = c.id
          WHERE v.customer_id = $1
          ORDER BY v.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [customer_id, limit, offset];
      } else {
        query = `
          SELECT v.*, c.first_name, c.last_name, c.phone, c.email
          FROM vehicles v
          LEFT JOIN customers c ON v.customer_id = c.id
          WHERE c.shop_id = $1
          ORDER BY v.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [req.user.shop_id, limit, offset];
      }
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get vehicles error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch vehicles' });
    }
  });

  // Get vehicle by VIN
  app.get('/api/vehicles/vin/:vin', authMiddleware.authenticate(), async (req, res) => {
    try {
      const { vin } = req.params;
      
      const query = `
        SELECT 
          v.*,
          c.first_name as customer_first_name,
          c.last_name as customer_last_name,
          c.phone as customer_phone,
          c.email as customer_email
        FROM vehicles v
        LEFT JOIN customers c ON v.customer_id = c.id
        WHERE v.vin = $1
      `;
      
      const result = await db.query(query, [vin]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Vehicle not found',
          code: 'NOT_FOUND'
        });
      }
      
      // Format the response
      const vehicle = result.rows[0];
      const response = {
        id: vehicle.id,
        vin: vehicle.vin,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        license_plate: vehicle.license_plate,
        color: vehicle.color,
        mileage: vehicle.mileage,
        customer_id: vehicle.customer_id,
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at
      };
      
      // Add customer data if exists
      if (vehicle.customer_id) {
        response.customer = {
          first_name: vehicle.customer_first_name,
          last_name: vehicle.customer_last_name,
          phone: vehicle.customer_phone,
          email: vehicle.customer_email
        };
      }
      
      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      console.error('Get vehicle by VIN error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch vehicle' });
    }
  });

  // Create a new vehicle
  app.post('/api/vehicles', authMiddleware.authenticate(), async (req, res) => {
    try {
      const { vin, make, model, year, license_plate, color, mileage, customer_id } = req.body;
      
      // Validation
      if (!vin || !make || !model || !year) {
        return res.status(400).json({ 
          success: false, 
          error: 'VIN, make, model, and year are required' 
        });
      }
      
      if (vin.length !== 17) {
        return res.status(400).json({ 
          success: false, 
          error: 'VIN must be exactly 17 characters' 
        });
      }
      
      // Check if vehicle already exists
      const existingCheck = await db.query(
        'SELECT id FROM vehicles WHERE vin = $1',
        [vin]
      );
      
      if (existingCheck.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          error: 'Vehicle with this VIN already exists' 
        });
      }
      
      // Insert new vehicle
      const insertQuery = `
        INSERT INTO vehicles (vin, make, model, year, license_plate, color, mileage, customer_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const result = await db.query(insertQuery, [
        vin,
        make,
        model,
        year,
        license_plate || null,
        color || null,
        mileage || null,
        customer_id || null
      ]);
      
      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create vehicle error:', error);
      res.status(500).json({ success: false, error: 'Failed to create vehicle' });
    }
  });

  // Associate vehicle with customer
  app.patch('/api/vehicles/:id/customer', authMiddleware.authenticate(), async (req, res) => {
    try {
      const { id } = req.params;
      const { customer_id } = req.body;
      
      if (!customer_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'customer_id is required' 
        });
      }
      
      // Verify customer exists and belongs to the shop
      const customerCheck = await db.query(
        'SELECT id FROM customers WHERE id = $1 AND shop_id = $2',
        [customer_id, req.user.shop_id]
      );
      
      if (customerCheck.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found or does not belong to your shop' 
        });
      }
      
      // Update vehicle
      const updateQuery = `
        UPDATE vehicles 
        SET customer_id = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await db.query(updateQuery, [customer_id, id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Vehicle not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Associate vehicle error:', error);
      res.status(500).json({ success: false, error: 'Failed to associate vehicle' });
    }
  });

  // Update vehicle
  app.patch('/api/vehicles/:id', authMiddleware.authenticate(), async (req, res) => {
    try {
      const { id } = req.params;
      const { license_plate, color, mileage } = req.body;
      
      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (license_plate !== undefined) {
        updates.push(`license_plate = $${paramCount++}`);
        values.push(license_plate || null);
      }
      if (color !== undefined) {
        updates.push(`color = $${paramCount++}`);
        values.push(color || null);
      }
      if (mileage !== undefined) {
        updates.push(`mileage = $${paramCount++}`);
        values.push(mileage || null);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }
      
      values.push(id);
      
      const updateQuery = `
        UPDATE vehicles 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING *
      `;
      
      const result = await db.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Vehicle not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update vehicle error:', error);
      res.status(500).json({ success: false, error: 'Failed to update vehicle' });
    }
  });
}

module.exports = {
  setupCustomerRoutes,
  setupVehicleRoutes
};