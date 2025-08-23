import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, BORDER_RADIUS, SHADOWS, COMPONENT_SIZES } from '@/constants';

interface CardProps {
  children: ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  padding = 'md',
  style,
}) => {
  const cardStyle = [
    styles.card,
    styles[variant],
    padding !== 'none' && { padding: getPaddingValue(padding) },
    style,
  ];

  return <View style={cardStyle}>{children}</View>;
};

function getPaddingValue(padding: 'sm' | 'md' | 'lg'): number {
  switch (padding) {
    case 'sm':
      return COMPONENT_SIZES.card.padding / 2;
    case 'lg':
      return COMPONENT_SIZES.card.padding * 1.5;
    default:
      return COMPONENT_SIZES.card.padding;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: COMPONENT_SIZES.card.borderRadius,
    backgroundColor: COLORS.white,
  },
  elevated: {
    ...SHADOWS.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  filled: {
    backgroundColor: COLORS.background.secondary,
  },
});

export default Card;