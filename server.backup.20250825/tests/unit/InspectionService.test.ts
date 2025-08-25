/**
 * Unit tests for InspectionService
 * Tests inspection CRUD operations, workflow management, and business logic
 */

import { InspectionService } from '../../src/services/InspectionService';
import { InspectionRepository } from '../../src/repositories/InspectionRepository';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { WorkflowService } from '../../src/services/WorkflowService';
import { TestDataFactory } from '../utils/test-setup';

// Mock dependencies
jest.mock('../../src/repositories/InspectionRepository');
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/services/WorkflowService');

const mockInspectionRepository = InspectionRepository as jest.Mocked<typeof InspectionRepository>;
const mockCustomerRepository = CustomerRepository as jest.Mocked<typeof CustomerRepository>;
const mockWorkflowService = WorkflowService as jest.Mocked<typeof WorkflowService>;

describe('InspectionService', () => {
  let inspectionService: InspectionService;
  let mockInspection: any;
  let mockCustomer: any;
  let mockUser: any;

  beforeEach(() => {
    inspectionService = new InspectionService();
    
    mockUser = TestDataFactory.user({
      role: 'mechanic',
      shop_id: 'shop-123'
    });

    mockCustomer = TestDataFactory.customer({
      shop_id: 'shop-123'
    });

    mockInspection = TestDataFactory.inspection({
      shop_id: 'shop-123',
      customer_id: mockCustomer.id,
      technician_id: mockUser.id,
      status: 'in_progress'
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createInspection', () => {
    it('should successfully create new inspection', async () => {
      // Arrange
      const inspectionData = {
        customer_id: mockCustomer.id,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard' as const
      };

      mockCustomerRepository.prototype.findById = jest.fn().mockResolvedValue(mockCustomer);
      mockInspectionRepository.prototype.getNextInspectionNumber = jest.fn().mockResolvedValue('24-0042');
      mockInspectionRepository.prototype.create = jest.fn().mockResolvedValue({
        ...mockInspection,
        ...inspectionData,
        inspection_number: '24-0042'
      });
      mockWorkflowService.prototype.initializeWorkflow = jest.fn().mockResolvedValue({
        workflow_id: 'workflow-123',
        initial_state: 'inspection_started'
      });

      // Act
      const result = await inspectionService.createInspection(inspectionData, mockUser);

      // Assert
      expect(result.success).toBe(true);
      expect(result.inspection).toBeDefined();
      expect(result.inspection.inspection_number).toBe('24-0042');
      expect(result.inspection.status).toBe('in_progress');
      expect(mockCustomerRepository.prototype.findById).toHaveBeenCalledWith(inspectionData.customer_id);
      expect(mockWorkflowService.prototype.initializeWorkflow).toHaveBeenCalled();
    });

    it('should fail when customer not found', async () => {
      // Arrange
      const inspectionData = {
        customer_id: 'nonexistent-customer',
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard' as const
      };

      mockCustomerRepository.prototype.findById = jest.fn().mockResolvedValue(null);

      // Act
      const result = await inspectionService.createInspection(inspectionData, mockUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found');
      expect(mockInspectionRepository.prototype.create).not.toHaveBeenCalled();
    });

    it('should fail when customer belongs to different shop', async () => {
      // Arrange
      const inspectionData = {
        customer_id: mockCustomer.id,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard' as const
      };

      const differentShopCustomer = { ...mockCustomer, shop_id: 'different-shop' };
      mockCustomerRepository.prototype.findById = jest.fn().mockResolvedValue(differentShopCustomer);

      // Act
      const result = await inspectionService.createInspection(inspectionData, mockUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found in your shop');
    });

    it('should validate VIN format', async () => {
      // Arrange
      const inspectionData = {
        customer_id: mockCustomer.id,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: 'INVALID_VIN',
        mileage: 45000,
        license_plate: 'ABC123',
        inspection_type: 'standard' as const
      };

      mockCustomerRepository.prototype.findById = jest.fn().mockResolvedValue(mockCustomer);

      // Act
      const result = await inspectionService.createInspection(inspectionData, mockUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid VIN format');
    });

    it('should validate mileage range', async () => {
      // Arrange
      const inspectionData = {
        customer_id: mockCustomer.id,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: 2020,
        vehicle_vin: '1HGBH41JXMN109186',
        mileage: -100, // Invalid negative mileage
        license_plate: 'ABC123',
        inspection_type: 'standard' as const
      };

      mockCustomerRepository.prototype.findById = jest.fn().mockResolvedValue(mockCustomer);

      // Act
      const result = await inspectionService.createInspection(inspectionData, mockUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid mileage');
    });
  });

  describe('getInspectionById', () => {
    it('should return inspection when found and authorized', async () => {
      // Arrange
      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(mockInspection);

      // Act
      const result = await inspectionService.getInspectionById(mockInspection.id, mockUser);

      // Assert
      expect(result.success).toBe(true);
      expect(result.inspection).toEqual(mockInspection);
      expect(mockInspectionRepository.prototype.findById).toHaveBeenCalledWith(mockInspection.id);
    });

    it('should fail when inspection not found', async () => {
      // Arrange
      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(null);

      // Act
      const result = await inspectionService.getInspectionById('nonexistent-id', mockUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Inspection not found');
    });

    it('should fail when user not authorized for inspection', async () => {
      // Arrange
      const unauthorizedInspection = { ...mockInspection, shop_id: 'different-shop' };
      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(unauthorizedInspection);

      // Act
      const result = await inspectionService.getInspectionById(mockInspection.id, mockUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authorized to access this inspection');
    });
  });

  describe('updateInspectionStatus', () => {
    it('should successfully update inspection status', async () => {
      // Arrange
      const newStatus = 'completed';
      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(mockInspection);
      mockWorkflowService.prototype.canTransitionTo = jest.fn().mockReturnValue(true);
      mockInspectionRepository.prototype.update = jest.fn().mockResolvedValue({
        ...mockInspection,
        status: newStatus
      });
      mockWorkflowService.prototype.updateWorkflowState = jest.fn().mockResolvedValue({
        success: true
      });

      // Act
      const result = await inspectionService.updateInspectionStatus(
        mockInspection.id,
        newStatus,
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.inspection.status).toBe(newStatus);
      expect(mockWorkflowService.prototype.canTransitionTo).toHaveBeenCalledWith(
        mockInspection.status,
        newStatus
      );
      expect(mockWorkflowService.prototype.updateWorkflowState).toHaveBeenCalled();
    });

    it('should fail when status transition not allowed', async () => {
      // Arrange
      const invalidStatus = 'archived';
      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(mockInspection);
      mockWorkflowService.prototype.canTransitionTo = jest.fn().mockReturnValue(false);

      // Act
      const result = await inspectionService.updateInspectionStatus(
        mockInspection.id,
        invalidStatus,
        mockUser
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
      expect(mockInspectionRepository.prototype.update).not.toHaveBeenCalled();
    });

    it('should fail when user lacks permission to update', async () => {
      // Arrange
      const mechanicUser = { ...mockUser, role: 'mechanic' };
      const managerOnlyStatus = 'approved';
      
      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(mockInspection);
      mockWorkflowService.prototype.canTransitionTo = jest.fn().mockReturnValue(true);

      // Act
      const result = await inspectionService.updateInspectionStatus(
        mockInspection.id,
        managerOnlyStatus,
        mechanicUser
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
    });
  });

  describe('getInspectionsByShop', () => {
    it('should return paginated inspections for shop', async () => {
      // Arrange
      const inspections = [mockInspection, { ...mockInspection, id: 'inspection-2' }];
      const filters = { status: 'in_progress', page: 1, limit: 10 };
      
      mockInspectionRepository.prototype.findByShop = jest.fn().mockResolvedValue({
        inspections,
        total: 2,
        hasMore: false
      });

      // Act
      const result = await inspectionService.getInspectionsByShop(
        mockUser.shop_id,
        filters,
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.inspections).toEqual(inspections);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.hasMore).toBe(false);
      expect(mockInspectionRepository.prototype.findByShop).toHaveBeenCalledWith(
        mockUser.shop_id,
        filters
      );
    });

    it('should apply default pagination when not specified', async () => {
      // Arrange
      const inspections = [mockInspection];
      
      mockInspectionRepository.prototype.findByShop = jest.fn().mockResolvedValue({
        inspections,
        total: 1,
        hasMore: false
      });

      // Act
      const result = await inspectionService.getInspectionsByShop(
        mockUser.shop_id,
        {},
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockInspectionRepository.prototype.findByShop).toHaveBeenCalledWith(
        mockUser.shop_id,
        { page: 1, limit: 20 }
      );
    });
  });

  describe('calculateInspectionCost', () => {
    it('should calculate cost based on inspection type and items', async () => {
      // Arrange
      const inspectionWithItems = {
        ...mockInspection,
        inspection_type: 'comprehensive',
        inspection_items: [
          { category: 'brakes', status: 'needs_service', urgency_level: 'high' },
          { category: 'engine', status: 'good', urgency_level: 'low' }
        ]
      };

      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(inspectionWithItems);

      // Act
      const result = await inspectionService.calculateInspectionCost(
        mockInspection.id,
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.cost).toBeDefined();
      expect(result.cost.base_cost).toBeGreaterThan(0);
      expect(result.cost.total_cost).toBeGreaterThan(0);
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.inspection_fee).toBeGreaterThan(0);
    });

    it('should apply discounts for routine inspections', async () => {
      // Arrange
      const routineInspection = {
        ...mockInspection,
        inspection_type: 'routine',
        inspection_items: []
      };

      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(routineInspection);

      // Act
      const result = await inspectionService.calculateInspectionCost(
        mockInspection.id,
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.cost.discount_applied).toBe(true);
      expect(result.cost.total_cost).toBeLessThan(result.cost.base_cost);
    });
  });

  describe('generateInspectionSummary', () => {
    it('should generate comprehensive inspection summary', async () => {
      // Arrange
      const inspectionWithItems = {
        ...mockInspection,
        inspection_items: [
          { 
            category: 'brakes', 
            item_name: 'Brake Pads',
            status: 'needs_service', 
            urgency_level: 'high',
            notes: 'Worn brake pads'
          },
          { 
            category: 'engine', 
            item_name: 'Oil Filter',
            status: 'good', 
            urgency_level: 'low',
            notes: 'Recently replaced'
          }
        ]
      };

      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(inspectionWithItems);

      // Act
      const result = await inspectionService.generateInspectionSummary(
        mockInspection.id,
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.total_items).toBe(2);
      expect(result.summary.items_needing_service).toBe(1);
      expect(result.summary.high_priority_items).toBe(1);
      expect(result.summary.categories).toContain('brakes');
      expect(result.summary.categories).toContain('engine');
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle inspection with no items', async () => {
      // Arrange
      const emptyInspection = {
        ...mockInspection,
        inspection_items: []
      };

      mockInspectionRepository.prototype.findById = jest.fn().mockResolvedValue(emptyInspection);

      // Act
      const result = await inspectionService.generateInspectionSummary(
        mockInspection.id,
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.summary.total_items).toBe(0);
      expect(result.summary.items_needing_service).toBe(0);
      expect(result.recommendations.length).toBe(0);
    });
  });

  describe('business logic validation', () => {
    it('should validate VIN checksum correctly', () => {
      const validVINs = [
        '1HGBH41JXMN109186',
        'JH4TB2H26CC000000',
        '1M8GDM9AXKP042788'
      ];

      const invalidVINs = [
        '1HGBH41JXMN109185', // Wrong checksum
        'INVALID_VIN_FORMAT',
        '123456789ABCDEFGH' // Invalid characters
      ];

      validVINs.forEach(vin => {
        expect(inspectionService.validateVIN(vin)).toBe(true);
      });

      invalidVINs.forEach(vin => {
        expect(inspectionService.validateVIN(vin)).toBe(false);
      });
    });

    it('should calculate correct urgency scores', () => {
      const highUrgencyItem = {
        category: 'brakes',
        status: 'critical',
        mileage_since_last_service: 15000,
        age_in_months: 36
      };

      const lowUrgencyItem = {
        category: 'interior',
        status: 'good',
        mileage_since_last_service: 1000,
        age_in_months: 6
      };

      const highScore = inspectionService.calculateUrgencyScore(highUrgencyItem);
      const lowScore = inspectionService.calculateUrgencyScore(lowUrgencyItem);

      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBeGreaterThanOrEqual(7); // High urgency threshold
      expect(lowScore).toBeLessThanOrEqual(3); // Low urgency threshold
    });
  });
});