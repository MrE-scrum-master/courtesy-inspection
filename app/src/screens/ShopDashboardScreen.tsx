// Shop Dashboard Screen - Pure presentation of metrics from API
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useShopMetrics } from '../hooks/useShopMetrics';
import { useApprovalQueue } from '../hooks/useApprovalQueue';
import { getDeviceInfo, responsiveValue } from '../utils/responsive';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/theme';
import { iPadDashboardStyles } from '../styles/ipad.styles';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorBoundary } from '../components/ErrorBoundary';

interface DateRangeOption {
  label: string;
  value: string;
  startDate: string;
  endDate: string;
}

export const ShopDashboardScreen: React.FC = () => {
  const deviceInfo = getDeviceInfo();
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeOption>({
    label: 'Last 30 Days',
    value: '30d',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  
  // API data (read-only)
  const {
    metrics,
    mechanicMetrics,
    customerMetrics,
    realtimeMetrics,
    computedMetrics,
    topMechanic,
    performanceAlerts,
    isLoading,
    error,
    refreshMetrics,
  } = useShopMetrics({
    startDate: selectedDateRange.startDate,
    endDate: selectedDateRange.endDate,
  });
  
  const {
    stats: approvalStats,
    urgentCount,
    totalPending,
  } = useApprovalQueue();
  
  // Date range options
  const dateRangeOptions: DateRangeOption[] = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90Days = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    return [
      {
        label: 'Today',
        value: 'today',
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      },
      {
        label: 'Yesterday',
        value: 'yesterday',
        startDate: yesterday.toISOString().split('T')[0],
        endDate: yesterday.toISOString().split('T')[0],
      },
      {
        label: 'Last 7 Days',
        value: '7d',
        startDate: last7Days.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      },
      {
        label: 'Last 30 Days',
        value: '30d',
        startDate: last30Days.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      },
      {
        label: 'Last 90 Days',
        value: '90d',
        startDate: last90Days.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      },
    ];
  }, []);
  
  // Responsive grid columns
  const gridColumns = responsiveValue({
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
  }) || 2;
  
  // Computed display values (no business logic)
  const topPerformers = useMemo(() => {
    if (!mechanicMetrics) return [];
    
    return [...mechanicMetrics]
      .sort((a, b) => {
        const aScore = (a.qualityScore * 0.4) + (a.efficiency * 0.3) + (a.customerRating * 0.3);
        const bScore = (b.qualityScore * 0.4) + (b.efficiency * 0.3) + (b.customerRating * 0.3);
        return bScore - aScore;
      })
      .slice(0, 3);
  }, [mechanicMetrics]);
  
  const recentTrends = useMemo(() => {
    if (!metrics?.dailyInspectionCounts) return [];
    
    return metrics.dailyInspectionCounts
      .slice(-7) // Last 7 days
      .map(day => ({
        ...day,
        date: new Date(day.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
      }));
  }, [metrics?.dailyInspectionCounts]);
  
  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner message="Loading dashboard..." />
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorTitle}>Failed to Load Dashboard</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
        <Button
          variant="primary"
          onPress={refreshMetrics}
          style={styles.retryButton}
        >
          Retry
        </Button>
      </View>
    );
  }
  
  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshMetrics}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              {selectedDateRange.label} • Last updated: {
                realtimeMetrics?.lastUpdate ? 
                new Date(realtimeMetrics.lastUpdate).toLocaleTimeString() : 
                'Never'
              }
            </Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.dateRangeSelector}
          >
            {dateRangeOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedDateRange.value === option.value ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => setSelectedDateRange(option)}
                style={styles.dateRangeButton}
              >
                {option.label}
              </Button>
            ))}
          </ScrollView>
        </View>
        
        {/* Performance Alerts */}
        {performanceAlerts && performanceAlerts.length > 0 && (
          <View style={styles.alertsSection}>
            <Text style={styles.sectionTitle}>⚠️ Performance Alerts</Text>
            {performanceAlerts.map((alert, index) => (
              <AlertCard key={index} alert={alert} />
            ))}
          </View>
        )}
        
        {/* Real-time Metrics */}
        {realtimeMetrics && (
          <View style={styles.realtimeSection}>
            <Text style={styles.sectionTitle}>📊 Right Now</Text>
            <View style={styles.realtimeGrid}>
              <RealtimeMetricCard
                title="Today's Inspections"
                value={realtimeMetrics.todayInspections}
                icon="document-text"
                color={COLORS.primary}
              />
              <RealtimeMetricCard
                title="Active Inspections"
                value={realtimeMetrics.activeInspections}
                icon="timer"
                color={COLORS.warning}
              />
              <RealtimeMetricCard
                title="Pending Approvals"
                value={totalPending}
                icon="hourglass"
                color={COLORS.error}
                urgent={urgentCount > 0}
              />
              <RealtimeMetricCard
                title="Avg Wait Time"
                value={`${realtimeMetrics.averageWaitTime}m`}
                icon="speedometer"
                color={COLORS.info}
              />
            </View>
          </View>
        )}
        
        {/* Key Metrics Grid */}
        {metrics && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>📈 Key Metrics</Text>
            <View style={[styles.metricsGrid, { gridColumns }]}>
              <MetricCard
                title="Total Inspections"
                value={metrics.totalInspections}
                change={metrics.weekOverWeekGrowth}
                icon="document"
                color={COLORS.primary}
              />
              <MetricCard
                title="Completion Rate"
                value={`${computedMetrics?.inspectionCompletionRate.toFixed(1)}%`}
                change={0} // Would come from API if available
                icon="checkmark-circle"
                color={COLORS.success}
              />
              <MetricCard
                title="Customer Satisfaction"
                value={`${metrics.customerSatisfactionScore.toFixed(1)}/5`}
                change={0} // Would come from API if available
                icon="star"
                color={COLORS.warning}
              />
              <MetricCard
                title="Total Revenue"
                value={`$${metrics.totalRevenue.toLocaleString()}`}
                change={0} // Would come from API if available
                icon="cash"
                color={COLORS.success}
              />
              <MetricCard
                title="Avg Inspection Time"
                value={`${metrics.averageInspectionTime}m`}
                change={0} // Would come from API if available
                icon="time"
                color={COLORS.info}
              />
              <MetricCard
                title="Issues Found"
                value={metrics.issuesFound}
                change={0} // Would come from API if available
                icon="alert-circle"
                color={COLORS.error}
              />
            </View>
          </View>
        )}
        
        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <View style={styles.performersSection}>
            <Text style={styles.sectionTitle}>🏆 Top Performers</Text>
            <View style={styles.performersList}>
              {topPerformers.map((mechanic, index) => (
                <MechanicCard 
                  key={mechanic.mechanicId} 
                  mechanic={mechanic} 
                  rank={index + 1}
                />
              ))}
            </View>
          </View>
        )}
        
        {/* Recent Trends */}
        {recentTrends.length > 0 && (
          <View style={styles.trendsSection}>
            <Text style={styles.sectionTitle}>📊 7-Day Trend</Text>
            <Card style={styles.trendsCard}>
              <View style={styles.trendsChart}>
                {recentTrends.map((day, index) => (
                  <TrendBar 
                    key={day.date} 
                    day={day} 
                    maxCount={Math.max(...recentTrends.map(d => d.count))}
                    isLast={index === recentTrends.length - 1}
                  />
                ))}
              </View>
            </Card>
          </View>
        )}
        
        {/* Customer Insights */}
        {customerMetrics && (
          <View style={styles.customerSection}>
            <Text style={styles.sectionTitle}>👥 Customer Insights</Text>
            <View style={styles.customerGrid}>
              <CustomerMetricCard
                title="Total Customers"
                value={customerMetrics.totalCustomers}
                subtitle="Active customers"
                icon="people"
                color={COLORS.primary}
              />
              <CustomerMetricCard
                title="New Customers"
                value={customerMetrics.newCustomers}
                subtitle="This period"
                icon="person-add"
                color={COLORS.success}
              />
              <CustomerMetricCard
                title="Retention Rate"
                value={`${customerMetrics.customerRetentionRate.toFixed(1)}%`}
                subtitle="Returning customers"
                icon="refresh"
                color={COLORS.info}
              />
              <CustomerMetricCard
                title="Avg Customer Value"
                value={`$${customerMetrics.averageCustomerValue.toFixed(0)}`}
                subtitle="Per customer"
                icon="card"
                color={COLORS.warning}
              />
            </View>
          </View>
        )}
        
        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <View style={styles.actionButtons}>
            <ActionButton
              title="New Inspection"
              icon="add-circle"
              color={COLORS.primary}
              onPress={() => {/* Navigate to create inspection */}}
            />
            <ActionButton
              title="View Reports"
              icon="bar-chart"
              color={COLORS.info}
              onPress={() => {/* Navigate to reports */}}
            />
            <ActionButton
              title="Manage Staff"
              icon="people"
              color={COLORS.secondary}
              onPress={() => {/* Navigate to staff management */}}
            />
            <ActionButton
              title="Settings"
              icon="settings"
              color={COLORS.gray[600]}
              onPress={() => {/* Navigate to settings */}}
            />
          </View>
        </View>
      </ScrollView>
    </ErrorBoundary>
  );
};

// Helper Components (Pure Presentation)

interface AlertCardProps {
  alert: {
    type: 'warning' | 'error' | 'info';
    message: string;
    metric: string;
    value: number;
  };
}

const AlertCard: React.FC<AlertCardProps> = ({ alert }) => {
  const alertColors = {
    warning: COLORS.warning,
    error: COLORS.error,
    info: COLORS.info,
  };
  
  const alertIcons = {
    warning: 'warning',
    error: 'alert-circle',
    info: 'information-circle',
  };
  
  return (
    <Card style={[styles.alertCard, { borderLeftColor: alertColors[alert.type] }]}>
      <View style={styles.alertContent}>
        <Ionicons 
          name={alertIcons[alert.type] as any} 
          size={20} 
          color={alertColors[alert.type]} 
        />
        <View style={styles.alertText}>
          <Text style={styles.alertMessage}>{alert.message}</Text>
          <Text style={styles.alertValue}>Current: {alert.value.toFixed(1)}%</Text>
        </View>
      </View>
    </Card>
  );
};

interface RealtimeMetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  urgent?: boolean;
}

const RealtimeMetricCard: React.FC<RealtimeMetricCardProps> = ({ 
  title, value, icon, color, urgent 
}) => (
  <Card style={[styles.realtimeCard, urgent && styles.urgentCard]}>
    <View style={styles.realtimeHeader}>
      <Ionicons name={icon as any} size={24} color={color} />
      {urgent && <View style={styles.urgentBadge} />}
    </View>
    <Text style={styles.realtimeValue}>{value}</Text>
    <Text style={styles.realtimeTitle}>{title}</Text>
  </Card>
);

interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: string;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon, color }) => (
  <Card style={styles.metricCard}>
    <View style={styles.metricHeader}>
      <Ionicons name={icon as any} size={20} color={color} />
      {change !== 0 && (
        <View style={[styles.changeIndicator, { 
          backgroundColor: change > 0 ? COLORS.success : COLORS.error 
        }]}>
          <Ionicons 
            name={change > 0 ? 'trending-up' : 'trending-down'} 
            size={12} 
            color={COLORS.white} 
          />
          <Text style={styles.changeText}>{Math.abs(change).toFixed(1)}%</Text>
        </View>
      )}
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricTitle}>{title}</Text>
  </Card>
);

interface MechanicCardProps {
  mechanic: any;
  rank: number;
}

const MechanicCard: React.FC<MechanicCardProps> = ({ mechanic, rank }) => {
  const rankColors = {
    1: COLORS.warning, // Gold
    2: COLORS.gray[400], // Silver
    3: '#CD7F32', // Bronze
  };
  
  const rankIcons = {
    1: 'trophy',
    2: 'medal',
    3: 'ribbon',
  };
  
  return (
    <Card style={styles.mechanicCard}>
      <View style={styles.mechanicHeader}>
        <View style={styles.mechanicRank}>
          <Ionicons 
            name={rankIcons[rank as keyof typeof rankIcons] || 'star'} 
            size={20} 
            color={rankColors[rank as keyof typeof rankColors] || COLORS.primary} 
          />
          <Text style={styles.rankNumber}>#{rank}</Text>
        </View>
        <Text style={styles.mechanicName}>{mechanic.mechanicName}</Text>
      </View>
      
      <View style={styles.mechanicStats}>
        <StatItem label="Inspections" value={mechanic.totalInspections} />
        <StatItem label="Quality" value={`${mechanic.qualityScore.toFixed(1)}/5`} />
        <StatItem label="Rating" value={`${mechanic.customerRating.toFixed(1)}/5`} />
      </View>
    </Card>
  );
};

const StatItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <View style={styles.statItem}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

interface TrendBarProps {
  day: any;
  maxCount: number;
  isLast: boolean;
}

const TrendBar: React.FC<TrendBarProps> = ({ day, maxCount, isLast }) => {
  const height = maxCount > 0 ? (day.count / maxCount) * 60 : 0;
  
  return (
    <View style={styles.trendBar}>
      <View style={[styles.trendBarFill, { 
        height, 
        backgroundColor: isLast ? COLORS.primary : COLORS.gray[300] 
      }]} />
      <Text style={styles.trendValue}>{day.count}</Text>
      <Text style={styles.trendDate}>{day.date}</Text>
    </View>
  );
};

interface CustomerMetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  color: string;
}

const CustomerMetricCard: React.FC<CustomerMetricCardProps> = ({ 
  title, value, subtitle, icon, color 
}) => (
  <Card style={styles.customerCard}>
    <View style={styles.customerHeader}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={styles.customerTitle}>{title}</Text>
    </View>
    <Text style={styles.customerValue}>{value}</Text>
    <Text style={styles.customerSubtitle}>{subtitle}</Text>
  </Card>
);

interface ActionButtonProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ title, icon, color, onPress }) => (
  <Button
    variant="secondary"
    onPress={onPress}
    style={styles.actionButton}
  >
    <View style={styles.actionButtonContent}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={styles.actionButtonText}>{title}</Text>
    </View>
  </Button>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.secondary,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background.primary,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xl,
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  dateRangeSelector: {
    maxHeight: 40,
  },
  dateRangeButton: {
    marginRight: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  alertsSection: {
    marginBottom: SPACING.xl,
  },
  alertCard: {
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertText: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  alertMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  alertValue: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  realtimeSection: {
    marginBottom: SPACING.xl,
  },
  realtimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  realtimeCard: {
    flex: 1,
    minWidth: 140,
    alignItems: 'center',
    padding: SPACING.md,
  },
  urgentCard: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  realtimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  urgentBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    marginLeft: SPACING.sm,
  },
  realtimeValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  realtimeTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  metricsSection: {
    marginBottom: SPACING.xl,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    padding: SPACING.md,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  changeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.white,
    marginLeft: 2,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  metricTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  performersSection: {
    marginBottom: SPACING.xl,
  },
  performersList: {
    gap: SPACING.md,
  },
  mechanicCard: {
    padding: SPACING.md,
  },
  mechanicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  mechanicRank: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  rankNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginLeft: 4,
  },
  mechanicName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    flex: 1,
  },
  mechanicStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  trendsSection: {
    marginBottom: SPACING.xl,
  },
  trendsCard: {
    padding: SPACING.lg,
  },
  trendsChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
  },
  trendBar: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  trendBarFill: {
    width: 20,
    borderRadius: 2,
    marginBottom: SPACING.sm,
  },
  trendValue: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  trendDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  customerSection: {
    marginBottom: SPACING.xl,
  },
  customerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  customerCard: {
    flex: 1,
    minWidth: 150,
    padding: SPACING.md,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  customerTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
  },
  customerValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  customerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  actionsSection: {
    marginBottom: SPACING.xl,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    minWidth: 120,
  },
  actionButtonContent: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
});