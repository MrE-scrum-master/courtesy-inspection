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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { TextInput, Button, Card, RadioButton, Chip } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/utils';
import { apiClient as ApiClient } from '@/services';
import { LoadingSpinner } from '@/components';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants';

// Navigation types
type CreateInspectionParams = {
  vehicle: {
    id: number;
    make: string;
    model: string;
    year: number;
    vin: string;
    license_plate?: string;
    mileage?: number;
    decoded_info?: any;
  };
  customer: {
    id?: number;
    first_name: string;
    last_name: string;
    phone: string;
    email?: string;
  };
};

type CreateInspectionRouteProp = RouteProp<{ CreateInspection: CreateInspectionParams }, 'CreateInspection'>;

// Inspection types available
const INSPECTION_TYPES = [
  { id: 'basic', label: 'Basic Inspection', description: '25-point inspection', points: 25 },
  { id: 'comprehensive', label: 'Comprehensive', description: '50-point inspection', points: 50 },
  { id: 'premium', label: 'Premium Check', description: '100-point inspection', points: 100 },
  { id: 'quick', label: 'Quick Check', description: '10-point quick inspection', points: 10 },
];

export const CreateInspectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CreateInspectionRouteProp>();
  const { user } = useAuthContext();
  
  // Extract params
  const vehicle = route.params?.vehicle;
  const customer = route.params?.customer;
  
  // State
  const [loading, setLoading] = useState(false);
  const [inspectionType, setInspectionType] = useState('basic');
  const [mileage, setMileage] = useState(vehicle?.mileage?.toString() || '');
  const [notes, setNotes] = useState('');
  const [urgentItems, setUrgentItems] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState(customer?.id || null);
  
  // Common urgent items for quick selection
  const commonUrgentItems = [
    'Oil Change',
    'Brake Pads',
    'Tire Rotation',
    'Air Filter',
    'Battery Check',
    'Coolant Flush',
    'Transmission Service',
    'Wiper Blades',
  ];

  useEffect(() => {
    // Validate we have required data
    if (!vehicle || !customer) {
      Alert.alert(
        'Missing Information',
        'Vehicle and customer information is required to create an inspection.',
        [{ text: 'Go Back', onPress: () => navigation.goBack() }]
      );
    }
  }, [vehicle, customer]);

  // Create the inspection
  const handleCreateInspection = async () => {
    if (!vehicle || !customer) {
      Alert.alert('Error', 'Missing vehicle or customer information');
      return;
    }

    if (!mileage) {
      Alert.alert('Error', 'Please enter the current mileage');
      return;
    }

    setLoading(true);
    try {
      // First ensure customer exists in database if not already
      let finalCustomerId = customerId;
      
      if (!finalCustomerId && customer) {
        // Create customer if needed
        const customerResponse = await ApiClient.post('/customers', {
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
          email: customer.email,
          shop_id: user?.shopId,
        });
        finalCustomerId = customerResponse.data.data.id;
      }

      // Update vehicle mileage
      if (vehicle.id) {
        await ApiClient.patch(`/vehicles/${vehicle.id}`, {
          mileage: parseInt(mileage),
        });
      }

      // Create the inspection
      const inspectionData = {
        vehicle_id: vehicle.id,
        customer_id: finalCustomerId,
        mechanic_id: user?.id,
        shop_id: user?.shopId,
        type: inspectionType,
        status: 'in_progress',
        mileage: parseInt(mileage),
        notes: notes,
        urgent_items: urgentItems,
        inspection_data: {
          template: inspectionType,
          points: INSPECTION_TYPES.find(t => t.id === inspectionType)?.points || 25,
          vehicle_info: {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            vin: vehicle.vin,
            decoded_info: vehicle.decoded_info,
          },
        },
      };

      const response = await ApiClient.post('/inspections', inspectionData);
      const createdInspection = response.data.data;

      Alert.alert(
        'Success',
        'Inspection created successfully!',
        [
          {
            text: 'Start Inspection',
            onPress: () => {
              // Navigate to inspection detail/edit screen
              (navigation as any).navigate('InspectionDetail', {
                inspectionId: createdInspection.id,
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Create inspection error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to create inspection. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Toggle urgent item selection
  const toggleUrgentItem = (item: string) => {
    setUrgentItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  if (!vehicle || !customer) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner fullScreen text="Loading..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Vehicle & Customer Info */}
          <Card style={styles.card}>
            <Card.Title 
              title="Vehicle Information"
              left={(props) => <Ionicons {...props} name="car" size={24} color={COLORS.primary} />}
            />
            <Card.Content>
              <Text style={styles.vehicleInfo}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </Text>
              <Text style={styles.subInfo}>VIN: {vehicle.vin}</Text>
              {vehicle.license_plate && (
                <Text style={styles.subInfo}>License: {vehicle.license_plate}</Text>
              )}
              
              <View style={styles.divider} />
              
              <Text style={styles.customerLabel}>Customer:</Text>
              <Text style={styles.customerInfo}>
                {customer.first_name} {customer.last_name}
              </Text>
              <Text style={styles.subInfo}>{customer.phone}</Text>
              {customer.email && <Text style={styles.subInfo}>{customer.email}</Text>}
            </Card.Content>
          </Card>

          {/* Inspection Type Selection */}
          <Card style={styles.card}>
            <Card.Title 
              title="Inspection Type"
              left={(props) => <Ionicons {...props} name="clipboard" size={24} color={COLORS.primary} />}
            />
            <Card.Content>
              <RadioButton.Group 
                onValueChange={value => setInspectionType(value)} 
                value={inspectionType}
              >
                {INSPECTION_TYPES.map(type => (
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
                      <Text style={styles.radioLabel}>{type.label}</Text>
                      <Text style={styles.radioDescription}>{type.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </RadioButton.Group>
            </Card.Content>
          </Card>

          {/* Mileage Input */}
          <Card style={styles.card}>
            <Card.Title 
              title="Current Mileage"
              left={(props) => <Ionicons {...props} name="speedometer" size={24} color={COLORS.primary} />}
            />
            <Card.Content>
              <TextInput
                label="Mileage *"
                value={mileage}
                onChangeText={setMileage}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
                placeholder="Enter current mileage"
              />
            </Card.Content>
          </Card>

          {/* Urgent Items */}
          <Card style={styles.card}>
            <Card.Title 
              title="Urgent Items"
              subtitle="Select items that need immediate attention"
              left={(props) => <Ionicons {...props} name="warning" size={24} color={COLORS.warning} />}
            />
            <Card.Content>
              <View style={styles.chipContainer}>
                {commonUrgentItems.map(item => (
                  <Chip
                    key={item}
                    selected={urgentItems.includes(item)}
                    onPress={() => toggleUrgentItem(item)}
                    style={styles.chip}
                    selectedColor={COLORS.primary}
                  >
                    {item}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>

          {/* Notes */}
          <Card style={styles.card}>
            <Card.Title 
              title="Initial Notes"
              subtitle="Add any preliminary observations"
              left={(props) => <Ionicons {...props} name="document-text" size={24} color={COLORS.primary} />}
            />
            <Card.Content>
              <TextInput
                label="Notes (Optional)"
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                multiline
                numberOfLines={4}
                style={styles.input}
                placeholder="Enter any initial observations or customer concerns..."
              />
            </Card.Content>
          </Card>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={[styles.button, styles.cancelButton]}
              disabled={loading}
            >
              Cancel
            </Button>
            
            <Button
              mode="contained"
              onPress={handleCreateInspection}
              style={[styles.button, styles.createButton]}
              loading={loading}
              disabled={loading}
              icon="clipboard-check"
            >
              Create Inspection
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  card: {
    marginBottom: SPACING.md,
    elevation: 2,
  },
  vehicleInfo: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  subInfo: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs / 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border.primary,
    marginVertical: SPACING.md,
  },
  customerLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  customerInfo: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs / 2,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  radioItemSelected: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  radioContent: {
    flex: 1,
    marginLeft: SPACING.xs,
  },
  radioLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  radioDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  input: {
    backgroundColor: COLORS.white,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    marginBottom: SPACING.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  button: {
    flex: 1,
  },
  cancelButton: {
    borderColor: COLORS.text.secondary,
  },
  createButton: {
    backgroundColor: COLORS.success,
  },
});

export default CreateInspectionScreen;