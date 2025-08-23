// Approval Queue Screen - Pure presentation with no business logic
import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApprovalQueue } from '../hooks/useApprovalQueue';
import { InspectionSplitView } from '../screens/iPadLayouts/SplitViewLayout';
import { getDeviceInfo } from '../utils/responsive';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/theme';
import { iPadContentStyles } from '../styles/ipad.styles';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Inspection } from '../types/common';

interface ApprovalQueueScreenProps {
  onInspectionSelect?: (inspection: Inspection) => void;
  selectedInspectionId?: string;
}

export const ApprovalQueueScreen: React.FC<ApprovalQueueScreenProps> = ({
  onInspectionSelect,
  selectedInspectionId,
}) => {
  const deviceInfo = getDeviceInfo();
  
  // API data (read-only)
  const {
    prioritizedQueue,
    urgentInspections,
    stats,
    isLoading,
    error,
    approvalError,
    rejectionError,
    isApproving,
    isRejecting,
    totalPending,
    urgentCount,
    refreshQueue,
    approveInspection,
    rejectInspection,
    bulkApprove,
  } = useApprovalQueue();
  
  // Pure computed values (no business logic)
  const selectedInspection = useMemo(() => {
    return prioritizedQueue.find(inspection => inspection.id === selectedInspectionId);
  }, [prioritizedQueue, selectedInspectionId]);
  
  const groupedByPriority = useMemo(() => {
    return {
      high: prioritizedQueue.filter(i => i.priority === 'high'),
      medium: prioritizedQueue.filter(i => i.priority === 'medium'),
      low: prioritizedQueue.filter(i => i.priority === 'low'),
    };
  }, [prioritizedQueue]);
  
  // Error display helper
  const displayError = useMemo(() => {
    if (error) return error.message;
    if (approvalError) return `Approval failed: ${approvalError.message}`;
    if (rejectionError) return `Rejection failed: ${rejectionError.message}`;
    return null;
  }, [error, approvalError, rejectionError]);
  
  // Render approval queue item
  const renderApprovalItem = ({ item }: { item: Inspection }) => (
    <ApprovalQueueItem
      inspection={item}
      isSelected={item.id === selectedInspectionId}
      onSelect={() => onInspectionSelect?.(item)}
      onApprove={(notes, cost, actions) => approveInspection(item.id, notes, cost, actions)}
      onReject={(notes) => rejectInspection(item.id, notes)}
      isApproving={isApproving}
      isRejecting={isRejecting}
    />
  );
  
  // Render approval queue list
  const renderApprovalList = () => (
    <View style={styles.listContainer}>
      {/* Header */}
      <View style={iPadContentStyles.headerContainer}>
        <View>
          <Text style={iPadContentStyles.headerTitle}>Approval Queue</Text>
          <Text style={styles.subtitle}>
            {totalPending} pending • {urgentCount} urgent
          </Text>
        </View>
        
        <View style={iPadContentStyles.headerActions}>
          {groupedByPriority.high.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onPress={() => bulkApprove(groupedByPriority.high.map(i => i.id))}
              disabled={isApproving}
            >
              Approve All Urgent
            </Button>
          )}
          
          <Button
            variant="secondary"
            size="sm"
            onPress={refreshQueue}
            disabled={isLoading}
          >
            <Ionicons name="refresh" size={16} color={COLORS.text.primary} />
          </Button>
        </View>
      </View>
      
      {/* Stats Display */}
      {stats && (
        <View style={styles.statsContainer}>
          <StatCard
            title="Pending"
            value={stats.pending}
            color={COLORS.warning}
            icon="time-outline"
          />
          <StatCard
            title="Avg Time"
            value={`${stats.averageApprovalTime}m`}
            color={COLORS.info}
            icon="speedometer-outline"
          />
          <StatCard
            title="Urgent"
            value={stats.urgentCount}
            color={COLORS.error}
            icon="alert-circle-outline"
          />
        </View>
      )}
      
      {/* Error Display */}
      {displayError && (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{displayError}</Text>
        </Card>
      )}
      
      {/* Loading State */}
      {isLoading ? (
        <LoadingSpinner message="Loading approval queue..." />
      ) : (
        <>
          {/* Urgent Items Section */}
          {urgentInspections.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                🚨 Urgent ({urgentInspections.length})
              </Text>
              <FlatList
                data={urgentInspections}
                keyExtractor={(item) => item.id}
                renderItem={renderApprovalItem}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            </View>
          )}
          
          {/* All Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              All Pending ({prioritizedQueue.length})
            </Text>
            <FlatList
              data={prioritizedQueue}
              keyExtractor={(item) => item.id}
              renderItem={renderApprovalItem}
              refreshControl={
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={refreshQueue}
                  tintColor={COLORS.primary}
                />
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons 
                    name="checkmark-circle-outline" 
                    size={64} 
                    color={COLORS.success} 
                  />
                  <Text style={styles.emptyTitle}>All Caught Up!</Text>
                  <Text style={styles.emptyMessage}>
                    No inspections pending approval
                  </Text>
                </View>
              }
            />
          </View>
        </>
      )}
    </View>
  );
  
  // Render inspection detail
  const renderInspectionDetail = () => {
    if (!selectedInspection) {
      return (
        <View style={styles.placeholderContainer}>
          <Ionicons 
            name="document-text-outline" 
            size={64} 
            color={COLORS.gray[400]} 
          />
          <Text style={styles.placeholderText}>
            Select an inspection to review
          </Text>
        </View>
      );
    }
    
    return (
      <InspectionApprovalDetail
        inspection={selectedInspection}
        onApprove={(notes, cost, actions) => 
          approveInspection(selectedInspection.id, notes, cost, actions)}
        onReject={(notes) => 
          rejectInspection(selectedInspection.id, notes)}
        isApproving={isApproving}
        isRejecting={isRejecting}
      />
    );
  };
  
  // iPad split view or mobile full screen
  if (deviceInfo.isTablet) {
    return (
      <ErrorBoundary>
        <InspectionSplitView
          listComponent={renderApprovalList()}
          detailComponent={renderInspectionDetail()}
        />
      </ErrorBoundary>
    );
  }
  
  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {selectedInspection ? renderInspectionDetail() : renderApprovalList()}
      </View>
    </ErrorBoundary>
  );
};

// Approval Queue Item Component (Pure Presentation)
interface ApprovalQueueItemProps {
  inspection: Inspection;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: (notes?: string, cost?: number, actions?: string[]) => void;
  onReject: (notes?: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

const ApprovalQueueItem: React.FC<ApprovalQueueItemProps> = ({
  inspection,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}) => {
  const priorityColor = {
    high: COLORS.error,
    medium: COLORS.warning,
    low: COLORS.success,
  }[inspection.priority];
  
  const handleQuickApprove = () => {
    Alert.alert(
      'Quick Approve',
      `Approve inspection for ${inspection.customer?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Approve', 
          onPress: () => onApprove(),
          style: 'default'
        },
      ]
    );
  };
  
  const handleQuickReject = () => {
    Alert.alert(
      'Quick Reject',
      `Reject inspection for ${inspection.customer?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          onPress: () => onReject('Rejected from approval queue'),
          style: 'destructive'
        },
      ]
    );
  };
  
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
          <View style={styles.priorityBadge}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {inspection.priority.toUpperCase()}
            </Text>
          </View>
          
          <Text style={styles.customerName}>
            {inspection.customer?.name || 'Unknown Customer'}
          </Text>
          
          <Text style={styles.vehicleInfo}>
            {inspection.vehicle?.year} {inspection.vehicle?.make} {inspection.vehicle?.model}
          </Text>
          
          <Text style={styles.mechanicName}>
            by {inspection.mechanic?.name || 'Unknown Mechanic'}
          </Text>
        </View>
        
        <View style={styles.inspectionActions}>
          <Text style={styles.estimatedCost}>
            ${(inspection.totalEstimatedCost || 0).toFixed(2)}
          </Text>
          
          <View style={styles.actionButtons}>
            <Button
              variant="success"
              size="sm"
              onPress={handleQuickApprove}
              disabled={isApproving || isRejecting}
              style={styles.actionButton}
            >
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </Button>
            
            <Button
              variant="danger"
              size="sm"
              onPress={handleQuickReject}
              disabled={isApproving || isRejecting}
              style={styles.actionButton}
            >
              <Ionicons name="close" size={16} color={COLORS.white} />
            </Button>
          </View>
        </View>
      </View>
      
      <View style={styles.inspectionSummary}>
        <Text style={styles.itemCount}>
          {inspection.items.length} items inspected
        </Text>
        
        <Text style={styles.issuesFound}>
          {inspection.items.filter(item => 
            item.status === 'poor' || item.status === 'needs_attention'
          ).length} issues found
        </Text>
        
        <Text style={styles.completedDate}>
          Completed {new Date(inspection.completedDate || inspection.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </Card>
  );
};

// Inspection Approval Detail Component (Pure Presentation)
interface InspectionApprovalDetailProps {
  inspection: Inspection;
  onApprove: (notes?: string, cost?: number, actions?: string[]) => void;
  onReject: (notes?: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

const InspectionApprovalDetail: React.FC<InspectionApprovalDetailProps> = ({
  inspection,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}) => {
  return (
    <View style={styles.detailContainer}>
      <View style={iPadContentStyles.headerContainer}>
        <Text style={iPadContentStyles.headerTitle}>
          Inspection Details
        </Text>
        
        <View style={iPadContentStyles.headerActions}>
          <Button
            variant="danger"
            size="md"
            onPress={() => onReject('Rejected after review')}
            disabled={isApproving || isRejecting}
          >
            {isRejecting ? 'Rejecting...' : 'Reject'}
          </Button>
          
          <Button
            variant="success"
            size="md"
            onPress={() => onApprove()}
            disabled={isApproving || isRejecting}
          >
            {isApproving ? 'Approving...' : 'Approve'}
          </Button>
        </View>
      </View>
      
      {/* Inspection content would go here - detailed view */}
      <Text style={styles.detailPlaceholder}>
        Detailed inspection view for {inspection.customer?.name}
      </Text>
    </View>
  );
};

// Stat Card Component (Pure Presentation)
interface StatCardProps {
  title: string;
  value: string | number;
  color: string;
  icon: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color, icon }) => (
  <View style={styles.statCard}>
    <Ionicons name={icon as any} size={24} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  listContainer: {
    flex: 1,
    backgroundColor: COLORS.background.secondary,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
    ...COLORS.gray[100],
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginTop: 4,
  },
  statTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  errorCard: {
    margin: SPACING.lg,
    backgroundColor: COLORS.error,
  },
  errorText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  listContent: {
    paddingBottom: SPACING.xl,
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
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  priorityText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
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
  mechanicName: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
  },
  inspectionActions: {
    alignItems: 'flex-end',
  },
  estimatedCost: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
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
  completedDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },
  placeholderText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.secondary,
    marginTop: SPACING.lg,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  detailPlaceholder: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING['2xl'],
  },
});