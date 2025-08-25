// Inspection Items Management Service
// Handles individual inspection findings, conditions, and recommendations
// Supports predefined categories, measurements, and business rule validation

import { InspectionItemRepository, InspectionItem, InspectionItemCreateRequest, InspectionItemUpdateRequest } from '../repositories/InspectionItemRepository';
import { VoiceProcessingService } from './VoiceProcessingService';
import { PhotoService } from './PhotoService';
import { DatabaseService } from '../types/common';
import { UrgencyCalculator, UrgencyInput, calculateUrgency } from '../utils/urgency-calculator';
import { RecommendationEngine, RecommendationInput, generateRecommendations } from '../utils/recommendation-engine';

export interface InspectionCategory {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  required: boolean;
  has_measurements: boolean;
  measurement_units?: string[];
  default_components: string[];
  is_active: boolean;
}

export interface InspectionItemWithDetails extends InspectionItem {
  category_info?: InspectionCategory;
  voice_notes_count?: number;
  photos_count?: number;
  recommendation_priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ItemValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ItemRecommendation {
  type: 'maintenance' | 'replacement' | 'inspection' | 'monitoring';
  urgency: 'immediate' | 'soon' | 'scheduled' | 'routine';
  description: string;
  estimatedCost?: number;
  timeframe?: string;
}

export interface BulkItemOperation {
  action: 'create' | 'update' | 'delete' | 'condition_update';
  items: Array<{
    id?: string;
    data: InspectionItemCreateRequest | InspectionItemUpdateRequest | { condition: string };
  }>;
}

export class InspectionItemService {
  private itemRepository: InspectionItemRepository;
  private voiceService: VoiceProcessingService;
  private photoService: PhotoService;
  private db: DatabaseService;
  
  constructor(db: DatabaseService) {
    this.db = db;
    this.itemRepository = new InspectionItemRepository(db);
    this.voiceService = new VoiceProcessingService(db);
    this.photoService = new PhotoService(db);
  }
  
  // Create inspection item with validation
  async createItem(
    inspectionId: string,
    data: InspectionItemCreateRequest,
    userId: string,
    shopId: string
  ): Promise<{ success: boolean; item?: InspectionItem; errors?: string[] }> {
    
    try {
      // Validate item data
      const validation = await this.validateItemData(data, inspectionId, shopId);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }
      
      // Create item
      const item = await this.itemRepository.create(inspectionId, data, shopId);
      
      // Generate initial recommendations if condition is set
      if (item.condition && item.condition !== 'good') {
        const recommendations = await this.generateRecommendations(item);
        if (recommendations.length > 0) {
          await this.itemRepository.update(item.id, {
            recommendations: recommendations.map(r => r.description).join('. ')
          }, shopId);
        }
      }
      
      return { success: true, item };
      
    } catch (error) {
      console.error('Create item error:', error);
      return { success: false, errors: ['Failed to create inspection item'] };
    }
  }

  // Update inspection item with business logic
  async updateItem(
    id: string,
    data: InspectionItemUpdateRequest,
    shopId: string
  ): Promise<{ success: boolean; item?: InspectionItem; warnings?: string[]; errors?: string[] }> {
    
    try {
      // Get current item for comparison
      const currentItems = await this.itemRepository.findByInspectionId('', shopId);
      const currentItem = currentItems.find(item => item.id === id);
      
      if (!currentItem) {
        return { success: false, errors: ['Item not found'] };
      }
      
      const warnings: string[] = [];
      
      // Check for condition changes that might require attention
      if (data.condition && data.condition !== currentItem.condition) {
        const conditionWarning = this.checkConditionChange(currentItem.condition, data.condition);
        if (conditionWarning) {
          warnings.push(conditionWarning);
        }
      }
      
      // Update item
      const item = await this.itemRepository.update(id, data, shopId);
      
      if (!item) {
        return { success: false, errors: ['Failed to update item'] };
      }
      
      // Update recommendations if condition changed
      if (data.condition && data.condition !== currentItem.condition) {
        const urgencyInput: UrgencyInput = {
          condition: data.condition,
          measurements: data.measurements || item.measurements,
          itemType: data.category || item.category,
          priority: data.priority || item.priority,
          estimatedCost: data.estimatedCost || item.estimated_cost
        };
        
        const urgencyResult = calculateUrgency(urgencyInput);
        
        const recommendationInput: RecommendationInput = {
          itemType: data.category || item.category,
          condition: data.condition,
          measurements: data.measurements || item.measurements
        };
        
        const recommendations = generateRecommendations(recommendationInput);
        
        await this.itemRepository.update(id, {
          recommendations: recommendations.primary.description,
          priority: this.calculatePriority(data.condition)
        }, shopId);
      }
      
      return { success: true, item, warnings };
      
    } catch (error) {
      console.error('Update item error:', error);
      return { success: false, errors: ['Failed to update inspection item'] };
    }
  }

  // Get items for inspection with details
  async getInspectionItems(
    inspectionId: string,
    shopId: string,
    includeDetails: boolean = false
  ): Promise<InspectionItemWithDetails[]> {
    
    const items = await this.itemRepository.findByInspectionId(inspectionId, shopId);
    
    if (!includeDetails) {
      return items;
    }
    
    // Enhance with additional details
    const enhancedItems: InspectionItemWithDetails[] = [];
    
    for (const item of items) {
      const enhanced: InspectionItemWithDetails = { ...item };
      
      // Add voice notes count
      if (item.voice_notes && Array.isArray(item.voice_notes)) {
        enhanced.voice_notes_count = item.voice_notes.length;
      }
      
      // Add photos count
      if (item.photo_ids && Array.isArray(item.photo_ids)) {
        enhanced.photos_count = item.photo_ids.length;
      }
      
      // Add recommendation priority
      enhanced.recommendation_priority = this.getRecommendationPriority(item.condition);
      
      enhancedItems.push(enhanced);
    }
    
    return enhancedItems;
  }

  // Calculate item urgency and update
  async calculateAndUpdateUrgency(
    inspectionId: string,
    shopId: string
  ): Promise<{ success: boolean; updatedItems?: number; errors?: string[] }> {
    
    try {
      const items = await this.itemRepository.findByInspectionId(inspectionId, shopId);
      let updatedCount = 0;
      
      for (const item of items) {
        if (!item.condition) continue;
        
        const urgencyInput: UrgencyInput = {
          condition: item.condition,
          measurements: item.measurements,
          itemType: item.category,
          priority: item.priority,
          estimatedCost: item.estimated_cost
        };
        
        const urgencyResult = calculateUrgency(urgencyInput);
        
        // Update priority based on urgency calculation
        const newPriority = this.urgencyLevelToPriority(urgencyResult.level);
        
        if (newPriority !== item.priority) {
          await this.itemRepository.update(item.id, {
            priority: newPriority
          }, shopId);
          updatedCount++;
        }
      }
      
      return { success: true, updatedItems: updatedCount };
      
    } catch (error) {
      console.error('Calculate urgency error:', error);
      return { success: false, errors: ['Failed to calculate item urgencies'] };
    }
  }

  // Bulk create items (for inspection templates)
  async createBulkItems(
    inspectionId: string,
    items: InspectionItemCreateRequest[],
    shopId: string
  ): Promise<{ success: boolean; items?: InspectionItem[]; errors?: string[] }> {
    
    try {
      // Validate all items first
      for (const item of items) {
        const validation = await this.validateItemData(item, inspectionId, shopId);
        if (!validation.valid) {
          return { success: false, errors: validation.errors };
        }
      }
      
      // Create all items
      const createdItems = await this.itemRepository.createBulk(inspectionId, items, shopId);
      
      return { success: true, items: createdItems };
      
    } catch (error) {
      console.error('Bulk create items error:', error);
      return { success: false, errors: ['Failed to create items in bulk'] };
    }
  }

  // Get inspection categories
  async getInspectionCategories(shopId?: string): Promise<InspectionCategory[]> {
    let query = `
      SELECT * FROM inspection_categories 
      WHERE is_active = true
    `;
    
    const params: any[] = [];
    
    if (shopId) {
      query += ' AND (shop_id = $1 OR shop_id IS NULL)';
      params.push(shopId);
    } else {
      query += ' AND shop_id IS NULL'; // Only system categories
    }
    
    query += ' ORDER BY sort_order, name';
    
    const result = await this.db.query(query, params);
    return result.rows;
  }

  // Generate comprehensive item assessment
  async generateItemAssessment(
    item: InspectionItem,
    vehicleInfo?: { year?: number; make?: string; model?: string; mileage?: number }
  ): Promise<{
    urgency: any;
    recommendations: any;
    nextServiceDate?: Date;
    costEstimate?: number;
  }> {
    
    const urgencyInput: UrgencyInput = {
      condition: item.condition,
      measurements: item.measurements,
      itemType: item.category,
      priority: item.priority,
      estimatedCost: item.estimated_cost
    };
    
    const urgencyResult = calculateUrgency(urgencyInput);
    
    const recommendationInput: RecommendationInput = {
      itemType: item.category,
      condition: item.condition,
      measurements: item.measurements,
      vehicleInfo
    };
    
    const recommendations = generateRecommendations(recommendationInput);
    
    return {
      urgency: urgencyResult,
      recommendations,
      nextServiceDate: recommendations.nextServiceDate,
      costEstimate: recommendations.totalEstimatedCost
    };
  }

  // Generate recommendations for an item using the recommendation engine
  private async generateRecommendations(item: InspectionItem): Promise<ItemRecommendation[]> {
    const recommendations: ItemRecommendation[] = [];
    
    if (!item.condition) {
      return recommendations;
    }

    const input: RecommendationInput = {
      itemType: item.category,
      condition: item.condition,
      measurements: item.measurements
    };

    const result = generateRecommendations(input);
    
    // Convert to ItemRecommendation format
    if (result.primary) {
      recommendations.push({
        type: result.primary.type,
        urgency: result.primary.urgency,
        description: result.primary.description,
        estimatedCost: result.primary.estimatedCost?.total,
        timeframe: result.primary.timeframe
      });
    }

    result.secondary.forEach(rec => {
      recommendations.push({
        type: rec.type,
        urgency: rec.urgency,
        description: rec.description,
        estimatedCost: rec.estimatedCost?.total,
        timeframe: rec.timeframe
      });
    });

    return recommendations;
  }

  private async validateItemData(
    data: InspectionItemCreateRequest,
    inspectionId: string,
    shopId: string
  ): Promise<ItemValidationResult> {
    
    const result: ItemValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      recommendations: []
    };
    
    // Basic validation
    if (!data.category) {
      result.errors.push('Category is required');
      result.valid = false;
    }
    
    if (!data.component) {
      result.errors.push('Component is required');
      result.valid = false;
    }

    // Validate measurements if provided
    if (data.measurements) {
      const measurementValidation = this.validateMeasurements(data.measurements, data.category);
      if (!measurementValidation.valid) {
        result.errors.push(...measurementValidation.errors);
        result.valid = false;
      }
      result.warnings.push(...measurementValidation.warnings);
    }
    
    return result;
  }

  private validateMeasurements(
    measurements: Record<string, any>,
    category: string
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    
    const result = { valid: true, errors: [], warnings: [] };

    switch (category.toLowerCase()) {
      case 'brakes':
        if (measurements.pad_thickness_mm !== undefined) {
          const thickness = parseFloat(measurements.pad_thickness_mm);
          if (isNaN(thickness) || thickness < 0 || thickness > 20) {
            result.errors.push('Brake pad thickness must be between 0-20mm');
            result.valid = false;
          } else if (thickness < 2) {
            result.warnings.push('Brake pad thickness is critically low');
          }
        }
        break;

      case 'tires':
        if (measurements.tread_depth_32nds !== undefined) {
          const tread = parseFloat(measurements.tread_depth_32nds);
          if (isNaN(tread) || tread < 0 || tread > 32) {
            result.errors.push('Tread depth must be between 0-32/32"');
            result.valid = false;
          } else if (tread < 4) {
            result.warnings.push('Tread depth is approaching minimum legal limit');
          }
        }
        break;

      case 'battery':
        if (measurements.voltage !== undefined) {
          const voltage = parseFloat(measurements.voltage);
          if (isNaN(voltage) || voltage < 8 || voltage > 16) {
            result.errors.push('Battery voltage must be between 8-16V');
            result.valid = false;
          } else if (voltage < 12.0) {
            result.warnings.push('Battery voltage is low');
          }
        }
        break;
    }

    return result;
  }
  
  private checkConditionChange(
    oldCondition: string,
    newCondition: string
  ): string | null {
    
    // Check for concerning condition changes
    if (oldCondition === 'good' && newCondition === 'needs_immediate') {
      return 'Condition degraded significantly - verify assessment';
    }
    
    if (newCondition === 'needs_immediate') {
      return 'Critical safety item identified - requires immediate attention';
    }
    
    if (oldCondition === 'needs_immediate' && newCondition === 'good') {
      return 'Major condition improvement - verify repair was completed';
    }
    
    return null;
  }
  
  private calculatePriority(condition: string): number {
    const priorityMap: Record<string, number> = {
      'needs_immediate': 10,
      'poor': 7,
      'fair': 4,
      'good': 1
    };
    
    return priorityMap[condition] || 1;
  }

  private urgencyLevelToPriority(level: string): number {
    const priorityMap: Record<string, number> = {
      'critical': 10,
      'high': 7,
      'normal': 4,
      'low': 1
    };
    
    return priorityMap[level] || 1;
  }

  private getRecommendationPriority(
    condition: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    
    switch (condition) {
      case 'needs_immediate':
        return 'critical';
      case 'poor':
        return 'high';
      case 'fair':
        return 'medium';
      case 'good':
      default:
        return 'low';
    }
  }
}