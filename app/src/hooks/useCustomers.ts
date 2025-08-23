// Customer data fetching hooks using React Query - NO business logic
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CustomerApi, VehicleApi } from '@/services';
import type { Customer, Vehicle, PaginatedResponse } from '@/types/common';

// Query keys for cache management
export const CUSTOMER_QUERY_KEYS = {
  all: ['customers'] as const,
  lists: () => [...CUSTOMER_QUERY_KEYS.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...CUSTOMER_QUERY_KEYS.lists(), filters] as const,
  details: () => [...CUSTOMER_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CUSTOMER_QUERY_KEYS.details(), id] as const,
  search: (query: string) => [...CUSTOMER_QUERY_KEYS.all, 'search', query] as const,
  byShop: (shopId: string) => [...CUSTOMER_QUERY_KEYS.all, 'shop', shopId] as const,
};

export const VEHICLE_QUERY_KEYS = {
  all: ['vehicles'] as const,
  lists: () => [...VEHICLE_QUERY_KEYS.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...VEHICLE_QUERY_KEYS.lists(), filters] as const,
  details: () => [...VEHICLE_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...VEHICLE_QUERY_KEYS.details(), id] as const,
  byCustomer: (customerId: string) => [...VEHICLE_QUERY_KEYS.all, 'customer', customerId] as const,
  search: (query: string) => [...VEHICLE_QUERY_KEYS.all, 'search', query] as const,
};

// Customer hooks
export function useCustomers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  shopId?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: CUSTOMER_QUERY_KEYS.list(params || {}),
    queryFn: () => CustomerApi.getCustomers(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCustomer(customerId: string) {
  return useQuery({
    queryKey: CUSTOMER_QUERY_KEYS.detail(customerId),
    queryFn: () => CustomerApi.getCustomer(customerId),
    enabled: !!customerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCustomerDetails(customerId: string) {
  return useQuery({
    queryKey: [...CUSTOMER_QUERY_KEYS.detail(customerId), 'full'],
    queryFn: () => CustomerApi.getCustomerDetails(customerId),
    enabled: !!customerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useSearchCustomers(query: string, shopId?: string) {
  return useQuery({
    queryKey: CUSTOMER_QUERY_KEYS.search(query),
    queryFn: () => CustomerApi.searchCustomers(query, shopId),
    enabled: query.length >= 2, // Only search when query is at least 2 characters
    staleTime: 30 * 1000, // 30 seconds for search results
  });
}

export function useCustomersByShop(
  shopId: string,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }
) {
  return useQuery({
    queryKey: CUSTOMER_QUERY_KEYS.byShop(shopId),
    queryFn: () => CustomerApi.getCustomersByShop(shopId, params),
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Customer mutations
export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CustomerApi.createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_QUERY_KEYS.lists() });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, data }: { 
      customerId: string; 
      data: Partial<Customer> 
    }) => CustomerApi.updateCustomer(customerId, data),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        CUSTOMER_QUERY_KEYS.detail(variables.customerId),
        data
      );
      queryClient.invalidateQueries({ queryKey: CUSTOMER_QUERY_KEYS.lists() });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CustomerApi.deleteCustomer,
    onSuccess: (data, customerId) => {
      queryClient.removeQueries({ 
        queryKey: CUSTOMER_QUERY_KEYS.detail(customerId) 
      });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_QUERY_KEYS.lists() });
    },
  });
}

export function useArchiveCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CustomerApi.archiveCustomer,
    onSuccess: (data, customerId) => {
      queryClient.invalidateQueries({ 
        queryKey: CUSTOMER_QUERY_KEYS.detail(customerId) 
      });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_QUERY_KEYS.lists() });
    },
  });
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CustomerApi.restoreCustomer,
    onSuccess: (data, customerId) => {
      queryClient.invalidateQueries({ 
        queryKey: CUSTOMER_QUERY_KEYS.detail(customerId) 
      });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_QUERY_KEYS.lists() });
    },
  });
}

// Vehicle hooks
export function useVehicles(params?: {
  page?: number;
  limit?: number;
  customerId?: string;
}) {
  return useQuery({
    queryKey: VEHICLE_QUERY_KEYS.list(params || {}),
    queryFn: () => VehicleApi.getVehicles(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useVehicle(vehicleId: string) {
  return useQuery({
    queryKey: VEHICLE_QUERY_KEYS.detail(vehicleId),
    queryFn: () => VehicleApi.getVehicle(vehicleId),
    enabled: !!vehicleId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useVehicleDetails(vehicleId: string) {
  return useQuery({
    queryKey: [...VEHICLE_QUERY_KEYS.detail(vehicleId), 'full'],
    queryFn: () => VehicleApi.getVehicleDetails(vehicleId),
    enabled: !!vehicleId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useVehiclesByCustomer(customerId: string) {
  return useQuery({
    queryKey: VEHICLE_QUERY_KEYS.byCustomer(customerId),
    queryFn: () => VehicleApi.getVehiclesByCustomer(customerId),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSearchVehicles(query: string) {
  return useQuery({
    queryKey: VEHICLE_QUERY_KEYS.search(query),
    queryFn: () => VehicleApi.searchVehicles(query),
    enabled: query.length >= 3, // Only search when query is at least 3 characters
    staleTime: 30 * 1000, // 30 seconds for search results
  });
}

// Vehicle mutations
export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: VehicleApi.createVehicle,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: VEHICLE_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ 
        queryKey: VEHICLE_QUERY_KEYS.byCustomer(variables.customerId) 
      });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vehicleId, data }: { 
      vehicleId: string; 
      data: Partial<Vehicle> 
    }) => VehicleApi.updateVehicle(vehicleId, data),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        VEHICLE_QUERY_KEYS.detail(variables.vehicleId),
        data
      );
      queryClient.invalidateQueries({ queryKey: VEHICLE_QUERY_KEYS.lists() });
      // Invalidate customer's vehicles list
      if (data?.data?.customerId) {
        queryClient.invalidateQueries({ 
          queryKey: VEHICLE_QUERY_KEYS.byCustomer(data.data.customerId) 
        });
      }
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: VehicleApi.deleteVehicle,
    onSuccess: (data, vehicleId) => {
      queryClient.removeQueries({ 
        queryKey: VEHICLE_QUERY_KEYS.detail(vehicleId) 
      });
      queryClient.invalidateQueries({ queryKey: VEHICLE_QUERY_KEYS.lists() });
      // Note: We can't easily invalidate customer vehicles without knowing customerId
      // but the list invalidation should handle most cases
    },
  });
}