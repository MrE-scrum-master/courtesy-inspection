// iPad-specific styles and layout configurations
import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../constants/theme';
import { getResponsiveSpacing, getResponsiveFontSize } from '../utils/responsive';

// iPad split view styles
export const splitViewStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.background.primary,
  },
  
  leftPanel: {
    backgroundColor: COLORS.background.secondary,
    borderRightWidth: 1,
    borderRightColor: COLORS.border.primary,
    minWidth: 280,
  },
  
  rightPanel: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  
  leftPanelCollapsed: {
    width: 0,
    overflow: 'hidden',
  },
  
  leftPanelExpanded: {
    width: '30%',
    maxWidth: 400,
  },
  
  toggleButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.full,
    padding: 8,
    ...SHADOWS.sm,
  },
  
  splitViewDivider: {
    width: 1,
    backgroundColor: COLORS.border.primary,
    cursor: 'col-resize', // Web only
  },
  
  splitViewHandle: {
    width: 12,
    height: 40,
    backgroundColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.sm,
    position: 'absolute',
    top: '50%',
    left: -6,
    transform: [{ translateY: -20 }],
  },
});

// Enhanced navigation styles for iPad
export const iPadNavigationStyles = StyleSheet.create({
  drawerContainer: {
    backgroundColor: COLORS.background.secondary,
    paddingTop: getResponsiveSpacing(SPACING.lg),
  },
  
  drawerHeader: {
    paddingHorizontal: getResponsiveSpacing(SPACING.lg),
    paddingBottom: getResponsiveSpacing(SPACING.md),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  
  drawerTitle: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize['2xl']),
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  
  drawerSubtitle: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.sm),
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getResponsiveSpacing(SPACING.lg),
    paddingVertical: getResponsiveSpacing(SPACING.md),
    marginHorizontal: getResponsiveSpacing(SPACING.sm),
    borderRadius: BORDER_RADIUS.md,
  },
  
  drawerItemActive: {
    backgroundColor: COLORS.primary,
  },
  
  drawerItemText: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.base),
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginLeft: getResponsiveSpacing(SPACING.md),
    color: COLORS.text.primary,
  },
  
  drawerItemTextActive: {
    color: COLORS.white,
  },
  
  drawerIcon: {
    width: 24,
    height: 24,
  },
  
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getResponsiveSpacing(SPACING.lg),
    paddingVertical: getResponsiveSpacing(SPACING.sm),
    backgroundColor: COLORS.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  
  breadcrumbItem: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.sm),
    color: COLORS.text.secondary,
  },
  
  breadcrumbActive: {
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  
  breadcrumbSeparator: {
    marginHorizontal: getResponsiveSpacing(SPACING.sm),
    color: COLORS.text.tertiary,
  },
});

// Enhanced content layouts for iPad
export const iPadContentStyles = StyleSheet.create({
  masterDetailContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  
  masterList: {
    width: '35%',
    minWidth: 320,
    maxWidth: 480,
    backgroundColor: COLORS.background.secondary,
    borderRightWidth: 1,
    borderRightColor: COLORS.border.primary,
  },
  
  detailView: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  
  gridContainer: {
    padding: getResponsiveSpacing(SPACING.lg),
  },
  
  gridItem: {
    margin: getResponsiveSpacing(SPACING.sm),
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.md,
  },
  
  twoColumnGrid: {
    width: 'calc(50% - 16px)',
  },
  
  threeColumnGrid: {
    width: 'calc(33.333% - 16px)',
  },
  
  fourColumnGrid: {
    width: 'calc(25% - 16px)',
  },
  
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: getResponsiveSpacing(SPACING.lg),
    paddingVertical: getResponsiveSpacing(SPACING.md),
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
    ...SHADOWS.sm,
  },
  
  headerTitle: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize['2xl']),
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: getResponsiveSpacing(SPACING.sm),
  },
  
  actionButton: {
    paddingHorizontal: getResponsiveSpacing(SPACING.md),
    paddingVertical: getResponsiveSpacing(SPACING.sm),
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.sm,
  },
  
  actionButtonText: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.sm),
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.white,
  },
  
  searchContainer: {
    paddingHorizontal: getResponsiveSpacing(SPACING.lg),
    paddingVertical: getResponsiveSpacing(SPACING.md),
    backgroundColor: COLORS.background.secondary,
  },
  
  searchInput: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: getResponsiveSpacing(SPACING.md),
    paddingVertical: getResponsiveSpacing(SPACING.sm),
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.base),
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
});

// Dashboard-specific iPad styles
export const iPadDashboardStyles = StyleSheet.create({
  dashboardContainer: {
    flex: 1,
    backgroundColor: COLORS.background.secondary,
    padding: getResponsiveSpacing(SPACING.lg),
  },
  
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  metricCard: {
    width: 'calc(25% - 12px)',
    minWidth: 200,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: getResponsiveSpacing(SPACING.lg),
    marginBottom: getResponsiveSpacing(SPACING.md),
    ...SHADOWS.md,
  },
  
  metricCardWide: {
    width: 'calc(50% - 12px)',
    minWidth: 400,
  },
  
  metricCardFull: {
    width: '100%',
  },
  
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getResponsiveSpacing(SPACING.md),
  },
  
  metricTitle: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.base),
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  
  metricValue: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize['3xl']),
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: getResponsiveSpacing(SPACING.sm),
  },
  
  metricChange: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.sm),
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  
  metricChangePositive: {
    color: COLORS.success,
  },
  
  metricChangeNegative: {
    color: COLORS.error,
  },
  
  chartContainer: {
    height: 300,
    marginTop: getResponsiveSpacing(SPACING.md),
  },
  
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: getResponsiveSpacing(SPACING.md),
    marginTop: getResponsiveSpacing(SPACING.lg),
  },
  
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: getResponsiveSpacing(SPACING.lg),
    paddingVertical: getResponsiveSpacing(SPACING.md),
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.sm,
  },
  
  quickActionIcon: {
    marginRight: getResponsiveSpacing(SPACING.sm),
  },
  
  quickActionText: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.base),
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
});

// Modal and overlay styles for iPad
export const iPadModalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: getResponsiveSpacing(SPACING.xl),
  },
  
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: getResponsiveSpacing(SPACING.xl),
    maxWidth: 800,
    maxHeight: '90%',
    width: '80%',
    ...SHADOWS.xl,
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
    paddingBottom: getResponsiveSpacing(SPACING.md),
    marginBottom: getResponsiveSpacing(SPACING.lg),
  },
  
  modalTitle: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize['2xl']),
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  
  modalCloseButton: {
    padding: getResponsiveSpacing(SPACING.sm),
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
  },
  
  modalContent: {
    flex: 1,
    minHeight: 200,
  },
  
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: getResponsiveSpacing(SPACING.md),
    marginTop: getResponsiveSpacing(SPACING.lg),
    paddingTop: getResponsiveSpacing(SPACING.md),
    borderTopWidth: 1,
    borderTopColor: COLORS.border.primary,
  },
  
  popoverContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: getResponsiveSpacing(SPACING.md),
    ...SHADOWS.lg,
    maxWidth: 400,
  },
  
  tooltipContainer: {
    backgroundColor: COLORS.gray[800],
    borderRadius: BORDER_RADIUS.sm,
    padding: getResponsiveSpacing(SPACING.sm),
    maxWidth: 300,
  },
  
  tooltipText: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.sm),
    color: COLORS.white,
    textAlign: 'center',
  },
});

// Animation styles for iPad interactions
export const iPadAnimationStyles = StyleSheet.create({
  slideInFromLeft: {
    transform: [{ translateX: -100 }],
    opacity: 0,
  },
  
  slideInFromRight: {
    transform: [{ translateX: 100 }],
    opacity: 0,
  },
  
  fadeIn: {
    opacity: 0,
  },
  
  scaleIn: {
    transform: [{ scale: 0.9 }],
    opacity: 0,
  },
  
  visible: {
    transform: [{ translateX: 0 }, { scale: 1 }],
    opacity: 1,
  },
});

// Accessibility styles for iPad
export const iPadAccessibilityStyles = StyleSheet.create({
  focusIndicator: {
    borderWidth: 2,
    borderColor: COLORS.border.focus,
    borderRadius: BORDER_RADIUS.md,
  },
  
  highContrastText: {
    color: COLORS.black,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  
  largeText: {
    fontSize: getResponsiveFontSize(TYPOGRAPHY.fontSize.lg),
    lineHeight: TYPOGRAPHY.lineHeight.relaxed,
  },
  
  touchTarget: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  screenReaderOnly: {
    position: 'absolute',
    left: -10000,
    top: -10000,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});

// Type definitions for style usage
export type SplitViewStyleKey = keyof typeof splitViewStyles;
export type IPadNavigationStyleKey = keyof typeof iPadNavigationStyles;
export type IPadContentStyleKey = keyof typeof iPadContentStyles;
export type IPadDashboardStyleKey = keyof typeof iPadDashboardStyles;
export type IPadModalStyleKey = keyof typeof iPadModalStyles;