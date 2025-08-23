// Reports Hook - Generated reports and analytics
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { ApiClient } from '../services/ApiClient';
import { PaginatedResponse, ApiResponse } from '../types/common';

interface Report {
  id: string;
  name: string;
  type: 'inspection_summary' | 'performance' | 'revenue' | 'customer_analysis' | 'mechanic_performance' | 'custom';
  description: string;
  format: 'pdf' | 'csv' | 'excel' | 'json';
  status: 'generating' | 'completed' | 'failed' | 'expired';
  fileUrl?: string;
  fileSize?: number;
  parameters: ReportParameters;
  generatedAt?: string;
  expiresAt?: string;
  downloadCount: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportParameters {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  filters?: {
    mechanicIds?: string[];
    customerIds?: string[];
    inspectionTypes?: string[];
    priorities?: string[];
    statuses?: string[];
  };
  groupBy?: 'day' | 'week' | 'month' | 'mechanic' | 'customer' | 'category';
  includeCharts?: boolean;
  includePhotos?: boolean;
  includeCustomerInfo?: boolean;
  customFields?: string[];
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: Report['type'];
  format: Report['format'];
  defaultParameters: ReportParameters;
  isPublic: boolean;
  createdBy: string;
  createdByName: string;
  usageCount: number;
  createdAt: string;
}

interface ReportRequest {
  templateId?: string;
  name: string;
  type: Report['type'];
  format: Report['format'];
  parameters: ReportParameters;
  scheduleFor?: string; // For future scheduling
  emailTo?: string[]; // Auto-email when ready
}

interface ReportStats {
  totalReports: number;
  reportsThisMonth: number;
  averageGenerationTime: number;
  mostPopularType: string;
  totalDownloads: number;
  storageUsed: number; // in bytes
  recentActivity: Array<{
    date: string;
    reportCount: number;
    downloadCount: number;
  }>;
}

interface ReportFilters {
  type?: Report['type'];
  status?: Report['status'];
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  format?: Report['format'];
  page?: number;
  limit?: number;
}

// Query keys for cache management
const REPORTS_KEYS = {
  all: ['reports'] as const,
  lists: () => [...REPORTS_KEYS.all, 'list'] as const,
  list: (filters: ReportFilters) => [...REPORTS_KEYS.lists(), filters] as const,
  templates: () => [...REPORTS_KEYS.all, 'templates'] as const,
  stats: () => [...REPORTS_KEYS.all, 'stats'] as const,
  detail: (id: string) => [...REPORTS_KEYS.all, 'detail', id] as const,
  preview: (templateId: string, parameters: ReportParameters) => 
    [...REPORTS_KEYS.all, 'preview', templateId, parameters] as const,
};

// Custom hook for reports management
export function useReports(filters: ReportFilters = {}) {
  const queryClient = useQueryClient();
  
  // Default filters
  const defaultFilters: ReportFilters = {
    page: 1,
    limit: 20,
    ...filters,
  };
  
  // Fetch reports with pagination and filters
  const {
    data: reports,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useQuery({
    queryKey: REPORTS_KEYS.list(defaultFilters),
    queryFn: async () => {
      const response = await ApiClient.get<PaginatedResponse<Report>>(
        '/api/reports',
        { params: defaultFilters }
      );
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes for status updates
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
  
  // Fetch report templates
  const {
    data: templates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useQuery({
    queryKey: REPORTS_KEYS.templates(),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<ReportTemplate[]>>('/api/reports/templates');
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
  
  // Fetch report statistics
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: REPORTS_KEYS.stats(),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<ReportStats>>('/api/reports/stats');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
  });
  
  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (request: ReportRequest) => {
      const response = await ApiClient.post<ApiResponse<Report>>(
        '/api/reports/generate',
        request
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      // Add the new report to the cache
      queryClient.setQueryData<PaginatedResponse<Report>>(
        REPORTS_KEYS.list(defaultFilters),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: [data, ...old.data],
            total: old.total + 1,
          };
        }
      );
      
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: REPORTS_KEYS.stats() });
    },
    retry: 1,
    retryDelay: 3000,
  });
  
  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await ApiClient.delete(`/api/reports/${reportId}`);
      return reportId;
    },
    onSuccess: (reportId) => {
      // Remove the report from cache
      queryClient.setQueryData<PaginatedResponse<Report>>(
        REPORTS_KEYS.list(defaultFilters),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter(report => report.id !== reportId),
            total: Math.max(0, old.total - 1),
          };
        }
      );
      
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: REPORTS_KEYS.stats() });
    },
    retry: 1,
  });
  
  // Memoized derived data
  const reportsByStatus = useMemo(() => {
    if (!reports?.data) return {};
    
    return reports.data.reduce((acc, report) => {
      const status = report.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(report);
      return acc;
    }, {} as Record<Report['status'], Report[]>);
  }, [reports?.data]);
  
  const reportsByType = useMemo(() => {
    if (!reports?.data) return {};
    
    return reports.data.reduce((acc, report) => {
      const type = report.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(report);
      return acc;
    }, {} as Record<Report['type'], Report[]>);
  }, [reports?.data]);
  
  const recentReports = useMemo(() => {
    if (!reports?.data) return [];
    
    return [...reports.data]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [reports?.data]);
  
  const availableReports = useMemo(() => {
    if (!reports?.data) return [];
    
    return reports.data.filter(report => 
      report.status === 'completed' && 
      report.fileUrl &&
      (!report.expiresAt || new Date(report.expiresAt) > new Date())
    );
  }, [reports?.data]);
  
  // Helper functions
  const generateReport = useCallback(
    (request: ReportRequest) => {
      return generateReportMutation.mutate(request);
    },
    [generateReportMutation]
  );
  
  const generateFromTemplate = useCallback(
    (templateId: string, parameters: Partial<ReportParameters>, name?: string, format?: Report['format']) => {
      const template = templates?.find(t => t.id === templateId);
      if (!template) {
        throw new Error('Template not found');
      }
      
      return generateReportMutation.mutate({
        templateId,
        name: name || `${template.name} - ${new Date().toISOString().split('T')[0]}`,
        type: template.type,
        format: format || template.format,
        parameters: {
          ...template.defaultParameters,
          ...parameters,
        },
      });
    },
    [generateReportMutation, templates]
  );
  
  const deleteReport = useCallback(
    (reportId: string) => {
      return deleteReportMutation.mutate(reportId);
    },
    [deleteReportMutation]
  );
  
  const downloadReport = useCallback(
    async (reportId: string) => {
      try {
        const report = reports?.data.find(r => r.id === reportId);
        if (!report || !report.fileUrl) {
          throw new Error('Report not available for download');
        }
        
        const response = await ApiClient.get(`/api/reports/${reportId}/download`, {
          responseType: 'blob',
        });
        
        // Create download link
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${report.name}.${report.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Update download count in cache
        queryClient.setQueryData<PaginatedResponse<Report>>(
          REPORTS_KEYS.list(defaultFilters),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              data: old.data.map(r => r.id === reportId ? { ...r, downloadCount: r.downloadCount + 1 } : r),
            };
          }
        );
        
        return true;
      } catch (error) {
        console.error('Failed to download report:', error);
        throw error;
      }
    },
    [reports?.data, queryClient, defaultFilters]
  );
  
  const getReportPreview = useCallback(
    (templateId: string, parameters: ReportParameters) => {
      return queryClient.fetchQuery({
        queryKey: REPORTS_KEYS.preview(templateId, parameters),
        queryFn: async () => {
          const response = await ApiClient.post<ApiResponse<{
            sampleData: any;
            estimatedSize: number;
            estimatedGenerationTime: number;
          }>>(`/api/reports/templates/${templateId}/preview`, { parameters });
          return response.data.data;
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );
  
  const refreshReports = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: REPORTS_KEYS.lists() });
    queryClient.invalidateQueries({ queryKey: REPORTS_KEYS.stats() });
  }, [queryClient]);
  
  const clearCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: REPORTS_KEYS.all });
  }, [queryClient]);
  
  // Calculate storage usage
  const storageAnalysis = useMemo(() => {
    if (!reports?.data || !stats) return null;
    
    const totalSize = reports.data.reduce((sum, report) => sum + (report.fileSize || 0), 0);
    const averageSize = reports.data.length > 0 ? totalSize / reports.data.length : 0;
    const sizeByType = reportsByType;
    
    return {
      totalSize,
      averageSize,
      reportCount: reports.data.length,
      usagePercentage: stats.storageUsed > 0 ? (totalSize / stats.storageUsed) * 100 : 0,
      largestReport: reports.data.reduce((largest, current) => 
        (current.fileSize || 0) > (largest?.fileSize || 0) ? current : largest, 
        reports.data[0]
      ),
    };
  }, [reports?.data, stats, reportsByType]);
  
  return {
    // Core data
    reports: reports?.data || [],
    templates: templates || [],
    stats,
    
    // Derived data
    reportsByStatus,
    reportsByType,
    recentReports,
    availableReports,
    storageAnalysis,
    
    // Loading states
    isLoading,
    templatesLoading,
    statsLoading,
    isGenerating: generateReportMutation.isLoading,
    isDeleting: deleteReportMutation.isLoading,
    
    // Error states
    error,
    templatesError,
    statsError,
    generateError: generateReportMutation.error,
    deleteError: deleteReportMutation.error,
    
    // Pagination
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    
    // Actions
    generateReport,
    generateFromTemplate,
    deleteReport,
    downloadReport,
    getReportPreview,
    refetch,
    refreshReports,
    clearCache,
    
    // Computed values
    totalReports: reports?.total || 0,
    completedReports: reportsByStatus.completed?.length || 0,
    failedReports: reportsByStatus.failed?.length || 0,
    generatingReports: reportsByStatus.generating?.length || 0,
    isEmpty: !isLoading && (reports?.data.length === 0),
    
    // Current filters
    filters: defaultFilters,
  };
}

// Hook for individual report details
export function useReportDetail(reportId: string | null) {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: REPORTS_KEYS.detail(reportId || ''),
    queryFn: async () => {
      if (!reportId) return null;
      
      const response = await ApiClient.get<ApiResponse<Report>>(`/api/reports/${reportId}`);
      return response.data.data;
    },
    enabled: !!reportId,
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchInterval: (data) => {
      // Refresh more frequently if report is still generating
      return data?.status === 'generating' ? 10 * 1000 : 2 * 60 * 1000;
    },
    retry: 2,
  });
}

// Hook for template-based report generation
export function useReportTemplates() {
  const {
    data: templates,
    isLoading,
    error,
  } = useQuery({
    queryKey: REPORTS_KEYS.templates(),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<ReportTemplate[]>>('/api/reports/templates');
      return response.data.data;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
  
  const templatesByType = useMemo(() => {
    if (!templates) return {};
    
    return templates.reduce((acc, template) => {
      const type = template.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(template);
      return acc;
    }, {} as Record<ReportTemplate['type'], ReportTemplate[]>);
  }, [templates]);
  
  const popularTemplates = useMemo(() => {
    if (!templates) return [];
    
    return [...templates]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);
  }, [templates]);
  
  return {
    templates: templates || [],
    templatesByType,
    popularTemplates,
    isLoading,
    error,
  };
}