import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, COMPONENT_SIZES } from '@/constants';

interface FormInputProps extends TextInputProps {
  label?: string;
  error?: string | undefined;
  required?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outlined' | 'filled';
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  required = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  size = 'md',
  variant = 'outlined',
  secureTextEntry,
  style,
  ...props
}) => {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  const sizeStyle = COMPONENT_SIZES.input[size];
  const hasError = !!error;

  const containerStyle = [
    styles.container,
    variant === 'filled' && styles.filledContainer,
    sizeStyle,
    isFocused && styles.focusedContainer,
    hasError && styles.errorContainer,
  ];

  const inputStyle = [
    styles.input,
    leftIcon && styles.inputWithLeftIcon,
    (rightIcon || secureTextEntry) && styles.inputWithRightIcon,
    style,
  ];

  const handleToggleSecure = () => {
    setIsSecure(!isSecure);
  };

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      
      <View style={containerStyle}>
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={hasError ? COLORS.error : COLORS.text.secondary}
            style={styles.leftIcon}
          />
        )}
        
        <TextInput
          style={inputStyle}
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor={COLORS.text.tertiary}
          {...props}
        />
        
        {secureTextEntry && (
          <TouchableOpacity onPress={handleToggleSecure} style={styles.rightIcon}>
            <Ionicons
              name={isSecure ? 'eye-off' : 'eye'}
              size={20}
              color={COLORS.text.secondary}
            />
          </TouchableOpacity>
        )}
        
        {rightIcon && !secureTextEntry && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <Ionicons
              name={rightIcon}
              size={20}
              color={hasError ? COLORS.error : COLORS.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  required: {
    color: COLORS.error,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
  },
  filledContainer: {
    backgroundColor: COLORS.background.secondary,
    borderColor: 'transparent',
  },
  focusedContainer: {
    borderColor: COLORS.border.focus,
    borderWidth: 2,
  },
  errorContainer: {
    borderColor: COLORS.error,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    paddingVertical: 0, // Remove default padding
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  leftIcon: {
    marginLeft: SPACING.sm,
    marginRight: SPACING.xs,
  },
  rightIcon: {
    padding: SPACING.sm,
    marginRight: SPACING.xs,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
});

export default FormInput;