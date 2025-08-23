import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@/constants';

interface SMSPreviewProps {
  template: string;
  data: Record<string, any>;
  recipientPhone?: string;
  inspectionId?: number;
  onSend?: (result: any) => void;
  disabled?: boolean;
}

interface MessagePreview {
  message: string;
  length: number;
  segments: number;
  cost: number;
  costFormatted: string;
  type: string;
}

export const SMSPreview: React.FC<SMSPreviewProps> = ({
  template,
  data,
  recipientPhone = '',
  inspectionId,
  onSend,
  disabled = false
}) => {
  const [preview, setPreview] = useState<MessagePreview | null>(null);
  const [phone, setPhone] = useState(recipientPhone);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (template && data) {
      generatePreview();
    }
  }, [template, data]);

  const generatePreview = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/sms/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template, data })
      });

      if (response.ok) {
        const result = await response.json();
        setPreview(result.data);
      } else {
        console.error('Preview generation failed');
      }
    } catch (error) {
      console.error('Preview error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!phone || !preview) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^\+?1?[2-9]\d{2}[2-9]\d{2}\d{4}$/;
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (!phoneRegex.test(cleanPhone) && !phoneRegex.test(phone)) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    Alert.alert(
      'Send SMS',
      `Send message to ${phone}?\n\nCost: ${preview.costFormatted}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: sendSMS }
      ]
    );
  };

  const sendSMS = async () => {
    try {
      setSending(true);
      
      const response = await fetch('/api/sms/send-mock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${/* get token from storage */''}`
        },
        body: JSON.stringify({
          template,
          data,
          to_phone: phone,
          inspection_id: inspectionId
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        Alert.alert(
          'SMS Sent!',
          `Message sent successfully to ${phone}\nCost: ${result.data.costFormatted}`,
          [{ text: 'OK' }]
        );
        onSend?.(result.data);
      } else {
        Alert.alert('Error', result.error || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('Send SMS error:', error);
      Alert.alert('Error', 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    if (formatted.length <= 14) { // Max length for (xxx) xxx-xxxx
      setPhone(formatted);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Generating preview...</Text>
        </View>
      </View>
    );
  }

  if (!preview) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Unable to generate message preview</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SMS Preview</Text>
      
      {/* Message Preview */}
      <View style={styles.messageContainer}>
        <View style={styles.phoneFrame}>
          <View style={styles.messageHeader}>
            <Text style={styles.fromNumber}>+1 (555) 551-234</Text>
            <Text style={styles.timestamp}>now</Text>
          </View>
          <View style={styles.messageBubble}>
            <Text style={styles.messageText}>{preview.message}</Text>
          </View>
        </View>
      </View>

      {/* Message Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Length</Text>
          <Text style={styles.statValue}>{preview.length}/160</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Segments</Text>
          <Text style={styles.statValue}>{preview.segments}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Cost</Text>
          <Text style={[
            styles.statValue,
            preview.cost > 0.01 ? styles.highCost : styles.normalCost
          ]}>
            {preview.costFormatted}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Type</Text>
          <Text style={[
            styles.statValue,
            styles.typeText,
            preview.type === 'urgent' && styles.urgentType
          ]}>
            {preview.type}
          </Text>
        </View>
      </View>

      {/* Recipient Phone Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Send to:</Text>
        <TextInput
          style={styles.phoneInput}
          placeholder="(555) 123-4567"
          value={phone}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          editable={!disabled && !sending}
          maxLength={14}
        />
      </View>

      {/* Send Button */}
      <TouchableOpacity
        style={[
          styles.sendButton,
          (disabled || !phone || sending) && styles.disabledButton
        ]}
        onPress={handleSend}
        disabled={disabled || !phone || sending}
      >
        <Ionicons 
          name={sending ? "hourglass" : "send"} 
          size={20} 
          color={COLORS.white} 
          style={styles.sendIcon}
        />
        <Text style={styles.sendButtonText}>
          {sending ? 'Sending...' : `Send SMS (${preview.costFormatted})`}
        </Text>
      </TouchableOpacity>

      {/* Message Type Warning */}
      {preview.type === 'urgent' && (
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={16} color={COLORS.warning} />
          <Text style={styles.warningText}>
            This is an urgent message and will be sent immediately
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    margin: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.error,
    textAlign: 'center',
    padding: SPACING.lg,
  },
  messageContainer: {
    marginBottom: SPACING.lg,
  },
  phoneFrame: {
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  fromNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
  },
  messageBubble: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  messageText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.white,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.gray[200],
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  normalCost: {
    color: COLORS.success,
  },
  highCost: {
    color: COLORS.warning,
  },
  typeText: {
    textTransform: 'capitalize',
  },
  urgentType: {
    color: COLORS.error,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    backgroundColor: COLORS.white,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  disabledButton: {
    backgroundColor: COLORS.gray[400],
  },
  sendIcon: {
    marginRight: SPACING.sm,
  },
  sendButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  warningText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
});

export default SMSPreview;