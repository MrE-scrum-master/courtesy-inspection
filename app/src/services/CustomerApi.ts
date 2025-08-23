// Customer API service - pure API calls, NO business logic
import { apiClient } from './ApiClient';
import { API_ENDPOINTS } from '@/constants';
import type { 
  Customer, 
  Vehicle,
  ApiResponse, 
  PaginatedResponse 
} from '@/types/common';

export class CustomerApi {
  // Get all customers with pagination and search
  static async getCustomers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    shopId?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<PaginatedResponse<Customer>>> {
    return apiClient.get<PaginatedResponse<Customer>>(API_ENDPOINTS.CUSTOMERS.BASE, {
      params,
    });
  }

  // Get single customer by ID
  static async getCustomer(customerId: string): Promise<ApiResponse<Customer>> {
    return apiClient.get<Customer>(API_ENDPOINTS.CUSTOMERS.BY_ID(customerId));
  }

  // Create new customer
  static async createCustomer(customerData: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    shopId: string;
  }): Promise<ApiResponse<Customer>> {
    return apiClient.post<Customer>(API_ENDPOINTS.CUSTOMERS.BASE, customerData);
  }

  // Update customer
  static async updateCustomer(
    customerId: string, 
    customerData: Partial<Customer>
  ): Promise<ApiResponse<Customer>> {
    return apiClient.put<Customer>(
      API_ENDPOINTS.CUSTOMERS.BY_ID(customerId), 
      customerData
    );
  }

  // Delete customer
  static async deleteCustomer(customerId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(API_ENDPOINTS.CUSTOMERS.BY_ID(customerId));
  }

  // Search customers
  static async searchCustomers(
    query: string,
    shopId?: string
  ): Promise<ApiResponse<Customer[]>> {
    return apiClient.get<Customer[]>(API_ENDPOINTS.CUSTOMERS.SEARCH, {
      params: { query, shopId },
    });
  }

  // Get customers by shop
  static async getCustomersByShop(
    shopId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    }
  ): Promise<ApiResponse<PaginatedResponse<Customer>>> {
    return apiClient.get<PaginatedResponse<Customer>>(
      API_ENDPOINTS.CUSTOMERS.BY_SHOP(shopId),
      { params }
    );
  }

  // Archive customer
  static async archiveCustomer(customerId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(
      `${API_ENDPOINTS.CUSTOMERS.BY_ID(customerId)}/archive`
    );
  }

  // Restore archived customer
  static async restoreCustomer(customerId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(
      `${API_ENDPOINTS.CUSTOMERS.BY_ID(customerId)}/restore`
    );
  }

  // Get customer with vehicles and recent inspections
  static async getCustomerDetails(customerId: string): Promise<ApiResponse<{
    customer: Customer;
    vehicles: Vehicle[];
    recentInspections: Array<{
      id: string;
      vehicleId: string;
      type: string;
      status: string;
      completedDate?: string;
      totalEstimatedCost?: number;
    }>;
  }>> {
    return apiClient.get(`${API_ENDPOINTS.CUSTOMERS.BY_ID(customerId)}/details`);
  }
}

// Vehicle API methods (related to customers)
export class VehicleApi {
  // Get all vehicles
  static async getVehicles(params?: {
    page?: number;
    limit?: number;
    customerId?: string;
  }): Promise<ApiResponse<PaginatedResponse<Vehicle>>> {
    return apiClient.get<PaginatedResponse<Vehicle>>(API_ENDPOINTS.VEHICLES.BASE, {
      params,
    });
  }

  // Get single vehicle by ID
  static async getVehicle(vehicleId: string): Promise<ApiResponse<Vehicle>> {
    return apiClient.get<Vehicle>(API_ENDPOINTS.VEHICLES.BY_ID(vehicleId));
  }

  // Create new vehicle
  static async createVehicle(vehicleData: {
    customerId: string;
    make: string;
    model: string;
    year: number;
    vin?: string;
    licensePlate?: string;
    color?: string;
    mileage?: number;
    notes?: string;
  }): Promise<ApiResponse<Vehicle>> {
    return apiClient.post<Vehicle>(API_ENDPOINTS.VEHICLES.BASE, vehicleData);
  }

  // Update vehicle
  static async updateVehicle(
    vehicleId: string, 
    vehicleData: Partial<Vehicle>
  ): Promise<ApiResponse<Vehicle>> {
    return apiClient.put<Vehicle>(
      API_ENDPOINTS.VEHICLES.BY_ID(vehicleId), 
      vehicleData
    );
  }

  // Delete vehicle
  static async deleteVehicle(vehicleId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(API_ENDPOINTS.VEHICLES.BY_ID(vehicleId));
  }

  // Get vehicles by customer
  static async getVehiclesByCustomer(customerId: string): Promise<ApiResponse<Vehicle[]>> {
    return apiClient.get<Vehicle[]>(API_ENDPOINTS.VEHICLES.BY_CUSTOMER(customerId));
  }

  // Get vehicle with inspection history
  static async getVehicleDetails(vehicleId: string): Promise<ApiResponse<{
    vehicle: Vehicle;
    customer: Customer;
    inspectionHistory: Array<{
      id: string;
      type: string;
      status: string;
      completedDate?: string;
      totalEstimatedCost?: number;
      mechanicName: string;
    }>;
  }>> {
    return apiClient.get(`${API_ENDPOINTS.VEHICLES.BY_ID(vehicleId)}/details`);
  }

  // Search vehicles by VIN or license plate
  static async searchVehicles(query: string): Promise<ApiResponse<Vehicle[]>> {
    return apiClient.get<Vehicle[]>(`${API_ENDPOINTS.VEHICLES.BASE}/search`, {
      params: { query },
    });
  }
}

export default CustomerApi;