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
import { useAuth } from '@/utils/AuthContext';
import { apiClient as ApiClient } from '@/services';

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
    try {
      // Check if vehicle exists
      const response = await ApiClient.get(`/vehicles/vin/${vin}`);
      const foundVehicle = response.data.data;
      
      if (foundVehicle) {
        setVehicle(foundVehicle);
        
        if (foundVehicle.customer) {
          // Vehicle exists with customer - navigate to inspection
          Alert.alert(
            'Vehicle Found',
            `${foundVehicle.year} ${foundVehicle.make} ${foundVehicle.model}\nCustomer: ${foundVehicle.customer.first_name} ${foundVehicle.customer.last_name}`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Start Inspection', onPress: () => navigateToInspection(foundVehicle) }
            ]
          );
        } else {
          // Vehicle exists without customer - show customer selection
          Alert.alert(
            'Vehicle Found',
            `${foundVehicle.year} ${foundVehicle.make} ${foundVehicle.model}\n\nThis vehicle is not associated with a customer. Would you like to associate it with a customer?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Create New Customer', onPress: () => setShowCustomerModal(true) },
              { text: 'Select Existing Customer', onPress: () => showCustomerSelection() }
            ]
          );
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Vehicle doesn't exist - show create vehicle flow
        Alert.alert(
          'New Vehicle',
          'This vehicle is not in our system. Would you like to add it?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Vehicle', onPress: () => setShowVehicleModal(true) }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to check VIN. Please try again.');
        console.error('VIN lookup error:', error);
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
              {vehicle.customer ? (
                <View style={styles.customerInfo}>
                  <Text style={styles.customerTitle}>Customer:</Text>
                  <Text>{vehicle.customer.first_name} {vehicle.customer.last_name}</Text>
                  <Text>{vehicle.customer.phone}</Text>
                  {vehicle.customer.email && <Text>{vehicle.customer.email}</Text>}
                </View>
              ) : (
                <Text style={styles.noCustomer}>No customer associated</Text>
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