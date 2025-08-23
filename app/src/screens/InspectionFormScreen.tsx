import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CustomerApi, InspectionApi } from '@/services';
import { useAuth } from '@/utils/AuthContext';
import { COLORS as colors, TYPOGRAPHY as typography } from '@/constants/theme';
import type { Customer, Vehicle } from '@/types/common';

interface InspectionFormData {
  customerId: string;
  vehicleId: string;
  inspectionType: string;
  notes: string;
  shopId: string;
}

export default function InspectionFormScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState<InspectionFormData>({
    customerId: '',
    vehicleId: '',
    inspectionType: 'courtesy',
    notes: '',
    shopId: user?.shopId || '',
  });
  
  // Search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
  
  // New vehicle form
  const [newVehicle, setNewVehicle] = useState({
    year: '',
    make: '',
    model: '',
    vin: '',
    licensePlate: '',
  });

  // Search customers
  const { data: customerResults, isLoading: searchingCustomers } = useQuery({
    queryKey: ['customerSearch', customerSearch],
    queryFn: () => CustomerApi.searchCustomers(customerSearch),
    enabled: customerSearch.length >= 2,
  });

  // Get customer's vehicles
  const { data: customerVehicles, refetch: refetchVehicles } = useQuery({
    queryKey: ['customerVehicles', selectedCustomer?.id],
    queryFn: () => CustomerApi.getCustomerVehicles(selectedCustomer!.id),
    enabled: !!selectedCustomer?.id,
  });

  // Create inspection mutation
  const createInspectionMutation = useMutation({
    mutationFn: (data: InspectionFormData) => InspectionApi.createInspection(data),
    onSuccess: (data) => {
      Alert.alert('Success', 'Inspection created successfully', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('InspectionDetails', { id: data.id }),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create inspection');
    },
  });

  // Create vehicle mutation
  const createVehicleMutation = useMutation({
    mutationFn: (data: any) => CustomerApi.createVehicle({
      ...data,
      customerId: selectedCustomer!.id,
    }),
    onSuccess: () => {
      setShowNewVehicleForm(false);
      setNewVehicle({ year: '', make: '', model: '', vin: '', licensePlate: '' });
      refetchVehicles();
      Alert.alert('Success', 'Vehicle added successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to add vehicle');
    },
  });

  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customerId: customer.id }));
    setCustomerSearch(customer.full_name);
    setShowCustomerResults(false);
    setSelectedVehicle(null);
    setFormData(prev => ({ ...prev, vehicleId: '' }));
  };

  // Handle vehicle selection
  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData(prev => ({ ...prev, vehicleId: vehicle.id }));
    setShowVehicleModal(false);
  };

  // Handle form submission
  const handleSubmit = () => {
    // Validation
    if (!formData.customerId) {
      Alert.alert('Validation Error', 'Please select a customer');
      return;
    }
    if (!formData.vehicleId) {
      Alert.alert('Validation Error', 'Please select a vehicle');
      return;
    }
    if (!formData.inspectionType) {
      Alert.alert('Validation Error', 'Please select inspection type');
      return;
    }

    createInspectionMutation.mutate(formData);
  };

  // Handle new vehicle submission
  const handleAddVehicle = () => {
    if (!newVehicle.year || !newVehicle.make || !newVehicle.model) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }
    createVehicleMutation.mutate(newVehicle);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>New Inspection</Text>
        </View>

        {/* Customer Search */}
        <View style={styles.section}>
          <Text style={styles.label}>Customer *</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.input}
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Search by name, phone, or email"
              onFocus={() => setShowCustomerResults(true)}
            />
            {searchingCustomers && (
              <ActivityIndicator style={styles.searchIcon} size="small" color={colors.primary} />
            )}
          </View>
          
          {showCustomerResults && customerResults && customerResults.length > 0 && (
            <View style={styles.searchResults}>
              {customerResults.map((customer: Customer) => (
                <TouchableOpacity
                  key={customer.id}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectCustomer(customer)}
                >
                  <Text style={styles.searchResultName}>{customer.full_name}</Text>
                  <Text style={styles.searchResultDetail}>
                    {customer.phone} • {customer.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Vehicle Selection */}
        {selectedCustomer && (
          <View style={styles.section}>
            <Text style={styles.label}>Vehicle *</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowVehicleModal(true)}
            >
              <Text style={selectedVehicle ? styles.inputText : styles.placeholder}>
                {selectedVehicle
                  ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                  : 'Select or add vehicle'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Inspection Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Inspection Type *</Text>
          <View style={styles.radioGroup}>
            {['courtesy', 'full', 'other'].map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.radioOption}
                onPress={() => setFormData(prev => ({ ...prev, inspectionType: type }))}
              >
                <View style={styles.radio}>
                  {formData.inspectionType === type && (
                    <View style={styles.radioSelected} />
                  )}
                </View>
                <Text style={styles.radioLabel}>
                  {type.charAt(0).toUpperCase() + type.slice(1)} Inspection
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.notes}
            onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
            placeholder="Add any initial notes..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            createInspectionMutation.isPending && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={createInspectionMutation.isPending}
        >
          {createInspectionMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Create Inspection</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Vehicle Selection Modal */}
      <Modal
        visible={showVehicleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVehicleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle</Text>
              <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {!showNewVehicleForm ? (
              <>
                <FlatList
                  data={customerVehicles || []}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.vehicleItem}
                      onPress={() => handleSelectVehicle(item)}
                    >
                      <Text style={styles.vehicleText}>
                        {item.year} {item.make} {item.model}
                      </Text>
                      <Text style={styles.vehicleVin}>VIN: {item.vin || 'N/A'}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No vehicles found</Text>
                  }
                />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowNewVehicleForm(true)}
                >
                  <Ionicons name="add" size={20} color="white" />
                  <Text style={styles.addButtonText}>Add New Vehicle</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.newVehicleForm}>
                <TextInput
                  style={styles.modalInput}
                  value={newVehicle.year}
                  onChangeText={(text) => setNewVehicle(prev => ({ ...prev, year: text }))}
                  placeholder="Year *"
                  keyboardType="numeric"
                  maxLength={4}
                />
                <TextInput
                  style={styles.modalInput}
                  value={newVehicle.make}
                  onChangeText={(text) => setNewVehicle(prev => ({ ...prev, make: text }))}
                  placeholder="Make *"
                />
                <TextInput
                  style={styles.modalInput}
                  value={newVehicle.model}
                  onChangeText={(text) => setNewVehicle(prev => ({ ...prev, model: text }))}
                  placeholder="Model *"
                />
                <TextInput
                  style={styles.modalInput}
                  value={newVehicle.vin}
                  onChangeText={(text) => setNewVehicle(prev => ({ ...prev, vin: text }))}
                  placeholder="VIN (optional)"
                  autoCapitalize="characters"
                />
                <TextInput
                  style={styles.modalInput}
                  value={newVehicle.licensePlate}
                  onChangeText={(text) => setNewVehicle(prev => ({ ...prev, licensePlate: text }))}
                  placeholder="License Plate (optional)"
                  autoCapitalize="characters"
                />
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowNewVehicleForm(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleAddVehicle}
                    disabled={createVehicleMutation.isPending}
                  >
                    {createVehicleMutation.isPending ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.saveButtonText}>Add Vehicle</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  section: {
    padding: 16,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    color: colors.text.primary,
    fontSize: 16,
  },
  placeholder: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  searchContainer: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  searchResults: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchResultName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  searchResultDetail: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    margin: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  vehicleItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  vehicleText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  vehicleVin: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 4,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    padding: 32,
  },
  addButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  addButtonText: {
    ...typography.bodyBold,
    color: 'white',
    marginLeft: 8,
  },
  newVehicleForm: {
    padding: 16,
  },
  modalInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    ...typography.bodyBold,
    color: 'white',
  },
});