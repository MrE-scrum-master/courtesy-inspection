import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingSpinner, Card, Button } from '@/components';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants';

export const CreateInspectionScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Text style={styles.title}>Create New Inspection</Text>
          <Text style={styles.subtitle}>
            This screen will allow mechanics to create new inspections
            by selecting customers, vehicles, and inspection templates.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Workflow:</Text>
          <Text style={styles.step}>1. Select customer (search/browse)</Text>
          <Text style={styles.step}>2. Select or add vehicle</Text>
          <Text style={styles.step}>3. Choose inspection type</Text>
          <Text style={styles.step}>4. Load inspection template</Text>
          <Text style={styles.step}>5. Begin inspection process</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Features:</Text>
          <Text style={styles.feature}>• Customer search and selection</Text>
          <Text style={styles.feature}>• Vehicle management</Text>
          <Text style={styles.feature}>• Inspection template library</Text>
          <Text style={styles.feature}>• Voice input for notes</Text>
          <Text style={styles.feature}>• Photo capture integration</Text>
          <Text style={styles.feature}>• Real-time auto-save</Text>
        </Card>

        <Button
          title="Start Mock Inspection"
          variant="primary"
          fullWidth
          onPress={() => {
            console.log('Navigate to inspection form');
          }}
        />
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
  step: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  feature: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
});

export default CreateInspectionScreen;