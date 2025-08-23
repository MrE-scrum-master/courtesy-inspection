import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LoadingSpinner, Card, Button } from '@/components';
import { useAuthContext } from '@/utils';
import { useInspectionsByMechanic, useInspectionsByShop } from '@/hooks';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@/constants';
import type { Inspection } from '@/types/common';

export const DashboardScreen: React.FC = () => {
  const { user, logout } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch inspections based on user role
  const inspectionsQuery = user?.role === 'mechanic'
    ? useInspectionsByMechanic(user.id, { 
        limit: 10, 
        status: 'in_progress,draft' 
      })
    : useInspectionsByShop(user?.shopId || '', { 
        limit: 10 
      });

  const { data: inspectionsData, isLoading, error, refetch } = inspectionsQuery;
  const inspections = inspectionsData?.data?.data || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'draft':
        return COLORS.gray[500];
      case 'in_progress':
        return COLORS.warning;
      case 'completed':
        return COLORS.success;
      case 'sent':
        return COLORS.primary;
      default:
        return COLORS.gray[500];
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'sent':
        return 'Sent';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string): string => {
    return COLORS.priority[priority as keyof typeof COLORS.priority] || COLORS.gray[500];
  };

  if (isLoading && !refreshing) {
    return (
      <LoadingSpinner
        fullScreen
        text="Loading dashboard..."
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Hello, {user?.name}</Text>
              <Text style={styles.role}>{user?.role}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{inspections.length}</Text>
            <Text style={styles.statLabel}>Active Inspections</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {inspections.filter(i => i.status === 'completed').length}
            </Text>
            <Text style={styles.statLabel}>Completed Today</Text>
          </Card>
        </View>

        {/* Recent Inspections */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Inspections</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <Card style={styles.errorCard}>
              <Text style={styles.errorText}>
                Failed to load inspections. Pull to refresh.
              </Text>
            </Card>
          )}

          {inspections.length === 0 && !error ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="clipboard-outline" size={48} color={COLORS.text.tertiary} />
              <Text style={styles.emptyText}>No inspections yet</Text>
              <Text style={styles.emptySubtext}>
                {user?.role === 'mechanic' 
                  ? 'Start your first inspection by tapping the + button'
                  : 'Mechanics will see their inspections here'
                }
              </Text>
            </Card>
          ) : (
            inspections.map((inspection) => (
              <InspectionCard
                key={inspection.id}
                inspection={inspection}
                onPress={() => {
                  // Navigation will be handled by navigation container
                  console.log('Navigate to inspection:', inspection.id);
                }}
              />
            ))
          )}
        </View>

        {/* Quick Actions */}
        {user?.role === 'mechanic' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActions}>
              <Button
                title="New Inspection"
                leftIcon="add"
                style={styles.quickActionButton}
                onPress={() => {
                  // Navigation will be handled by navigation container
                  console.log('Navigate to create inspection');
                }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

interface InspectionCardProps {
  inspection: Inspection;
  onPress: () => void;
}

const InspectionCard: React.FC<InspectionCardProps> = ({ inspection, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Card style={styles.inspectionCard}>
        <View style={styles.inspectionHeader}>
          <View style={styles.inspectionInfo}>
            <Text style={styles.customerName}>
              {inspection.customer?.name || 'Unknown Customer'}
            </Text>
            <Text style={styles.vehicleInfo}>
              {inspection.vehicle?.year} {inspection.vehicle?.make} {inspection.vehicle?.model}
            </Text>
          </View>
          <View style={styles.inspectionMeta}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(inspection.status)}20` }
            ]}>
              <Text style={[
                styles.statusText,
                { color: getStatusColor(inspection.status) }
              ]}>
                {getStatusText(inspection.status)}
              </Text>
            </View>
            <View style={[
              styles.priorityIndicator,
              { backgroundColor: getPriorityColor(inspection.priority) }
            ]} />
          </View>
        </View>

        <View style={styles.inspectionDetails}>
          <View style={styles.inspectionStat}>
            <Ionicons name="list-outline" size={16} color={COLORS.text.secondary} />
            <Text style={styles.inspectionStatText}>
              {inspection.items?.length || 0} items
            </Text>
          </View>
          {inspection.totalEstimatedCost && (
            <View style={styles.inspectionStat}>
              <Ionicons name="cash-outline" size={16} color={COLORS.text.secondary} />
              <Text style={styles.inspectionStatText}>
                ${inspection.totalEstimatedCost.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.inspectionStat}>
            <Ionicons name="time-outline" size={16} color={COLORS.text.secondary} />
            <Text style={styles.inspectionStatText}>
              {new Date(inspection.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

// Helper functions moved inside component for access to COLORS
function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return COLORS.gray[500];
    case 'in_progress':
      return COLORS.warning;
    case 'completed':
      return COLORS.success;
    case 'sent':
      return COLORS.primary;
    default:
      return COLORS.gray[500];
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'sent':
      return 'Sent';
    default:
      return status;
  }
}

function getPriorityColor(priority: string): string {
  return COLORS.priority[priority as keyof typeof COLORS.priority] || COLORS.gray[500];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  role: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textTransform: 'capitalize',
  },
  logoutButton: {
    padding: SPACING.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
  },
  statNumber: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  section: {
    padding: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  seeAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  errorCard: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.error,
    textAlign: 'center',
  },
  emptyCard: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  inspectionCard: {
    marginBottom: SPACING.md,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  inspectionInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  vehicleInfo: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  inspectionMeta: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inspectionDetails: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  inspectionStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  inspectionStatText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  quickActions: {
    marginTop: SPACING.md,
  },
  quickActionButton: {
    alignSelf: 'flex-start',
  },
});

export default DashboardScreen;