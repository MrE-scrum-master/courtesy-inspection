import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { TextInput, Button, Card, RadioButton, Chip } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/utils';
import { apiClient as ApiClient, InspectionApi } from '@/services';
import { LoadingSpinner } from '@/components';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants';

// Manager-focused inspection creation screen
export const ManagerCreateInspectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthContext();
  
  // State
  const [loading, setLoading] = useState(false);
  const [inspectionTypes, setInspectionTypes] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  
  // Form state
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  
  const [vinNumber, setVinNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  
  const [selectedMechanic, setSelectedMechanic] = useState<any>(null);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [showMechanicModal, setShowMechanicModal] = useState(false);
  
  const [inspectionType, setInspectionType] = useState('basic');
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  
  // Load data on mount
  useEffect(() => {
    loadInspectionTemplates();
    loadMechanics();
  }, []);
  
  const loadInspectionTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await InspectionApi.getInspectionTemplates();
      if (response.success && response.data) {
        setInspectionTypes(response.data);
        if (response.data.length > 0) {
          setInspectionType(response.data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load inspection templates:', error);
      // Use fallback types
      setInspectionTypes([
        { id: 'basic', name: 'Basic Inspection', description: '25-point inspection', points: 25 },
        { id: 'comprehensive', name: 'Comprehensive', description: '50-point inspection', points: 50 },
        { id: 'premium', name: 'Premium Check', description: '100-point inspection', points: 100 },
        { id: 'quick', name: 'Quick Check', description: '10-point quick inspection', points: 10 },
      ]);
    } finally {
      setLoadingTemplates(false);
    }
  };
  
  const loadMechanics = async () => {
    try {
      const response = await ApiClient.get('/users', {
        params: { shop_id: user?.shopId, role: 'mechanic' }
      });
      if (response.success && response.data) {
        setMechanics(response.data);
      }
    } catch (error) {
      console.error('Failed to load mechanics:', error);
    }
  };
  
  // Search customers
  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomers([]);
      return;
    }
    
    setSearchingCustomers(true);
    try {
      const response = await ApiClient.get('/customers/search', {
        params: { q: query, shop_id: user?.shopId }
      });
      if (response.success && response.data) {
        setCustomers(response.data);
      }
    } catch (error) {
      console.error('Failed to search customers:', error);
    } finally {
      setSearchingCustomers(false);
    }
  };
  
  // Create inspection
  const handleCreateInspection = async () => {
    if (!selectedCustomer) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }
    
    if (!vinNumber && !vehicleMake && !vehicleModel) {
      Alert.alert('Error', 'Please enter vehicle information');
      return;
    }
    
    setLoading(true);
    try {
      // First, create or find the vehicle
      let vehicleId = null;
      
      if (vinNumber || vehicleMake || vehicleModel) {
        const vehicleData = {
          customer_id: selectedCustomer.id,
          vin: vinNumber || null,
          make: vehicleMake || 'Unknown',
          model: vehicleModel || 'Unknown',
          year: vehicleYear ? parseInt(vehicleYear) : new Date().getFullYear(),
          license_plate: licensePlate || null,
        };
        
        const vehicleResponse = await ApiClient.post('/vehicles', vehicleData);
        if (vehicleResponse.success && vehicleResponse.data) {
          vehicleId = vehicleResponse.data.id;
        }
      }
      
      // Create the inspection
      const inspectionData = {
        customer_id: selectedCustomer.id,
        vehicle_id: vehicleId,
        type: inspectionType,
        status: 'draft',
        technician_id: selectedMechanic?.id || user?.id,
        notes: notes,
        scheduled_date: scheduledDate || null,
      };
      
      const response = await ApiClient.post('/inspections', inspectionData);
      
      if (response.success) {
        Alert.alert(
          'Success',
          'Inspection created successfully',
          [
            {
              text: 'View Inspection',
              onPress: () => navigation.navigate('InspectionDetail', { 
                inspectionId: response.data.id 
              })
            },
            {
              text: 'Create Another',
              onPress: () => {
                // Reset form
                setSelectedCustomer(null);
                setCustomerSearch('');
                setVinNumber('');
                setVehicleMake('');
                setVehicleModel('');
                setVehicleYear('');
                setLicensePlate('');
                setSelectedMechanic(null);
                setNotes('');
                setScheduledDate('');
              }
            }
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create inspection');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <LoadingSpinner fullScreen message="Creating inspection..." />;
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Inspection</Text>
          </View>
          
          {/* Customer Selection */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            
            {selectedCustomer ? (
              <View style={styles.selectedCustomer}>
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </Text>
                  <Text style={styles.customerDetail}>{selectedCustomer.phone}</Text>
                  <Text style={styles.customerDetail}>{selectedCustomer.email}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedCustomer(null)}
                  style={styles.changeButton}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowCustomerModal(true)}
              >
                <Ionicons name="person-add" size={20} color={COLORS.primary} />
                <Text style={styles.selectButtonText}>Select Customer</Text>
              </TouchableOpacity>
            )}
          </Card>
          
          {/* Vehicle Information */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            
            <TextInput
              label="VIN (Optional)"
              value={vinNumber}
              onChangeText={setVinNumber}
              style={styles.input}
              mode="outlined"
              maxLength={17}
              autoCapitalize="characters"
            />
            
            <View style={styles.row}>
              <TextInput
                label="Year"
                value={vehicleYear}
                onChangeText={setVehicleYear}
                style={[styles.input, styles.halfInput]}
                mode="outlined"
                keyboardType="numeric"
                maxLength={4}
              />
              
              <TextInput
                label="Make"
                value={vehicleMake}
                onChangeText={setVehicleMake}
                style={[styles.input, styles.halfInput]}
                mode="outlined"
              />
            </View>
            
            <View style={styles.row}>
              <TextInput
                label="Model"
                value={vehicleModel}
                onChangeText={setVehicleModel}
                style={[styles.input, styles.halfInput]}
                mode="outlined"
              />
              
              <TextInput
                label="License Plate"
                value={licensePlate}
                onChangeText={setLicensePlate}
                style={[styles.input, styles.halfInput]}
                mode="outlined"
                autoCapitalize="characters"
              />
            </View>
          </Card>
          
          {/* Inspection Type */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Inspection Type</Text>
            
            <RadioButton.Group 
              onValueChange={value => setInspectionType(value)} 
              value={inspectionType}
            >
              {inspectionTypes.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.radioItem,
                    inspectionType === type.id && styles.radioItemSelected
                  ]}
                  onPress={() => setInspectionType(type.id)}
                >
                  <RadioButton value={type.id} />
                  <View style={styles.radioContent}>
                    <Text style={styles.radioLabel}>{type.name}</Text>
                    <Text style={styles.radioDescription}>{type.description}</Text>
                    <Text style={styles.radioPoints}>{type.points} points</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </RadioButton.Group>
          </Card>
          
          {/* Mechanic Assignment */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Assign to Mechanic</Text>
            
            {selectedMechanic ? (
              <View style={styles.selectedCustomer}>
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>{selectedMechanic.full_name}</Text>
                  <Text style={styles.customerDetail}>{selectedMechanic.email}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedMechanic(null)}
                  style={styles.changeButton}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowMechanicModal(true)}
              >
                <Ionicons name="person" size={20} color={COLORS.primary} />
                <Text style={styles.selectButtonText}>Select Mechanic</Text>
              </TouchableOpacity>
            )}
          </Card>
          
          {/* Notes */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Add any special instructions or notes..."
            />
          </Card>
          
          {/* Submit Button */}
          <Button
            mode="contained"
            onPress={handleCreateInspection}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            disabled={loading || !selectedCustomer}
          >
            Create Inspection
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Customer Selection Modal */}
      <Modal
        visible={showCustomerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              label="Search customers..."
              value={customerSearch}
              onChangeText={(text) => {
                setCustomerSearch(text);
                searchCustomers(text);
              }}
              style={styles.searchInput}
              mode="outlined"
              left={<TextInput.Icon icon="magnify" />}
            />
            
            {searchingCustomers ? (
              <LoadingSpinner />
            ) : (
              <FlatList
                data={customers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedCustomer(item);
                      setShowCustomerModal(false);
                    }}
                  >
                    <Text style={styles.modalItemTitle}>
                      {item.first_name} {item.last_name}
                    </Text>
                    <Text style={styles.modalItemSubtitle}>{item.phone}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {customerSearch.length > 0 
                        ? 'No customers found' 
                        : 'Start typing to search'}
                    </Text>
                  </View>
                }
              />
            )}
            
            <Button
              mode="outlined"
              onPress={() => {
                setShowCustomerModal(false);
                navigation.navigate('CreateCustomer');
              }}
              style={styles.createNewButton}
            >
              Create New Customer
            </Button>
          </View>
        </View>
      </Modal>
      
      {/* Mechanic Selection Modal */}
      <Modal
        visible={showMechanicModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMechanicModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Mechanic</Text>
              <TouchableOpacity onPress={() => setShowMechanicModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={mechanics}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedMechanic(item);
                    setShowMechanicModal(false);
                  }}
                >
                  <Text style={styles.modalItemTitle}>{item.full_name}</Text>
                  <Text style={styles.modalItemSubtitle}>{item.email}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No mechanics available</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text.primary,
  },
  card: {
    margin: SPACING.md,
    padding: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  input: {
    marginBottom: SPACING.sm,
  },
  halfInput: {
    flex: 1,
    marginHorizontal: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -SPACING.xs,
  },
  selectedCustomer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 8,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text.primary,
  },
  customerDetail: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  changeButton: {
    padding: SPACING.sm,
  },
  changeButtonText: {
    color: COLORS.primary,
    ...TYPOGRAPHY.bodyBold,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  selectButtonText: {
    color: COLORS.primary,
    ...TYPOGRAPHY.bodyBold,
    marginLeft: SPACING.sm,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  radioItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  radioContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  radioLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text.primary,
  },
  radioDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  radioPoints: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    marginTop: 4,
  },
  submitButton: {
    margin: SPACING.md,
    marginTop: SPACING.xl,
  },
  submitButtonContent: {
    paddingVertical: SPACING.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
  },
  searchInput: {
    margin: SPACING.md,
  },
  modalItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  modalItemTitle: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text.primary,
  },
  modalItemSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
  },
  createNewButton: {
    margin: SPACING.md,
  },
});

export default ManagerCreateInspectionScreen;