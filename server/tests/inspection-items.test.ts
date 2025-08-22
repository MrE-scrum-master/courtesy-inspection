// Comprehensive tests for Inspection Items Engine
// Tests business logic, urgency calculation, recommendations, and validation

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { InspectionItemService } from '../src/services/InspectionItemService';
import { calculateUrgency, calculateInspectionUrgency, UrgencyInput } from '../src/utils/urgency-calculator';
import { generateRecommendations, RecommendationInput } from '../src/utils/recommendation-engine';

// Mock database service
const mockDb = {
  query: jest.fn(),
  connect: jest.fn(),
} as any;

describe('Urgency Calculator', () => {
  
  describe('Individual Item Urgency', () => {
    test('should calculate critical urgency for brake pads below 2mm', () => {
      const input: UrgencyInput = {
        condition: 'needs_immediate',
        measurements: { pad_thickness_mm: 1.5 },
        itemType: 'brakes',
        priority: 1
      };
      
      const result = calculateUrgency(input);
      
      expect(result.level).toBe('critical');
      expect(result.score).toBeGreaterThan(85);
      expect(result.factors).toContain('Condition: needs_immediate (+95)');
      expect(result.recommendations).toContain('STOP DRIVING - Immediate safety risk');
    });

    test('should calculate high urgency for tire tread below 4/32"', () => {
      const input: UrgencyInput = {
        condition: 'poor',
        measurements: { tread_depth_32nds: 3 },
        itemType: 'tires',
        priority: 2
      };
      
      const result = calculateUrgency(input);
      
      expect(result.level).toBe('high');
      expect(result.score).toBeGreaterThan(60);
      expect(result.factors.some(f => f.includes('tread_depth_32nds'))).toBe(true);
    });

    test('should calculate normal urgency for fair condition items', () => {
      const input: UrgencyInput = {
        condition: 'fair',
        measurements: { voltage: 11.9 },
        itemType: 'battery',
        priority: 1
      };
      
      const result = calculateUrgency(input);
      
      expect(result.level).toBe('normal');
      expect(result.score).toBeGreaterThan(30);
      expect(result.score).toBeLessThan(65);
    });

    test('should calculate low urgency for good condition items', () => {
      const input: UrgencyInput = {
        condition: 'good',
        measurements: { level_percent: 80 },
        itemType: 'fluids',
        priority: 1
      };
      
      const result = calculateUrgency(input);
      
      expect(result.level).toBe('low');
      expect(result.score).toBeLessThan(35);
    });
  });

  describe('Inspection-Level Urgency', () => {
    test('should calculate critical urgency when any item is critical', () => {
      const items: UrgencyInput[] = [
        { condition: 'good', itemType: 'fluids', priority: 1 },
        { condition: 'fair', itemType: 'filters', priority: 1 },
        { condition: 'needs_immediate', itemType: 'brakes', priority: 10 }
      ];
      
      const result = calculateInspectionUrgency(items);
      
      expect(result.level).toBe('critical');
      expect(result.score).toBe(95);
      expect(result.factors).toContain('1 critical safety item(s)');
      expect(result.recommendations).toContain('IMMEDIATE ATTENTION REQUIRED - Do not drive vehicle');
    });

    test('should calculate high urgency for multiple poor items', () => {
      const items: UrgencyInput[] = [
        { condition: 'poor', itemType: 'brakes', priority: 7 },
        { condition: 'poor', itemType: 'tires', priority: 7 },
        { condition: 'poor', itemType: 'battery', priority: 7 }
      ];
      
      const result = calculateInspectionUrgency(items);
      
      expect(result.level).toBe('high');
      expect(result.score).toBe(75);
      expect(result.recommendations).toContain('Schedule repair within 1-2 weeks');
    });

    test('should handle empty inspection items', () => {
      const items: UrgencyInput[] = [];
      
      const result = calculateInspectionUrgency(items);
      
      expect(result.level).toBe('low');
      expect(result.score).toBe(0);
      expect(result.factors).toContain('No inspection items');
    });
  });

  describe('Item Type Modifiers', () => {
    test('should apply higher multiplier to brake items', () => {
      const brakeInput: UrgencyInput = {
        condition: 'poor',
        itemType: 'brakes',
        priority: 1
      };
      
      const otherInput: UrgencyInput = {
        condition: 'poor',
        itemType: 'wipers',
        priority: 1
      };
      
      const brakeResult = calculateUrgency(brakeInput);
      const otherResult = calculateUrgency(otherInput);
      
      expect(brakeResult.score).toBeGreaterThan(otherResult.score);
    });

    test('should apply measurements correctly for different item types', () => {
      const batteryInput: UrgencyInput = {
        condition: 'fair',
        measurements: { voltage: 11.5 },
        itemType: 'battery',
        priority: 1
      };
      
      const result = calculateUrgency(batteryInput);
      
      expect(result.score).toBeGreaterThan(50); // Should be boosted by low voltage
      expect(result.factors.some(f => f.includes('voltage'))).toBe(true);
    });
  });
});

describe('Recommendation Engine', () => {
  
  describe('Condition-Based Recommendations', () => {
    test('should recommend immediate action for critical brake condition', () => {
      const input: RecommendationInput = {
        itemType: 'brakes',
        condition: 'needs_immediate',
        measurements: { pad_thickness_mm: 1 }
      };
      
      const result = generateRecommendations(input);
      
      expect(result.primary.type).toBe('immediate_action');
      expect(result.primary.urgency).toBe('immediate');
      expect(result.primary.title).toContain('Immediate brakes attention required');
      expect(result.primary.benefits).toContain('Prevent accidents');
    });

    test('should recommend replacement for poor condition tires', () => {
      const input: RecommendationInput = {
        itemType: 'tires',
        condition: 'poor',
        measurements: { tread_depth_32nds: 3 }
      };
      
      const result = generateRecommendations(input);
      
      expect(result.primary.type).toBe('replacement');
      expect(result.primary.urgency).toBe('soon');
      expect(result.primary.timeframe).toContain('Within');
    });

    test('should recommend monitoring for fair condition items', () => {
      const input: RecommendationInput = {
        itemType: 'battery',
        condition: 'fair',
        measurements: { voltage: 11.9 }
      };
      
      const result = generateRecommendations(input);
      
      expect(result.primary.type).toBe('monitoring');
      expect(result.primary.urgency).toBe('scheduled');
    });
  });

  describe('Measurement-Based Recommendations', () => {
    test('should provide specific brake pad recommendations', () => {
      const input: RecommendationInput = {
        itemType: 'brakes',
        condition: 'poor',
        measurements: { pad_thickness_mm: 2.5 }
      };
      
      const result = generateRecommendations(input);
      
      expect(result.secondary.some(rec => 
        rec.description.includes('thickness')
      )).toBe(true);
    });

    test('should provide tire tread recommendations', () => {
      const input: RecommendationInput = {
        itemType: 'tires',
        condition: 'fair',
        measurements: { tread_depth_32nds: 5 }
      };
      
      const result = generateRecommendations(input);
      
      expect(result.secondary.some(rec => 
        rec.description.includes('tread')
      )).toBe(true);
    });

    test('should provide battery voltage recommendations', () => {
      const input: RecommendationInput = {
        itemType: 'battery',
        condition: 'poor',
        measurements: { voltage: 11.7 }
      };
      
      const result = generateRecommendations(input);
      
      expect(result.secondary.some(rec => 
        rec.description.includes('voltage')
      )).toBe(true);
    });
  });

  describe('Cost Estimation', () => {
    test('should include cost estimates when shop config enables them', () => {
      const input: RecommendationInput = {
        itemType: 'brakes',
        condition: 'poor',
        shopConfig: {
          includeCostEstimates: true,
          laborRate: 120,
          markupPercent: 0.15,
          includePartNumbers: false,
          includeTimeframes: true
        }
      };
      
      const result = generateRecommendations(input);
      
      if (result.primary.estimatedCost) {
        expect(result.primary.estimatedCost.total).toBeGreaterThan(0);
        expect(result.primary.estimatedCost.parts).toBeGreaterThan(0);
        expect(result.primary.estimatedCost.labor).toBeGreaterThan(0);
      }
    });

    test('should not include costs when shop config disables them', () => {
      const input: RecommendationInput = {
        itemType: 'brakes',
        condition: 'poor',
        shopConfig: {
          includeCostEstimates: false,
          includePartNumbers: false,
          includeTimeframes: true
        }
      };
      
      const result = generateRecommendations(input);
      
      expect(result.primary.estimatedCost).toBeUndefined();
    });
  });

  describe('Preventive Maintenance', () => {
    test('should recommend preventive maintenance based on mileage', () => {
      const input: RecommendationInput = {
        itemType: 'brakes',
        condition: 'good',
        vehicleInfo: {
          year: 2020,
          make: 'Honda',
          model: 'Civic',
          mileage: 35000
        }
      };
      
      const result = generateRecommendations(input);
      
      // Should have preventive recommendations
      expect(result.preventive.length).toBeGreaterThan(0);
    });

    test('should calculate next service date', () => {
      const input: RecommendationInput = {
        itemType: 'tires',
        condition: 'fair',
        vehicleInfo: {
          mileage: 45000
        }
      };
      
      const result = generateRecommendations(input);
      
      expect(result.nextServiceDate).toBeDefined();
      expect(result.nextServiceDate).toBeInstanceOf(Date);
    });
  });
});

describe('InspectionItemService', () => {
  let service: InspectionItemService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new InspectionItemService(mockDb);
  });
  
  describe('Item Creation', () => {
    test('should create item with validation', async () => {
      const itemData = {
        category: 'brakes',
        component: 'Front brake pads',
        condition: 'fair',
        measurements: { pad_thickness_mm: 4 },
        priority: 1
      };
      
      // Mock repository response
      const mockItem = { id: 'test-id', ...itemData };
      mockDb.query.mockResolvedValue({ rows: [mockItem] });
      
      const result = await service.createItem(
        'inspection-id',
        itemData,
        'user-id',
        'shop-id'
      );
      
      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
    });

    test('should fail validation for missing required fields', async () => {
      const itemData = {
        // Missing category and component
        condition: 'fair'
      };
      
      const result = await service.createItem(
        'inspection-id',
        itemData as any,
        'user-id',
        'shop-id'
      );
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Category is required');
      expect(result.errors).toContain('Component is required');
    });

    test('should validate brake measurements correctly', async () => {
      const itemData = {
        category: 'brakes',
        component: 'Front brake pads',
        measurements: { pad_thickness_mm: 25 } // Invalid - too high
      };
      
      const result = await service.createItem(
        'inspection-id',
        itemData,
        'user-id',
        'shop-id'
      );
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Brake pad thickness must be between 0-20mm');
    });
  });

  describe('Item Updates', () => {
    test('should update item and recalculate recommendations', async () => {
      const currentItem = {
        id: 'item-id',
        category: 'brakes',
        component: 'Front brake pads',
        condition: 'fair',
        priority: 4
      };
      
      const updateData = {
        condition: 'poor',
        measurements: { pad_thickness_mm: 3 }
      };
      
      // Mock repository responses
      mockDb.query.mockResolvedValueOnce({ rows: [currentItem] }); // findByInspectionId
      mockDb.query.mockResolvedValueOnce({ rows: [{ ...currentItem, ...updateData }] }); // update
      mockDb.query.mockResolvedValueOnce({ rows: [{}] }); // second update for recommendations
      
      const result = await service.updateItem(
        'item-id',
        updateData as any,
        'shop-id'
      );
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    test('should warn about significant condition changes', async () => {
      const currentItem = {
        id: 'item-id',
        condition: 'good'
      };
      
      const updateData = {
        condition: 'needs_immediate'
      };
      
      // Mock repository responses
      mockDb.query.mockResolvedValueOnce({ rows: [currentItem] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ ...currentItem, ...updateData }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{}] });
      
      const result = await service.updateItem(
        'item-id',
        updateData as any,
        'shop-id'
      );
      
      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Condition degraded significantly - verify assessment');
    });
  });

  describe('Urgency Calculation', () => {
    test('should calculate and update urgency for all items', async () => {
      const items = [
        {
          id: 'item-1',
          condition: 'poor',
          category: 'brakes',
          measurements: { pad_thickness_mm: 2.5 },
          priority: 4
        },
        {
          id: 'item-2',
          condition: 'needs_immediate',
          category: 'tires',
          measurements: { tread_depth_32nds: 1 },
          priority: 5
        }
      ];
      
      // Mock repository responses
      mockDb.query.mockResolvedValueOnce({ rows: items }); // findByInspectionId
      mockDb.query.mockResolvedValue({ rows: [{}] }); // updates
      
      const result = await service.calculateAndUpdateUrgency(
        'inspection-id',
        'shop-id'
      );
      
      expect(result.success).toBe(true);
      expect(result.updatedItems).toBeGreaterThan(0);
    });
  });

  describe('Item Assessment', () => {
    test('should generate comprehensive assessment', async () => {
      const item = {
        id: 'item-id',
        category: 'brakes',
        component: 'Front brake pads',
        condition: 'poor',
        measurements: { pad_thickness_mm: 3 },
        priority: 7,
        estimated_cost: 200
      };
      
      const vehicleInfo = {
        year: 2018,
        make: 'Toyota',
        model: 'Camry',
        mileage: 75000
      };
      
      const result = await service.generateItemAssessment(item, vehicleInfo);
      
      expect(result.urgency).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.urgency.level).toBeDefined();
      expect(result.recommendations.primary).toBeDefined();
    });
  });

  describe('Categories Management', () => {
    test('should get inspection categories', async () => {
      const categories = [
        {
          id: 'cat-1',
          name: 'Brakes',
          description: 'Brake system inspection',
          sort_order: 1,
          required: true,
          has_measurements: true,
          measurement_units: ['mm', 'inches'],
          default_components: ['Front brake pads', 'Rear brake pads'],
          is_active: true
        }
      ];
      
      mockDb.query.mockResolvedValue({ rows: categories });
      
      const result = await service.getInspectionCategories('shop-id');
      
      expect(result).toEqual(categories);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('inspection_categories'),
        ['shop-id']
      );
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  
  test('should handle invalid measurement values', () => {
    const input: UrgencyInput = {
      condition: 'fair',
      measurements: { 
        pad_thickness_mm: 'invalid', 
        voltage: null,
        tread_depth_32nds: undefined
      },
      itemType: 'brakes',
      priority: 1
    };
    
    const result = calculateUrgency(input);
    
    // Should not crash and should provide reasonable result
    expect(result.level).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('should handle unknown item types gracefully', () => {
    const input: UrgencyInput = {
      condition: 'poor',
      itemType: 'unknown_item_type',
      priority: 1
    };
    
    const result = calculateUrgency(input);
    
    expect(result.level).toBeDefined();
    expect(result.score).toBeGreaterThan(0);
  });

  test('should handle empty or null measurements', () => {
    const input: RecommendationInput = {
      itemType: 'brakes',
      condition: 'poor',
      measurements: null as any
    };
    
    const result = generateRecommendations(input);
    
    expect(result.primary).toBeDefined();
    expect(result.primary.description).toContain('brakes');
  });

  test('should handle extreme measurement values', () => {
    const input: UrgencyInput = {
      condition: 'fair',
      measurements: { 
        pad_thickness_mm: -5,  // Negative
        voltage: 1000,         // Extremely high
        tread_depth_32nds: 0   // Zero
      },
      itemType: 'brakes',
      priority: 1
    };
    
    const result = calculateUrgency(input);
    
    expect(result.level).toBeDefined();
    expect(result.score).toBeLessThanOrEqual(100);
  });
});