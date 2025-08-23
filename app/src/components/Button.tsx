import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, COMPONENT_SIZES } from '@/constants';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  ...props
}) => {
  const isDisabled = disabled || loading;
  const sizeStyle = COMPONENT_SIZES.button[size];

  const buttonStyle: ViewStyle[] = [
    styles.button,
    sizeStyle,
    styles[variant],
    ...(fullWidth ? [styles.fullWidth] : []),
    ...(isDisabled ? [styles.disabled] : []),
    ...(isDisabled ? [styles[`${variant}Disabled` as keyof typeof styles]] : []),
    ...(style ? [style] : []),
  ].filter(Boolean);

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`${variant}Text`],
    isDisabled && styles.disabledText,
    isDisabled && styles[`${variant}DisabledText`],
  ];

  const iconColor = getIconColor(variant, isDisabled);
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;

  return (
    <TouchableOpacity
      style={buttonStyle}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={iconColor}
          style={styles.loadingIndicator}
        />
      )}
      
      {!loading && leftIcon && (
        <Ionicons
          name={leftIcon}
          size={iconSize}
          color={iconColor}
          style={styles.leftIcon}
        />
      )}
      
      <Text style={textStyle}>{title}</Text>
      
      {!loading && rightIcon && (
        <Ionicons
          name={rightIcon}
          size={iconSize}
          color={iconColor}
          style={styles.rightIcon}
        />
      )}
    </TouchableOpacity>
  );
};

function getIconColor(variant: string, isDisabled: boolean): string {
  if (isDisabled) {
    switch (variant) {
      case 'primary':
      case 'danger':
        return COLORS.white;
      case 'secondary':
      case 'outline':
      case 'ghost':
        return COLORS.text.tertiary;
      default:
        return COLORS.text.tertiary;
    }
  }

  switch (variant) {
    case 'primary':
    case 'danger':
      return COLORS.white;
    case 'secondary':
      return COLORS.text.primary;
    case 'outline':
      return COLORS.primary;
    case 'ghost':
      return COLORS.primary;
    default:
      return COLORS.white;
  }
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: SPACING.xs,
  },
  rightIcon: {
    marginLeft: SPACING.xs,
  },
  loadingIndicator: {
    marginRight: SPACING.xs,
  },
  
  // Variants
  primary: {
    backgroundColor: COLORS.primary,
  },
  primaryText: {
    color: COLORS.white,
  },
  
  secondary: {
    backgroundColor: COLORS.gray[100],
  },
  secondaryText: {
    color: COLORS.text.primary,
  },
  
  outline: {
    backgroundColor: 'transparent',
    borderColor: COLORS.primary,
  },
  outlineText: {
    color: COLORS.primary,
  },
  
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: COLORS.primary,
  },
  
  danger: {
    backgroundColor: COLORS.error,
  },
  dangerText: {
    color: COLORS.white,
  },
  
  // Disabled states
  disabled: {
    opacity: 0.6,
  },
  disabledText: {
    // Base disabled text style
  },
  
  primaryDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  primaryDisabledText: {
    color: COLORS.white,
  },
  
  secondaryDisabled: {
    backgroundColor: COLORS.gray[100],
  },
  secondaryDisabledText: {
    color: COLORS.text.tertiary,
  },
  
  outlineDisabled: {
    borderColor: COLORS.gray[300],
  },
  outlineDisabledText: {
    color: COLORS.text.tertiary,
  },
  
  ghostDisabled: {
    backgroundColor: 'transparent',
  },
  ghostDisabledText: {
    color: COLORS.text.tertiary,
  },
  
  dangerDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  dangerDisabledText: {
    color: COLORS.white,
  },
});

export default Button;