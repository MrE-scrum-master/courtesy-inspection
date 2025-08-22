// Workflow Engine Service for Inspection State Management
// Implements state machine logic with validation and business rules
// Supports role-based transitions and audit trail

import { BaseRepository } from '../repositories/BaseRepository';
import { DatabaseService } from '../types/common';

export type WorkflowState = 
  | 'draft' 
  | 'in_progress' 
  | 'pending_review' 
  | 'approved' 
  | 'rejected' 
  | 'sent_to_customer' 
  | 'completed';

export type UserRole = 'mechanic' | 'shop_manager' | 'admin';

export interface StateTransition {
  from: WorkflowState;
  to: WorkflowState;
  allowedRoles: UserRole[];
  conditions?: string[];
  validations?: string[];
  actions?: string[];
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WorkflowTransitionRequest {
  inspectionId: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  userId: string;
  userRole: UserRole;
  shopId: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export class WorkflowService {
  private db: DatabaseService;
  
  // Define valid state transitions with role-based access control
  private readonly transitions: StateTransition[] = [
    // Draft to In Progress
    {
      from: 'draft',
      to: 'in_progress',
      allowedRoles: ['mechanic', 'shop_manager', 'admin'],
      conditions: ['inspection_has_items_or_can_add'],
      actions: ['start_inspection_timer']
    },
    
    // In Progress to Pending Review
    {
      from: 'in_progress',
      to: 'pending_review',
      allowedRoles: ['mechanic', 'shop_manager', 'admin'],
      conditions: ['inspection_has_items', 'all_items_have_status'],
      validations: ['check_critical_items'],
      actions: ['calculate_duration', 'notify_managers']
    },
    
    // Pending Review to Approved
    {
      from: 'pending_review',
      to: 'approved',
      allowedRoles: ['shop_manager', 'admin'],
      validations: ['no_blocking_critical_items'],
      actions: ['set_completion_time', 'prepare_customer_report']
    },
    
    // Pending Review to Rejected
    {
      from: 'pending_review',
      to: 'rejected',
      allowedRoles: ['shop_manager', 'admin'],
      conditions: ['rejection_reason_provided'],
      actions: ['notify_technician']
    },
    
    // Rejected back to In Progress
    {
      from: 'rejected',
      to: 'in_progress',
      allowedRoles: ['mechanic', 'shop_manager', 'admin'],
      actions: ['clear_rejection_reason']
    },
    
    // Approved to Sent to Customer
    {
      from: 'approved',
      to: 'sent_to_customer',
      allowedRoles: ['shop_manager', 'admin'],
      conditions: ['customer_has_phone'],
      actions: ['send_sms', 'create_customer_link']
    },
    
    // Sent to Customer to Completed (when customer views)
    {
      from: 'sent_to_customer',
      to: 'completed',
      allowedRoles: ['mechanic', 'shop_manager', 'admin'], // Can be triggered by system
      actions: ['record_completion']
    },
    
    // Emergency transitions (admin only)
    {
      from: 'completed',
      to: 'approved',
      allowedRoles: ['admin'],
      conditions: ['admin_override_reason']
    }
  ];
  
  constructor(db: DatabaseService) {
    this.db = db;
  }
  
  // Get valid transitions from current state for user role
  getValidTransitions(currentState: WorkflowState, userRole: UserRole): WorkflowState[] {
    return this.transitions
      .filter(t => t.from === currentState && t.allowedRoles.includes(userRole))
      .map(t => t.to);
  }
  
  // Validate if transition is allowed
  async validateTransition(request: WorkflowTransitionRequest): Promise<WorkflowValidationResult> {
    const result: WorkflowValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Find transition rule
    const transition = this.transitions.find(
      t => t.from === request.fromState && 
           t.to === request.toState
    );
    
    if (!transition) {
      result.valid = false;
      result.errors.push(`Invalid transition from ${request.fromState} to ${request.toState}`);
      return result;
    }
    
    // Check role permissions
    if (!transition.allowedRoles.includes(request.userRole)) {
      result.valid = false;
      result.errors.push(`User role ${request.userRole} is not authorized for this transition`);
      return result;
    }
    
    // Check conditions
    if (transition.conditions) {
      for (const condition of transition.conditions) {
        const conditionResult = await this.checkCondition(condition, request);
        if (!conditionResult.valid) {
          result.valid = false;
          result.errors.push(...conditionResult.errors);
        }
        if (conditionResult.warnings) {
          result.warnings.push(...conditionResult.warnings);
        }
      }
    }
    
    // Check validations
    if (transition.validations) {
      for (const validation of transition.validations) {
        const validationResult = await this.checkValidation(validation, request);
        if (!validationResult.valid) {
          result.valid = false;
          result.errors.push(...validationResult.errors);
        }
        if (validationResult.warnings) {
          result.warnings.push(...validationResult.warnings);
        }
      }
    }
    
    return result;
  }
  
  // Execute state transition
  async executeTransition(request: WorkflowTransitionRequest): Promise<{ success: boolean; errors?: string[] }> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set context for triggers
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', request.userId]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_shop_id', request.shopId]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_role', request.userRole]);
      
      // Validate transition
      const validation = await this.validateTransition(request);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }
      
      // Get current inspection state to verify
      const currentStateResult = await client.query(
        'SELECT workflow_state, version FROM inspections WHERE id = $1 AND shop_id = $2',
        [request.inspectionId, request.shopId]
      );
      
      if (currentStateResult.rows.length === 0) {
        return { success: false, errors: ['Inspection not found'] };
      }
      
      const currentState = currentStateResult.rows[0].workflow_state;
      if (currentState !== request.fromState) {
        return { 
          success: false, 
          errors: [`Inspection state has changed. Expected ${request.fromState}, found ${currentState}`] 
        };
      }
      
      // Update inspection state
      const updateResult = await client.query(`
        UPDATE inspections 
        SET workflow_state = $1, 
            previous_state = $2,
            state_changed_at = NOW(),
            state_changed_by = $3,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $4 AND shop_id = $5
        RETURNING *
      `, [request.toState, request.fromState, request.userId, request.inspectionId, request.shopId]);
      
      if (updateResult.rows.length === 0) {
        return { success: false, errors: ['Failed to update inspection state'] };
      }
      
      // Record state change in history
      await client.query(`
        INSERT INTO inspection_state_history (
          inspection_id, from_state, to_state, changed_by, 
          change_reason, metadata, validation_passed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        request.inspectionId,
        request.fromState,
        request.toState,
        request.userId,
        request.reason,
        JSON.stringify(request.metadata || {}),
        true
      ]);
      
      // Execute transition actions
      const transition = this.transitions.find(
        t => t.from === request.fromState && t.to === request.toState
      );
      
      if (transition?.actions) {
        for (const action of transition.actions) {
          await this.executeAction(action, request, client);
        }
      }
      
      await client.query('COMMIT');
      return { success: true };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Check condition for transition
  private async checkCondition(
    condition: string, 
    request: WorkflowTransitionRequest
  ): Promise<WorkflowValidationResult> {
    
    const result: WorkflowValidationResult = { valid: true, errors: [], warnings: [] };
    
    switch (condition) {
      case 'inspection_has_items_or_can_add':
        // Allow starting inspection even without items (can add during inspection)
        break;
        
      case 'inspection_has_items':
        const itemCount = await this.db.query(
          'SELECT COUNT(*) as count FROM inspection_items WHERE inspection_id = $1',
          [request.inspectionId]
        );
        
        if (parseInt(itemCount.rows[0].count) === 0) {
          result.valid = false;
          result.errors.push('Inspection must have at least one item to submit for review');
        }
        break;
        
      case 'all_items_have_status':
        const uncompletedItems = await this.db.query(
          'SELECT COUNT(*) as count FROM inspection_items WHERE inspection_id = $1 AND condition IS NULL',
          [request.inspectionId]
        );
        
        if (parseInt(uncompletedItems.rows[0].count) > 0) {
          result.valid = false;
          result.errors.push('All inspection items must have a condition status');
        }
        break;
        
      case 'customer_has_phone':
        const customerPhone = await this.db.query(`
          SELECT c.phone 
          FROM inspections i
          JOIN vehicles v ON i.vehicle_id = v.id
          JOIN customers c ON v.customer_id = c.id
          WHERE i.id = $1
        `, [request.inspectionId]);
        
        if (!customerPhone.rows[0]?.phone) {
          result.valid = false;
          result.errors.push('Customer must have a phone number to send inspection results');
        }
        break;
        
      case 'rejection_reason_provided':
        if (!request.reason) {
          result.valid = false;
          result.errors.push('Rejection reason is required');
        }
        break;
        
      case 'admin_override_reason':
        if (!request.reason) {
          result.valid = false;
          result.errors.push('Administrator override reason is required');
        }
        break;
        
      default:
        result.warnings.push(`Unknown condition: ${condition}`);
    }
    
    return result;
  }
  
  // Check validation for transition
  private async checkValidation(
    validation: string, 
    request: WorkflowTransitionRequest
  ): Promise<WorkflowValidationResult> {
    
    const result: WorkflowValidationResult = { valid: true, errors: [], warnings: [] };
    
    switch (validation) {
      case 'check_critical_items':
        const criticalItems = await this.db.query(
          'SELECT COUNT(*) as count FROM inspection_items WHERE inspection_id = $1 AND condition = $2',
          [request.inspectionId, 'needs_immediate']
        );
        
        const criticalCount = parseInt(criticalItems.rows[0].count);
        if (criticalCount > 0) {
          result.warnings.push(`${criticalCount} critical safety items found - requires manager approval`);
        }
        break;
        
      case 'no_blocking_critical_items':
        const blockingItems = await this.db.query(
          'SELECT COUNT(*) as count FROM inspection_items WHERE inspection_id = $1 AND condition = $2',
          [request.inspectionId, 'needs_immediate']
        );
        
        const blockingCount = parseInt(blockingItems.rows[0].count);
        if (blockingCount > 0) {
          result.valid = false;
          result.errors.push(`Cannot approve inspection with ${blockingCount} critical safety items`);
        }
        break;
        
      default:
        result.warnings.push(`Unknown validation: ${validation}`);
    }
    
    return result;
  }
  
  // Execute action for transition
  private async executeAction(
    action: string, 
    request: WorkflowTransitionRequest, 
    client: any
  ): Promise<void> {
    
    switch (action) {
      case 'start_inspection_timer':
        await client.query(
          'UPDATE inspections SET started_at = NOW() WHERE id = $1',
          [request.inspectionId]
        );
        break;
        
      case 'calculate_duration':
        await client.query(`
          UPDATE inspections 
          SET inspection_duration = EXTRACT(EPOCH FROM (NOW() - started_at))/60
          WHERE id = $1 AND started_at IS NOT NULL
        `, [request.inspectionId]);
        break;
        
      case 'set_completion_time':
        await client.query(
          'UPDATE inspections SET completed_at = NOW() WHERE id = $1',
          [request.inspectionId]
        );
        break;
        
      case 'notify_managers':
        // This would integrate with notification service
        // For now, just log the action
        console.log(`Notifying managers about inspection ${request.inspectionId} ready for review`);
        break;
        
      case 'notify_technician':
        console.log(`Notifying technician about rejected inspection ${request.inspectionId}`);
        break;
        
      case 'send_sms':
        // This would integrate with SMS service
        console.log(`Sending SMS for inspection ${request.inspectionId}`);
        break;
        
      case 'create_customer_link':
        // This would generate a customer viewing link
        console.log(`Creating customer link for inspection ${request.inspectionId}`);
        break;
        
      case 'record_completion':
        await client.query(
          'UPDATE inspections SET completed_at = NOW() WHERE id = $1',
          [request.inspectionId]
        );
        break;
        
      case 'prepare_customer_report':
        // This would generate the customer-facing report
        console.log(`Preparing customer report for inspection ${request.inspectionId}`);
        break;
        
      case 'clear_rejection_reason':
        // Clear any rejection metadata when returning to in_progress
        break;
        
      default:
        console.log(`Unknown action: ${action}`);
    }
  }
  
  // Get workflow history for inspection
  async getWorkflowHistory(inspectionId: string, shopId: string): Promise<any[]> {
    const query = `
      SELECT 
        ish.*,
        u.first_name || ' ' || u.last_name as changed_by_name,
        u.role as changed_by_role
      FROM inspection_state_history ish
      JOIN users u ON ish.changed_by = u.id
      WHERE ish.inspection_id = $1
        AND EXISTS (
          SELECT 1 FROM inspections i 
          WHERE i.id = ish.inspection_id AND i.shop_id = $2
        )
      ORDER BY ish.changed_at DESC
    `;
    
    const result = await this.db.query(query, [inspectionId, shopId]);
    return result.rows;
  }
  
  // Get inspections in specific states
  async getInspectionsByState(
    shopId: string, 
    states: WorkflowState[], 
    limit: number = 50
  ): Promise<any[]> {
    
    const placeholders = states.map((_, index) => `$${index + 2}`).join(', ');
    
    const query = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
        u.first_name || ' ' || u.last_name as technician_name
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      WHERE i.shop_id = $1 
        AND i.workflow_state IN (${placeholders})
        AND i.deleted_at IS NULL
      ORDER BY i.state_changed_at ASC
      LIMIT ${limit}
    `;
    
    const result = await this.db.query(query, [shopId, ...states]);
    return result.rows;
  }
  
  // Get workflow statistics
  async getWorkflowStatistics(shopId: string, days: number = 30): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_transitions,
        COUNT(CASE WHEN from_state = 'draft' AND to_state = 'in_progress' THEN 1 END) as inspections_started,
        COUNT(CASE WHEN from_state = 'in_progress' AND to_state = 'pending_review' THEN 1 END) as submitted_for_review,
        COUNT(CASE WHEN from_state = 'pending_review' AND to_state = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN from_state = 'pending_review' AND to_state = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN to_state = 'completed' THEN 1 END) as completed,
        AVG(EXTRACT(EPOCH FROM (changed_at - (
          SELECT ish2.changed_at 
          FROM inspection_state_history ish2 
          WHERE ish2.inspection_id = ish.inspection_id 
            AND ish2.from_state = 'draft' 
            AND ish2.to_state = 'in_progress'
        )))/3600) as avg_completion_hours
      FROM inspection_state_history ish
      WHERE ish.inspection_id IN (
        SELECT i.id FROM inspections i WHERE i.shop_id = $1
      )
        AND ish.changed_at >= NOW() - INTERVAL '${days} days'
    `;
    
    const result = await this.db.query(query, [shopId]);
    return result.rows[0];
  }
  
  // Check if inspection can be transitioned
  async canTransition(
    inspectionId: string, 
    fromState: WorkflowState, 
    toState: WorkflowState, 
    userRole: UserRole,
    shopId: string
  ): Promise<boolean> {
    
    const validation = await this.validateTransition({
      inspectionId,
      fromState,
      toState,
      userId: '', // Not needed for validation check
      userRole,
      shopId
    });
    
    return validation.valid;
  }
  
  // Get current state of inspection
  async getCurrentState(inspectionId: string, shopId: string): Promise<WorkflowState | null> {
    const result = await this.db.query(
      'SELECT workflow_state FROM inspections WHERE id = $1 AND shop_id = $2',
      [inspectionId, shopId]
    );
    
    return result.rows[0]?.workflow_state || null;
  }
  
  // Force transition (admin only, bypass validations)
  async forceTransition(
    inspectionId: string,
    toState: WorkflowState,
    userId: string,
    shopId: string,
    reason: string
  ): Promise<{ success: boolean; errors?: string[] }> {
    
    if (!reason) {
      return { success: false, errors: ['Reason is required for force transition'] };
    }
    
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current state
      const currentResult = await client.query(
        'SELECT workflow_state FROM inspections WHERE id = $1 AND shop_id = $2',
        [inspectionId, shopId]
      );
      
      if (currentResult.rows.length === 0) {
        return { success: false, errors: ['Inspection not found'] };
      }
      
      const currentState = currentResult.rows[0].workflow_state;
      
      // Update state
      await client.query(`
        UPDATE inspections 
        SET workflow_state = $1,
            previous_state = $2,
            state_changed_at = NOW(),
            state_changed_by = $3,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $4 AND shop_id = $5
      `, [toState, currentState, userId, inspectionId, shopId]);
      
      // Record forced transition
      await client.query(`
        INSERT INTO inspection_state_history (
          inspection_id, from_state, to_state, changed_by,
          change_reason, validation_passed, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        inspectionId,
        currentState,
        toState,
        userId,
        `FORCE TRANSITION: ${reason}`,
        false, // Mark as validation bypassed
        JSON.stringify({ forced: true, original_reason: reason })
      ]);
      
      await client.query('COMMIT');
      return { success: true };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}