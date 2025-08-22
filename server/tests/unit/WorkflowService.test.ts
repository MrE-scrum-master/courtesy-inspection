/**
 * Unit tests for WorkflowService
 * Tests workflow state management, transitions, and business rules
 */

import { WorkflowService } from '../../src/services/WorkflowService';
import { TestDataFactory } from '../utils/test-setup';

describe('WorkflowService', () => {
  let workflowService: WorkflowService;
  let mockUser: any;
  let mockInspection: any;

  beforeEach(() => {
    workflowService = new WorkflowService();
    
    mockUser = TestDataFactory.user({
      role: 'mechanic',
      shop_id: 'shop-123'
    });

    mockInspection = TestDataFactory.inspection({
      status: 'in_progress',
      shop_id: 'shop-123'
    });

    jest.clearAllMocks();
  });

  describe('initializeWorkflow', () => {
    it('should initialize workflow for new inspection', async () => {
      // Act
      const result = await workflowService.initializeWorkflow(
        mockInspection,
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      expect(result.workflow.current_state).toBe('inspection_started');
      expect(result.workflow.inspection_id).toBe(mockInspection.id);
      expect(result.workflow.created_by).toBe(mockUser.id);
      expect(result.workflow.state_history).toHaveLength(1);
    });

    it('should set correct initial state based on inspection type', async () => {
      // Arrange
      const comprehensiveInspection = {
        ...mockInspection,
        inspection_type: 'comprehensive'
      };

      // Act
      const result = await workflowService.initializeWorkflow(
        comprehensiveInspection,
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.workflow.current_state).toBe('inspection_started');
      expect(result.workflow.workflow_type).toBe('comprehensive');
    });
  });

  describe('canTransitionTo', () => {
    it('should allow valid state transitions', () => {
      const validTransitions = [
        { from: 'in_progress', to: 'pending_approval' },
        { from: 'pending_approval', to: 'approved' },
        { from: 'pending_approval', to: 'requires_revision' },
        { from: 'requires_revision', to: 'in_progress' },
        { from: 'approved', to: 'completed' },
        { from: 'in_progress', to: 'cancelled' }
      ];

      validTransitions.forEach(({ from, to }) => {
        const canTransition = workflowService.canTransitionTo(from, to);
        expect(canTransition).toBe(true);
      });
    });

    it('should reject invalid state transitions', () => {
      const invalidTransitions = [
        { from: 'completed', to: 'in_progress' },
        { from: 'cancelled', to: 'approved' },
        { from: 'approved', to: 'pending_approval' },
        { from: 'draft', to: 'completed' },
        { from: 'completed', to: 'requires_revision' }
      ];

      invalidTransitions.forEach(({ from, to }) => {
        const canTransition = workflowService.canTransitionTo(from, to);
        expect(canTransition).toBe(false);
      });
    });

    it('should handle same state transitions', () => {
      const sameStateTransitions = [
        'in_progress',
        'pending_approval',
        'approved',
        'completed'
      ];

      sameStateTransitions.forEach(state => {
        const canTransition = workflowService.canTransitionTo(state, state);
        expect(canTransition).toBe(false); // Same state transitions not allowed
      });
    });
  });

  describe('updateWorkflowState', () => {
    it('should successfully update workflow state', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const newState = 'pending_approval';
      const currentState = 'in_progress';

      // Act
      const result = await workflowService.updateWorkflowState(
        workflowId,
        newState,
        currentState,
        mockUser,
        'Inspection completed, ready for review'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.workflow.current_state).toBe(newState);
      expect(result.workflow.updated_by).toBe(mockUser.id);
      expect(result.workflow.state_history).toBeDefined();
    });

    it('should fail when transition is not allowed', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const invalidNewState = 'completed';
      const currentState = 'draft';

      // Act
      const result = await workflowService.updateWorkflowState(
        workflowId,
        invalidNewState,
        currentState,
        mockUser
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid state transition');
    });

    it('should record state transition history', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const newState = 'approved';
      const currentState = 'pending_approval';
      const notes = 'Approved by manager';

      // Act
      const result = await workflowService.updateWorkflowState(
        workflowId,
        newState,
        currentState,
        mockUser,
        notes
      );

      // Assert
      expect(result.success).toBe(true);
      const latestHistory = result.workflow.state_history[result.workflow.state_history.length - 1];
      expect(latestHistory.from_state).toBe(currentState);
      expect(latestHistory.to_state).toBe(newState);
      expect(latestHistory.changed_by).toBe(mockUser.id);
      expect(latestHistory.notes).toBe(notes);
      expect(latestHistory.timestamp).toBeDefined();
    });
  });

  describe('getWorkflowHistory', () => {
    it('should return complete workflow history', async () => {
      // Arrange
      const workflowId = 'workflow-123';

      // Act
      const result = await workflowService.getWorkflowHistory(workflowId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.history).toBeDefined();
      expect(Array.isArray(result.history)).toBe(true);
      expect(result.workflow_summary).toBeDefined();
    });

    it('should include user information in history', async () => {
      // Arrange
      const workflowId = 'workflow-123';

      // Act
      const result = await workflowService.getWorkflowHistory(workflowId);

      // Assert
      expect(result.success).toBe(true);
      if (result.history.length > 0) {
        const historyEntry = result.history[0];
        expect(historyEntry.changed_by_name).toBeDefined();
        expect(historyEntry.changed_by_role).toBeDefined();
      }
    });
  });

  describe('getAvailableActions', () => {
    it('should return correct actions for mechanic in progress state', () => {
      // Arrange
      const state = 'in_progress';
      const userRole = 'mechanic';

      // Act
      const actions = workflowService.getAvailableActions(state, userRole);

      // Assert
      expect(actions).toContain('submit_for_approval');
      expect(actions).toContain('save_draft');
      expect(actions).toContain('cancel');
      expect(actions).not.toContain('approve');
      expect(actions).not.toContain('archive');
    });

    it('should return correct actions for manager in pending approval state', () => {
      // Arrange
      const state = 'pending_approval';
      const userRole = 'manager';

      // Act
      const actions = workflowService.getAvailableActions(state, userRole);

      // Assert
      expect(actions).toContain('approve');
      expect(actions).toContain('request_revision');
      expect(actions).toContain('reject');
      expect(actions).not.toContain('submit_for_approval');
    });

    it('should return limited actions for completed state', () => {
      // Arrange
      const state = 'completed';
      const userRole = 'manager';

      // Act
      const actions = workflowService.getAvailableActions(state, userRole);

      // Assert
      expect(actions).toContain('archive');
      expect(actions).toContain('generate_report');
      expect(actions).not.toContain('approve');
      expect(actions).not.toContain('submit_for_approval');
    });

    it('should return empty actions for cancelled state', () => {
      // Arrange
      const state = 'cancelled';
      const userRole = 'mechanic';

      // Act
      const actions = workflowService.getAvailableActions(state, userRole);

      // Assert
      expect(actions).toHaveLength(0);
    });
  });

  describe('validateStateTransition', () => {
    it('should validate business rules for approval transition', async () => {
      // Arrange
      const inspectionData = {
        ...mockInspection,
        inspection_items: [
          { status: 'good', notes: 'Detailed notes' },
          { status: 'needs_service', notes: 'Needs replacement' }
        ],
        photos: ['photo1.jpg', 'photo2.jpg']
      };

      // Act
      const validation = await workflowService.validateStateTransition(
        'in_progress',
        'pending_approval',
        inspectionData,
        mockUser
      );

      // Assert
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation when required items missing', async () => {
      // Arrange
      const incompleteInspection = {
        ...mockInspection,
        inspection_items: [], // No items inspected
        photos: []
      };

      // Act
      const validation = await workflowService.validateStateTransition(
        'in_progress',
        'pending_approval',
        incompleteInspection,
        mockUser
      );

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('At least one inspection item required');
      expect(validation.errors).toContain('At least one photo required');
    });

    it('should fail validation when critical items lack notes', async () => {
      // Arrange
      const inspectionWithMissingNotes = {
        ...mockInspection,
        inspection_items: [
          { status: 'critical', notes: '' }, // Critical item without notes
          { status: 'good', notes: 'Good condition' }
        ]
      };

      // Act
      const validation = await workflowService.validateStateTransition(
        'in_progress',
        'pending_approval',
        inspectionWithMissingNotes,
        mockUser
      );

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Critical items must have detailed notes');
    });

    it('should validate manager approval requirements', async () => {
      // Arrange
      const approvalData = {
        ...mockInspection,
        estimated_cost: 1500, // High cost requiring manager approval
        has_critical_issues: true
      };

      // Act
      const validation = await workflowService.validateStateTransition(
        'pending_approval',
        'approved',
        approvalData,
        { ...mockUser, role: 'mechanic' } // Mechanic trying to approve
      );

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Manager approval required for high-cost estimates');
    });
  });

  describe('calculateWorkflowMetrics', () => {
    it('should calculate time spent in each state', async () => {
      // Arrange
      const workflowId = 'workflow-123';

      // Act
      const metrics = await workflowService.calculateWorkflowMetrics(workflowId);

      // Assert
      expect(metrics.success).toBe(true);
      expect(metrics.metrics.total_duration).toBeDefined();
      expect(metrics.metrics.state_durations).toBeDefined();
      expect(metrics.metrics.state_durations.in_progress).toBeGreaterThanOrEqual(0);
    });

    it('should identify bottlenecks in workflow', async () => {
      // Arrange
      const workflowId = 'workflow-123';

      // Act
      const metrics = await workflowService.calculateWorkflowMetrics(workflowId);

      // Assert
      expect(metrics.success).toBe(true);
      expect(metrics.metrics.bottlenecks).toBeDefined();
      expect(Array.isArray(metrics.metrics.bottlenecks)).toBe(true);
    });

    it('should calculate efficiency score', async () => {
      // Arrange
      const workflowId = 'workflow-123';

      // Act
      const metrics = await workflowService.calculateWorkflowMetrics(workflowId);

      // Assert
      expect(metrics.success).toBe(true);
      expect(metrics.metrics.efficiency_score).toBeGreaterThanOrEqual(0);
      expect(metrics.metrics.efficiency_score).toBeLessThanOrEqual(100);
    });
  });

  describe('automated workflow triggers', () => {
    it('should trigger auto-approval for routine inspections', async () => {
      // Arrange
      const routineInspection = {
        ...mockInspection,
        inspection_type: 'routine',
        estimated_cost: 50, // Low cost
        has_critical_issues: false
      };

      // Act
      const autoTrigger = await workflowService.checkAutoApprovalEligibility(
        routineInspection
      );

      // Assert
      expect(autoTrigger.eligible).toBe(true);
      expect(autoTrigger.reason).toBe('routine_low_cost');
    });

    it('should require manual approval for high-cost inspections', async () => {
      // Arrange
      const expensiveInspection = {
        ...mockInspection,
        inspection_type: 'comprehensive',
        estimated_cost: 2500, // High cost
        has_critical_issues: true
      };

      // Act
      const autoTrigger = await workflowService.checkAutoApprovalEligibility(
        expensiveInspection
      );

      // Assert
      expect(autoTrigger.eligible).toBe(false);
      expect(autoTrigger.reason).toBe('high_cost_critical_issues');
    });

    it('should trigger follow-up reminders for pending items', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const daysOverdue = 3;

      // Act
      const reminder = await workflowService.checkFollowUpRequired(
        workflowId,
        daysOverdue
      );

      // Assert
      expect(reminder.required).toBe(true);
      expect(reminder.urgency_level).toBe('medium');
      expect(reminder.message).toContain('follow-up');
    });
  });
});