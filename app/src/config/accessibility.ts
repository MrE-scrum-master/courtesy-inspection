// Accessibility Configuration - WCAG 2.1 AA compliance settings
import { AccessibilityInfo, Platform } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../constants/theme';

// WCAG 2.1 Guidelines Implementation
export interface AccessibilityConfig {
  // Color contrast ratios
  contrastRatios: {
    normal: number; // 4.5:1 for normal text
    large: number;  // 3:1 for large text (18pt+)
    enhanced: number; // 7:1 for AAA compliance
  };
  
  // Touch target sizes (44pt minimum per iOS HIG / Android Guidelines)
  touchTargets: {
    minimum: number;    // 44pt minimum
    recommended: number; // 48pt recommended
    comfortable: number; // 56pt for comfortable use
  };
  
  // Font scaling support
  typography: {
    supportsDynamicType: boolean;
    maxScaleFactor: number;
    minScaleFactor: number;
  };
  
  // Motion and animation preferences
  motion: {
    respectsReduceMotion: boolean;
    defaultAnimationDuration: number;
    reducedAnimationDuration: number;
  };
  
  // Focus management
  focus: {
    visibleFocusIndicator: boolean;
    focusRingColor: string;
    focusRingWidth: number;
  };
  
  // Screen reader settings
  screenReader: {
    announcementDelay: number;
    maxAnnouncementLength: number;
    respectsSilentMode: boolean;
  };
}

export const accessibilityConfig: AccessibilityConfig = {
  contrastRatios: {
    normal: 4.5,
    large: 3.0,
    enhanced: 7.0,
  },
  
  touchTargets: {
    minimum: 44,
    recommended: 48,
    comfortable: 56,
  },
  
  typography: {
    supportsDynamicType: true,
    maxScaleFactor: 2.0,
    minScaleFactor: 0.8,
  },
  
  motion: {
    respectsReduceMotion: true,
    defaultAnimationDuration: 300,
    reducedAnimationDuration: 100,
  },
  
  focus: {
    visibleFocusIndicator: true,
    focusRingColor: COLORS.border.focus,
    focusRingWidth: 2,
  },
  
  screenReader: {
    announcementDelay: 500,
    maxAnnouncementLength: 200,
    respectsSilentMode: true,
  },
};

// Accessibility state management
class AccessibilityManager {
  private static instance: AccessibilityManager;
  private isScreenReaderEnabled = false;
  private isReduceMotionEnabled = false;
  private fontScale = 1.0;
  private isHighContrastEnabled = false;
  
  static getInstance(): AccessibilityManager {
    if (!AccessibilityManager.instance) {
      AccessibilityManager.instance = new AccessibilityManager();
    }
    return AccessibilityManager.instance;
  }
  
  async initialize(): Promise<void> {
    try {
      // Check screen reader status
      this.isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      // Listen for screen reader changes
      AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
        this.isScreenReaderEnabled = enabled;
        this.announceChange('Screen reader ' + (enabled ? 'enabled' : 'disabled'));
      });
      
      // Check reduce motion preference (iOS only)
      if (Platform.OS === 'ios') {
        this.isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
        AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
          this.isReduceMotionEnabled = enabled;
        });
      }
      
      // Get font scale
      this.fontScale = await AccessibilityInfo.getRecommendedTimeoutMillis() || 1.0;
      
    } catch (error) {
      console.warn('Failed to initialize accessibility features:', error);
    }
  }
  
  // Public getters
  getScreenReaderEnabled(): boolean {
    return this.isScreenReaderEnabled;
  }
  
  getReduceMotionEnabled(): boolean {
    return this.isReduceMotionEnabled;
  }
  
  getFontScale(): number {
    return this.fontScale;
  }
  
  getHighContrastEnabled(): boolean {
    return this.isHighContrastEnabled;
  }
  
  // Animation duration based on reduce motion preference
  getAnimationDuration(defaultDuration: number): number {
    if (this.isReduceMotionEnabled) {
      return accessibilityConfig.motion.reducedAnimationDuration;
    }
    return defaultDuration;
  }
  
  // Font size scaling
  getScaledFontSize(baseFontSize: number): number {
    const scaledSize = baseFontSize * this.fontScale;
    const maxSize = baseFontSize * accessibilityConfig.typography.maxScaleFactor;
    const minSize = baseFontSize * accessibilityConfig.typography.minScaleFactor;
    
    return Math.max(minSize, Math.min(maxSize, scaledSize));
  }
  
  // Touch target size validation
  getAccessibleTouchTargetSize(requestedSize: number): number {
    return Math.max(requestedSize, accessibilityConfig.touchTargets.minimum);
  }
  
  // Screen reader announcements
  announceForAccessibility(message: string, priority: 'low' | 'medium' | 'high' = 'medium'): void {
    if (!this.isScreenReaderEnabled) return;
    
    // Truncate long messages
    const truncatedMessage = message.length > accessibilityConfig.screenReader.maxAnnouncementLength
      ? message.substring(0, accessibilityConfig.screenReader.maxAnnouncementLength) + '...'
      : message;
    
    const delay = priority === 'high' ? 0 : accessibilityConfig.screenReader.announcementDelay;
    
    setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(truncatedMessage);
    }, delay);
  }
  
  // Private helper methods
  private announceChange(message: string): void {
    this.announceForAccessibility(message, 'high');
  }
}

// Accessibility utilities
export const a11y = {
  // Initialize accessibility manager
  initialize: async (): Promise<void> => {
    const manager = AccessibilityManager.getInstance();
    await manager.initialize();
  },
  
  // Get manager instance
  getManager: (): AccessibilityManager => {
    return AccessibilityManager.getInstance();
  },
  
  // Quick access methods
  isScreenReaderEnabled: (): boolean => {
    return AccessibilityManager.getInstance().getScreenReaderEnabled();
  },
  
  isReduceMotionEnabled: (): boolean => {
    return AccessibilityManager.getInstance().getReduceMotionEnabled();
  },
  
  getFontScale: (): number => {
    return AccessibilityManager.getInstance().getFontScale();
  },
  
  getAnimationDuration: (defaultDuration: number): number => {
    return AccessibilityManager.getInstance().getAnimationDuration(defaultDuration);
  },
  
  getScaledFontSize: (baseFontSize: number): number => {
    return AccessibilityManager.getInstance().getScaledFontSize(baseFontSize);
  },
  
  getAccessibleTouchTargetSize: (requestedSize: number): number => {
    return AccessibilityManager.getInstance().getAccessibleTouchTargetSize(requestedSize);
  },
  
  announce: (message: string, priority?: 'low' | 'medium' | 'high'): void => {
    AccessibilityManager.getInstance().announceForAccessibility(message, priority);
  },
};

// Accessibility style helpers
export const a11yStyles = {
  // Focus ring for keyboard navigation
  focusRing: {
    borderWidth: accessibilityConfig.focus.focusRingWidth,
    borderColor: accessibilityConfig.focus.focusRingColor,
    borderRadius: 4,
  },
  
  // High contrast text
  highContrastText: (baseColor: string = COLORS.text.primary) => ({
    color: AccessibilityManager.getInstance().getHighContrastEnabled() 
      ? COLORS.black 
      : baseColor,
    fontWeight: AccessibilityManager.getInstance().getHighContrastEnabled() 
      ? TYPOGRAPHY.fontWeight.bold 
      : TYPOGRAPHY.fontWeight.normal,
  }),
  
  // Accessible touch target
  touchTarget: (requestedSize: number) => {
    const size = a11y.getAccessibleTouchTargetSize(requestedSize);
    return {
      minWidth: size,
      minHeight: size,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    };
  },
  
  // Scaled typography
  scaledText: (baseFontSize: number) => ({
    fontSize: a11y.getScaledFontSize(baseFontSize),
  }),
};

// Accessibility props helpers
export const a11yProps = {
  // Standard button props
  button: (label: string, hint?: string) => ({
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessible: true,
  }),
  
  // Heading props
  heading: (level: 1 | 2 | 3 | 4 | 5 | 6, text: string) => ({
    accessibilityRole: 'header' as const,
    accessibilityLevel: level,
    accessibilityLabel: text,
    accessible: true,
  }),
  
  // Link props
  link: (label: string, hint?: string) => ({
    accessibilityRole: 'link' as const,
    accessibilityLabel: label,
    accessibilityHint: hint || 'Double tap to open',
    accessible: true,
  }),
  
  // Image props
  image: (description: string, decorative: boolean = false) => ({
    accessibilityRole: 'image' as const,
    accessibilityLabel: decorative ? undefined : description,
    accessible: !decorative,
  }),
  
  // Text input props
  textInput: (label: string, hint?: string, required: boolean = false) => ({
    accessibilityRole: 'none' as const, // Let TextInput handle its own role
    accessibilityLabel: label + (required ? ', required' : ''),
    accessibilityHint: hint,
    accessible: true,
  }),
  
  // Checkbox props
  checkbox: (label: string, checked: boolean, hint?: string) => ({
    accessibilityRole: 'checkbox' as const,
    accessibilityLabel: label,
    accessibilityState: { checked },
    accessibilityHint: hint,
    accessible: true,
  }),
  
  // Switch props
  switch: (label: string, value: boolean, hint?: string) => ({
    accessibilityRole: 'switch' as const,
    accessibilityLabel: label,
    accessibilityState: { checked: value },
    accessibilityHint: hint,
    accessible: true,
  }),
  
  // Alert props
  alert: (message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => ({
    accessibilityRole: type === 'error' ? 'alert' : 'text' as const,
    accessibilityLabel: `${type} alert: ${message}`,
    accessibilityLiveRegion: type === 'error' ? 'assertive' : 'polite' as const,
    accessible: true,
  }),
  
  // List props
  list: (itemCount: number, description?: string) => ({
    accessibilityRole: 'list' as const,
    accessibilityLabel: description || `List with ${itemCount} items`,
    accessible: true,
  }),
  
  // List item props
  listItem: (index: number, total: number, content: string) => ({
    accessibilityRole: 'none' as const, // Will be handled by FlatList
    accessibilityLabel: `${content}, ${index + 1} of ${total}`,
    accessible: true,
  }),
  
  // Tab props
  tab: (label: string, selected: boolean, index: number, total: number) => ({
    accessibilityRole: 'tab' as const,
    accessibilityLabel: label,
    accessibilityState: { selected },
    accessibilityHint: `Tab ${index + 1} of ${total}`,
    accessible: true,
  }),
  
  // Modal props
  modal: (title: string) => ({
    accessibilityRole: 'none' as const,
    accessibilityLabel: title,
    accessibilityViewIsModal: true,
    accessible: true,
  }),
};

// Color contrast utilities
export const colorContrast = {
  // Calculate contrast ratio between two colors
  getContrastRatio: (color1: string, color2: string): number => {
    // This would implement WCAG contrast calculation
    // For now, return a placeholder
    return 4.5;
  },
  
  // Check if color combination meets WCAG guidelines
  meetsWCAG: (
    foreground: string, 
    background: string, 
    level: 'AA' | 'AAA' = 'AA',
    isLargeText: boolean = false
  ): boolean => {
    const ratio = colorContrast.getContrastRatio(foreground, background);
    const requiredRatio = level === 'AAA' 
      ? (isLargeText ? 4.5 : 7.0)
      : (isLargeText ? 3.0 : 4.5);
    
    return ratio >= requiredRatio;
  },
  
  // Get accessible color alternatives
  getAccessibleColor: (
    baseColor: string, 
    backgroundColor: string,
    isLargeText: boolean = false
  ): string => {
    if (colorContrast.meetsWCAG(baseColor, backgroundColor, 'AA', isLargeText)) {
      return baseColor;
    }
    
    // Return high contrast alternative
    return backgroundColor === COLORS.white ? COLORS.black : COLORS.white;
  },
};

// Testing utilities for accessibility
export const a11yTesting = {
  // Validate component accessibility
  validateComponent: (component: any) => {
    const issues: string[] = [];
    
    // Check for accessibility label
    if (!component.props.accessibilityLabel && !component.props.children) {
      issues.push('Missing accessibility label');
    }
    
    // Check touch target size
    if (component.props.onPress && component.props.style?.width < 44) {
      issues.push('Touch target too small');
    }
    
    // Check color contrast (would need actual implementation)
    // ...
    
    return issues;
  },
  
  // Log accessibility warnings
  logA11yWarnings: (componentName: string, issues: string[]) => {
    if (issues.length > 0) {
      console.warn(`Accessibility issues in ${componentName}:`, issues);
    }
  },
};

// Export default accessibility manager instance
export default AccessibilityManager.getInstance();