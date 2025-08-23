import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingSpinner, Card } from '@/components';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants';

export const InspectionDetailScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Text style={styles.title}>Inspection Detail</Text>
          <Text style={styles.subtitle}>
            This screen will show detailed inspection information,
            including inspection items, photos, voice notes, and
            customer/vehicle details.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Features to implement:</Text>
          <Text style={styles.feature}>• Inspection item list with status</Text>
          <Text style={styles.feature}>• Photo gallery for each item</Text>
          <Text style={styles.feature}>• Voice note playback</Text>
          <Text style={styles.feature}>• Edit inspection items</Text>
          <Text style={styles.feature}>• Send report to customer</Text>
          <Text style={styles.feature}>• Export PDF report</Text>
        </Card>
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
});

export default InspectionDetailScreen;