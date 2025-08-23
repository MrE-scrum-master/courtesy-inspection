// Responsive utilities for iPad optimization and adaptive layouts
import { Dimensions, Platform } from 'react-native';

// Device type detection
export interface DeviceInfo {
  width: number;
  height: number;
  isTablet: boolean;
  isPhone: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  platform: 'ios' | 'android' | 'web';
}

export function getDeviceInfo(): DeviceInfo {
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 768;
  
  return {
    width,
    height,
    isTablet,
    isPhone: !isTablet,
    isLandscape,
    isPortrait: !isLandscape,
    platform: Platform.OS as 'ios' | 'android' | 'web',
  };
}

// Responsive breakpoints
export const BREAKPOINTS = {
  sm: 320,   // Small phones
  md: 480,   // Large phones
  lg: 768,   // Tablets portrait
  xl: 1024,  // Tablets landscape
  '2xl': 1440, // Desktop
} as const;

export function getBreakpoint(width: number): keyof typeof BREAKPOINTS {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  return 'sm';
}

// Responsive values helper
export function responsiveValue<T>(values: {
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}): T | undefined {
  const { width } = getDeviceInfo();
  const breakpoint = getBreakpoint(width);
  
  // Return the value for current breakpoint or fall back to smaller ones
  return values[breakpoint] ?? 
         values.xl ?? 
         values.lg ?? 
         values.md ?? 
         values.sm;
}

// Split view layout calculator
export interface SplitViewLayout {
  leftWidth: number;
  rightWidth: number;
  showSplitView: boolean;
  leftMinWidth: number;
  rightMinWidth: number;
}

export function calculateSplitViewLayout(
  totalWidth: number,
  leftPercentage: number = 30,
  minLeftWidth: number = 280,
  minRightWidth: number = 400
): SplitViewLayout {
  const leftWidth = Math.max(minLeftWidth, (totalWidth * leftPercentage) / 100);
  const rightWidth = totalWidth - leftWidth;
  const showSplitView = totalWidth >= minLeftWidth + minRightWidth;
  
  return {
    leftWidth: showSplitView ? leftWidth : totalWidth,
    rightWidth: showSplitView ? rightWidth : totalWidth,
    showSplitView,
    leftMinWidth: minLeftWidth,
    rightMinWidth: minRightWidth,
  };
}

// Touch target sizing for accessibility
export function getTouchTargetSize(size: 'sm' | 'md' | 'lg' = 'md') {
  const { isTablet } = getDeviceInfo();
  
  const sizes = {
    sm: isTablet ? 40 : 36,
    md: isTablet ? 48 : 44,
    lg: isTablet ? 56 : 52,
  };
  
  return sizes[size];
}

// Responsive spacing
export function getResponsiveSpacing(baseSpacing: number): number {
  const { isTablet } = getDeviceInfo();
  return isTablet ? baseSpacing * 1.25 : baseSpacing;
}

// Responsive font size
export function getResponsiveFontSize(baseFontSize: number): number {
  const { isTablet, width } = getDeviceInfo();
  
  if (isTablet) {
    // Scale font size based on screen width for tablets
    const scaleFactor = Math.min(width / 768, 1.2);
    return baseFontSize * scaleFactor;
  }
  
  return baseFontSize;
}

// Grid column calculator
export function getGridColumns(containerWidth: number, itemMinWidth: number = 280): number {
  return Math.max(1, Math.floor(containerWidth / itemMinWidth));
}

// Adaptive navigation type
export type NavigationType = 'tabs' | 'drawer' | 'stack';

export function getNavigationType(): NavigationType {
  const { isTablet, isLandscape } = getDeviceInfo();
  
  if (isTablet && isLandscape) {
    return 'drawer';
  } else if (isTablet) {
    return 'tabs';
  }
  
  return 'stack';
}

// Safe area constants for different devices
export function getSafeAreaInsets() {
  const { platform, isTablet } = getDeviceInfo();
  
  const defaults = {
    top: platform === 'ios' ? (isTablet ? 24 : 44) : 24,
    bottom: platform === 'ios' ? (isTablet ? 0 : 34) : 0,
    left: 0,
    right: 0,
  };
  
  return defaults;
}

// Orientation change handling
export function useOrientationChange(callback: (deviceInfo: DeviceInfo) => void) {
  const subscription = Dimensions.addEventListener('change', () => {
    callback(getDeviceInfo());
  });
  
  return () => subscription?.remove();
}

// Layout constants for different screen sizes
export const LAYOUT_CONSTANTS = {
  // Split view thresholds
  SPLIT_VIEW_MIN_WIDTH: 768,
  SPLIT_VIEW_LEFT_PERCENTAGE: 30,
  SPLIT_VIEW_MAX_LEFT_WIDTH: 400,
  SPLIT_VIEW_MIN_LEFT_WIDTH: 280,
  
  // Grid layouts
  CARD_MIN_WIDTH: 280,
  LIST_ITEM_HEIGHT: 80,
  HEADER_HEIGHT: 64,
  TAB_BAR_HEIGHT: 80,
  
  // Touch targets
  MIN_TOUCH_TARGET: 44,
  RECOMMENDED_TOUCH_TARGET: 48,
  
  // Content spacing
  CONTENT_PADDING: 16,
  SECTION_SPACING: 24,
  
  // Animation durations
  LAYOUT_ANIMATION_DURATION: 300,
  NAVIGATION_ANIMATION_DURATION: 250,
} as const;

// Responsive style helpers
export const responsiveStyles = {
  container: (isTablet: boolean) => ({
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 24 : 16,
  }),
  
  cardSpacing: (isTablet: boolean) => ({
    marginHorizontal: isTablet ? 12 : 8,
    marginVertical: isTablet ? 12 : 8,
  }),
  
  fontSize: (baseFontSize: number, isTablet: boolean) => ({
    fontSize: isTablet ? baseFontSize * 1.1 : baseFontSize,
  }),
  
  buttonHeight: (isTablet: boolean) => ({
    height: isTablet ? 52 : 44,
    paddingHorizontal: isTablet ? 24 : 16,
  }),
};