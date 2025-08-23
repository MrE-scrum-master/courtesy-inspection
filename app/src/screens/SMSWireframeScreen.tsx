import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@/constants';
import { SMSPreview, SMSHistory } from '@/components';

interface SMSWireframeScreenProps {
  navigation: any;
}

export const SMSWireframeScreen: React.FC<SMSWireframeScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');
  const [selectedTemplate, setSelectedTemplate] = useState('inspection_complete');

  // Mock data for demonstration
  const mockInspectionData = {
    customer_name: 'John Doe',
    vehicle: '2020 Honda Accord',
    shop_name: 'Main Street Auto',
    shop_phone: '(555) 123-4567',
    link: 'https://app.courtesyinspection.com/portal/abc123',
    customer_id: 1,
    service: 'brake replacement',
    price: '450'
  };

  const templates = [
    { 
      id: 'inspection_complete', 
      name: 'Inspection Complete',
      description: 'Notify customer when inspection is finished'
    },
    { 
      id: 'urgent_issue', 
      name: 'Urgent Issue Found',
      description: 'Alert customer of critical safety issues'
    },
    { 
      id: 'approval_request', 
      name: 'Service Approval',
      description: 'Request approval for recommended services'
    },
    { 
      id: 'service_reminder', 
      name: 'Service Reminder',
      description: 'Remind customer of upcoming maintenance'
    }
  ];

  const renderTemplateSelector = () => (
    <View style={styles.templateSelector}>
      <Text style={styles.sectionTitle}>Select Message Template</Text>
      {templates.map((template) => (
        <TouchableOpacity
          key={template.id}
          style={[
            styles.templateOption,
            selectedTemplate === template.id && styles.selectedTemplate
          ]}
          onPress={() => setSelectedTemplate(template.id)}
        >
          <View style={styles.templateContent}>
            <Text style={[
              styles.templateName,
              selectedTemplate === template.id && styles.selectedTemplateName
            ]}>
              {template.name}
            </Text>
            <Text style={styles.templateDescription}>
              {template.description}
            </Text>
          </View>
          {selectedTemplate === template.id && (
            <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTabContent = () => {
    if (activeTab === 'preview') {
      return (
        <View style={styles.tabContent}>
          {renderTemplateSelector()}
          <SMSPreview
            template={selectedTemplate}
            data={mockInspectionData}
            recipientPhone="(555) 123-4567"
            inspectionId={123}
            onSend={(result) => {
              Alert.alert(
                'Mock SMS Sent!',
                `Message sent to ${result.to}\nCost: ${result.costFormatted}\nMessage ID: ${result.messageId}`,
                [{ text: 'OK' }]
              );
            }}
          />
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <SMSHistory
          inspectionId={123}
          onMessagePress={(message) => {
            Alert.alert(
              'Message Details',
              `Status: ${message.status}\nSent: ${new Date(message.sent_at).toLocaleString()}\nCost: ${message.costFormatted}\n\nMessage:\n${message.message}`,
              [{ text: 'OK' }]
            );
          }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SMS Wireframe Demo</Text>
        <View style={styles.headerRight}>
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>DEMO</Text>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'preview' && styles.activeTab]}
          onPress={() => setActiveTab('preview')}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={activeTab === 'preview' ? COLORS.primary : COLORS.text.secondary} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'preview' && styles.activeTabText
          ]}>
            Send SMS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons 
            name="time" 
            size={20} 
            color={activeTab === 'history' ? COLORS.primary : COLORS.text.secondary} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'history' && styles.activeTabText
          ]}>
            Message History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
      </ScrollView>

      {/* Demo Info Footer */}
      <View style={styles.demoInfo}>
        <Ionicons name="information-circle" size={16} color={COLORS.primary} />
        <Text style={styles.demoInfoText}>
          This is a wireframe demonstration. No actual SMS messages are sent.
          All costs and delivery statuses are simulated for stakeholder preview.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  headerRight: {
    width: 24, // Same as back arrow for balance
    alignItems: 'flex-end',
  },
  demoBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  demoBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  tabNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  templateSelector: {
    backgroundColor: COLORS.white,
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    marginBottom: SPACING.sm,
  },
  selectedTemplate: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  selectedTemplateName: {
    color: COLORS.primary,
  },
  templateDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  demoInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  demoInfoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
    flex: 1,
    lineHeight: 18,
  },
});

export default SMSWireframeScreen;