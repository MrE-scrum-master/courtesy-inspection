import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingSpinner, Card, Button } from '@/components';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants';

export const CustomerScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Text style={styles.title}>Customer Management</Text>
          <Text style={styles.subtitle}>
            This screen will provide customer and vehicle management
            capabilities for shop managers and mechanics.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Customer Features:</Text>
          <Text style={styles.feature}>• Search customers by name, phone, email</Text>
          <Text style={styles.feature}>• View customer details and history</Text>
          <Text style={styles.feature}>• Add new customers</Text>
          <Text style={styles.feature}>• Edit customer information</Text>
          <Text style={styles.feature}>• View inspection history</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Vehicle Features:</Text>
          <Text style={styles.feature}>• View customer vehicles</Text>
          <Text style={styles.feature}>• Add new vehicles</Text>
          <Text style={styles.feature}>• VIN lookup and validation</Text>
          <Text style={styles.feature}>• Vehicle history tracking</Text>
          <Text style={styles.feature}>• Service recommendations</Text>
        </Card>

        <View style={styles.actionButtons}>
          <Button
            title="Add Customer"
            variant="primary"
            leftIcon="person-add"
            style={styles.actionButton}
            onPress={() => {
              console.log('Navigate to add customer');
            }}
          />
          <Button
            title="Search Customers"
            variant="outline"
            leftIcon="search"
            style={styles.actionButton}
            onPress={() => {
              console.log('Navigate to customer search');
            }}
          />
        </View>
      </ScrollView>
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
    padding: SPACING.lg,
  },
  card: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  feature: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
  },
});

export default CustomerScreen;