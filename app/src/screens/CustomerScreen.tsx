import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LoadingSpinner, Card, Button } from '@/components';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants';
import { ApiClient } from '@/services/ApiClient';
import { useAuth } from '@/utils/AuthContext';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  created_at: string;
}

export const CustomerScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCustomers = async () => {
    try {
      const response = await ApiClient.get(`/customers?shop_id=${user?.shopId}`);
      if (response.data.success) {
        setCustomers(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomers();
  };

  const renderCustomer = ({ item }: { item: Customer }) => (
    <TouchableOpacity>
      <Card style={styles.customerCard}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={styles.customerPhone}>{item.phone}</Text>
          {item.email && <Text style={styles.customerEmail}>{item.email}</Text>}
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <Button
          title="Add Customer"
          variant="primary"
          leftIcon="person-add"
          style={styles.addButton}
          onPress={() => {
            navigation.navigate('CreateCustomer' as never);
          }}
        />
      </View>
      
      <FlatList
        data={customers}
        renderItem={renderCustomer}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No customers yet</Text>
            <Text style={styles.emptySubtext}>Add your first customer to get started</Text>
          </Card>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.primary,
  },
  addButton: {
    paddingHorizontal: SPACING.md,
  },
  listContent: {
    padding: SPACING.md,
  },
  customerCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  customerPhone: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
  },
  customerEmail: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    marginTop: SPACING.xs,
  },
  emptyCard: {
    margin: SPACING.md,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.tertiary,
  },
});