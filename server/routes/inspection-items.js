/**
 * Inspection Items Routes
 * Handles CRUD operations for individual inspection checklist items
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/inspections/:inspectionId/items
 * Get all items for a specific inspection
 */
router.get('/:inspectionId/items', async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const { category, status, condition, priority } = req.query;
    const { db, user } = req;

    // Verify user has access to this inspection
    const inspectionCheck = await db.query(
      `SELECT shop_id FROM inspections WHERE id = $1`,
      [inspectionId]
    );

    if (inspectionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    // TODO: Add shop authorization check in production
    // if (inspectionCheck.rows[0].shop_id !== user.shop_id) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Access denied'
    //   });
    // }

    // Build query with optional filters
    let query = `
      SELECT 
        ii.*,
        u.full_name as checked_by_name,
        CASE 
          WHEN ii.checked_at IS NOT NULL THEN 
            json_build_object(
              'id', u.id,
              'name', u.full_name,
              'timestamp', ii.checked_at
            )
          ELSE NULL
        END as checked_by_details
      FROM inspection_items ii
      LEFT JOIN users u ON ii.checked_by = u.id
      WHERE ii.inspection_id = $1
    `;
    
    const params = [inspectionId];
    let paramCount = 1;

    if (category) {
      query += ` AND ii.category = $${++paramCount}`;
      params.push(category);
    }

    if (status) {
      query += ` AND ii.status = $${++paramCount}`;
      params.push(status);
    }

    if (condition) {
      query += ` AND ii.condition = $${++paramCount}`;
      params.push(condition);
    }

    if (priority) {
      query += ` AND ii.priority = $${++paramCount}`;
      params.push(priority);
    }

    query += ` ORDER BY 
      CASE ii.category
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
      ii.priority ASC,
      ii.component ASC`;

    const result = await db.query(query, params);

    // Get summary statistics
    const summaryResult = await db.query(
      'SELECT * FROM get_inspection_items_summary($1)',
      [inspectionId]
    );

    res.json({
      success: true,
      data: {
        items: result.rows,
        summary: summaryResult.rows[0],
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching inspection items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inspection items'
    });
  }
});

/**
 * POST /api/inspections/:inspectionId/items
 * Create a new inspection item
 */
router.post('/:inspectionId/items', async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const { 
      category,
      component,
      status = 'pending',
      condition,
      measurement_value,
      measurement_unit,
      notes,
      recommendations,
      estimated_cost,
      priority = 5,
      requires_immediate_attention = false
    } = req.body;
    const { db, user } = req;

    // Validate required fields
    if (!category || !component) {
      return res.status(400).json({
        success: false,
        error: 'Category and component are required'
      });
    }

    // Verify inspection exists and user has access
    const inspectionCheck = await db.query(
      `SELECT shop_id FROM inspections WHERE id = $1`,
      [inspectionId]
    );

    if (inspectionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    // Create the inspection item
    const result = await db.query(
      `INSERT INTO inspection_items (
        inspection_id, category, component, status, condition,
        measurement_value, measurement_unit, notes, recommendations,
        estimated_cost, priority, requires_immediate_attention,
        checked_by, checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        inspectionId, category, component, status, condition,
        measurement_value, measurement_unit, notes, recommendations,
        estimated_cost, priority, requires_immediate_attention,
        status === 'checked' ? user.id : null,
        status === 'checked' ? new Date() : null
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating inspection item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create inspection item'
    });
  }
});

/**
 * POST /api/inspections/:inspectionId/items/initialize
 * Initialize inspection items from templates
 */
router.post('/:inspectionId/items/initialize', async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const { db, user } = req;

    // Verify inspection exists and has no items yet
    const inspectionCheck = await db.query(
      `SELECT i.shop_id, COUNT(ii.id) as item_count
       FROM inspections i
       LEFT JOIN inspection_items ii ON i.id = ii.inspection_id
       WHERE i.id = $1
       GROUP BY i.shop_id`,
      [inspectionId]
    );

    if (inspectionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    if (inspectionCheck.rows[0].item_count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Inspection already has items'
      });
    }

    // Initialize items from templates
    const result = await db.query(
      'SELECT initialize_inspection_items($1, $2) as items_created',
      [inspectionId, inspectionCheck.rows[0].shop_id]
    );

    // Fetch the created items
    const itemsResult = await db.query(
      `SELECT * FROM inspection_items 
       WHERE inspection_id = $1 
       ORDER BY category, priority, component`,
      [inspectionId]
    );

    res.json({
      success: true,
      data: {
        items_created: result.rows[0].items_created,
        items: itemsResult.rows
      }
    });
  } catch (error) {
    console.error('Error initializing inspection items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize inspection items'
    });
  }
});

/**
 * PUT /api/inspections/:inspectionId/items/:itemId
 * Update an inspection item
 */
router.put('/:inspectionId/items/:itemId', async (req, res) => {
  try {
    const { inspectionId, itemId } = req.params;
    const { 
      status,
      condition,
      measurement_value,
      measurement_unit,
      notes,
      recommendations,
      estimated_cost,
      priority,
      requires_immediate_attention
    } = req.body;
    const { db, user } = req;

    // Verify item belongs to inspection
    const itemCheck = await db.query(
      `SELECT ii.*, i.shop_id 
       FROM inspection_items ii
       JOIN inspections i ON ii.inspection_id = i.id
       WHERE ii.id = $1 AND ii.inspection_id = $2`,
      [itemId, inspectionId]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection item not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (status !== undefined) {
      updates.push(`status = $${++paramCount}`);
      values.push(status);
      
      // Update checked_by and checked_at when status changes to checked
      if (status === 'checked' && itemCheck.rows[0].status !== 'checked') {
        updates.push(`checked_by = $${++paramCount}`);
        values.push(user.id);
        updates.push(`checked_at = $${++paramCount}`);
        values.push(new Date());
      }
    }

    if (condition !== undefined) {
      updates.push(`condition = $${++paramCount}`);
      values.push(condition);
    }

    if (measurement_value !== undefined) {
      updates.push(`measurement_value = $${++paramCount}`);
      values.push(measurement_value);
    }

    if (measurement_unit !== undefined) {
      updates.push(`measurement_unit = $${++paramCount}`);
      values.push(measurement_unit);
    }

    if (notes !== undefined) {
      updates.push(`notes = $${++paramCount}`);
      values.push(notes);
    }

    if (recommendations !== undefined) {
      updates.push(`recommendations = $${++paramCount}`);
      values.push(recommendations);
    }

    if (estimated_cost !== undefined) {
      updates.push(`estimated_cost = $${++paramCount}`);
      values.push(estimated_cost);
    }

    if (priority !== undefined) {
      updates.push(`priority = $${++paramCount}`);
      values.push(priority);
    }

    if (requires_immediate_attention !== undefined) {
      updates.push(`requires_immediate_attention = $${++paramCount}`);
      values.push(requires_immediate_attention);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    // Add updated_at
    updates.push(`updated_at = $${++paramCount}`);
    values.push(new Date());

    // Add WHERE clause parameters
    values.push(itemId);
    values.push(inspectionId);

    const query = `
      UPDATE inspection_items 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount + 1} AND inspection_id = $${paramCount + 2}
      RETURNING *`;

    const result = await db.query(query, values);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating inspection item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update inspection item'
    });
  }
});

/**
 * PATCH /api/inspections/:inspectionId/items/bulk-update
 * Bulk update multiple inspection items
 */
router.patch('/:inspectionId/items/bulk-update', async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const { updates } = req.body; // Array of { id, status, condition, notes, etc. }
    const { db, user } = req;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Updates array is required'
      });
    }

    // Verify all items belong to the inspection
    const itemIds = updates.map(u => u.id);
    const verifyResult = await db.query(
      `SELECT id FROM inspection_items 
       WHERE inspection_id = $1 AND id = ANY($2::uuid[])`,
      [inspectionId, itemIds]
    );

    if (verifyResult.rows.length !== updates.length) {
      return res.status(400).json({
        success: false,
        error: 'Some items do not belong to this inspection'
      });
    }

    // Start transaction for bulk update
    await db.query('BEGIN');

    try {
      const updatedItems = [];

      for (const update of updates) {
        const { id, ...fields } = update;
        
        // Build update query for each item
        const updateFields = [];
        const values = [];
        let paramCount = 0;

        Object.entries(fields).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields.push(`${key} = $${++paramCount}`);
            values.push(value);
          }
        });

        if (updateFields.length > 0) {
          // Add checked_by and checked_at if status is being set to checked
          if (fields.status === 'checked') {
            updateFields.push(`checked_by = $${++paramCount}`);
            values.push(user.id);
            updateFields.push(`checked_at = $${++paramCount}`);
            values.push(new Date());
          }

          updateFields.push(`updated_at = $${++paramCount}`);
          values.push(new Date());

          values.push(id);

          const result = await db.query(
            `UPDATE inspection_items 
             SET ${updateFields.join(', ')}
             WHERE id = $${paramCount + 1}
             RETURNING *`,
            values
          );

          updatedItems.push(result.rows[0]);
        }
      }

      await db.query('COMMIT');

      // Get updated summary
      const summaryResult = await db.query(
        'SELECT * FROM get_inspection_items_summary($1)',
        [inspectionId]
      );

      res.json({
        success: true,
        data: {
          updated_items: updatedItems,
          summary: summaryResult.rows[0]
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error bulk updating inspection items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update inspection items'
    });
  }
});

/**
 * DELETE /api/inspections/:inspectionId/items/:itemId
 * Delete an inspection item
 */
router.delete('/:inspectionId/items/:itemId', async (req, res) => {
  try {
    const { inspectionId, itemId } = req.params;
    const { db, user } = req;

    // Verify item belongs to inspection and user has access
    const result = await db.query(
      `DELETE FROM inspection_items 
       WHERE id = $1 AND inspection_id = $2
       RETURNING *`,
      [itemId, inspectionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection item not found'
      });
    }

    res.json({
      success: true,
      data: {
        deleted: true,
        item: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error deleting inspection item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete inspection item'
    });
  }
});

/**
 * GET /api/inspection-items/categories
 * Get all available categories and their default components
 */
router.get('/categories', async (req, res) => {
  try {
    const { db, user } = req;
    const { shop_id } = req.query;

    // Get categories and their components from templates
    const query = `
      SELECT 
        category,
        array_agg(
          json_build_object(
            'component', component,
            'priority', default_priority,
            'measurement_required', measurement_required,
            'measurement_unit', measurement_unit
          ) ORDER BY default_priority, component
        ) as components
      FROM inspection_item_templates
      WHERE is_active = TRUE
      AND (shop_id = $1 OR shop_id IS NULL)
      GROUP BY category
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
        END`;

    const result = await db.query(query, [shop_id || user.shop_id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

module.exports = router;