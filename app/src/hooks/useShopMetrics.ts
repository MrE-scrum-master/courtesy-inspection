// Shop Metrics Hook - Dashboard analytics and KPI tracking
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { ApiClient } from '../services/ApiClient';
import { ApiResponse } from '../types/common';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface ShopMetrics {
  // Core KPIs
  totalInspections: number;
  completedInspections: number;
  pendingInspections: number;
  averageInspectionTime: number;
  
  // Revenue metrics
  totalRevenue: number;
  averageRevenuePerInspection: number;
  revenueGrowth: number;
  
  // Quality metrics
  customerSatisfactionScore: number;
  inspectionAccuracy: number;
  issuesFound: number;
  criticalIssuesFound: number;
  
  // Performance metrics
  mechanicPerformance: MechanicPerformance[];
  inspectionsByCategory: CategoryMetrics[];
  dailyInspectionCounts: DailyCount[];
  
  // Trends
  weekOverWeekGrowth: number;
  monthOverMonthGrowth: number;
  yearOverYearGrowth: number;
  
  // Time periods
  dateRange: DateRange;
  lastUpdated: string;
}

interface MechanicPerformance {
  mechanicId: string;
  mechanicName: string;
  totalInspections: number;
  averageTime: number;
  qualityScore: number;
  efficiency: number;
  customerRating: number;
}

interface CategoryMetrics {
  category: string;
  count: number;
  percentage: number;
  averageCost: number;
  criticalCount: number;
}

interface DailyCount {
  date: string;
  count: number;
  revenue: number;
  averageTime: number;
}

interface TopIssue {
  issue: string;
  frequency: number;
  averageCost: number;
  category: string;
  severity: 'low' | 'medium' | 'high';
}

interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  customerRetentionRate: number;
  averageCustomerValue: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalInspections: number;
    totalRevenue: number;
    lastInspection: string;
  }>;
}

// Query keys for cache management
const METRICS_KEYS = {
  all: ['shopMetrics'] as const,
  overview: (dateRange: DateRange) => [...METRICS_KEYS.all, 'overview', dateRange] as const,
  mechanics: (dateRange: DateRange) => [...METRICS_KEYS.all, 'mechanics', dateRange] as const,
  customers: (dateRange: DateRange) => [...METRICS_KEYS.all, 'customers', dateRange] as const,
  issues: (dateRange: DateRange) => [...METRICS_KEYS.all, 'issues', dateRange] as const,
  realtime: () => [...METRICS_KEYS.all, 'realtime'] as const,
};

// Custom hook for shop metrics
export function useShopMetrics(dateRange?: DateRange) {
  const queryClient = useQueryClient();
  
  // Default date range (last 30 days)
  const defaultDateRange: DateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, []);
  
  const effectiveDateRange = dateRange || defaultDateRange;
  
  // Main metrics query
  const {
    data: metrics,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: METRICS_KEYS.overview(effectiveDateRange),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<ShopMetrics>>(
        '/api/metrics/overview',
        { params: effectiveDateRange }
      );
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  
  // Mechanic performance metrics
  const {
    data: mechanicMetrics,
    isLoading: mechanicsLoading,
    error: mechanicsError,
  } = useQuery({
    queryKey: METRICS_KEYS.mechanics(effectiveDateRange),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<MechanicPerformance[]>>(
        '/api/metrics/mechanics',
        { params: effectiveDateRange }
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
  });
  
  // Customer metrics
  const {
    data: customerMetrics,
    isLoading: customersLoading,
    error: customersError,
  } = useQuery({
    queryKey: METRICS_KEYS.customers(effectiveDateRange),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<CustomerMetrics>>(
        '/api/metrics/customers',
        { params: effectiveDateRange }
      );
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
  
  // Top issues analysis
  const {
    data: topIssues,
    isLoading: issuesLoading,
    error: issuesError,
  } = useQuery({
    queryKey: METRICS_KEYS.issues(effectiveDateRange),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<TopIssue[]>>(
        '/api/metrics/top-issues',
        { params: effectiveDateRange }
      );
      return response.data.data;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
  
  // Real-time metrics (current day)
  const {
    data: realtimeMetrics,
    isLoading: realtimeLoading,
    error: realtimeError,
  } = useQuery({
    queryKey: METRICS_KEYS.realtime(),
    queryFn: async () => {
      const response = await ApiClient.get<ApiResponse<{
        todayInspections: number;
        activeInspections: number;
        pendingApprovals: number;
        averageWaitTime: number;
        lastUpdate: string;
      }>>('/api/metrics/realtime');
      return response.data.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60 * 1000, // Refresh every minute
    refetchOnWindowFocus: true,
    retry: 1,
  });
  
  // Memoized computed metrics
  const computedMetrics = useMemo(() => {
    if (!metrics) return null;
    
    return {
      // Efficiency metrics
      inspectionCompletionRate: metrics.totalInspections > 0 
        ? (metrics.completedInspections / metrics.totalInspections) * 100 
        : 0,
      
      // Quality indicators
      criticalIssueRate: metrics.totalInspections > 0 
        ? (metrics.criticalIssuesFound / metrics.totalInspections) * 100 
        : 0,
      
      // Performance indicators
      averageRevenuePerDay: metrics.dailyInspectionCounts.length > 0
        ? metrics.dailyInspectionCounts.reduce((sum, day) => sum + day.revenue, 0) / metrics.dailyInspectionCounts.length
        : 0,
      
      // Growth indicators
      isGrowthPositive: metrics.weekOverWeekGrowth > 0,
      growthTrend: metrics.weekOverWeekGrowth > metrics.monthOverMonthGrowth ? 'improving' : 'declining',
      
      // Capacity utilization
      averageInspectionsPerDay: metrics.dailyInspectionCounts.length > 0
        ? metrics.dailyInspectionCounts.reduce((sum, day) => sum + day.count, 0) / metrics.dailyInspectionCounts.length
        : 0,
    };
  }, [metrics]);
  
  // Top performing mechanic
  const topMechanic = useMemo(() => {
    if (!mechanicMetrics || mechanicMetrics.length === 0) return null;
    
    return mechanicMetrics.reduce((top, current) => {
      const topScore = (top.qualityScore * 0.4) + (top.efficiency * 0.3) + (top.customerRating * 0.3);
      const currentScore = (current.qualityScore * 0.4) + (current.efficiency * 0.3) + (current.customerRating * 0.3);
      
      return currentScore > topScore ? current : top;
    });
  }, [mechanicMetrics]);
  
  // Critical issues that need attention
  const criticalIssues = useMemo(() => {
    if (!topIssues) return [];
    return topIssues.filter(issue => issue.severity === 'high').slice(0, 5);
  }, [topIssues]);
  
  // Helper functions
  const refreshMetrics = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: METRICS_KEYS.all });
  }, [queryClient]);
  
  const getMetricsForDateRange = useCallback((newDateRange: DateRange) => {
    return queryClient.fetchQuery({
      queryKey: METRICS_KEYS.overview(newDateRange),
      queryFn: async () => {
        const response = await ApiClient.get<ApiResponse<ShopMetrics>>(
          '/api/metrics/overview',
          { params: newDateRange }
        );
        return response.data.data;
      },
    });
  }, [queryClient]);
  
  const exportMetrics = useCallback(async (format: 'csv' | 'pdf' = 'csv') => {
    try {
      const response = await ApiClient.get('/api/metrics/export', {
        params: { ...effectiveDateRange, format },
        responseType: 'blob',
      });
      
      // Create download link
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shop-metrics-${effectiveDateRange.startDate}-to-${effectiveDateRange.endDate}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export metrics:', error);
      throw error;
    }
  }, [effectiveDateRange]);
  
  const clearCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: METRICS_KEYS.all });
  }, [queryClient]);
  
  // Calculate performance alerts
  const performanceAlerts = useMemo(() => {
    const alerts: Array<{
      type: 'warning' | 'error' | 'info';
      message: string;
      metric: string;
      value: number;
    }> = [];
    
    if (metrics) {
      // Low completion rate
      if (computedMetrics && computedMetrics.inspectionCompletionRate < 80) {
        alerts.push({
          type: 'warning',
          message: 'Inspection completion rate is below 80%',
          metric: 'completionRate',
          value: computedMetrics.inspectionCompletionRate,
        });
      }
      
      // High critical issue rate
      if (computedMetrics && computedMetrics.criticalIssueRate > 15) {
        alerts.push({
          type: 'error',
          message: 'Critical issue rate is above 15%',
          metric: 'criticalIssueRate',
          value: computedMetrics.criticalIssueRate,
        });
      }
      
      // Negative growth
      if (metrics.weekOverWeekGrowth < -10) {
        alerts.push({
          type: 'warning',
          message: 'Significant decrease in inspections week-over-week',
          metric: 'weekOverWeekGrowth',
          value: metrics.weekOverWeekGrowth,
        });
      }
      
      // Low customer satisfaction
      if (metrics.customerSatisfactionScore < 4.0) {
        alerts.push({
          type: 'warning',
          message: 'Customer satisfaction score is below 4.0',
          metric: 'customerSatisfaction',
          value: metrics.customerSatisfactionScore,
        });
      }
    }
    
    return alerts;
  }, [metrics, computedMetrics]);
  
  return {
    // Core data
    metrics,
    mechanicMetrics,
    customerMetrics,
    topIssues,
    realtimeMetrics,
    computedMetrics,
    
    // Derived data
    topMechanic,
    criticalIssues,
    performanceAlerts,
    
    // Loading states
    isLoading,
    mechanicsLoading,
    customersLoading,
    issuesLoading,
    realtimeLoading,
    
    // Error states
    error,
    mechanicsError,
    customersError,
    issuesError,
    realtimeError,
    
    // Actions
    refetch,
    refreshMetrics,
    getMetricsForDateRange,
    exportMetrics,
    clearCache,
    
    // Configuration
    dateRange: effectiveDateRange,
    isDataAvailable: !isLoading && !!metrics,
    lastUpdated: metrics?.lastUpdated,
  };
}

// Hook for comparing metrics across different time periods
export function useMetricsComparison(
  currentPeriod: DateRange,
  comparisonPeriod: DateRange
) {
  const currentMetrics = useShopMetrics(currentPeriod);
  const comparisonMetrics = useShopMetrics(comparisonPeriod);
  
  const comparison = useMemo(() => {
    if (!currentMetrics.metrics || !comparisonMetrics.metrics) return null;
    
    const current = currentMetrics.metrics;
    const previous = comparisonMetrics.metrics;
    
    return {
      inspectionChange: {
        current: current.totalInspections,
        previous: previous.totalInspections,
        change: current.totalInspections - previous.totalInspections,
        percentChange: previous.totalInspections > 0 
          ? ((current.totalInspections - previous.totalInspections) / previous.totalInspections) * 100
          : 0,
      },
      revenueChange: {
        current: current.totalRevenue,
        previous: previous.totalRevenue,
        change: current.totalRevenue - previous.totalRevenue,
        percentChange: previous.totalRevenue > 0
          ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100
          : 0,
      },
      satisfactionChange: {
        current: current.customerSatisfactionScore,
        previous: previous.customerSatisfactionScore,
        change: current.customerSatisfactionScore - previous.customerSatisfactionScore,
        percentChange: previous.customerSatisfactionScore > 0
          ? ((current.customerSatisfactionScore - previous.customerSatisfactionScore) / previous.customerSatisfactionScore) * 100
          : 0,
      },
      efficiencyChange: {
        current: current.averageInspectionTime,
        previous: previous.averageInspectionTime,
        change: current.averageInspectionTime - previous.averageInspectionTime,
        percentChange: previous.averageInspectionTime > 0
          ? ((current.averageInspectionTime - previous.averageInspectionTime) / previous.averageInspectionTime) * 100
          : 0,
      },
    };
  }, [currentMetrics.metrics, comparisonMetrics.metrics]);
  
  return {
    comparison,
    isLoading: currentMetrics.isLoading || comparisonMetrics.isLoading,
    error: currentMetrics.error || comparisonMetrics.error,
  };
}