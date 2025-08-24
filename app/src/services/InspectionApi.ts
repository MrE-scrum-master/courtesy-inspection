// Inspection API service - pure API calls, NO business logic
import { apiClient } from './ApiClient';
import { API_ENDPOINTS } from '@/constants';
import type { 
  Inspection, 
  InspectionItem,
  ApiResponse, 
  PaginatedResponse 
} from '@/types/common';

export class InspectionApi {
  // Get all inspections with pagination and filters
  static async getInspections(params?: {
    page?: number;
    limit?: number;
    status?: string;
    customerId?: string;
    mechanicId?: string;
    shopId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<PaginatedResponse<Inspection>>> {
    return apiClient.get<PaginatedResponse<Inspection>>(API_ENDPOINTS.INSPECTIONS.BASE, {
      params,
    });
  }

  // Get single inspection by ID
  static async getInspection(inspectionId: string): Promise<ApiResponse<Inspection>> {
    return apiClient.get<Inspection>(API_ENDPOINTS.INSPECTIONS.BY_ID(inspectionId));
  }

  // Create new inspection
  static async createInspection(inspectionData: {
    customerId: string;
    vehicleId: string;
    type: 'courtesy' | 'detailed' | 'follow_up';
    scheduledDate?: string;
    items?: Partial<InspectionItem>[];
  }): Promise<ApiResponse<Inspection>> {
    return apiClient.post<Inspection>(API_ENDPOINTS.INSPECTIONS.BASE, inspectionData);
  }

  // Update inspection
  static async updateInspection(
    inspectionId: string, 
    inspectionData: Partial<Inspection>
  ): Promise<ApiResponse<Inspection>> {
    return apiClient.put<Inspection>(
      API_ENDPOINTS.INSPECTIONS.BY_ID(inspectionId), 
      inspectionData
    );
  }

  // Delete inspection
  static async deleteInspection(inspectionId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(API_ENDPOINTS.INSPECTIONS.BY_ID(inspectionId));
  }

  // Update inspection item
  static async updateInspectionItem(
    inspectionId: string,
    itemId: string,
    itemData: Partial<InspectionItem>
  ): Promise<ApiResponse<InspectionItem>> {
    return apiClient.put<InspectionItem>(
      `${API_ENDPOINTS.INSPECTIONS.BY_ID(inspectionId)}/items/${itemId}`,
      itemData
    );
  }

  // Add inspection item
  static async addInspectionItem(
    inspectionId: string,
    itemData: Omit<InspectionItem, 'id'>
  ): Promise<ApiResponse<InspectionItem>> {
    return apiClient.post<InspectionItem>(
      `${API_ENDPOINTS.INSPECTIONS.BY_ID(inspectionId)}/items`,
      itemData
    );
  }

  // Remove inspection item
  static async removeInspectionItem(
    inspectionId: string,
    itemId: string
  ): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(
      `${API_ENDPOINTS.INSPECTIONS.BY_ID(inspectionId)}/items/${itemId}`
    );
  }

  // Upload photo for inspection item
  static async uploadPhoto(
    inspectionId: string,
    itemId: string,
    photoFile: {
      uri: string;
      type: string;
      name: string;
    },
    onUploadProgress?: (progress: { loaded: number; total?: number }) => void
  ): Promise<ApiResponse<{ photoUrl: string }>> {
    const formData = new FormData();
    formData.append('photo', photoFile as any);
    formData.append('itemId', itemId);

    return apiClient.upload<{ photoUrl: string }>(
      API_ENDPOINTS.INSPECTIONS.UPLOAD_PHOTO(inspectionId),
      formData,
      onUploadProgress
    );
  }

  // Upload voice note for inspection item
  static async uploadVoiceNote(
    inspectionId: string,
    itemId: string,
    voiceFile: {
      uri: string;
      type: string;
      name: string;
    },
    onUploadProgress?: (progress: { loaded: number; total?: number }) => void
  ): Promise<ApiResponse<{ voiceUrl: string }>> {
    const formData = new FormData();
    formData.append('voice', voiceFile as any);
    formData.append('itemId', itemId);

    return apiClient.upload<{ voiceUrl: string }>(
      API_ENDPOINTS.INSPECTIONS.UPLOAD_VOICE(inspectionId),
      formData,
      onUploadProgress
    );
  }

  // Get inspection templates
  static async getInspectionTemplates(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description: string;
    points: number;
    estimatedTime: number;
    categories: string[];
    items: Array<{
      category: string;
      name: string;
      priority: 'low' | 'medium' | 'high';
    }>;
  }>>> {
    return apiClient.get(API_ENDPOINTS.INSPECTIONS.TEMPLATES);
  }

  // Send inspection report to customer
  static async sendInspectionReport(
    inspectionId: string,
    options?: {
      method: 'sms' | 'email' | 'both';
      message?: string;
    }
  ): Promise<ApiResponse<void>> {
    return apiClient.post<void>(
      API_ENDPOINTS.INSPECTIONS.SEND_REPORT(inspectionId),
      options
    );
  }

  // Get inspections by customer
  static async getInspectionsByCustomer(
    customerId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
    }
  ): Promise<ApiResponse<PaginatedResponse<Inspection>>> {
    return apiClient.get<PaginatedResponse<Inspection>>(
      API_ENDPOINTS.INSPECTIONS.BY_CUSTOMER(customerId),
      { params }
    );
  }

  // Get inspections by mechanic
  static async getInspectionsByMechanic(
    mechanicId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ApiResponse<PaginatedResponse<Inspection>>> {
    return apiClient.get<PaginatedResponse<Inspection>>(
      API_ENDPOINTS.INSPECTIONS.BY_MECHANIC(mechanicId),
      { params }
    );
  }

  // Get inspections by shop
  static async getInspectionsByShop(
    shopId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
      mechanicId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ApiResponse<PaginatedResponse<Inspection>>> {
    return apiClient.get<PaginatedResponse<Inspection>>(
      API_ENDPOINTS.INSPECTIONS.BY_SHOP(shopId),
      { params }
    );
  }

  // Duplicate inspection
  static async duplicateInspection(
    inspectionId: string,
    newData?: {
      customerId?: string;
      vehicleId?: string;
      scheduledDate?: string;
    }
  ): Promise<ApiResponse<Inspection>> {
    return apiClient.post<Inspection>(
      `${API_ENDPOINTS.INSPECTIONS.BY_ID(inspectionId)}/duplicate`,
      newData
    );
  }

  // Archive inspection
  static async archiveInspection(inspectionId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(
      `${API_ENDPOINTS.INSPECTIONS.BY_ID(inspectionId)}/archive`
    );
  }

  // Restore archived inspection
  static async restoreInspection(inspectionId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(
      `${API_ENDPOINTS.INSPECTIONS.BY_ID(inspectionId)}/restore`
    );
  }
}

export default InspectionApi;