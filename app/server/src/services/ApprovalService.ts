import { Pool } from 'pg';
import { Logger } from '../utils/Logger';

export interface ApprovalWorkflow {
  id: number;
  inspection_id: number;
  submitted_by: number;
  submitted_at: Date;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  assigned_to: number | null;
  approved_by: number | null;
  approved_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  manager_comments: string | null;
  escalated_at: Date | null;
  escalated_to: number | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ApprovalHistory {
  id: number;
  workflow_id: number;
  user_id: number;
  action: string;
  comments: string | null;
  created_at: Date;
  metadata: any;
}

export interface SubmitForApprovalOptions {
  inspectionId: number;
  mechanicId: number;
  assignedTo?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  comments?: string;
}

export interface ApprovalAction {
  workflowId: number;
  managerId: number;
  comments?: string;
  reason?: string;
  requestedChanges?: string[];
}

export interface ApprovalStats {
  total_pending: number;
  total_approved: number;
  total_rejected: number;
  average_approval_time: number; // in minutes
  approval_rate: number; // percentage
  escalation_rate: number; // percentage
}

export interface EscalationRule {
  priority: 'low' | 'normal' | 'high' | 'urgent';
  escalation_time_hours: number;
  escalate_to_role: string;
  notify_immediately: boolean;
}

export class ApprovalService {
  private readonly pool: Pool;
  private readonly logger: Logger;
  
  // Default escalation rules
  private readonly escalationRules: EscalationRule[] = [
    {
      priority: 'urgent',
      escalation_time_hours: 2,
      escalate_to_role: 'owner',
      notify_immediately: true,
    },
    {
      priority: 'high',
      escalation_time_hours: 4,
      escalate_to_role: 'senior_manager',
      notify_immediately: true,
    },
    {
      priority: 'normal',
      escalation_time_hours: 24,
      escalate_to_role: 'senior_manager',
      notify_immediately: false,
    },
    {
      priority: 'low',
      escalation_time_hours: 48,
      escalate_to_role: 'senior_manager',
      notify_immediately: false,
    },
  ];

  constructor(pool: Pool) {
    this.pool = pool;
    this.logger = new Logger('ApprovalService');
  }

  /**
   * Submit inspection for approval
   */
  async submitForApproval(options: SubmitForApprovalOptions): Promise<ApprovalWorkflow> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if inspection already has pending approval
      const existingQuery = `
        SELECT id FROM approval_workflows 
        WHERE inspection_id = $1 AND status = 'pending'
      `;
      const existingResult = await client.query(existingQuery, [options.inspectionId]);
      
      if (existingResult.rows.length > 0) {
        throw new Error('Inspection already has pending approval workflow');
      }

      // Get inspection details for auto-assignment logic
      const inspectionQuery = `
        SELECT urgency_level, shop_id 
        FROM inspections 
        WHERE id = $1
      `;
      const inspectionResult = await client.query(inspectionQuery, [options.inspectionId]);
      
      if (inspectionResult.rows.length === 0) {
        throw new Error('Inspection not found');
      }

      const inspection = inspectionResult.rows[0];
      const priority = options.priority || this.mapUrgencyToPriority(inspection.urgency_level);
      
      // Auto-assign to manager if not specified
      let assignedTo = options.assignedTo;
      if (!assignedTo) {
        assignedTo = await this.findAvailableManager(inspection.shop_id, priority);
      }

      // Create approval workflow
      const workflowQuery = `
        INSERT INTO approval_workflows (
          inspection_id, submitted_by, assigned_to, priority
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const workflowResult = await client.query(workflowQuery, [
        options.inspectionId,
        options.mechanicId,
        assignedTo,
        priority,
      ]);

      const workflow = workflowResult.rows[0];

      // Update inspection status
      await client.query(
        'UPDATE inspections SET approval_status = $1, approval_workflow_id = $2 WHERE id = $3',
        ['submitted', workflow.id, options.inspectionId]
      );

      // Record history
      await this.recordHistory(client, workflow.id, options.mechanicId, 'submitted', options.comments, {
        priority,
        assigned_to: assignedTo,
      });

      await client.query('COMMIT');

      this.logger.info('Inspection submitted for approval', {
        inspectionId: options.inspectionId,
        workflowId: workflow.id,
        mechanicId: options.mechanicId,
        assignedTo,
        priority,
      });

      // TODO: Send notification to assigned manager
      await this.notifyAssignedManager(workflow);

      return workflow;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to submit inspection for approval:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Approve inspection
   */
  async approveInspection(options: ApprovalAction): Promise<ApprovalWorkflow> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get workflow
      const workflow = await this.getWorkflowById(options.workflowId);
      if (!workflow) {
        throw new Error('Approval workflow not found');
      }

      if (workflow.status !== 'pending') {
        throw new Error('Workflow is not in pending status');
      }

      // Update workflow
      const updateQuery = `
        UPDATE approval_workflows 
        SET 
          status = 'approved',
          approved_by = $1,
          approved_at = NOW(),
          manager_comments = $2
        WHERE id = $3
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        options.managerId,
        options.comments,
        options.workflowId,
      ]);

      const updatedWorkflow = updateResult.rows[0];

      // Update inspection status
      await client.query(
        'UPDATE inspections SET approval_status = $1 WHERE id = $2',
        ['approved', workflow.inspection_id]
      );

      // Record history
      await this.recordHistory(client, options.workflowId, options.managerId, 'approved', options.comments);

      await client.query('COMMIT');

      this.logger.info('Inspection approved', {
        workflowId: options.workflowId,
        inspectionId: workflow.inspection_id,
        managerId: options.managerId,
      });

      // TODO: Notify mechanic and customer
      await this.notifyApprovalComplete(updatedWorkflow, 'approved');

      return updatedWorkflow;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to approve inspection:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject inspection
   */
  async rejectInspection(options: ApprovalAction): Promise<ApprovalWorkflow> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get workflow
      const workflow = await this.getWorkflowById(options.workflowId);
      if (!workflow) {
        throw new Error('Approval workflow not found');
      }

      if (workflow.status !== 'pending') {
        throw new Error('Workflow is not in pending status');
      }

      if (!options.reason) {
        throw new Error('Rejection reason is required');
      }

      // Update workflow
      const updateQuery = `
        UPDATE approval_workflows 
        SET 
          status = 'rejected',
          rejected_at = NOW(),
          rejection_reason = $1,
          manager_comments = $2
        WHERE id = $3
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        options.reason,
        options.comments,
        options.workflowId,
      ]);

      const updatedWorkflow = updateResult.rows[0];

      // Update inspection status
      await client.query(
        'UPDATE inspections SET approval_status = $1 WHERE id = $2',
        ['rejected', workflow.inspection_id]
      );

      // Record history
      await this.recordHistory(client, options.workflowId, options.managerId, 'rejected', options.comments, {
        rejection_reason: options.reason,
      });

      await client.query('COMMIT');

      this.logger.info('Inspection rejected', {
        workflowId: options.workflowId,
        inspectionId: workflow.inspection_id,
        managerId: options.managerId,
        reason: options.reason,
      });

      // TODO: Notify mechanic
      await this.notifyApprovalComplete(updatedWorkflow, 'rejected');

      return updatedWorkflow;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to reject inspection:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Request changes to inspection
   */
  async requestChanges(options: ApprovalAction & { requestedChanges: string[] }): Promise<ApprovalWorkflow> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get workflow
      const workflow = await this.getWorkflowById(options.workflowId);
      if (!workflow) {
        throw new Error('Approval workflow not found');
      }

      if (workflow.status !== 'pending') {
        throw new Error('Workflow is not in pending status');
      }

      // Update workflow
      const updateQuery = `
        UPDATE approval_workflows 
        SET 
          status = 'changes_requested',
          manager_comments = $1
        WHERE id = $2
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        options.comments,
        options.workflowId,
      ]);

      const updatedWorkflow = updateResult.rows[0];

      // Update inspection status
      await client.query(
        'UPDATE inspections SET approval_status = $1 WHERE id = $2',
        ['changes_requested', workflow.inspection_id]
      );

      // Record history
      await this.recordHistory(client, options.workflowId, options.managerId, 'changes_requested', options.comments, {
        requested_changes: options.requestedChanges,
      });

      await client.query('COMMIT');

      this.logger.info('Changes requested for inspection', {
        workflowId: options.workflowId,
        inspectionId: workflow.inspection_id,
        managerId: options.managerId,
        changesCount: options.requestedChanges.length,
      });

      // TODO: Notify mechanic with requested changes
      await this.notifyChangesRequested(updatedWorkflow, options.requestedChanges);

      return updatedWorkflow;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to request changes:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Escalate workflow to senior manager/owner
   */
  async escalateToOwner(workflowId: number, reason: string, escalatedBy?: number): Promise<ApprovalWorkflow> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get workflow
      const workflow = await this.getWorkflowById(workflowId);
      if (!workflow) {
        throw new Error('Approval workflow not found');
      }

      // Find escalation target
      const escalationQuery = `
        SELECT id FROM users 
        WHERE shop_id = (
          SELECT shop_id FROM inspections WHERE id = $1
        ) 
        AND role = 'owner' 
        AND is_active = true
        LIMIT 1
      `;

      const escalationResult = await this.pool.query(escalationQuery, [workflow.inspection_id]);
      
      if (escalationResult.rows.length === 0) {
        throw new Error('No owner found for escalation');
      }

      const ownerId = escalationResult.rows[0].id;

      // Update workflow
      const updateQuery = `
        UPDATE approval_workflows 
        SET 
          escalated_at = NOW(),
          escalated_to = $1,
          assigned_to = $1,
          priority = 'urgent'
        WHERE id = $2
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [ownerId, workflowId]);
      const updatedWorkflow = updateResult.rows[0];

      // Record history
      await this.recordHistory(client, workflowId, escalatedBy || 0, 'escalated', reason, {
        escalated_to: ownerId,
        escalation_reason: reason,
      });

      await client.query('COMMIT');

      this.logger.info('Workflow escalated to owner', {
        workflowId,
        inspectionId: workflow.inspection_id,
        escalatedTo: ownerId,
        reason,
      });

      // TODO: Notify owner immediately
      await this.notifyEscalation(updatedWorkflow, reason);

      return updatedWorkflow;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to escalate workflow:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk approve multiple inspections
   */
  async bulkApprove(inspectionIds: number[], managerId: number, comments?: string): Promise<ApprovalWorkflow[]> {
    const approvedWorkflows: ApprovalWorkflow[] = [];
    
    for (const inspectionId of inspectionIds) {
      try {
        // Find pending workflow for inspection
        const workflowQuery = `
          SELECT id FROM approval_workflows 
          WHERE inspection_id = $1 AND status = 'pending'
        `;
        const workflowResult = await this.pool.query(workflowQuery, [inspectionId]);
        
        if (workflowResult.rows.length > 0) {
          const workflowId = workflowResult.rows[0].id;
          const approvedWorkflow = await this.approveInspection({
            workflowId,
            managerId,
            comments,
          });
          approvedWorkflows.push(approvedWorkflow);
        }
      } catch (error) {
        this.logger.error(`Failed to bulk approve inspection ${inspectionId}:`, error);
        // Continue with other inspections
      }
    }

    this.logger.info('Bulk approval completed', {
      requestedCount: inspectionIds.length,
      approvedCount: approvedWorkflows.length,
      managerId,
    });

    return approvedWorkflows;
  }

  /**
   * Get pending approvals for a manager
   */
  async getPendingApprovals(managerId: number, limit: number = 50): Promise<Array<ApprovalWorkflow & { inspection_details: any }>> {
    const query = `
      SELECT 
        aw.*,
        i.reference_number,
        i.urgency_level,
        i.vehicle_year,
        i.vehicle_make,
        i.vehicle_model,
        c.name as customer_name,
        u.full_name as mechanic_name
      FROM approval_workflows aw
      JOIN inspections i ON aw.inspection_id = i.id
      JOIN customers c ON i.customer_id = c.id
      JOIN users u ON aw.submitted_by = u.id
      WHERE aw.assigned_to = $1 
      AND aw.status = 'pending'
      ORDER BY 
        CASE aw.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        aw.submitted_at ASC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [managerId, limit]);
    return result.rows;
  }

  /**
   * Get approval statistics for a shop
   */
  async getApprovalStats(shopId: number, startDate: Date, endDate: Date): Promise<ApprovalStats> {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE aw.status = 'pending') as total_pending,
        COUNT(*) FILTER (WHERE aw.status = 'approved') as total_approved,
        COUNT(*) FILTER (WHERE aw.status = 'rejected') as total_rejected,
        AVG(
          CASE 
            WHEN aw.approved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (aw.approved_at - aw.submitted_at))/60
            ELSE NULL 
          END
        ) as average_approval_time,
        ROUND(
          CASE 
            WHEN COUNT(*) FILTER (WHERE aw.status IN ('approved', 'rejected')) > 0
            THEN (COUNT(*) FILTER (WHERE aw.status = 'approved')::decimal / 
                  COUNT(*) FILTER (WHERE aw.status IN ('approved', 'rejected'))) * 100
            ELSE 0 
          END, 2
        ) as approval_rate,
        ROUND(
          CASE 
            WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE aw.escalated_at IS NOT NULL)::decimal / COUNT(*)) * 100
            ELSE 0 
          END, 2
        ) as escalation_rate
      FROM approval_workflows aw
      JOIN inspections i ON aw.inspection_id = i.id
      WHERE i.shop_id = $1 
      AND aw.submitted_at BETWEEN $2 AND $3
    `;

    const result = await this.pool.query(query, [shopId, startDate, endDate]);
    const row = result.rows[0];

    return {
      total_pending: parseInt(row.total_pending),
      total_approved: parseInt(row.total_approved),
      total_rejected: parseInt(row.total_rejected),
      average_approval_time: Math.round(parseFloat(row.average_approval_time) || 0),
      approval_rate: parseFloat(row.approval_rate),
      escalation_rate: parseFloat(row.escalation_rate),
    };
  }

  /**
   * Check for workflows that need escalation
   */
  async checkForEscalations(): Promise<ApprovalWorkflow[]> {
    const escalatedWorkflows: ApprovalWorkflow[] = [];
    
    for (const rule of this.escalationRules) {
      const query = `
        SELECT aw.* 
        FROM approval_workflows aw
        WHERE aw.status = 'pending'
        AND aw.priority = $1
        AND aw.escalated_at IS NULL
        AND aw.submitted_at <= NOW() - INTERVAL '${rule.escalation_time_hours} hours'
      `;

      const result = await this.pool.query(query, [rule.priority]);
      
      for (const workflow of result.rows) {
        try {
          const escalatedWorkflow = await this.escalateToOwner(
            workflow.id,
            `Auto-escalated after ${rule.escalation_time_hours} hours for ${rule.priority} priority`
          );
          escalatedWorkflows.push(escalatedWorkflow);
        } catch (error) {
          this.logger.error(`Failed to auto-escalate workflow ${workflow.id}:`, error);
        }
      }
    }

    if (escalatedWorkflows.length > 0) {
      this.logger.info('Auto-escalation completed', {
        escalatedCount: escalatedWorkflows.length,
      });
    }

    return escalatedWorkflows;
  }

  // Private helper methods

  private async getWorkflowById(workflowId: number): Promise<ApprovalWorkflow | null> {
    const query = 'SELECT * FROM approval_workflows WHERE id = $1';
    const result = await this.pool.query(query, [workflowId]);
    return result.rows[0] || null;
  }

  private async recordHistory(
    client: any,
    workflowId: number,
    userId: number,
    action: string,
    comments?: string,
    metadata?: any
  ): Promise<void> {
    const query = `
      INSERT INTO approval_history (
        workflow_id, user_id, action, comments, metadata
      ) VALUES ($1, $2, $3, $4, $5)
    `;

    await client.query(query, [
      workflowId,
      userId,
      action,
      comments || null,
      JSON.stringify(metadata || {}),
    ]);
  }

  private mapUrgencyToPriority(urgencyLevel: string): 'low' | 'normal' | 'high' | 'urgent' {
    const mapping = {
      low: 'low',
      medium: 'normal',
      high: 'high',
      critical: 'urgent',
    };
    return mapping[urgencyLevel as keyof typeof mapping] || 'normal';
  }

  private async findAvailableManager(shopId: number, priority: string): Promise<number | null> {
    // Simple logic - find first available manager
    // Could be enhanced with workload balancing
    const query = `
      SELECT id FROM users 
      WHERE shop_id = $1 
      AND role IN ('manager', 'senior_manager', 'owner')
      AND is_active = true
      ORDER BY 
        CASE role 
          WHEN 'manager' THEN 1
          WHEN 'senior_manager' THEN 2
          WHEN 'owner' THEN 3
        END
      LIMIT 1
    `;

    const result = await this.pool.query(query, [shopId]);
    return result.rows[0]?.id || null;
  }

  private async notifyAssignedManager(workflow: ApprovalWorkflow): Promise<void> {
    // TODO: Implement notification logic
    // Could use SMS service, email, or push notifications
    this.logger.debug('TODO: Notify assigned manager', { workflowId: workflow.id });
  }

  private async notifyApprovalComplete(workflow: ApprovalWorkflow, status: string): Promise<void> {
    // TODO: Implement notification logic
    this.logger.debug('TODO: Notify approval complete', { workflowId: workflow.id, status });
  }

  private async notifyChangesRequested(workflow: ApprovalWorkflow, changes: string[]): Promise<void> {
    // TODO: Implement notification logic
    this.logger.debug('TODO: Notify changes requested', { workflowId: workflow.id, changesCount: changes.length });
  }

  private async notifyEscalation(workflow: ApprovalWorkflow, reason: string): Promise<void> {
    // TODO: Implement notification logic
    this.logger.debug('TODO: Notify escalation', { workflowId: workflow.id, reason });
  }
}