import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingSpinner, Card, Button } from '@/components';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants';
import apiClient from '@/services/ApiClient';
import { useAuthContext as useAuth } from '@/utils';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: string;
  license_plate: string;
  vin?: string;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  vehicles?: Vehicle[];
  created_at: string;
  inspection_count?: number;
  last_inspection_date?: string;
}

export const CustomerScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ 
    first_name: '', 
    last_name: '', 
    phone: '', 
    email: '' 
  });
  const [newVehicle, setNewVehicle] = useState({ 
    year: '', 
    make: '', 
    model: '', 
    license_plate: '', 
    vin: '' 
  });
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const fetchCustomers = async () => {
    try {
      const response = await apiClient.get(`/customers?shop_id=${user?.shopId}`);
      console.log('Fetch customers response:', response);
      
      // Handle transformed response format from ApiClient
      if (response.status === 'success') {
        setCustomers(response.data || []);
      } else {
        console.error('Failed to fetch customers:', response.message);
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      Alert.alert('Error', 'Failed to load customers');
      setCustomers([]); // Ensure empty state
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

  const handleAddCustomer = async () => {
    if (!newCustomer.first_name.trim() || !newCustomer.phone.trim()) {
      Alert.alert('Required Fields', 'Please enter at least name and phone number');
      return;
    }

    try {
      const response = await apiClient.post('/customers', {
        ...newCustomer,
        shop_id: user?.shopId
      });
      
      console.log('Add customer response:', response);
      
      // Handle transformed response format from ApiClient
      if (response.status === 'success') {
        setShowAddModal(false);
        setNewCustomer({ first_name: '', last_name: '', phone: '', email: '' });
        await fetchCustomers(); // Wait for refresh to complete
        Alert.alert('Success', 'Customer added successfully!');
      } else {
        Alert.alert('Error', response.message || 'Failed to add customer');
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add customer');
    }
  };

  const handleAddVehicle = async () => {
    if (!selectedCustomer || !newVehicle.make.trim() || !newVehicle.model.trim()) {
      Alert.alert('Required Fields', 'Please enter at least make and model');
      return;
    }

    try {
      const response = await apiClient.post('/vehicles', {
        ...newVehicle,
        customer_id: selectedCustomer.id
      });
      
      // Handle transformed response format from ApiClient
      if (response.status === 'success') {
        setShowVehicleModal(false);
        setNewVehicle({ year: '', make: '', model: '', license_plate: '', vin: '' });
        await fetchCustomers(); // Wait for refresh to complete
        Alert.alert('Success', 'Vehicle added successfully!');
      } else {
        Alert.alert('Error', response.message || 'Failed to add vehicle');
      }
    } catch (error) {
      console.error('Error adding vehicle:', error);
      Alert.alert('Error', 'Failed to add vehicle');
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchQuery.toLowerCase();
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    return fullName.includes(searchLower) || 
           customer.phone.includes(searchQuery) ||
           customer.email?.toLowerCase().includes(searchLower);
  });

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderCustomer = ({ item, index }: { item: Customer; index: number }) => {
    const vehicleCount = item.vehicles?.length || 0;
    const animatedValue = new Animated.Value(0);
    
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();

    return (
      <Animated.View
        style={{
          opacity: animatedValue,
          transform: [{
            translateY: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          }],
        }}
      >
        <TouchableOpacity 
          onPress={() => {
            animatePress();
            // Navigate to customer detail or show options
          }}
          activeOpacity={0.9}
        >
          <Card style={styles.customerCard}>
            <LinearGradient
              colors={['#ffffff', '#f8f9fa']}
              style={styles.cardGradient}
            >
              <View style={styles.customerHeader}>
                <View style={styles.avatarContainer}>
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.secondary]}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {item.first_name.charAt(0)}{item.last_name.charAt(0)}
                    </Text>
                  </LinearGradient>
                </View>
                
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>
                    {item.first_name} {item.last_name}
                  </Text>
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={14} color={COLORS.text.secondary} />
                    <Text style={styles.customerPhone}>{item.phone}</Text>
                  </View>
                  {item.email && (
                    <View style={styles.contactRow}>
                      <Ionicons name="mail-outline" size={14} color={COLORS.text.secondary} />
                      <Text style={styles.customerEmail}>{item.email}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.vehicleButton}
                  onPress={() => {
                    setSelectedCustomer(item);
                    setShowVehicleModal(true);
                  }}
                >
                  <LinearGradient
                    colors={vehicleCount > 0 ? [COLORS.success, '#10b981'] : ['#6b7280', '#9ca3af']}
                    style={styles.vehicleBadge}
                  >
                    <Ionicons name="car" size={16} color="white" />
                    <Text style={styles.vehicleCount}>{vehicleCount}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {vehicleCount > 0 && (
                <View style={styles.vehicleList}>
                  <Text style={styles.vehicleListTitle}>Vehicles:</Text>
                  {item.vehicles?.slice(0, 2).map((vehicle, idx) => (
                    <View key={vehicle.id || idx} style={styles.vehicleItem}>
                      <Ionicons name="car-sport-outline" size={12} color={COLORS.text.tertiary} />
                      <Text style={styles.vehicleText}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </Text>
                    </View>
                  ))}
                  {vehicleCount > 2 && (
                    <Text style={styles.moreVehicles}>+{vehicleCount - 2} more</Text>
                  )}
                </View>
              )}
            </LinearGradient>
          </Card>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner fullScreen message="Loading customers..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#f0f9ff', '#ffffff']}
        style={styles.backgroundGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Customers</Text>
            <Text style={styles.subtitle}>
              {customers.length} total • {filteredCustomers.length} shown
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              style={styles.addButtonGradient}
            >
              <Ionicons name="add" size={24} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={COLORS.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customers..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={COLORS.text.tertiary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>{customers.length}</Text>
            <Text style={styles.statLabel}>Customers</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="car" size={24} color={COLORS.success} />
            <Text style={styles.statNumber}>
              {customers.reduce((sum, c) => sum + (c.vehicles?.length || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Vehicles</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="clipboard" size={24} color={COLORS.warning} />
            <Text style={styles.statNumber}>
              {customers.reduce((sum, c) => sum + (c.inspection_count || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Inspections</Text>
          </View>
        </ScrollView>
        
        {/* Customer List */}
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={COLORS.text.tertiary} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No customers found' : 'No customers yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search' : 'Add your first customer to get started'}
              </Text>
              {!searchQuery && (
                <Button
                  variant="primary"
                  onPress={() => setShowAddModal(true)}
                  style={styles.emptyButton}
                >
                  Add First Customer
                </Button>
              )}
            </View>
          }
        />
      </LinearGradient>

      {/* Add Customer Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Customer</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={newCustomer.first_name}
                  onChangeText={(text) => setNewCustomer({...newCustomer, first_name: text})}
                  placeholder="John"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={newCustomer.last_name}
                  onChangeText={(text) => setNewCustomer({...newCustomer, last_name: text})}
                  placeholder="Doe"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number *</Text>
                <TextInput
                  style={styles.input}
                  value={newCustomer.phone}
                  onChangeText={(text) => setNewCustomer({...newCustomer, phone: text})}
                  placeholder="(555) 123-4567"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={newCustomer.email}
                  onChangeText={(text) => setNewCustomer({...newCustomer, email: text})}
                  placeholder="john@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                variant="secondary"
                onPress={() => setShowAddModal(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={handleAddCustomer}
                style={styles.modalButton}
              >
                Add Customer
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Vehicle Modal */}
      <Modal
        visible={showVehicleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVehicleModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Vehicle</Text>
              <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>

            {selectedCustomer && (
              <Text style={styles.modalSubtitle}>
                For: {selectedCustomer.first_name} {selectedCustomer.last_name}
              </Text>
            )}

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Year</Text>
                <TextInput
                  style={styles.input}
                  value={newVehicle.year}
                  onChangeText={(text) => setNewVehicle({...newVehicle, year: text})}
                  placeholder="2024"
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Make *</Text>
                <TextInput
                  style={styles.input}
                  value={newVehicle.make}
                  onChangeText={(text) => setNewVehicle({...newVehicle, make: text})}
                  placeholder="Toyota"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Model *</Text>
                <TextInput
                  style={styles.input}
                  value={newVehicle.model}
                  onChangeText={(text) => setNewVehicle({...newVehicle, model: text})}
                  placeholder="Camry"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>License Plate</Text>
                <TextInput
                  style={styles.input}
                  value={newVehicle.license_plate}
                  onChangeText={(text) => setNewVehicle({...newVehicle, license_plate: text})}
                  placeholder="ABC 123"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>VIN (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={newVehicle.vin}
                  onChangeText={(text) => setNewVehicle({...newVehicle, vin: text})}
                  placeholder="1HGCM82633A123456"
                  autoCapitalize="characters"
                  maxLength={17}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                variant="secondary"
                onPress={() => setShowVehicleModal(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={handleAddVehicle}
                style={styles.modalButton}
              >
                Add Vehicle
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  backgroundGradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 16,
    color: COLORS.text.primary,
  },
  statsContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    maxHeight: 100,
  },
  statCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginRight: SPACING.sm,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  customerCard: {
    marginBottom: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardGradient: {
    padding: SPACING.md,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginLeft: 6,
  },
  customerEmail: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    marginLeft: 6,
  },
  vehicleButton: {
    marginLeft: SPACING.sm,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  vehicleCount: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  vehicleList: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.primary,
  },
  vehicleListTitle: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  vehicleText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginLeft: 4,
  },
  moreVehicles: {
    fontSize: 12,
    color: COLORS.primary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING['4xl'],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyButton: {
    marginTop: SPACING.lg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    paddingHorizontal: SPACING.lg,
    marginTop: -SPACING.sm,
  },
  modalBody: {
    padding: SPACING.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.primary,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.text.primary,
    backgroundColor: COLORS.white,
  },
});

export default CustomerScreen;