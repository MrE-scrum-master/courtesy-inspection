import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TextInput, Button, Card, Searchbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext as useAuth } from '@/utils';
import { apiClient as ApiClient } from '@/services';
import { VINDecoder } from '@/services/vinDecoder';

interface Vehicle {
  id: number;
  customer_id?: number;
  make: string;
  model: string;
  year: number;
  vin: string;
  license_plate?: string;
  color?: string;
  mileage?: number;
  customer?: {
    first_name: string;
    last_name: string;
    phone: string;
    email?: string;
  };
}

interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  shop_id: number;
}

const VINScannerScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [vin, setVin] = useState('');
  const [loading, setLoading] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newVehicle, setNewVehicle] = useState({
    make: '',
    model: '',
    year: '',
    license_plate: '',
    color: '',
    mileage: '',
  });
  const [newCustomer, setNewCustomer] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
  });

  // Scan or Enter VIN
  const handleVinEntry = async () => {
    if (!vin || vin.length !== 17) {
      Alert.alert('Invalid VIN', 'Please enter a valid 17-character VIN');
      return;
    }

    setLoading(true);
    
    // Declare decodedData at function level to fix scope issue
    let decodedData = null;
    
    try {
      // First, decode the VIN using NHTSA API (no API key needed!)
      console.log('Decoding VIN with NHTSA:', vin);
      decodedData = await VINDecoder.decode(vin);
      
      if (decodedData) {
        console.log('VIN decoded successfully:', decodedData);
        // We now have year, make, model automatically!
      }
      
      // Then check if vehicle exists in our database
      const response = await ApiClient.get(`/vehicles/vin/${vin}`);
      const foundVehicle = response.data.data || response.data; // Handle both response formats
      
      console.log('Vehicle found in database:', foundVehicle); // Debug log
      
      if (foundVehicle) {
        // Merge decoded data with database data (database takes priority)
        const mergedVehicle = {
          ...foundVehicle,
          // Add decoded data if not in database
          make: foundVehicle.make || decodedData?.make,
          model: foundVehicle.model || decodedData?.model,
          year: foundVehicle.year || decodedData?.year,
          // Add extra decoded info as metadata
          decoded_info: decodedData,
        };
        
        setVehicle(mergedVehicle);
        
        if (foundVehicle.customer || foundVehicle.customer_id) {
          // Vehicle exists with customer - navigate to inspection
          const customerName = foundVehicle.customer 
            ? `${foundVehicle.customer.first_name} ${foundVehicle.customer.last_name}`
            : 'Associated Customer';
          
          Alert.alert(
            'Vehicle Found',
            `${mergedVehicle.year} ${mergedVehicle.make} ${mergedVehicle.model}\nCustomer: ${customerName}`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Start Inspection', onPress: () => navigateToInspection(mergedVehicle) }
            ]
          );
        } else {
          // Vehicle exists without customer - just set the vehicle
          // The UI will show a "Create Customer" button
          console.log('Vehicle found without customer - showing Create Customer button');
        }
      }
    } catch (error: any) {
      console.error('VIN lookup error:', error);
      if (error.response?.status === 404) {
        // Vehicle doesn't exist in our database
        // But we might have decoded data from NHTSA!
        if (decodedData) {
          // Pre-populate the new vehicle form with decoded data
          setNewVehicle({
            make: decodedData.make || '',
            model: decodedData.model || '',
            year: decodedData.year?.toString() || '',
            license_plate: '',
            color: '',
            mileage: '',
          });
          
          // For web, directly show modal since Alert.alert doesn't work well
          if (Platform.OS === 'web') {
            setShowVehicleModal(true);
          } else {
            Alert.alert(
              'New Vehicle',
              `${decodedData.year} ${decodedData.make} ${decodedData.model}\n\nThis vehicle is not in our system. Would you like to add it?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Add Vehicle', onPress: () => setShowVehicleModal(true) }
              ]
            );
          }
        } else {
          // No decoded data and not in database
          if (Platform.OS === 'web') {
            setShowVehicleModal(true);
          } else {
            Alert.alert(
              'New Vehicle',
              'This vehicle is not in our system. Would you like to add it?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Add Vehicle', onPress: () => setShowVehicleModal(true) }
              ]
            );
          }
        }
      } else {
        console.error('VIN lookup error details:', error);
        Alert.alert('Error', error.message || 'Failed to check VIN. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show customer selection
  const showCustomerSelection = async () => {
    try {
      const response = await ApiClient.get('/customers', {
        params: { shop_id: user?.shopId, limit: 100 }
      });
      setCustomers(response.data.data);
      setShowCustomerModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to load customers');
      console.error('Load customers error:', error);
    }
  };

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer =>
    `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  // Associate vehicle with customer
  const associateVehicleWithCustomer = async (customerId: number) => {
    if (!vehicle) return;

    try {
      await ApiClient.patch(`/vehicles/${vehicle.id}/customer`, {
        customer_id: customerId
      });
      
      // Update vehicle state
      const customer = customers.find(c => c.id === customerId);
      const updatedVehicle = {
        ...vehicle,
        customer_id: customerId,
        customer: customer ? {
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
          email: customer.email
        } : undefined
      };
      
      setVehicle(updatedVehicle);
      setShowCustomerModal(false);
      
      Alert.alert(
        'Success',
        'Vehicle associated with customer successfully!',
        [
          { text: 'Start Inspection', onPress: () => navigateToInspection(updatedVehicle) }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to associate vehicle with customer');
      console.error('Associate vehicle error:', error);
    }
  };

  // Create new customer
  const createNewCustomer = async () => {
    if (!newCustomer.first_name || !newCustomer.last_name || !newCustomer.phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const response = await ApiClient.post('/customers', {
        ...newCustomer,
        shop_id: user?.shopId
      });
      
      const createdCustomer = response.data.data;
      
      // If we have an existing vehicle, associate it
      if (vehicle) {
        await associateVehicleWithCustomer(createdCustomer.id);
      } else {
        // We're creating a new vehicle too
        setSelectedCustomer(createdCustomer);
        setShowCustomerModal(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create customer');
      console.error('Create customer error:', error);
    }
  };

  // Create new vehicle
  const createNewVehicle = async () => {
    if (!newVehicle.make || !newVehicle.model || !newVehicle.year) {
      Alert.alert('Error', 'Please fill in make, model, and year');
      return;
    }

    try {
      const response = await ApiClient.post('/vehicles', {
        ...newVehicle,
        vin,
        year: parseInt(newVehicle.year),
        mileage: newVehicle.mileage ? parseInt(newVehicle.mileage) : null,
        customer_id: selectedCustomer?.id || null
      });
      
      const createdVehicle = response.data.data;
      
      if (selectedCustomer) {
        const vehicleWithCustomer = {
          ...createdVehicle,
          customer: {
            first_name: selectedCustomer.first_name,
            last_name: selectedCustomer.last_name,
            phone: selectedCustomer.phone,
            email: selectedCustomer.email
          }
        };
        setVehicle(vehicleWithCustomer);
        setShowVehicleModal(false);
        
        Alert.alert(
          'Success',
          'Vehicle created successfully!',
          [
            { text: 'Start Inspection', onPress: () => navigateToInspection(vehicleWithCustomer) }
          ]
        );
      } else {
        setVehicle(createdVehicle);
        setShowVehicleModal(false);
        Alert.alert(
          'Vehicle Created',
          'Vehicle created successfully! Now associate it with a customer.',
          [
            { text: 'Create New Customer', onPress: () => setShowCustomerModal(true) },
            { text: 'Select Existing Customer', onPress: () => showCustomerSelection() }
          ]
        );
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        Alert.alert('Error', 'A vehicle with this VIN already exists');
      } else {
        Alert.alert('Error', 'Failed to create vehicle');
      }
      console.error('Create vehicle error:', error);
    }
  };

  // Navigate to inspection
  const navigateToInspection = (vehicleData: Vehicle) => {
    if (!vehicleData.customer) {
      Alert.alert('Error', 'Vehicle must be associated with a customer before starting inspection');
      return;
    }

    // Navigate to create inspection screen with vehicle data
    (navigation as any).navigate('CreateInspection', {
      vehicle: vehicleData,
      customer: vehicleData.customer
    });
  };

  // Clear form
  const clearForm = () => {
    setVin('');
    setVehicle(null);
    setSelectedCustomer(null);
    setNewVehicle({
      make: '',
      model: '',
      year: '',
      license_plate: '',
      color: '',
      mileage: '',
    });
    setNewCustomer({
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Title title="VIN Scanner" subtitle="Scan or enter vehicle VIN" />
          <Card.Content>
            <TextInput
              label="VIN (17 characters)"
              value={vin}
              onChangeText={setVin}
              mode="outlined"
              maxLength={17}
              autoCapitalize="characters"
              style={styles.input}
            />
            
            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={handleVinEntry}
                loading={loading}
                disabled={loading || vin.length !== 17}
                style={styles.button}
              >
                {loading ? 'Checking...' : 'Look Up VIN'}
              </Button>
              
              <Button
                mode="outlined"
                onPress={clearForm}
                style={styles.button}
              >
                Clear
              </Button>
            </View>

            {/* Simulate Camera Scanner for MVP */}
            <Button
              mode="text"
              onPress={() => Alert.alert('Camera Scanner', 'Camera scanning will be implemented in a future update. For now, please enter the VIN manually.')}
              style={styles.cameraButton}
            >
              📷 Camera Scanner (Coming Soon)
            </Button>
          </Card.Content>
        </Card>

        {vehicle && (
          <Card style={styles.card}>
            <Card.Title title="Vehicle Information" />
            <Card.Content>
              <Text style={styles.vehicleInfo}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </Text>
              <Text>VIN: {vehicle.vin}</Text>
              {vehicle.license_plate && <Text>License: {vehicle.license_plate}</Text>}
              
              {/* Core inspection-relevant details always visible */}
              {vehicle.decoded_info && (
                <View style={styles.coreDetails}>
                  {vehicle.decoded_info.fuelType && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Fuel:</Text>
                      <Text style={styles.detailValue}>{vehicle.decoded_info.fuelType}</Text>
                    </View>
                  )}
                  {vehicle.decoded_info.driveType && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Drive:</Text>
                      <Text style={styles.detailValue}>{vehicle.decoded_info.driveType}</Text>
                    </View>
                  )}
                  {vehicle.decoded_info.trim && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Trim:</Text>
                      <Text style={styles.detailValue}>{vehicle.decoded_info.trim}</Text>
                    </View>
                  )}
                </View>
              )}
              
              {/* Expandable More Details section */}
              {vehicle.decoded_info && (
                <TouchableOpacity 
                  onPress={() => setShowMoreDetails(!showMoreDetails)}
                  style={styles.moreDetailsButton}
                >
                  <Text style={styles.moreDetailsText}>
                    {showMoreDetails ? '▼ Hide Details' : '▶ More Details'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {showMoreDetails && vehicle.decoded_info && (
                <View style={styles.moreDetailsContent}>
                  {vehicle.decoded_info.bodyClass && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Body Type:</Text>
                      <Text style={styles.detailValue}>{vehicle.decoded_info.bodyClass}</Text>
                    </View>
                  )}
                  {vehicle.decoded_info.vehicleType && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Vehicle Type:</Text>
                      <Text style={styles.detailValue}>{vehicle.decoded_info.vehicleType}</Text>
                    </View>
                  )}
                  {vehicle.decoded_info.doors && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Doors:</Text>
                      <Text style={styles.detailValue}>{vehicle.decoded_info.doors}</Text>
                    </View>
                  )}
                  {vehicle.decoded_info.engineCylinders && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Engine:</Text>
                      <Text style={styles.detailValue}>{vehicle.decoded_info.engineCylinders} Cylinder</Text>
                    </View>
                  )}
                  {vehicle.decoded_info.manufacturerName && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Manufacturer:</Text>
                      <Text style={styles.detailValue}>{vehicle.decoded_info.manufacturerName}</Text>
                    </View>
                  )}
                </View>
              )}
              
              {vehicle.customer ? (
                <View>
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerTitle}>Customer:</Text>
                    <Text>{vehicle.customer.first_name} {vehicle.customer.last_name}</Text>
                    <Text>{vehicle.customer.phone}</Text>
                    {vehicle.customer.email && <Text>{vehicle.customer.email}</Text>}
                  </View>
                  <Button 
                    mode="contained"
                    onPress={() => navigateToInspection(vehicle)}
                    style={styles.startInspectionButton}
                    icon="clipboard-check"
                  >
                    Start Inspection
                  </Button>
                </View>
              ) : (
                <View>
                  <Text style={styles.noCustomer}>No customer associated</Text>
                  <Button 
                    mode="contained"
                    onPress={() => {
                      navigation.navigate('CreateCustomer' as never, {
                        vehicleId: vehicle.id,
                        vehicleInfo: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                        returnTo: 'VINScanner'
                      } as never);
                    }}
                    style={styles.createCustomerButton}
                  >
                    Create Customer
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Customer Selection/Creation Modal */}
      <Modal
        visible={showCustomerModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {customers.length > 0 ? 'Select or Create Customer' : 'Create New Customer'}
            </Text>
            <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {customers.length > 0 && (
              <>
                <Searchbar
                  placeholder="Search customers..."
                  onChangeText={setSearchQuery}
                  value={searchQuery}
                  style={styles.searchbar}
                />
                
                {filteredCustomers.map((customer) => (
                  <TouchableOpacity
                    key={customer.id}
                    style={styles.customerItem}
                    onPress={() => associateVehicleWithCustomer(customer.id)}
                  >
                    <Text style={styles.customerName}>
                      {customer.first_name} {customer.last_name}
                    </Text>
                    <Text style={styles.customerPhone}>{customer.phone}</Text>
                  </TouchableOpacity>
                ))}
                
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Or Create New Customer:</Text>
              </>
            )}
            
            <TextInput
              label="First Name *"
              value={newCustomer.first_name}
              onChangeText={(text) => setNewCustomer({...newCustomer, first_name: text})}
              mode="outlined"
              style={styles.input}
            />
            
            <TextInput
              label="Last Name *"
              value={newCustomer.last_name}
              onChangeText={(text) => setNewCustomer({...newCustomer, last_name: text})}
              mode="outlined"
              style={styles.input}
            />
            
            <TextInput
              label="Phone *"
              value={newCustomer.phone}
              onChangeText={(text) => setNewCustomer({...newCustomer, phone: text})}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
            />
            
            <TextInput
              label="Email"
              value={newCustomer.email}
              onChangeText={(text) => setNewCustomer({...newCustomer, email: text})}
              mode="outlined"
              keyboardType="email-address"
              style={styles.input}
            />
            
            <Button
              mode="contained"
              onPress={createNewCustomer}
              style={styles.createButton}
            >
              Create Customer
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vehicle Creation Modal */}
      <Modal
        visible={showVehicleModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Vehicle</Text>
            <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.vinDisplay}>VIN: {vin}</Text>
            
            <TextInput
              label="Make *"
              value={newVehicle.make}
              onChangeText={(text) => setNewVehicle({...newVehicle, make: text})}
              mode="outlined"
              style={styles.input}
            />
            
            <TextInput
              label="Model *"
              value={newVehicle.model}
              onChangeText={(text) => setNewVehicle({...newVehicle, model: text})}
              mode="outlined"
              style={styles.input}
            />
            
            <TextInput
              label="Year *"
              value={newVehicle.year}
              onChangeText={(text) => setNewVehicle({...newVehicle, year: text})}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />
            
            <TextInput
              label="License Plate"
              value={newVehicle.license_plate}
              onChangeText={(text) => setNewVehicle({...newVehicle, license_plate: text})}
              mode="outlined"
              style={styles.input}
            />
            
            <TextInput
              label="Color"
              value={newVehicle.color}
              onChangeText={(text) => setNewVehicle({...newVehicle, color: text})}
              mode="outlined"
              style={styles.input}
            />
            
            <TextInput
              label="Mileage"
              value={newVehicle.mileage}
              onChangeText={(text) => setNewVehicle({...newVehicle, mileage: text})}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />
            
            <Button
              mode="contained"
              onPress={createNewVehicle}
              style={styles.createButton}
            >
              Add Vehicle
            </Button>
            
            {!selectedCustomer && (
              <Button
                mode="outlined"
                onPress={() => {
                  setShowVehicleModal(false);
                  setShowCustomerModal(true);
                }}
                style={styles.createButton}
              >
                Select Customer First
              </Button>
            )}
            
            {selectedCustomer && (
              <Text style={styles.selectedCustomer}>
                Customer: {selectedCustomer.first_name} {selectedCustomer.last_name}
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
  },
  button: {
    flex: 1,
  },
  cameraButton: {
    marginTop: 8,
  },
  vehicleInfo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  customerInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
  },
  customerTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noCustomer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    fontStyle: 'italic',
  },
  createCustomerButton: {
    marginTop: 12,
  },
  startInspectionButton: {
    marginTop: 12,
    backgroundColor: '#4caf50',
  },
  coreDetails: {
    marginTop: 8,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#000',
    flex: 1,
    fontWeight: '500',
  },
  moreDetailsButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  moreDetailsButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  moreDetailsContent: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  searchbar: {
    marginBottom: 16,
  },
  customerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  customerPhone: {
    fontSize: 14,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  createButton: {
    marginTop: 16,
  },
  vinDisplay: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectedCustomer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    textAlign: 'center',
  },
});

export default VINScannerScreen;