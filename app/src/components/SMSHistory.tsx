import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@/constants';

interface SMSMessage {
  id: number;
  message: string;
  to_phone: string;
  from_phone: string;
  status: string;
  sent_at: string;
  customer_name?: string;
  inspection_number?: string;
  segments: number;
  cost: number;
  costFormatted: string;
  telnyx_message_id: string;
}

interface SMSHistoryProps {
  inspectionId?: number;
  showInspectionFilter?: boolean;
  onMessagePress?: (message: SMSMessage) => void;
}

export const SMSHistory: React.FC<SMSHistoryProps> = ({
  inspectionId,
  showInspectionFilter = false,
  onMessagePress
}) => {
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    loadMessages(1, true);
  }, [inspectionId]);

  const loadMessages = async (pageNumber: number = 1, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: pageNumber.toString(),
        limit: '20'
      });

      if (inspectionId) {
        params.append('inspection_id', inspectionId.toString());
      }

      const response = await fetch(`/api/sms/history?${params}`, {
        headers: {
          'Authorization': `Bearer ${/* get token from storage */''}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        const newMessages = result.data || [];

        if (reset) {
          setMessages(newMessages);
        } else {
          setMessages(prev => [...prev, ...newMessages]);
        }

        setHasMore(newMessages.length === 20);
        setPage(pageNumber);

        // Calculate total cost
        const total = newMessages.reduce((sum: number, msg: SMSMessage) => sum + msg.cost, 0);
        if (reset) {
          setTotalCost(total);
        } else {
          setTotalCost(prev => prev + total);
        }
      } else {
        console.error('Failed to load SMS history');
      }
    } catch (error) {
      console.error('SMS history error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMessages(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMessages(page + 1, false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent': return COLORS.success;
      case 'delivered': return COLORS.primary;
      case 'failed': return COLORS.error;
      case 'pending': return COLORS.warning;
      default: return COLORS.text.secondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent': return 'checkmark-circle';
      case 'delivered': return 'checkmark-done-circle';
      case 'failed': return 'close-circle';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  };

  const renderMessage = ({ item }: { item: SMSMessage }) => (
    <TouchableOpacity
      style={styles.messageCard}
      onPress={() => onMessagePress?.(item)}
      activeOpacity={0.7}
    >
      <View style={styles.messageHeader}>
        <View style={styles.recipientInfo}>
          <Text style={styles.recipientName}>
            {item.customer_name || 'Unknown Customer'}
          </Text>
          <Text style={styles.recipientPhone}>{item.to_phone}</Text>
        </View>
        <View style={styles.statusContainer}>
          <Ionicons
            name={getStatusIcon(item.status)}
            size={16}
            color={getStatusColor(item.status)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.messageText} numberOfLines={3}>
        {item.message}
      </Text>

      <View style={styles.messageFooter}>
        <View style={styles.messageDetails}>
          {item.inspection_number && (
            <Text style={styles.inspectionNumber}>
              {item.inspection_number}
            </Text>
          )}
          <Text style={styles.timestamp}>
            {formatDate(item.sent_at)}
          </Text>
        </View>
        <View style={styles.costInfo}>
          <Text style={styles.segments}>
            {item.segments} seg{item.segments !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.cost}>{item.costFormatted}</Text>
        </View>
      </View>

      {item.telnyx_message_id.startsWith('mock_') && (
        <View style={styles.mockBadge}>
          <Text style={styles.mockBadgeText}>MOCK</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>SMS History</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          <Ionicons
            name="refresh"
            size={24}
            color={refreshing ? COLORS.gray[400] : COLORS.primary}
          />
        </TouchableOpacity>
      </View>
      
      {messages.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Messages</Text>
            <Text style={styles.summaryValue}>{messages.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Cost</Text>
            <Text style={styles.summaryValue}>
              ${totalCost.toFixed(4)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color={COLORS.gray[400]} />
      <Text style={styles.emptyTitle}>No Messages Yet</Text>
      <Text style={styles.emptyText}>
        SMS messages sent to customers will appear here
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading || messages.length === 0) return null;
    
    return (
      <View style={styles.footerLoader}>
        <Text style={styles.loadingText}>Loading more messages...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={messages.length === 0 ? styles.emptyListContainer : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  headerContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.sm,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  messageCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    position: 'relative',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  recipientPhone: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginLeft: SPACING.xs,
    textTransform: 'capitalize',
  },
  messageText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  messageDetails: {
    flex: 1,
  },
  inspectionNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  costInfo: {
    alignItems: 'flex-end',
  },
  segments: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  cost: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.success,
  },
  mockBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  mockBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  emptyListContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footerLoader: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
});

export default SMSHistory;