// Customer Portal Hook - Read-only access via token-based authentication
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { ApiClient } from '../services/ApiClient';
import { Inspection, Customer, Vehicle, ApiResponse } from '../types/common';

interface CustomerPortalData {
  inspection: Inspection;
  customer: Customer;
  vehicle: Vehicle;
  recommendations: InspectionRecommendation[];
  photos: InspectionPhoto[];
  timeline: InspectionTimelineEvent[];
  shopInfo: ShopInfo;
}

interface InspectionRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimatedCost: number;
  urgency: 'immediate' | 'soon' | 'future';
  detailsUrl?: string;
}

interface InspectionPhoto {
  id: string;
  category: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  timestamp: string;
  beforeAfter?: 'before' | 'after';
}

interface InspectionTimelineEvent {
  id: string;
  type: 'inspection_started' | 'inspection_completed' | 'sent_to_customer' | 'customer_viewed';
  title: string;
  description: string;
  timestamp: string;
  mechanicName?: string;
}

interface ShopInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logoUrl?: string;
  businessHours: BusinessHours[];
}

interface BusinessHours {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface FeedbackSubmission {
  rating: number;
  comments?: string;
  recommendToFriend: boolean;
  serviceAreas: {
    communication: number;
    timeliness: number;
    thoroughness: number;
    value: number;
  };
}

interface CallbackRequest {
  preferredTime: 'morning' | 'afternoon' | 'evening';
  preferredDate: string;
  topic: 'quote' | 'scheduling' | 'questions' | 'other';
  message?: string;
  phoneNumber: string;
}

// Query keys for cache management
const CUSTOMER_PORTAL_KEYS = {
  all: ['customerPortal'] as const,
  inspection: (token: string) => [...CUSTOMER_PORTAL_KEYS.all, 'inspection', token] as const,
  feedback: (token: string) => [...CUSTOMER_PORTAL_KEYS.all, 'feedback', token] as const,
  status: (token: string) => [...CUSTOMER_PORTAL_KEYS.all, 'status', token] as const,
};

// Custom hook for customer portal access
export function useCustomerPortal(token: string | null) {
  const queryClient = useQueryClient();
  
  // Main portal data query
  const {
    data: portalData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: CUSTOMER_PORTAL_KEYS.inspection(token || ''),
    queryFn: async () => {
      if (!token) return null;
      
      const response = await ApiClient.get<ApiResponse<CustomerPortalData>>(
        `/api/customer-portal/${token}`
      );
      return response.data.data;
    },
    enabled: !!token,
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.response?.status === 401 || error?.response?.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 2000,
  });
  
  // Portal access status
  const {
    data: accessStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: CUSTOMER_PORTAL_KEYS.status(token || ''),
    queryFn: async () => {
      if (!token) return null;
      
      const response = await ApiClient.get<ApiResponse<{
        isValid: boolean;
        expiresAt: string;
        viewCount: number;
        lastViewed: string;
        canSubmitFeedback: boolean;
        canRequestCallback: boolean;
      }>>(`/api/customer-portal/${token}/status`);
      return response.data.data;
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
  
  // Memoized derived data
  const inspectionSummary = useMemo(() => {
    if (!portalData) return null;
    
    const { inspection } = portalData;
    const totalItems = inspection.items.length;
    const goodItems = inspection.items.filter(item => item.status === 'good').length;
    const fairItems = inspection.items.filter(item => item.status === 'fair').length;
    const poorItems = inspection.items.filter(item => item.status === 'poor').length;
    const needsAttentionItems = inspection.items.filter(item => item.status === 'needs_attention').length;
    
    const overallScore = totalItems > 0 
      ? ((goodItems * 4 + fairItems * 3 + poorItems * 2 + needsAttentionItems * 1) / (totalItems * 4)) * 100
      : 0;
    
    return {
      totalItems,
      goodItems,
      fairItems,
      poorItems,
      needsAttentionItems,
      overallScore,
      totalEstimatedCost: inspection.totalEstimatedCost || 0,
      completedDate: inspection.completedDate,
      mechanicName: inspection.mechanic?.name,
    };
  }, [portalData]);
  
  const prioritizedRecommendations = useMemo(() => {
    if (!portalData?.recommendations) return [];
    
    return [...portalData.recommendations].sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const urgencyWeight = { immediate: 3, soon: 2, future: 1 };
      
      const aScore = priorityWeight[a.priority] + urgencyWeight[a.urgency];
      const bScore = priorityWeight[b.priority] + urgencyWeight[b.urgency];
      
      return bScore - aScore;
    });
  }, [portalData?.recommendations]);
  
  const photosByCategory = useMemo(() => {
    if (!portalData?.photos) return {};
    
    return portalData.photos.reduce((acc, photo) => {
      const category = photo.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(photo);
      return acc;
    }, {} as Record<string, InspectionPhoto[]>);
  }, [portalData?.photos]);
  
  // Portal interaction tracking
  const trackPortalView = useCallback(async () => {
    if (!token) return;
    
    try {
      await ApiClient.post(`/api/customer-portal/${token}/track-view`);
      // Update the access status cache
      queryClient.invalidateQueries({ 
        queryKey: CUSTOMER_PORTAL_KEYS.status(token) 
      });
    } catch (error) {
      console.warn('Failed to track portal view:', error);
    }
  }, [token, queryClient]);
  
  // Download inspection report
  const downloadReport = useCallback(async (format: 'pdf' | 'email' = 'pdf') => {
    if (!token) return;
    
    try {
      const response = await ApiClient.get(`/api/customer-portal/${token}/report`, {
        params: { format },
        responseType: format === 'pdf' ? 'blob' : 'json',
      });
      
      if (format === 'pdf') {
        // Create download link for PDF
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `inspection-report-${portalData?.inspection.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      
      return response.data;
    } catch (error) {
      console.error('Failed to download report:', error);
      throw error;
    }
  }, [token, portalData?.inspection.id]);
  
  // Submit customer feedback
  const submitFeedback = useCallback(async (feedback: FeedbackSubmission) => {
    if (!token) return;
    
    try {
      const response = await ApiClient.post<ApiResponse<{ success: boolean }>>(
        `/api/customer-portal/${token}/feedback`,
        feedback
      );
      
      // Update access status to reflect feedback submission
      queryClient.invalidateQueries({ 
        queryKey: CUSTOMER_PORTAL_KEYS.status(token) 
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      throw error;
    }
  }, [token, queryClient]);
  
  // Request callback from shop
  const requestCallback = useCallback(async (request: CallbackRequest) => {
    if (!token) return;
    
    try {
      const response = await ApiClient.post<ApiResponse<{ success: boolean; ticketId: string }>>(
        `/api/customer-portal/${token}/callback`,
        request
      );
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to request callback:', error);
      throw error;
    }
  }, [token]);
  
  // Share inspection results
  const shareInspection = useCallback(async (method: 'email' | 'sms', recipient: string) => {
    if (!token) return;
    
    try {
      const response = await ApiClient.post<ApiResponse<{ success: boolean }>>(
        `/api/customer-portal/${token}/share`,
        { method, recipient }
      );
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to share inspection:', error);
      throw error;
    }
  }, [token]);
  
  // Print-friendly formatting
  const getPrintData = useCallback(() => {
    if (!portalData) return null;
    
    return {
      inspection: portalData.inspection,
      customer: portalData.customer,
      vehicle: portalData.vehicle,
      summary: inspectionSummary,
      recommendations: prioritizedRecommendations,
      shopInfo: portalData.shopInfo,
      generatedAt: new Date().toISOString(),
    };
  }, [portalData, inspectionSummary, prioritizedRecommendations]);
  
  // Check if portal access is still valid
  const isAccessValid = useMemo(() => {
    if (!accessStatus) return false;
    
    return accessStatus.isValid && new Date(accessStatus.expiresAt) > new Date();
  }, [accessStatus]);
  
  // Calculate days until expiration
  const daysUntilExpiration = useMemo(() => {
    if (!accessStatus?.expiresAt) return null;
    
    const expiryDate = new Date(accessStatus.expiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  }, [accessStatus?.expiresAt]);
  
  return {
    // Core data
    portalData,
    accessStatus,
    inspectionSummary,
    prioritizedRecommendations,
    photosByCategory,
    
    // Loading states
    isLoading,
    statusLoading,
    
    // Error states
    error,
    statusError,
    
    // Access validation
    isAccessValid,
    daysUntilExpiration,
    
    // Actions
    trackPortalView,
    downloadReport,
    submitFeedback,
    requestCallback,
    shareInspection,
    getPrintData,
    refetch,
    
    // Computed states
    canSubmitFeedback: accessStatus?.canSubmitFeedback || false,
    canRequestCallback: accessStatus?.canRequestCallback || false,
    hasBeenViewed: (accessStatus?.viewCount || 0) > 0,
    lastViewed: accessStatus?.lastViewed,
    isExpired: !isAccessValid && !!accessStatus,
    
    // Utilities
    token,
    isDataAvailable: !isLoading && !!portalData && isAccessValid,
  };
}

// Hook for validating portal tokens
export function usePortalTokenValidation(token: string | null) {
  return useQuery({
    queryKey: ['portalTokenValidation', token],
    queryFn: async () => {
      if (!token) return { isValid: false, reason: 'missing_token' };
      
      try {
        const response = await ApiClient.get<ApiResponse<{
          isValid: boolean;
          reason?: string;
          expiresAt?: string;
        }>>(`/api/customer-portal/${token}/validate`);
        
        return response.data.data;
      } catch (error: any) {
        return {
          isValid: false,
          reason: error.response?.status === 404 ? 'invalid_token' : 'validation_error',
        };
      }
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: false, // Don't retry validation failures
  });
}