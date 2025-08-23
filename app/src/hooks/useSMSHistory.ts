// SMS History Hook - Communication tracking and history
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { ApiClient } from '../services/ApiClient';
import { PaginatedResponse, ApiResponse } from '../types/common';

interface SMSMessage {
  id: string;
  customerId: string;
  inspectionId?: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  messageType: 'inspection_link' | 'reminder' | 'follow_up' | 'custom' | 'auto_reply';
  cost: number;
  telnyxMessageId?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Populated fields
  customerName?: string;
  inspectionType?: string;
}

interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  type: 'inspection_link' | 'reminder' | 'follow_up' | 'custom';
  isActive: boolean;
  variables: string[];
}

interface SMSStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  totalCost: number;
  averageCost: number;
  messagesByType: Record<string, number>;
  messagesByDay: Array<{
    date: string;
    count: number;
    cost: number;
    deliveryRate: number;
  }>;
}

interface SendSMSRequest {
  customerId: string;
  inspectionId?: string;
  templateId?: string;
  customMessage?: string;
  variables?: Record<string, string>;
  scheduleFor?: string;
}

interface SMSFilters {
  customerId?: string;
  inspectionId?: string;
  direction?: 'inbound' | 'outbound';
  status?: SMSMessage['status'];
  messageType?: SMSMessage['messageType'];
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  page?: number;
  limit?: number;
}

// Query keys for cache management
const SMS_KEYS = {
  all: ['sms'] as const,
  lists: () => [...SMS_KEYS.all, 'list'] as const,
  list: (filters: SMSFilters) => [...SMS_KEYS.lists(), filters] as const,
  stats: (dateRange?: { startDate: string; endDate: string }) => 
    [...SMS_KEYS.all, 'stats', dateRange] as const,
  templates: () => [...SMS_KEYS.all, 'templates'] as const,
  customer: (customerId: string) => [...SMS_KEYS.all, 'customer', customerId] as const,
  inspection: (inspectionId: string) => [...SMS_KEYS.all, 'inspection', inspectionId] as const,
};

// Custom hook for SMS history management
export function useSMSHistory(filters: SMSFilters = {}) {
  const queryClient = useQueryClient();
  
  // Default filters
  const defaultFilters: SMSFilters = {
    page: 1,
    limit: 50,
    ...filters,
  };
  
  // Fetch SMS messages with pagination and filters
  const {
    data: smsMessages,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useQuery({
    queryKey: SMS_KEYS.list(defaultFilters),
    queryFn: async () => {
      const response = await ApiClient.get<PaginatedResponse<SMSMessage>>(
        '/api/sms/messages',
        { params: defaultFilters }
      );
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
  
  // Fetch SMS statistics
  const {
    data: smsStats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: SMS_KEYS.stats({
      startDate: filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: filters.dateTo || new Date().toISOString().split('T')[0],
    }),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<SMSStats>>(
        '/api/sms/stats',
        { 
          params: {
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
          }
        }
      );
      return response.data.data;
    },
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
  
  // Fetch SMS templates
  const {
    data: smsTemplates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useQuery({
    queryKey: SMS_KEYS.templates(),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<SMSTemplate[]>>('/api/sms/templates');
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
  
  // Send SMS mutation
  const sendSMSMutation = useMutation({
    mutationFn: async (request: SendSMSRequest) => {
      const response = await ApiClient.post<ApiResponse<SMSMessage>>(
        '/api/sms/send',
        request
      );
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      // Add the new message to the cache
      queryClient.setQueryData<PaginatedResponse<SMSMessage>>(
        SMS_KEYS.list(defaultFilters),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: [data, ...old.data],
            total: old.total + 1,
          };
        }
      );
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: SMS_KEYS.stats() });
      queryClient.invalidateQueries({ queryKey: SMS_KEYS.customer(variables.customerId) });
      if (variables.inspectionId) {
        queryClient.invalidateQueries({ queryKey: SMS_KEYS.inspection(variables.inspectionId) });
      }
    },
    retry: 2,
    retryDelay: 2000,
  });
  
  // Resend SMS mutation
  const resendSMSMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await ApiClient.post<ApiResponse<SMSMessage>>(
        `/api/sms/messages/${messageId}/resend`
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      // Update the message in cache
      queryClient.setQueryData<PaginatedResponse<SMSMessage>>(
        SMS_KEYS.list(defaultFilters),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map(msg => msg.id === data.id ? data : msg),
          };
        }
      );
      
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: SMS_KEYS.stats() });
    },
    retry: 1,
  });
  
  // Memoized derived data
  const messagesByStatus = useMemo(() => {
    if (!smsMessages?.data) return {};
    
    return smsMessages.data.reduce((acc, message) => {
      const status = message.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(message);
      return acc;
    }, {} as Record<SMSMessage['status'], SMSMessage[]>);
  }, [smsMessages?.data]);
  
  const recentFailures = useMemo(() => {
    if (!smsMessages?.data) return [];
    
    return smsMessages.data
      .filter(msg => msg.status === 'failed' || msg.status === 'undelivered')
      .slice(0, 10);
  }, [smsMessages?.data]);
  
  const conversationsByCustomer = useMemo(() => {
    if (!smsMessages?.data) return {};
    
    return smsMessages.data.reduce((acc, message) => {
      const customerId = message.customerId;
      if (!acc[customerId]) {
        acc[customerId] = {
          customerId,
          customerName: message.customerName || 'Unknown Customer',
          messages: [],
          lastMessage: null,
          unreadCount: 0,
        };
      }
      
      acc[customerId].messages.push(message);
      
      // Update last message
      if (!acc[customerId].lastMessage || 
          new Date(message.createdAt) > new Date(acc[customerId].lastMessage.createdAt)) {
        acc[customerId].lastMessage = message;
      }
      
      return acc;
    }, {} as Record<string, {
      customerId: string;
      customerName: string;
      messages: SMSMessage[];
      lastMessage: SMSMessage | null;
      unreadCount: number;
    }>);
  }, [smsMessages?.data]);
  
  // Helper functions
  const sendCustomSMS = useCallback(
    (customerId: string, message: string, inspectionId?: string) => {
      return sendSMSMutation.mutate({
        customerId,
        customMessage: message,
        inspectionId,
      });
    },
    [sendSMSMutation]
  );
  
  const sendTemplatedSMS = useCallback(
    (customerId: string, templateId: string, variables?: Record<string, string>, inspectionId?: string) => {
      return sendSMSMutation.mutate({
        customerId,
        templateId,
        variables,
        inspectionId,
      });
    },
    [sendSMSMutation]
  );
  
  const resendFailedSMS = useCallback(
    (messageId: string) => {
      return resendSMSMutation.mutate(messageId);
    },
    [resendSMSMutation]
  );
  
  const getCustomerMessages = useCallback(
    (customerId: string) => {
      return queryClient.fetchQuery({
        queryKey: SMS_KEYS.customer(customerId),
        queryFn: async () => {
          const response = await ApiClient.get<PaginatedResponse<SMSMessage>>(
            `/api/sms/customers/${customerId}/messages`
          );
          return response.data;
        },
        staleTime: 30 * 1000,
      });
    },
    [queryClient]
  );
  
  const getInspectionMessages = useCallback(
    (inspectionId: string) => {
      return queryClient.fetchQuery({
        queryKey: SMS_KEYS.inspection(inspectionId),
        queryFn: async () => {
          const response = await ApiClient.get<PaginatedResponse<SMSMessage>>(
            `/api/sms/inspections/${inspectionId}/messages`
          );
          return response.data;
        },
        staleTime: 30 * 1000,
      });
    },
    [queryClient]
  );
  
  const refreshMessages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SMS_KEYS.lists() });
    queryClient.invalidateQueries({ queryKey: SMS_KEYS.stats() });
  }, [queryClient]);
  
  const clearCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: SMS_KEYS.all });
  }, [queryClient]);
  
  // Calculate cost analysis
  const costAnalysis = useMemo(() => {
    if (!smsStats) return null;
    
    const avgCostPerMessage = smsStats.averageCost;
    const monthlyProjection = (smsStats.totalCost / 30) * 30; // Rough monthly estimate
    const costByType = Object.entries(smsStats.messagesByType).map(([type, count]) => ({
      type,
      count,
      estimatedCost: count * avgCostPerMessage,
    }));
    
    return {
      avgCostPerMessage,
      monthlyProjection,
      costByType,
      totalSpent: smsStats.totalCost,
      deliveryEfficiency: smsStats.deliveryRate,
      wastedCost: smsStats.totalCost * (1 - smsStats.deliveryRate / 100),
    };
  }, [smsStats]);
  
  return {
    // Core data
    smsMessages: smsMessages?.data || [],
    smsStats,
    smsTemplates: smsTemplates || [],
    
    // Derived data
    messagesByStatus,
    recentFailures,
    conversationsByCustomer,
    costAnalysis,
    
    // Loading states
    isLoading,
    statsLoading,
    templatesLoading,
    isSending: sendSMSMutation.isLoading,
    isResending: resendSMSMutation.isLoading,
    
    // Error states
    error,
    statsError,
    templatesError,
    sendError: sendSMSMutation.error,
    resendError: resendSMSMutation.error,
    
    // Pagination
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    
    // Actions
    sendCustomSMS,
    sendTemplatedSMS,
    resendFailedSMS,
    getCustomerMessages,
    getInspectionMessages,
    refetch,
    refreshMessages,
    clearCache,
    
    // Computed values
    totalMessages: smsMessages?.total || 0,
    deliveryRate: smsStats?.deliveryRate || 0,
    totalCost: smsStats?.totalCost || 0,
    failureRate: smsStats ? ((smsStats.totalFailed / smsStats.totalSent) * 100) : 0,
    isEmpty: !isLoading && (smsMessages?.data.length === 0),
    
    // Current filters
    filters: defaultFilters,
  };
}

// Hook for customer-specific SMS conversation
export function useCustomerSMSConversation(customerId: string | null) {
  return useQuery({
    queryKey: SMS_KEYS.customer(customerId || ''),
    queryFn: async () => {
      if (!customerId) return null;
      
      const response = await ApiClient.get<PaginatedResponse<SMSMessage>>(
        `/api/sms/customers/${customerId}/messages`,
        { params: { limit: 100, sortBy: 'createdAt', sortOrder: 'desc' } }
      );
      return response.data;
    },
    enabled: !!customerId,
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000, // Check for new messages every minute
    retry: 2,
  });
}

// Hook for inspection-specific SMS messages
export function useInspectionSMSMessages(inspectionId: string | null) {
  return useQuery({
    queryKey: SMS_KEYS.inspection(inspectionId || ''),
    queryFn: async () => {
      if (!inspectionId) return null;
      
      const response = await ApiClient.get<PaginatedResponse<SMSMessage>>(
        `/api/sms/inspections/${inspectionId}/messages`
      );
      return response.data;
    },
    enabled: !!inspectionId,
    staleTime: 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: 2,
  });
}