// Inspection Service - Core business logic for vehicle inspections
// Handles inspection lifecycle, checklist management, and voice integration

import { InspectionRepository } from '../repositories/InspectionRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { UserRepository } from '../repositories/UserRepository';
import { VoiceService } from './VoiceService';
import { 
  CreateInspectionDTO, 
  UpdateInspectionDTO, 
  InspectionItemUpdateDTO,
  InspectionQueryDTO 
} from '../types/dtos';
import { ServiceResult, DatabaseService, AppError, HttpStatus, PaginationResult } from '../types/common';
import { Inspection, ChecklistItemResult } from '../types/entities';

export class InspectionService {
  private inspectionRepo: InspectionRepository;
  private customerRepo: CustomerRepository;
  private userRepo: UserRepository;
  private voiceService: VoiceService;
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
    this.inspectionRepo = new InspectionRepository(db);
    this.customerRepo = new CustomerRepository(db);
    this.userRepo = new UserRepository(db);
    this.voiceService = new VoiceService();
  }

  // Create new inspection with validation
  async createInspection(data: CreateInspectionDTO, userId: string): Promise<ServiceResult<Inspection>> {
    try {
      return await this.db.transaction(async (client) => {
        // Validate customer exists and belongs to shop
        const customer = await this.customerRepo.findById(data.customer_id, { transaction: client });
        if (!customer || customer.shop_id !== data.shop_id) {
          return {
            success: false,
            error: 'Invalid customer ID',
            statusCode: HttpStatus.BAD_REQUEST
          };
        }

        // Validate vehicle exists and belongs to customer
        const vehicleExists = await client.query(
          'SELECT 1 FROM vehicles WHERE id = $1 AND customer_id = $2 AND shop_id = $3',
          [data.vehicle_id, data.customer_id, data.shop_id]
        );

        if (vehicleExists.rows.length === 0) {
          return {
            success: false,
            error: 'Invalid vehicle ID',
            statusCode: HttpStatus.BAD_REQUEST
          };
        }

        // Validate technician exists and belongs to shop
        const technician = await this.userRepo.findById(data.technician_id, { transaction: client });
        if (!technician || technician.shop_id !== data.shop_id) {
          return {
            success: false,
            error: 'Invalid technician ID',
            statusCode: HttpStatus.BAD_REQUEST
          };
        }

        // Check if inspection number already exists for this shop
        const existingInspection = await this.inspectionRepo.findByInspectionNumber(
          data.shop_id, 
          data.inspection_number,
          { transaction: client }
        );

        if (existingInspection) {
          return {
            success: false,
            error: 'Inspection number already exists',
            statusCode: HttpStatus.CONFLICT
          };
        }

        // Initialize checklist data from template if provided
        let checklistData = {};
        if (data.template_id) {
          const template = await client.query(
            'SELECT checklist_items FROM inspection_templates WHERE id = $1 AND shop_id = $2 AND active = true',
            [data.template_id, data.shop_id]
          );

          if (template.rows.length === 0) {
            return {
              success: false,
              error: 'Invalid template ID',
              statusCode: HttpStatus.BAD_REQUEST
            };
          }

          // Initialize checklist with template items
          const templateItems = template.rows[0].checklist_items || [];
          templateItems.forEach((item: any) => {
            checklistData[item.id] = {
              status: null,
              notes: '',
              completed: false
            };
          });
        }

        // Create inspection
        const inspectionData = {
          ...data,
          checklist_data: checklistData,
          status: 'draft' as const,
          started_at: new Date()
        };

        const inspection = await this.inspectionRepo.create(inspectionData, { transaction: client });

        return {
          success: true,
          data: inspection
        };
      });

    } catch (error) {
      console.error('Create inspection error:', error);
      return {
        success: false,
        error: 'Failed to create inspection',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get inspection with full details
  async getInspectionById(id: string, userId: string, userRole: string, shopId?: string): Promise<ServiceResult<any>> {
    try {
      const inspection = await this.inspectionRepo.findByIdWithDetails(id);
      
      if (!inspection) {
        return {
          success: false,
          error: 'Inspection not found',
          statusCode: HttpStatus.NOT_FOUND
        };
      }

      // Check access permissions
      const hasAccess = this.checkInspectionAccess(inspection, userId, userRole, shopId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied',
          statusCode: HttpStatus.FORBIDDEN
        };
      }

      // Get inspection photos
      const photos = await this.db.query(
        'SELECT * FROM inspection_photos WHERE inspection_id = $1 ORDER BY sort_order, created_at',
        [id]
      );

      const result = {
        ...inspection,
        photos: photos.rows
      };

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('Get inspection error:', error);
      return {
        success: false,
        error: 'Failed to retrieve inspection',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get inspections with filtering and pagination
  async getInspections(
    query: InspectionQueryDTO, 
    userId: string, 
    userRole: string, 
    userShopId?: string
  ): Promise<ServiceResult<PaginationResult<any>>> {
    try {
      // Apply shop access control
      let shopId = query.shop_id;
      if (userRole !== 'admin') {
        if (!userShopId) {
          return {
            success: false,
            error: 'No shop access',
            statusCode: HttpStatus.FORBIDDEN
          };
        }
        shopId = userShopId;
      }

      if (!shopId) {
        return {
          success: false,
          error: 'Shop ID required',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      // Apply technician filter for mechanics
      let filters = {
        status: query.status,
        technicianId: query.technician_id,
        customerId: query.customer_id,
        fromDate: query.from_date,
        toDate: query.to_date,
        searchTerm: query.search
      };

      if (userRole === 'mechanic') {
        filters.technicianId = userId;
      }

      const result = await this.inspectionRepo.findByShopWithFilters(
        shopId,
        filters,
        query.page || 1,
        query.limit || 20
      );

      return {
        success: true,
        data: {
          items: result.inspections,
          pagination: {
            page: query.page || 1,
            limit: query.limit || 20,
            total: result.total,
            totalPages: Math.ceil(result.total / (query.limit || 20))
          }
        }
      };

    } catch (error) {
      console.error('Get inspections error:', error);
      return {
        success: false,
        error: 'Failed to retrieve inspections',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Update inspection
  async updateInspection(
    id: string, 
    data: UpdateInspectionDTO, 
    userId: string, 
    userRole: string, 
    shopId?: string
  ): Promise<ServiceResult<Inspection>> {
    try {
      return await this.db.transaction(async (client) => {
        // Get current inspection
        const inspection = await this.inspectionRepo.findById(id, { transaction: client });
        
        if (!inspection) {
          return {
            success: false,
            error: 'Inspection not found',
            statusCode: HttpStatus.NOT_FOUND
          };
        }

        // Check access permissions
        const hasAccess = this.checkInspectionAccess(inspection, userId, userRole, shopId);
        if (!hasAccess) {
          return {
            success: false,
            error: 'Access denied',
            statusCode: HttpStatus.FORBIDDEN
          };
        }

        // Validate status transition
        if (data.status && !this.isValidStatusTransition(inspection.status, data.status)) {
          return {
            success: false,
            error: 'Invalid status transition',
            statusCode: HttpStatus.BAD_REQUEST
          };
        }

        // Handle status-specific updates
        const updateData = { ...data };
        let timestampField: 'completed_at' | 'sent_at' | undefined;

        if (data.status === 'completed' && inspection.status !== 'completed') {
          timestampField = 'completed_at';
        } else if (data.status === 'sent' && inspection.status !== 'sent') {
          timestampField = 'sent_at';
        }

        // Update inspection
        const updatedInspection = timestampField 
          ? await this.inspectionRepo.updateStatus(id, data.status!, timestampField, { transaction: client })
          : await this.inspectionRepo.updateById(id, updateData, { transaction: client });

        if (!updatedInspection) {
          return {
            success: false,
            error: 'Failed to update inspection',
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR
          };
        }

        return {
          success: true,
          data: updatedInspection
        };
      });

    } catch (error) {
      console.error('Update inspection error:', error);
      return {
        success: false,
        error: 'Failed to update inspection',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Update checklist item with voice integration
  async updateInspectionItem(
    inspectionId: string,
    itemData: InspectionItemUpdateDTO,
    userId: string,
    userRole: string,
    shopId?: string
  ): Promise<ServiceResult<Inspection>> {
    try {
      return await this.db.transaction(async (client) => {
        // Get current inspection
        const inspection = await this.inspectionRepo.findById(inspectionId, { transaction: client });
        
        if (!inspection) {
          return {
            success: false,
            error: 'Inspection not found',
            statusCode: HttpStatus.NOT_FOUND
          };
        }

        // Check access permissions
        const hasAccess = this.checkInspectionAccess(inspection, userId, userRole, shopId);
        if (!hasAccess) {
          return {
            success: false,
            error: 'Access denied',
            statusCode: HttpStatus.FORBIDDEN
          };
        }

        // Parse voice input if provided
        let voiceData = null;
        if (itemData.voice_input) {
          const voiceResult = await this.voiceService.parseVoiceInput({
            text: itemData.voice_input,
            inspection_id: inspectionId,
            item_id: itemData.item_id
          });

          if (voiceResult.success) {
            voiceData = voiceResult.data;
          }
        }

        // Update checklist data
        const currentChecklistData = inspection.checklist_data || {};
        const itemResult: ChecklistItemResult = {
          status: itemData.status,
          notes: itemData.notes || '',
          measurement: itemData.measurement || voiceData?.measurement || undefined,
          voice_input: itemData.voice_input || undefined,
          photos: currentChecklistData[itemData.item_id]?.photos || []
        };

        currentChecklistData[itemData.item_id] = itemResult;

        // Update inspection with new checklist data
        const updatedInspection = await this.inspectionRepo.updateChecklistData(
          inspectionId, 
          currentChecklistData, 
          { transaction: client }
        );

        if (!updatedInspection) {
          return {
            success: false,
            error: 'Failed to update inspection item',
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR
          };
        }

        return {
          success: true,
          data: updatedInspection
        };
      });

    } catch (error) {
      console.error('Update inspection item error:', error);
      return {
        success: false,
        error: 'Failed to update inspection item',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Generate next inspection number
  async generateInspectionNumber(shopId: string): Promise<ServiceResult<{ inspectionNumber: string }>> {
    try {
      const inspectionNumber = await this.inspectionRepo.generateInspectionNumber(shopId);
      
      return {
        success: true,
        data: { inspectionNumber }
      };

    } catch (error) {
      console.error('Generate inspection number error:', error);
      return {
        success: false,
        error: 'Failed to generate inspection number',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get shop inspection statistics
  async getShopStatistics(
    shopId: string, 
    fromDate?: string, 
    toDate?: string
  ): Promise<ServiceResult<any>> {
    try {
      const stats = await this.inspectionRepo.getShopStatistics(shopId, fromDate, toDate);
      
      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('Get shop statistics error:', error);
      return {
        success: false,
        error: 'Failed to retrieve statistics',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get recent inspections for dashboard
  async getRecentInspections(shopId: string, limit: number = 10): Promise<ServiceResult<any[]>> {
    try {
      const inspections = await this.inspectionRepo.findRecentInspections(shopId, limit);
      
      return {
        success: true,
        data: inspections
      };

    } catch (error) {
      console.error('Get recent inspections error:', error);
      return {
        success: false,
        error: 'Failed to retrieve recent inspections',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Delete inspection (admin only)
  async deleteInspection(
    id: string, 
    userId: string, 
    userRole: string
  ): Promise<ServiceResult<{ success: boolean }>> {
    try {
      if (userRole !== 'admin') {
        return {
          success: false,
          error: 'Admin access required',
          statusCode: HttpStatus.FORBIDDEN
        };
      }

      const deleted = await this.inspectionRepo.deleteById(id);
      
      return {
        success: true,
        data: { success: deleted }
      };

    } catch (error) {
      console.error('Delete inspection error:', error);
      return {
        success: false,
        error: 'Failed to delete inspection',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Private helper methods
  private checkInspectionAccess(
    inspection: any, 
    userId: string, 
    userRole: string, 
    shopId?: string
  ): boolean {
    // Admin can access any inspection
    if (userRole === 'admin') {
      return true;
    }

    // Shop-based access control
    if (shopId && inspection.shop_id !== shopId) {
      return false;
    }

    // Mechanics can only access their own inspections
    if (userRole === 'mechanic' && inspection.technician_id !== userId) {
      return false;
    }

    return true;
  }

  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'draft': ['in_progress', 'archived'],
      'in_progress': ['completed', 'draft', 'archived'],
      'completed': ['sent', 'archived'],
      'sent': ['archived'],
      'archived': [] // Cannot transition from archived
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}