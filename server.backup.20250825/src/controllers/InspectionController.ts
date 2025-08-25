// Inspection Controller - HTTP request handling for inspections
// Thin controller layer - delegates to InspectionService for business logic

import { Request, Response } from 'express';
import { InspectionService } from '../services/InspectionService';
import { 
  CreateInspectionDTO, 
  UpdateInspectionDTO, 
  InspectionItemUpdateDTO,
  InspectionQueryDTO 
} from '../types/dtos';
import { HttpStatus } from '../types/common';

export class InspectionController {
  private inspectionService: InspectionService;

  constructor(inspectionService: InspectionService) {
    this.inspectionService = inspectionService;
  }

  // POST /inspections
  createInspection = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const data: CreateInspectionDTO = req.body;
      const result = await this.inspectionService.createInspection(data, req.user.id);

      if (result.success) {
        res.status(HttpStatus.CREATED).json({
          success: true,
          data: result.data,
          message: 'Inspection created successfully'
        });
      } else {
        res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Create inspection controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to create inspection'
      });
    }
  };

  // GET /inspections/:id
  getInspectionById = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { id } = req.params;
      const result = await this.inspectionService.getInspectionById(
        id,
        req.user.id,
        req.user.role,
        req.user.shop_id || undefined
      );

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data
        });
      } else {
        res.status(result.statusCode || HttpStatus.NOT_FOUND).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Get inspection controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to retrieve inspection'
      });
    }
  };

  // GET /inspections
  getInspections = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const query = req.query as InspectionQueryDTO;
      const result = await this.inspectionService.getInspections(
        query,
        req.user.id,
        req.user.role,
        req.user.shop_id || undefined
      );

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data?.items,
          pagination: result.data?.pagination
        });
      } else {
        res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Get inspections controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to retrieve inspections'
      });
    }
  };

  // PUT /inspections/:id
  updateInspection = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { id } = req.params;
      const data: UpdateInspectionDTO = req.body;
      
      const result = await this.inspectionService.updateInspection(
        id,
        data,
        req.user.id,
        req.user.role,
        req.user.shop_id || undefined
      );

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data,
          message: 'Inspection updated successfully'
        });
      } else {
        res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Update inspection controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to update inspection'
      });
    }
  };

  // PATCH /inspections/:id/items
  updateInspectionItem = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { id } = req.params;
      const itemData: InspectionItemUpdateDTO = req.body;
      
      const result = await this.inspectionService.updateInspectionItem(
        id,
        itemData,
        req.user.id,
        req.user.role,
        req.user.shop_id || undefined
      );

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data,
          message: 'Inspection item updated successfully'
        });
      } else {
        res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Update inspection item controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to update inspection item'
      });
    }
  };

  // DELETE /inspections/:id
  deleteInspection = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { id } = req.params;
      const result = await this.inspectionService.deleteInspection(
        id,
        req.user.id,
        req.user.role
      );

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          message: 'Inspection deleted successfully'
        });
      } else {
        res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Delete inspection controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to delete inspection'
      });
    }
  };

  // GET /inspections/generate-number/:shopId
  generateInspectionNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { shopId } = req.params;

      // Check shop access
      if (req.user.role !== 'admin' && req.user.shop_id !== shopId) {
        res.status(HttpStatus.FORBIDDEN).json({
          success: false,
          error: 'Access denied to this shop'
        });
        return;
      }

      const result = await this.inspectionService.generateInspectionNumber(shopId);

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data
        });
      } else {
        res.status(result.statusCode || HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Generate inspection number controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to generate inspection number'
      });
    }
  };

  // GET /inspections/statistics/:shopId
  getShopStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { shopId } = req.params;
      const { fromDate, toDate } = req.query;

      // Check shop access
      if (req.user.role !== 'admin' && req.user.shop_id !== shopId) {
        res.status(HttpStatus.FORBIDDEN).json({
          success: false,
          error: 'Access denied to this shop'
        });
        return;
      }

      const result = await this.inspectionService.getShopStatistics(
        shopId,
        fromDate as string,
        toDate as string
      );

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data
        });
      } else {
        res.status(result.statusCode || HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Get shop statistics controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }
  };

  // GET /inspections/recent/:shopId
  getRecentInspections = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { shopId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      // Check shop access
      if (req.user.role !== 'admin' && req.user.shop_id !== shopId) {
        res.status(HttpStatus.FORBIDDEN).json({
          success: false,
          error: 'Access denied to this shop'
        });
        return;
      }

      const result = await this.inspectionService.getRecentInspections(shopId, limit);

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data
        });
      } else {
        res.status(result.statusCode || HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Get recent inspections controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to retrieve recent inspections'
      });
    }
  };

  // GET /inspections/my
  getMyInspections = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Force filter by technician for mechanics
      const query: InspectionQueryDTO = {
        ...req.query as InspectionQueryDTO,
        technician_id: req.user.id,
        shop_id: req.user.shop_id || undefined
      };

      const result = await this.inspectionService.getInspections(
        query,
        req.user.id,
        req.user.role,
        req.user.shop_id || undefined
      );

      if (result.success) {
        res.status(HttpStatus.OK).json({
          success: true,
          data: result.data?.items,
          pagination: result.data?.pagination
        });
      } else {
        res.status(result.statusCode || HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Get my inspections controller error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to retrieve inspections'
      });
    }
  };
}