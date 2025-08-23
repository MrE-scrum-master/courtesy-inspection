// StatusBadge Component - Color-coded urgency and status indicators
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/theme';

export type StatusType = 
  | 'good' 
  | 'fair' 
  | 'poor' 
  | 'needs_attention'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'in_progress'
  | 'draft'
  | 'sent'
  | 'archived'
  | 'active'
  | 'inactive'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent'
  | 'critical';

export type StatusSize = 'xs' | 'sm' | 'md' | 'lg';
export type StatusVariant = 'filled' | 'outlined' | 'subtle';

export interface StatusBadgeProps {
  status: StatusType;
  size?: StatusSize;
  variant?: StatusVariant;
  label?: string;
  showIcon?: boolean;
  customIcon?: string;
  customColor?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  animated?: boolean;
  pulsing?: boolean;
  testID?: string;
}

// Status configuration mapping
const statusConfig: Record<StatusType, {
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon: string;
  label: string;
}> = {
  // Inspection statuses
  good: {
    color: COLORS.success,
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
    icon: 'checkmark-circle',
    label: 'Good',
  },
  fair: {
    color: COLORS.warning,
    backgroundColor: COLORS.warning + '20',
    borderColor: COLORS.warning,
    icon: 'alert-circle',
    label: 'Fair',
  },
  poor: {
    color: COLORS.error,
    backgroundColor: COLORS.error + '20',
    borderColor: COLORS.error,
    icon: 'close-circle',
    label: 'Poor',
  },
  needs_attention: {
    color: '#FF6B35',
    backgroundColor: '#FF6B35' + '20',
    borderColor: '#FF6B35',
    icon: 'warning',
    label: 'Needs Attention',
  },
  
  // Process statuses
  pending: {
    color: COLORS.warning,
    backgroundColor: COLORS.warning + '20',
    borderColor: COLORS.warning,
    icon: 'time',
    label: 'Pending',
  },
  approved: {
    color: COLORS.success,
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
    icon: 'checkmark-circle',
    label: 'Approved',
  },
  rejected: {
    color: COLORS.error,
    backgroundColor: COLORS.error + '20',
    borderColor: COLORS.error,
    icon: 'close-circle',
    label: 'Rejected',
  },
  completed: {
    color: COLORS.success,
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
    icon: 'checkmark-done',
    label: 'Completed',
  },
  in_progress: {
    color: COLORS.info,
    backgroundColor: COLORS.info + '20',
    borderColor: COLORS.info,
    icon: 'refresh',
    label: 'In Progress',
  },
  draft: {
    color: COLORS.gray[500],
    backgroundColor: COLORS.gray[500] + '20',
    borderColor: COLORS.gray[500],
    icon: 'document-outline',
    label: 'Draft',
  },
  sent: {
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
    icon: 'send',
    label: 'Sent',
  },
  archived: {
    color: COLORS.gray[400],
    backgroundColor: COLORS.gray[400] + '20',
    borderColor: COLORS.gray[400],
    icon: 'archive',
    label: 'Archived',
  },
  
  // General statuses
  active: {
    color: COLORS.success,
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
    icon: 'radio-button-on',
    label: 'Active',
  },
  inactive: {
    color: COLORS.gray[500],
    backgroundColor: COLORS.gray[500] + '20',
    borderColor: COLORS.gray[500],
    icon: 'radio-button-off',
    label: 'Inactive',
  },
  
  // Semantic statuses
  success: {
    color: COLORS.success,
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
    icon: 'checkmark-circle',
    label: 'Success',
  },
  warning: {
    color: COLORS.warning,
    backgroundColor: COLORS.warning + '20',
    borderColor: COLORS.warning,
    icon: 'warning',
    label: 'Warning',
  },
  error: {
    color: COLORS.error,
    backgroundColor: COLORS.error + '20',
    borderColor: COLORS.error,
    icon: 'alert-circle',
    label: 'Error',
  },
  info: {
    color: COLORS.info,
    backgroundColor: COLORS.info + '20',
    borderColor: COLORS.info,
    icon: 'information-circle',
    label: 'Info',
  },
  
  // Priority levels
  low: {
    color: COLORS.success,
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
    icon: 'chevron-down',
    label: 'Low',
  },
  medium: {
    color: COLORS.warning,
    backgroundColor: COLORS.warning + '20',
    borderColor: COLORS.warning,
    icon: 'remove',
    label: 'Medium',
  },
  high: {
    color: COLORS.error,
    backgroundColor: COLORS.error + '20',
    borderColor: COLORS.error,
    icon: 'chevron-up',
    label: 'High',
  },
  urgent: {
    color: '#FF3B30',
    backgroundColor: '#FF3B30' + '20',
    borderColor: '#FF3B30',
    icon: 'flash',
    label: 'Urgent',
  },
  critical: {
    color: '#8B0000',
    backgroundColor: '#8B0000' + '20',
    borderColor: '#8B0000',
    icon: 'alert',
    label: 'Critical',
  },
};

// Size configuration
const sizeConfig: Record<StatusSize, {
  paddingHorizontal: number;
  paddingVertical: number;
  fontSize: number;
  iconSize: number;
  borderRadius: number;
  minHeight: number;
}> = {
  xs: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    iconSize: 12,
    borderRadius: 6,
    minHeight: 18,
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: TYPOGRAPHY.fontSize.sm,
    iconSize: 14,
    borderRadius: 8,
    minHeight: 24,
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: TYPOGRAPHY.fontSize.sm,
    iconSize: 16,
    borderRadius: 10,
    minHeight: 30,
  },
  lg: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: TYPOGRAPHY.fontSize.base,
    iconSize: 18,
    borderRadius: 12,
    minHeight: 36,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  variant = 'filled',
  label,
  showIcon = true,
  customIcon,
  customColor,
  style,
  textStyle,
  animated = false,
  pulsing = false,
  testID,
}) => {
  const config = statusConfig[status];
  const sizeStyle = sizeConfig[size];
  
  if (!config) {
    console.warn(`StatusBadge: Unknown status "${status}"`);
    return null;
  }
  
  // Use custom color if provided
  const colors = customColor ? {
    color: customColor,
    backgroundColor: customColor + '20',
    borderColor: customColor,
  } : {
    color: config.color,
    backgroundColor: config.backgroundColor,
    borderColor: config.borderColor,
  };
  
  // Generate styles based on variant
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: colors.color,
          borderColor: colors.color,
          borderWidth: 1,
        };
      
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.color,
          borderWidth: 1,
        };
      
      case 'subtle':
        return {
          backgroundColor: colors.backgroundColor,
          borderColor: 'transparent',
          borderWidth: 1,
        };
      
      default:
        return {};
    }
  };
  
  // Generate text styles based on variant
  const getTextStyles = (): TextStyle => {
    const baseTextColor = variant === 'filled' ? COLORS.white : colors.color;
    
    return {
      color: baseTextColor,
      fontSize: sizeStyle.fontSize,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
    };
  };
  
  // Get display label
  const displayLabel = label || config.label;
  
  // Get icon name
  const iconName = customIcon || config.icon;
  
  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
          borderRadius: sizeStyle.borderRadius,
          minHeight: sizeStyle.minHeight,
        },
        getVariantStyles(),
        pulsing && styles.pulsing,
        style,
      ]}
      testID={testID || `status-badge-${status}`}
    >
      <View style={styles.content}>
        {showIcon && (
          <Ionicons
            name={iconName as any}
            size={sizeStyle.iconSize}
            color={variant === 'filled' ? COLORS.white : colors.color}
            style={[
              styles.icon,
              displayLabel && { marginRight: sizeStyle.paddingHorizontal / 2 }
            ]}
          />
        )}
        
        {displayLabel && (
          <Text
            style={[getTextStyles(), textStyle]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayLabel}
          </Text>
        )}
      </View>
    </View>
  );
};

// Specialized status badge components for common use cases

export const InspectionStatusBadge: React.FC<{
  status: 'good' | 'fair' | 'poor' | 'needs_attention';
  size?: StatusSize;
  variant?: StatusVariant;
  style?: ViewStyle;
}> = ({ status, size = 'sm', variant = 'filled', style }) => (
  <StatusBadge
    status={status}
    size={size}
    variant={variant}
    style={style}
    testID={`inspection-status-${status}`}
  />
);

export const PriorityBadge: React.FC<{
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  size?: StatusSize;
  variant?: StatusVariant;
  style?: ViewStyle;
  pulsing?: boolean;
}> = ({ priority, size = 'sm', variant = 'filled', style, pulsing }) => (
  <StatusBadge
    status={priority}
    size={size}
    variant={variant}
    style={style}
    pulsing={pulsing && (priority === 'urgent' || priority === 'critical')}
    testID={`priority-badge-${priority}`}
  />
);

export const ProcessStatusBadge: React.FC<{
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'in_progress' | 'draft';
  size?: StatusSize;
  variant?: StatusVariant;
  style?: ViewStyle;
}> = ({ status, size = 'sm', variant = 'filled', style }) => (
  <StatusBadge
    status={status}
    size={size}
    variant={variant}
    style={style}
    animated={status === 'in_progress'}
    testID={`process-status-${status}`}
  />
);

export const CustomStatusBadge: React.FC<{
  label: string;
  color: string;
  icon?: string;
  size?: StatusSize;
  variant?: StatusVariant;
  style?: ViewStyle;
  showIcon?: boolean;
}> = ({ label, color, icon, size = 'sm', variant = 'filled', style, showIcon = true }) => (
  <StatusBadge
    status="info" // Use info as base, will be overridden by custom props
    label={label}
    customColor={color}
    customIcon={icon}
    size={size}
    variant={variant}
    style={style}
    showIcon={showIcon}
    testID={`custom-status-${label.toLowerCase().replace(/\s+/g, '-')}`}
  />
);

// Utility function to get status configuration
export const getStatusConfig = (status: StatusType) => {
  return statusConfig[status];
};

// Utility function to determine appropriate status badge variant based on context
export const getRecommendedVariant = (
  context: 'list' | 'detail' | 'dashboard' | 'notification'
): StatusVariant => {
  switch (context) {
    case 'list':
      return 'subtle';
    case 'detail':
      return 'filled';
    case 'dashboard':
      return 'outlined';
    case 'notification':
      return 'filled';
    default:
      return 'filled';
  }
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    // Icon-specific styles if needed
  },
  pulsing: {
    // Animation for pulsing effect
    // This would be implemented with Animated API or react-native-reanimated
  },
});