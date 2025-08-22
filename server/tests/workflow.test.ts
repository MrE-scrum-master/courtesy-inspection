// Comprehensive tests for Workflow Engine
// Tests state transitions, business rules, validation, and integration

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WorkflowService, WorkflowState, UserRole, WorkflowTransitionRequest } from '../src/services/WorkflowService';

// Mock database service
const mockDb = {
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn()
  })
} as any;

describe('WorkflowService', () => {
  let workflowService: WorkflowService;
  let mockClient: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    workflowService = new WorkflowService(mockDb);
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    mockDb.connect.mockResolvedValue(mockClient);
  });
  
  describe('State Transitions', () => {
    
    test('should allow mechanic to transition from draft to in_progress', async () => {
      const validTransitions = workflowService.getValidTransitions('draft', 'mechanic');
      
      expect(validTransitions).toContain('in_progress');
    });

    test('should allow mechanic to transition from in_progress to pending_review', async () => {
      const validTransitions = workflowService.getValidTransitions('in_progress', 'mechanic');
      
      expect(validTransitions).toContain('pending_review');
    });

    test('should only allow shop_manager to approve inspections', async () => {
      const mechanicTransitions = workflowService.getValidTransitions('pending_review', 'mechanic');
      const managerTransitions = workflowService.getValidTransitions('pending_review', 'shop_manager');
      
      expect(mechanicTransitions).not.toContain('approved');
      expect(managerTransitions).toContain('approved');
    });

    test('should only allow shop_manager to reject inspections', async () => {
      const mechanicTransitions = workflowService.getValidTransitions('pending_review', 'mechanic');
      const managerTransitions = workflowService.getValidTransitions('pending_review', 'shop_manager');
      
      expect(mechanicTransitions).not.toContain('rejected');
      expect(managerTransitions).toContain('rejected');
    });

    test('should only allow shop_manager to send to customer', async () => {
      const mechanicTransitions = workflowService.getValidTransitions('approved', 'mechanic');
      const managerTransitions = workflowService.getValidTransitions('approved', 'shop_manager');
      
      expect(mechanicTransitions).not.toContain('sent_to_customer');
      expect(managerTransitions).toContain('sent_to_customer');
    });

    test('should allow return from rejected to in_progress', async () => {
      const validTransitions = workflowService.getValidTransitions('rejected', 'mechanic');
      
      expect(validTransitions).toContain('in_progress');
    });
  });

  describe('Transition Validation', () => {
    
    test('should validate inspection has items before pending review', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'in_progress',
        toState: 'pending_review',
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      // Mock query to return no items
      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await workflowService.validateTransition(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Inspection must have at least one item to submit for review');
    });

    test('should validate all items have condition status', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'in_progress',
        toState: 'pending_review',
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      // Mock queries - has items but some without condition
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })  // has items
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // 2 items without condition

      const result = await workflowService.validateTransition(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('All inspection items must have a condition status');
    });

    test('should validate customer has phone for sending results', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'approved',
        toState: 'sent_to_customer',
        userId: 'test-user',
        userRole: 'shop_manager',
        shopId: 'test-shop'
      };

      // Mock query to return customer without phone
      mockDb.query.mockResolvedValue({ rows: [{ phone: null }] });

      const result = await workflowService.validateTransition(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Customer must have a phone number to send inspection results');
    });

    test('should require rejection reason when rejecting', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'pending_review',
        toState: 'rejected',
        userId: 'test-user',
        userRole: 'shop_manager',
        shopId: 'test-shop'
        // No reason provided
      };

      const result = await workflowService.validateTransition(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rejection reason is required');
    });

    test('should warn about critical items but allow submission', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'in_progress',
        toState: 'pending_review',
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      // Mock queries - has items, all have conditions, but 2 are critical
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })   // has items
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })   // all have conditions
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });  // 2 critical items

      const result = await workflowService.validateTransition(request);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('2 critical safety items found - requires manager approval');
    });

    test('should block approval when critical items exist', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'pending_review',
        toState: 'approved',
        userId: 'test-user',
        userRole: 'shop_manager',
        shopId: 'test-shop'
      };

      // Mock query to return critical items
      mockDb.query.mockResolvedValue({ rows: [{ count: '1' }] });

      const result = await workflowService.validateTransition(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot approve inspection with 1 critical safety items');
    });
  });

  describe('Transition Execution', () => {
    
    test('should execute valid transition successfully', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'draft',
        toState: 'in_progress',
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      // Mock validation passes
      mockClient.query
        .mockResolvedValueOnce({ rows: [{}] })  // set config calls
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{ workflow_state: 'draft', version: 1 }] })  // current state check
        .mockResolvedValueOnce({ rows: [{ id: 'test-inspection' }] })  // update
        .mockResolvedValueOnce({ rows: [{}] })  // state history
        .mockResolvedValueOnce({ rows: [{}] })  // action execution
        .mockResolvedValueOnce({ rows: [{}] }); // commit

      const result = await workflowService.executeTransition(request);

      expect(result.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    test('should rollback on validation failure', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'in_progress',
        toState: 'pending_review',
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      // Mock validation failure (no items)
      mockClient.query
        .mockResolvedValueOnce({ rows: [{}] })  // set config calls
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{}] });
      
      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] }); // no items

      const result = await workflowService.executeTransition(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Inspection must have at least one item to submit for review');
    });

    test('should handle optimistic locking conflicts', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'draft',
        toState: 'in_progress',
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      // Mock state changed by another user
      mockClient.query
        .mockResolvedValueOnce({ rows: [{}] })  // set config calls
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{ workflow_state: 'in_progress', version: 2 }] }); // different state

      const result = await workflowService.executeTransition(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Inspection state has changed. Expected draft, found in_progress');
    });
  });

  describe('Workflow Actions', () => {
    
    test('should execute start_inspection_timer action', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'draft',
        toState: 'in_progress',
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      // Mock successful transition
      mockClient.query
        .mockResolvedValueOnce({ rows: [{}] })  // config
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{ workflow_state: 'draft', version: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'test-inspection' }] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{}] }); // start timer action

      const result = await workflowService.executeTransition(request);

      expect(result.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE inspections SET started_at = NOW() WHERE id = $1',
        ['test-inspection']
      );
    });

    test('should execute calculate_duration action', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'in_progress',
        toState: 'pending_review',
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      // Mock successful transition with all required validations passing
      mockClient.query
        .mockResolvedValueOnce({ rows: [{}] })  // config
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{ workflow_state: 'in_progress', version: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'test-inspection' }] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{}] }); // calculate duration action

      // Mock validation queries
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })  // has items
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // all have conditions
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // 1 critical item (warning only)

      const result = await workflowService.executeTransition(request);

      expect(result.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('inspection_duration = EXTRACT'),
        ['test-inspection']
      );
    });
  });

  describe('Workflow History', () => {
    
    test('should retrieve workflow history', async () => {
      const historyData = [
        {
          id: 'history-1',
          from_state: 'draft',
          to_state: 'in_progress',
          changed_by_name: 'John Doe',
          changed_by_role: 'mechanic',
          changed_at: new Date(),
          change_reason: null
        },
        {
          id: 'history-2',
          from_state: 'in_progress',
          to_state: 'pending_review',
          changed_by_name: 'John Doe',
          changed_by_role: 'mechanic',
          changed_at: new Date(),
          change_reason: null
        }
      ];

      mockDb.query.mockResolvedValue({ rows: historyData });

      const result = await workflowService.getWorkflowHistory('test-inspection', 'test-shop');

      expect(result).toEqual(historyData);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('inspection_state_history'),
        ['test-inspection', 'test-shop']
      );
    });
  });

  describe('Workflow Statistics', () => {
    
    test('should retrieve workflow statistics', async () => {
      const statsData = {
        total_transitions: 150,
        inspections_started: 45,
        submitted_for_review: 40,
        approved: 35,
        rejected: 5,
        completed: 30,
        avg_completion_hours: 24.5
      };

      mockDb.query.mockResolvedValue({ rows: [statsData] });

      const result = await workflowService.getWorkflowStatistics('test-shop', 30);

      expect(result).toEqual(statsData);
      expect(result.avg_completion_hours).toBe(24.5);
    });

    test('should filter statistics by date range', async () => {
      await workflowService.getWorkflowStatistics('test-shop', 7);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('7 days'),
        ['test-shop']
      );
    });
  });

  describe('Inspections by State', () => {
    
    test('should retrieve inspections in specific states', async () => {
      const inspectionData = [
        {
          id: 'inspection-1',
          workflow_state: 'pending_review',
          customer_name: 'Jane Smith',
          vehicle_info: '2020 Honda Civic',
          technician_name: 'John Doe'
        }
      ];

      mockDb.query.mockResolvedValue({ rows: inspectionData });

      const result = await workflowService.getInspectionsByState(
        'test-shop',
        ['pending_review', 'approved'],
        25
      );

      expect(result).toEqual(inspectionData);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('workflow_state IN'),
        ['test-shop', 'pending_review', 'approved']
      );
    });
  });

  describe('Force Transitions (Admin)', () => {
    
    test('should allow admin to force transition with reason', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{}] })  // begin
        .mockResolvedValueOnce({ rows: [{ workflow_state: 'completed' }] })  // current state
        .mockResolvedValueOnce({ rows: [{}] })  // update
        .mockResolvedValueOnce({ rows: [{}] })  // history
        .mockResolvedValueOnce({ rows: [{}] }); // commit

      const result = await workflowService.forceTransition(
        'test-inspection',
        'approved',
        'admin-user',
        'test-shop',
        'Customer complaint - reverting for additional work'
      );

      expect(result.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FORCE TRANSITION'),
        expect.arrayContaining(['Customer complaint - reverting for additional work'])
      );
    });

    test('should require reason for force transition', async () => {
      const result = await workflowService.forceTransition(
        'test-inspection',
        'approved',
        'admin-user',
        'test-shop',
        '' // Empty reason
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reason is required for force transition');
    });
  });

  describe('State Checking Utilities', () => {
    
    test('should check if transition is allowed', async () => {
      // Mock successful validation
      mockDb.query.mockResolvedValue({ rows: [{ count: '3' }] }); // has items

      const canTransition = await workflowService.canTransition(
        'test-inspection',
        'in_progress',
        'pending_review',
        'mechanic',
        'test-shop'
      );

      expect(canTransition).toBe(true);
    });

    test('should get current state', async () => {
      mockDb.query.mockResolvedValue({ 
        rows: [{ workflow_state: 'in_progress' }] 
      });

      const currentState = await workflowService.getCurrentState(
        'test-inspection',
        'test-shop'
      );

      expect(currentState).toBe('in_progress');
    });

    test('should return null for non-existent inspection', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const currentState = await workflowService.getCurrentState(
        'non-existent',
        'test-shop'
      );

      expect(currentState).toBeNull();
    });
  });

  describe('Error Handling', () => {
    
    test('should handle database errors gracefully', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'draft',
        toState: 'in_progress',
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      mockClient.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(workflowService.executeTransition(request)).rejects.toThrow('Database connection failed');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('should handle invalid role gracefully', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'pending_review',
        toState: 'approved',
        userId: 'test-user',
        userRole: 'invalid_role' as UserRole,
        shopId: 'test-shop'
      };

      const result = await workflowService.validateTransition(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User role invalid_role is not authorized for this transition');
    });

    test('should handle invalid state transition', async () => {
      const request: WorkflowTransitionRequest = {
        inspectionId: 'test-inspection',
        fromState: 'draft',
        toState: 'completed' as WorkflowState,
        userId: 'test-user',
        userRole: 'mechanic',
        shopId: 'test-shop'
      };

      const result = await workflowService.validateTransition(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid transition from draft to completed');
    });
  });
});