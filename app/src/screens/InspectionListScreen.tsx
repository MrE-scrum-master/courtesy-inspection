// Inspection List Screen - Pure presentation with real API data
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInspections } from '@/hooks/useInspections';
import { useAuthContext as useAuth } from '@/utils';
import { getDeviceInfo } from '@/utils/responsive';
import { COLORS, TYPOGRAPHY, SPACING } from '@/constants/theme';
import { Button, Card, LoadingSpinner, ErrorBoundary } from '@/components';
import { useShopTime } from '@/contexts/ShopContext';
import type { Inspection } from '@/types/common';

interface InspectionListScreenProps {
  onInspectionSelect?: (inspection: Inspection) => void;
  onCreateInspection?: () => void;
  selectedInspectionId?: string;
}

export const InspectionListScreen: React.FC<InspectionListScreenProps> = ({
  onInspectionSelect,
  onCreateInspection,
  selectedInspectionId,
}) => {
  const { user } = useAuth();
  const deviceInfo = getDeviceInfo();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  
  // Fetch inspections with filters
  const {
    data: inspectionsResponse,
    isLoading,
    error,
    refetch,
  } = useInspections({
    page,
    limit: 20,
    status: statusFilter === 'all' ? undefined : statusFilter,
    shopId: user?.shopId,
  });
  
  // Extract data from paginated response
  const inspections = inspectionsResponse?.data?.data || [];
  const pagination = inspectionsResponse?.data ? {
    total: inspectionsResponse.data.total,
    page: inspectionsResponse.data.page,
    limit: inspectionsResponse.data.limit,
    hasNext: inspectionsResponse.data.hasNext,
    hasPrev: inspectionsResponse.data.hasPrev,
  } : null;
  
  // Filter options
  const statusOptions = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Sent', value: 'sent' },
  ];
  
  // Status counts for display
  const statusCounts = useMemo(() => {
    return inspections.reduce((acc, inspection) => {
      const status = inspection?.status || 'draft';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [inspections]);
  
  // Render inspection item
  const renderInspectionItem = ({ item }: { item: Inspection }) => (
    <InspectionListItem
      inspection={item}
      isSelected={item.id === selectedInspectionId}
      onSelect={() => onInspectionSelect?.(item)}
    />
  );
  
  // Render status filter
  const renderStatusFilter = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={statusOptions}
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterButton,
              statusFilter === item.value && styles.activeFilterButton,
            ]}
            onPress={() => setStatusFilter(item.value)}
          >
            <Text
              style={[
                styles.filterButtonText,
                statusFilter === item.value && styles.activeFilterButtonText,
              ]}
            >
              {item.label}
              {item.value !== 'all' && statusCounts[item.value] && (
                <Text style={styles.filterCount}> ({statusCounts[item.value]})</Text>
              )}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
  
  // Loading state
  if (isLoading && !inspections.length) {
    return <LoadingSpinner fullScreen message="Loading inspections..." />;
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorTitle}>Error Loading Inspections</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
        <Button variant="primary" onPress={() => refetch()}>
          Try Again
        </Button>
      </View>
    );
  }
  
  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.headerTitle}>Inspections</Text>
            <Text style={styles.subtitle}>
              {pagination?.total || 0} total inspections
            </Text>
          </View>
          
          <View style={styles.headerActions}>
            <Button
              variant="primary"
              size="sm"
              onPress={onCreateInspection}
            >
              <Ionicons name="add" size={16} color={COLORS.white} />
              <Text style={styles.buttonText}>New</Text>
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onPress={() => refetch()}
              disabled={isLoading}
            >
              <Ionicons name="refresh" size={16} color={COLORS.text.primary} />
            </Button>
          </View>
        </View>
        
        {/* Status Filter */}
        {renderStatusFilter()}
        
        {/* Inspection List */}
        <FlatList
          data={inspections}
          keyExtractor={(item) => item.id || item.inspection_number || Math.random().toString()}
          renderItem={renderInspectionItem}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => refetch()}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons 
                name="clipboard-outline" 
                size={64} 
                color={COLORS.gray[400]} 
              />
              <Text style={styles.emptyTitle}>No Inspections</Text>
              <Text style={styles.emptyMessage}>
                {statusFilter === 'all' 
                  ? 'No inspections found. Create your first inspection.'
                  : `No ${statusFilter.replace('_', ' ')} inspections found.`}
              </Text>
              {statusFilter === 'all' && (
                <Button
                  variant="primary"
                  onPress={onCreateInspection}
                  style={styles.createButton}
                >
                  Create First Inspection
                </Button>
              )}
            </View>
          }
        />
      </View>
    </ErrorBoundary>
  );
};

// Inspection List Item Component
interface InspectionListItemProps {
  inspection: Inspection;
  isSelected: boolean;
  onSelect: () => void;
}

const InspectionListItem: React.FC<InspectionListItemProps> = ({
  inspection,
  isSelected,
  onSelect,
}) => {
  // Get shop's date formatter
  const dateFormatter = useShopTime();
  
  const statusColors = {
    draft: COLORS.gray[400],
    in_progress: COLORS.warning,
    completed: COLORS.success,
    sent: COLORS.primary,
    archived: COLORS.gray[300],
  };
  
  const statusColor = statusColors[inspection.status] || COLORS.gray[400];
  
  // Safely get date - handle both camelCase and snake_case
  const createdDate = inspection.createdAt || inspection.created_at || new Date().toISOString();
  
  // Calculate checklist items count from checklist_data if available
  const checklistItems = inspection.checklist_data ? Object.keys(inspection.checklist_data).length : (inspection.items?.length || 0);
  
  // Calculate issues from checklist_data if available
  const issuesCount = inspection.checklist_data 
    ? Object.values(inspection.checklist_data).filter(item => 
        item.status === 'red' || item.status === 'yellow'
      ).length
    : (inspection.items?.filter(item => 
        item.status === 'poor' || item.status === 'needs_attention'
      ).length || 0);
  
  return (
    <Card 
      style={[
        styles.inspectionCard,
        isSelected && styles.selectedCard
      ]}
      onPress={onSelect}
    >
      <View style={styles.inspectionHeader}>
        <View style={styles.inspectionInfo}>
          {/* Status Badge */}
          <View style={styles.badgeContainer}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>
                {inspection.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
          
          {/* Inspection Number */}
          <Text style={styles.inspectionNumber}>
            #{inspection.inspection_number || inspection.id?.slice(-6) || 'N/A'}
          </Text>
          
          {/* Customer Info - use the new fields from backend */}
          <Text style={styles.customerName}>
            {inspection.customer_first_name && inspection.customer_last_name 
              ? `${inspection.customer_first_name} ${inspection.customer_last_name}`
              : inspection.customer?.name || 
                (inspection.customer?.first_name && inspection.customer?.last_name 
                  ? `${inspection.customer.first_name} ${inspection.customer.last_name}`
                  : 'Unknown Customer')}
          </Text>
          
          {/* Vehicle Info - use backend fields */}
          <Text style={styles.vehicleInfo}>
            {[
              inspection.year,
              inspection.make,
              inspection.model
            ].filter(Boolean).join(' ') || 
             [
              inspection.vehicle?.year,
              inspection.vehicle?.make,
              inspection.vehicle?.model
            ].filter(Boolean).join(' ') || 'Unknown Vehicle'}
            {(inspection.license_plate || inspection.vehicle?.licensePlate || inspection.vehicle?.license_plate) && (
              <Text style={styles.licensePlate}>
                {' • '}{inspection.license_plate || inspection.vehicle?.licensePlate || inspection.vehicle?.license_plate}
              </Text>
            )}
          </Text>
          
          {/* Technician Info - use backend field */}
          <Text style={styles.mechanicName}>
            by {inspection.technician_name ||
                inspection.mechanic?.name || 
                inspection.mechanic?.full_name ||
                'Unknown Technician'}
          </Text>
        </View>
        
        <View style={styles.inspectionMetrics}>
          {/* Action Icon */}
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={COLORS.gray[400]} 
          />
        </View>
      </View>
      
      {/* Summary */}
      <View style={styles.inspectionSummary}>
        <Text style={styles.itemCount}>
          {checklistItems} items inspected
        </Text>
        
        <Text style={styles.issuesFound}>
          {issuesCount} issues found
        </Text>
        
        <Text style={styles.createdDate}>
          {dateFormatter.formatDate(createdDate)}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
    backgroundColor: COLORS.white,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  buttonText: {
    color: COLORS.white,
    marginLeft: 4,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  filterContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  filterButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
  },
  activeFilterButton: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  activeFilterButtonText: {
    color: COLORS.white,
  },
  filterCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  listContent: {
    padding: SPACING.lg,
  },
  inspectionCard: {
    marginBottom: SPACING.md,
  },
  selectedCard: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  inspectionInfo: {
    flex: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  inspectionNumber: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  customerName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  vehicleInfo: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  licensePlate: {
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  mechanicName: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
  },
  inspectionMetrics: {
    alignItems: 'flex-end',
  },
  estimatedCost: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  inspectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.primary,
  },
  itemCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  issuesFound: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  createdDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING['4xl'],
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginTop: SPACING.md,
  },
  emptyMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  createButton: {
    marginTop: SPACING.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginTop: SPACING.md,
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
});

export default InspectionListScreen;