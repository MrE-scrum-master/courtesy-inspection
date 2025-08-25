const express = require('express');
const { generateInspectionItems, getAvailableTemplates } = require('../inspection-templates');

const router = express.Router();

// Inspection Endpoints
router.post('/', async (req, res) => {
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
      const vehicleResult = await req.db.query(
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
    const inspectionResult = await req.db.query(`
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
        
        const itemsResult = await req.db.query(insertItemsQuery, itemParams);
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
        await req.db.query(
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

router.get('/:id', async (req, res) => {
  try {
    const { include_items } = req.query;
    
    const inspectionResult = await req.db.query(`
      SELECT 
        i.*,
        v.year, v.make, v.model, v.license_plate,
        s.name as shop_name,
        u.full_name,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.phone as customer_phone,
        c.email as customer_email
      FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN shops s ON i.shop_id = s.id
      LEFT JOIN users u ON i.technician_id = u.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (inspectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    const inspection = inspectionResult.rows[0];

    // Include items if requested
    if (include_items === 'true') {
      const itemsResult = await req.db.query(
        `SELECT * FROM inspection_items 
         WHERE inspection_id = $1 
         ORDER BY 
           CASE category
             WHEN 'Brakes' THEN 1
             WHEN 'Tires' THEN 2
             WHEN 'Fluids' THEN 3
             WHEN 'Filters' THEN 4
             WHEN 'Battery' THEN 5
             WHEN 'Lights' THEN 6
             WHEN 'Wipers' THEN 7
             WHEN 'Belts & Hoses' THEN 8
             WHEN 'Suspension' THEN 9
             WHEN 'Exhaust' THEN 10
             ELSE 99
           END,
           priority ASC,
           component ASC`,
        [req.params.id]
      );

      inspection.items = itemsResult.rows;

      // Get summary
      const summaryResult = await req.db.query(
        'SELECT * FROM get_inspection_items_summary($1)',
        [req.params.id]
      );
      
      inspection.items_summary = summaryResult.rows[0];
    }

    res.json({
      success: true,
      data: inspection
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
router.get('/shop/:shopId', async (req, res) => {
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

    const result = await req.db.query(query, params);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM inspections i
      ${whereClause}
    `;
    const countResult = await req.db.query(countQuery, params.slice(0, -2));
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

router.get('/', async (req, res) => {
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

    const result = await req.db.query(query, params);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inspections i
      WHERE 1=1 ${whereClause}
    `;
    const countResult = await req.db.query(countQuery, params.slice(0, -2));
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

router.put('/:id', async (req, res) => {
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

    const result = await req.db.query(query, params);

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

router.patch('/:id/items', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required'
      });
    }

    // Update checklist_data
    const result = await req.db.query(`
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

// Attach photo to inspection item
router.post('/:id/photos', (req, res, next) => {
  // Apply upload middleware
  req.upload.single('photo')(req, res, next);
}, async (req, res) => {
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
    const inspectionResult = await req.db.query(
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
    const photoResult = await req.db.query(`
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

module.exports = router;