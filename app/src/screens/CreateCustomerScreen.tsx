import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { TextInput, Button, Appbar, Card } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiClient as ApiClient } from '@/services';
import { useAuthContext as useAuth } from '@/utils';

interface RouteParams {
  vehicleId?: number;
  vehicleInfo?: string;
  returnTo?: string;
  onCustomerCreated?: (customerId: number) => void;
}

const CreateCustomerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams || {};
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [customerData, setCustomerData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
  });

  const handleSave = async () => {
    // Validate required fields
    if (!customerData.first_name || !customerData.last_name || !customerData.phone) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    // Basic phone validation
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    if (!phoneRegex.test(customerData.phone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    // Basic email validation if provided
    if (customerData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerData.email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return;
      }
    }

    setLoading(true);
    try {
      // Create the customer
      const response = await ApiClient.post('/customers', {
        ...customerData,
        shop_id: user?.shopId,
      });
      
      const createdCustomer = response.data.data || response.data;
      console.log('Customer created:', createdCustomer);
      
      // If we have a vehicle to associate, do it now
      if (params.vehicleId) {
        try {
          await ApiClient.patch(`/vehicles/${params.vehicleId}/customer`, {
            customer_id: createdCustomer.id,
          });
          console.log('Vehicle associated with customer successfully');
          
          // Success - vehicle and customer are now linked
          Alert.alert(
            'Success!',
            `Customer created and linked to ${params.vehicleInfo || 'vehicle'}`,
            [
              {
                text: 'Start Inspection',
                onPress: async () => {
                  // Get the updated vehicle data
                  try {
                    const vehicleResponse = await ApiClient.get(`/vehicles/${params.vehicleId}`);
                    const vehicle = vehicleResponse.data.data || vehicleResponse.data;
                    
                    // Navigate to create inspection with the vehicle and customer
                    (navigation as any).navigate('CreateInspection', {
                      vehicle: vehicle,
                      customer: {
                        id: createdCustomer.id,
                        first_name: createdCustomer.first_name,
                        last_name: createdCustomer.last_name,
                        phone: createdCustomer.phone,
                        email: createdCustomer.email,
                      }
                    });
                  } catch (error) {
                    console.error('Failed to get vehicle data:', error);
                    navigation.goBack();
                  }
                }
              },
              {
                text: 'Go Back',
                onPress: () => {
                  // Navigate back to the return screen if specified
                  if (params.returnTo === 'VINScanner') {
                    (navigation as any).navigate('VINScanner');
                  } else {
                    navigation.goBack();
                  }
                }
              }
            ]
          );
        } catch (error) {
          console.error('Failed to associate vehicle:', error);
          Alert.alert(
            'Customer Created',
            'Customer was created but failed to link to vehicle. You can link them manually.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } else {
        // No vehicle to associate, just show success
        Alert.alert(
          'Customer Created',
          `${customerData.first_name} ${customerData.last_name} has been added successfully.`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (params.onCustomerCreated) {
                  params.onCustomerCreated(createdCustomer.id);
                }
                navigation.goBack();
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Create customer error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to create customer. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Create Customer" />
      </Appbar.Header>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {params.vehicleInfo && (
            <Card style={styles.vehicleCard}>
              <Card.Content>
                <Text style={styles.vehicleLabel}>Creating customer for:</Text>
                <Text style={styles.vehicleText}>{params.vehicleInfo}</Text>
              </Card.Content>
            </Card>
          )}

          <Card style={styles.formCard}>
            <Card.Content>
              <TextInput
                label="First Name *"
                value={customerData.first_name}
                onChangeText={(text) => setCustomerData({...customerData, first_name: text})}
                style={styles.input}
                mode="outlined"
                autoCapitalize="words"
              />

              <TextInput
                label="Last Name *"
                value={customerData.last_name}
                onChangeText={(text) => setCustomerData({...customerData, last_name: text})}
                style={styles.input}
                mode="outlined"
                autoCapitalize="words"
              />

              <TextInput
                label="Phone Number *"
                value={customerData.phone}
                onChangeText={(text) => setCustomerData({...customerData, phone: text})}
                style={styles.input}
                mode="outlined"
                keyboardType="phone-pad"
                placeholder="555-555-5555"
              />

              <TextInput
                label="Email (Optional)"
                value={customerData.email}
                onChangeText={(text) => setCustomerData({...customerData, email: text})}
                style={styles.input}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.requiredNote}>* Required fields</Text>
            </Card.Content>
          </Card>

          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={styles.button}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={[styles.button, styles.saveButton]}
              loading={loading}
              disabled={loading}
              icon="account-plus"
            >
              Create Customer
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  vehicleCard: {
    marginBottom: 16,
    backgroundColor: '#e3f2fd',
  },
  vehicleLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  vehicleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  formCard: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  requiredNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  button: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#4caf50',
  },
});

export default CreateCustomerScreen;