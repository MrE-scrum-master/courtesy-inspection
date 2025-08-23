// Approval Queue Hook - Enhanced API integration with retry and caching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { ApiClient } from '../services/ApiClient';
import { Inspection, PaginatedResponse, ApiResponse } from '../types/common';

interface ApprovalQueueFilters {
  priority?: 'low' | 'medium' | 'high';
  mechanicId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: 'pending' | 'approved' | 'rejected';
  sortBy?: 'createdAt' | 'priority' | 'mechanicName' | 'customerName';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface ApprovalAction {
  inspectionId: string;
  action: 'approve' | 'reject';
  notes?: string;
  estimatedCost?: number;
  recommendedActions?: string[];
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  averageApprovalTime: number;
  urgentCount: number;
}

// Query keys for cache management
const APPROVAL_QUEUE_KEYS = {
  all: ['approvalQueue'] as const,
  lists: () => [...APPROVAL_QUEUE_KEYS.all, 'list'] as const,
  list: (filters: ApprovalQueueFilters) => [...APPROVAL_QUEUE_KEYS.lists(), filters] as const,
  stats: () => [...APPROVAL_QUEUE_KEYS.all, 'stats'] as const,
  detail: (id: string) => [...APPROVAL_QUEUE_KEYS.all, 'detail', id] as const,
};

// Custom hook for approval queue management
export function useApprovalQueue(filters: ApprovalQueueFilters = {}) {
  const queryClient = useQueryClient();
  
  // Default filters
  const defaultFilters: ApprovalQueueFilters = {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    ...filters,
  };
  
  // Fetch approval queue with pagination and filters
  const {
    data: approvalQueue,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useQuery({
    queryKey: APPROVAL_QUEUE_KEYS.list(defaultFilters),
    queryFn: async () => {
      const response = await ApiClient.get<PaginatedResponse<Inspection>>(
        '/api/approvals/queue',
        { params: defaultFilters }
      );
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Auto-refresh every minute
    refetchOnWindowFocus: true,
    retry: (failureCount, error: any) => {
      // Retry up to 3 times for network errors
      if (failureCount < 3 && error?.code !== 'UNAUTHORIZED') {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  
  // Fetch approval statistics
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: APPROVAL_QUEUE_KEYS.stats(),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<ApprovalStats>>('/api/approvals/stats');
      return response.data.data;
    },
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
  });
  
  // Approve inspection mutation
  const approveMutation = useMutation({
    mutationFn: async (action: ApprovalAction) => {
      const response = await ApiClient.post<ApiResponse<Inspection>>(
        `/api/approvals/${action.inspectionId}/approve`,
        {
          notes: action.notes,
          estimatedCost: action.estimatedCost,
          recommendedActions: action.recommendedActions,
        }
      );
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      // Update the approval queue cache
      queryClient.setQueryData<PaginatedResponse<Inspection>>(
        APPROVAL_QUEUE_KEYS.list(defaultFilters),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter(item => item.id !== variables.inspectionId),
            total: old.total - 1,
          };
        }
      );
      
      // Update stats cache
      queryClient.setQueryData<ApprovalStats>(
        APPROVAL_QUEUE_KEYS.stats(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pending: Math.max(0, old.pending - 1),
            approved: old.approved + 1,
          };
        }
      );
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    retry: 2,
    retryDelay: 1000,
  });
  
  // Reject inspection mutation
  const rejectMutation = useMutation({
    mutationFn: async (action: ApprovalAction) => {
      const response = await ApiClient.post<ApiResponse<Inspection>>(
        `/api/approvals/${action.inspectionId}/reject`,
        {
          notes: action.notes,
        }
      );
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      // Update the approval queue cache
      queryClient.setQueryData<PaginatedResponse<Inspection>>(
        APPROVAL_QUEUE_KEYS.list(defaultFilters),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter(item => item.id !== variables.inspectionId),
            total: old.total - 1,
          };
        }
      );
      
      // Update stats cache
      queryClient.setQueryData<ApprovalStats>(
        APPROVAL_QUEUE_KEYS.stats(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pending: Math.max(0, old.pending - 1),
            rejected: old.rejected + 1,
          };
        }
      );
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
    retry: 2,
    retryDelay: 1000,
  });
  
  // Bulk approval mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (inspectionIds: string[]) => {
      const response = await ApiClient.post<ApiResponse<Inspection[]>>(
        '/api/approvals/bulk-approve',
        { inspectionIds }
      );
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      // Remove approved items from cache
      queryClient.setQueryData<PaginatedResponse<Inspection>>(
        APPROVAL_QUEUE_KEYS.list(defaultFilters),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter(item => !variables.includes(item.id)),
            total: Math.max(0, old.total - variables.length),
          };
        }
      );
      
      // Update stats
      queryClient.setQueryData<ApprovalStats>(
        APPROVAL_QUEUE_KEYS.stats(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pending: Math.max(0, old.pending - variables.length),
            approved: old.approved + variables.length,
          };
        }
      );
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  
  // Memoized derived data
  const prioritizedQueue = useMemo(() => {
    if (!approvalQueue?.data) return [];
    
    // Sort by priority and creation date
    return [...approvalQueue.data].sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [approvalQueue?.data]);
  
  const urgentInspections = useMemo(() => {
    return prioritizedQueue.filter(inspection => inspection.priority === 'high');
  }, [prioritizedQueue]);
  
  // Helper functions
  const approveInspection = useCallback(
    (inspectionId: string, notes?: string, estimatedCost?: number, recommendedActions?: string[]) => {
      return approveMutation.mutate({
        inspectionId,
        action: 'approve',
        notes,
        estimatedCost,
        recommendedActions,
      });
    },
    [approveMutation]
  );
  
  const rejectInspection = useCallback(
    (inspectionId: string, notes?: string) => {
      return rejectMutation.mutate({
        inspectionId,
        action: 'reject',
        notes,
      });
    },
    [rejectMutation]
  );
  
  const bulkApprove = useCallback(
    (inspectionIds: string[]) => {
      return bulkApproveMutation.mutate(inspectionIds);
    },
    [bulkApproveMutation]
  );
  
  const clearCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: APPROVAL_QUEUE_KEYS.all });
  }, [queryClient]);
  
  const refreshQueue = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: APPROVAL_QUEUE_KEYS.lists() });
    queryClient.invalidateQueries({ queryKey: APPROVAL_QUEUE_KEYS.stats() });
  }, [queryClient]);
  
  // Background refresh for real-time updates
  const startBackgroundRefresh = useCallback(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshQueue();
      }
    }, 30 * 1000); // Every 30 seconds when visible
    
    return () => clearInterval(interval);
  }, [refreshQueue]);
  
  return {
    // Data
    approvalQueue: approvalQueue?.data || [],
    prioritizedQueue,
    urgentInspections,
    stats,
    
    // Loading states
    isLoading,
    statsLoading,
    isApproving: approveMutation.isLoading,
    isRejecting: rejectMutation.isLoading,
    isBulkApproving: bulkApproveMutation.isLoading,
    
    // Error states
    error,
    statsError,
    approvalError: approveMutation.error,
    rejectionError: rejectMutation.error,
    bulkApprovalError: bulkApproveMutation.error,
    
    // Pagination
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    
    // Actions
    approveInspection,
    rejectInspection,
    bulkApprove,
    refetch,
    refreshQueue,
    clearCache,
    startBackgroundRefresh,
    
    // Computed values
    totalPending: stats?.pending || 0,
    urgentCount: stats?.urgentCount || 0,
    averageApprovalTime: stats?.averageApprovalTime || 0,
    isEmpty: !isLoading && (approvalQueue?.data.length === 0),
  };
}

// Hook for individual inspection approval details
export function useApprovalDetail(inspectionId: string | null) {
  return useQuery({
    queryKey: APPROVAL_QUEUE_KEYS.detail(inspectionId || ''),
    queryFn: async () => {
      if (!inspectionId) return null;
      const response = await ApiClient.get<ApiResponse<Inspection>>(
        `/api/approvals/${inspectionId}`
      );
      return response.data.data;
    },
    enabled: !!inspectionId,
    staleTime: 30 * 1000,
    cacheTime: 2 * 60 * 1000,
    retry: 2,
  });
}