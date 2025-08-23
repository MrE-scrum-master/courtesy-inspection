// Inspection data fetching hooks using React Query - NO business logic
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InspectionApi } from '@/services';
import type { 
  Inspection, 
  InspectionItem, 
  PaginatedResponse 
} from '@/types/common';

// Query keys for cache management
export const INSPECTION_QUERY_KEYS = {
  all: ['inspections'] as const,
  lists: () => [...INSPECTION_QUERY_KEYS.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...INSPECTION_QUERY_KEYS.lists(), filters] as const,
  details: () => [...INSPECTION_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...INSPECTION_QUERY_KEYS.details(), id] as const,
  templates: () => [...INSPECTION_QUERY_KEYS.all, 'templates'] as const,
  byCustomer: (customerId: string) => [...INSPECTION_QUERY_KEYS.all, 'customer', customerId] as const,
  byMechanic: (mechanicId: string) => [...INSPECTION_QUERY_KEYS.all, 'mechanic', mechanicId] as const,
  byShop: (shopId: string) => [...INSPECTION_QUERY_KEYS.all, 'shop', shopId] as const,
};

// Get inspections with pagination and filters
export function useInspections(params?: {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  mechanicId?: string;
  shopId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: INSPECTION_QUERY_KEYS.list(params || {}),
    queryFn: () => InspectionApi.getInspections(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get single inspection
export function useInspection(inspectionId: string) {
  return useQuery({
    queryKey: INSPECTION_QUERY_KEYS.detail(inspectionId),
    queryFn: () => InspectionApi.getInspection(inspectionId),
    enabled: !!inspectionId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get inspection templates
export function useInspectionTemplates() {
  return useQuery({
    queryKey: INSPECTION_QUERY_KEYS.templates(),
    queryFn: () => InspectionApi.getInspectionTemplates(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Get inspections by customer
export function useInspectionsByCustomer(
  customerId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
  }
) {
  return useQuery({
    queryKey: INSPECTION_QUERY_KEYS.byCustomer(customerId),
    queryFn: () => InspectionApi.getInspectionsByCustomer(customerId, params),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get inspections by mechanic
export function useInspectionsByMechanic(
  mechanicId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  return useQuery({
    queryKey: INSPECTION_QUERY_KEYS.byMechanic(mechanicId),
    queryFn: () => InspectionApi.getInspectionsByMechanic(mechanicId, params),
    enabled: !!mechanicId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get inspections by shop
export function useInspectionsByShop(
  shopId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    mechanicId?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  return useQuery({
    queryKey: INSPECTION_QUERY_KEYS.byShop(shopId),
    queryFn: () => InspectionApi.getInspectionsByShop(shopId, params),
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutations for inspection operations
export function useCreateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: InspectionApi.createInspection,
    onSuccess: () => {
      // Invalidate and refetch inspection lists
      queryClient.invalidateQueries({ queryKey: INSPECTION_QUERY_KEYS.lists() });
    },
  });
}

export function useUpdateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ inspectionId, data }: { 
      inspectionId: string; 
      data: Partial<Inspection> 
    }) => InspectionApi.updateInspection(inspectionId, data),
    onSuccess: (data, variables) => {
      // Update the specific inspection in cache
      queryClient.setQueryData(
        INSPECTION_QUERY_KEYS.detail(variables.inspectionId),
        data
      );
      // Invalidate lists to reflect changes
      queryClient.invalidateQueries({ queryKey: INSPECTION_QUERY_KEYS.lists() });
    },
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: InspectionApi.deleteInspection,
    onSuccess: (data, inspectionId) => {
      // Remove from cache
      queryClient.removeQueries({ 
        queryKey: INSPECTION_QUERY_KEYS.detail(inspectionId) 
      });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: INSPECTION_QUERY_KEYS.lists() });
    },
  });
}

export function useUpdateInspectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      inspectionId, 
      itemId, 
      data 
    }: { 
      inspectionId: string; 
      itemId: string; 
      data: Partial<InspectionItem> 
    }) => InspectionApi.updateInspectionItem(inspectionId, itemId, data),
    onSuccess: (data, variables) => {
      // Invalidate the inspection detail to refetch
      queryClient.invalidateQueries({ 
        queryKey: INSPECTION_QUERY_KEYS.detail(variables.inspectionId) 
      });
    },
  });
}

export function useAddInspectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      inspectionId, 
      data 
    }: { 
      inspectionId: string; 
      data: Omit<InspectionItem, 'id'> 
    }) => InspectionApi.addInspectionItem(inspectionId, data),
    onSuccess: (data, variables) => {
      // Invalidate the inspection detail to refetch
      queryClient.invalidateQueries({ 
        queryKey: INSPECTION_QUERY_KEYS.detail(variables.inspectionId) 
      });
    },
  });
}

export function useRemoveInspectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      inspectionId, 
      itemId 
    }: { 
      inspectionId: string; 
      itemId: string 
    }) => InspectionApi.removeInspectionItem(inspectionId, itemId),
    onSuccess: (data, variables) => {
      // Invalidate the inspection detail to refetch
      queryClient.invalidateQueries({ 
        queryKey: INSPECTION_QUERY_KEYS.detail(variables.inspectionId) 
      });
    },
  });
}

export function useUploadInspectionPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      inspectionId, 
      itemId, 
      photoFile,
      onUploadProgress 
    }: { 
      inspectionId: string; 
      itemId: string; 
      photoFile: { uri: string; type: string; name: string };
      onUploadProgress?: (progress: { loaded: number; total?: number }) => void;
    }) => InspectionApi.uploadPhoto(inspectionId, itemId, photoFile, onUploadProgress),
    onSuccess: (data, variables) => {
      // Invalidate the inspection detail to refetch
      queryClient.invalidateQueries({ 
        queryKey: INSPECTION_QUERY_KEYS.detail(variables.inspectionId) 
      });
    },
  });
}

export function useUploadVoiceNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      inspectionId, 
      itemId, 
      voiceFile,
      onUploadProgress 
    }: { 
      inspectionId: string; 
      itemId: string; 
      voiceFile: { uri: string; type: string; name: string };
      onUploadProgress?: (progress: { loaded: number; total?: number }) => void;
    }) => InspectionApi.uploadVoiceNote(inspectionId, itemId, voiceFile, onUploadProgress),
    onSuccess: (data, variables) => {
      // Invalidate the inspection detail to refetch
      queryClient.invalidateQueries({ 
        queryKey: INSPECTION_QUERY_KEYS.detail(variables.inspectionId) 
      });
    },
  });
}

export function useSendInspectionReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      inspectionId, 
      options 
    }: { 
      inspectionId: string; 
      options?: { method: 'sms' | 'email' | 'both'; message?: string } 
    }) => InspectionApi.sendInspectionReport(inspectionId, options),
    onSuccess: (data, variables) => {
      // Invalidate the inspection detail to refetch
      queryClient.invalidateQueries({ 
        queryKey: INSPECTION_QUERY_KEYS.detail(variables.inspectionId) 
      });
    },
  });
}

export function useDuplicateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      inspectionId, 
      newData 
    }: { 
      inspectionId: string; 
      newData?: { customerId?: string; vehicleId?: string; scheduledDate?: string } 
    }) => InspectionApi.duplicateInspection(inspectionId, newData),
    onSuccess: () => {
      // Invalidate lists to show new inspection
      queryClient.invalidateQueries({ queryKey: INSPECTION_QUERY_KEYS.lists() });
    },
  });
}

export function useArchiveInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: InspectionApi.archiveInspection,
    onSuccess: (data, inspectionId) => {
      // Invalidate the inspection detail and lists
      queryClient.invalidateQueries({ 
        queryKey: INSPECTION_QUERY_KEYS.detail(inspectionId) 
      });
      queryClient.invalidateQueries({ queryKey: INSPECTION_QUERY_KEYS.lists() });
    },
  });
}