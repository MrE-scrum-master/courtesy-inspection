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
import { TextInput, Button, Appbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiClient as ApiClient } from '@/services';
import { useAuthContext as useAuth } from '@/utils';

interface RouteParams {
  vehicleId?: number;
  vehicleInfo?: string;
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

    setLoading(true);
    try {
      // TODO: Implement actual API call
      // const response = await ApiClient.post('/customers', {
      //   ...customerData,
      //   shop_id: user?.shop_id,
      // });
      
      // For now, just simulate success
      Alert.alert(
        'Customer Created',
        `${customerData.first_name} ${customerData.last_name} has been added.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // If we have a vehicle to associate, do it
              if (params.vehicleId) {
                // TODO: Associate vehicle with customer
                console.log('Would associate vehicle', params.vehicleId, 'with new customer');
              }
              
              // Navigate back or to inspection
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create customer. Please try again.');
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
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleText}>For Vehicle: {params.vehicleInfo}</Text>
            </View>
          )}

          <TextInput
            label="First Name *"
            value={customerData.first_name}
            onChangeText={(text) => setCustomerData({...customerData, first_name: text})}
            style={styles.input}
            mode="outlined"
          />

          <TextInput
            label="Last Name *"
            value={customerData.last_name}
            onChangeText={(text) => setCustomerData({...customerData, last_name: text})}
            style={styles.input}
            mode="outlined"
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
          />

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
              style={styles.button}
              loading={loading}
              disabled={loading}
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
  vehicleInfo: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  vehicleText: {
    fontSize: 14,
    color: '#1976d2',
  },
  input: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 32,
  },
  button: {
    flex: 0.48,
  },
});

export default CreateCustomerScreen;