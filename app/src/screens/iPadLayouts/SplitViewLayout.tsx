// iPad Split View Layout Component - Master-Detail Pattern
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Dimensions,
  Animated,
  PanGestureHandler,
  GestureHandlerRootView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { splitViewStyles } from '@/styles/ipad.styles';
import { getDeviceInfo, calculateSplitViewLayout } from '@/utils/responsive';
import { COLORS } from '@/constants/theme';
import { Button } from '@/components/Button';

interface SplitViewLayoutProps {
  // Left panel (master)
  leftComponent: React.ReactNode;
  leftMinWidth?: number;
  leftDefaultWidth?: number;
  leftMaxWidth?: number;
  
  // Right panel (detail)
  rightComponent: React.ReactNode;
  rightMinWidth?: number;
  
  // Behavior
  collapsible?: boolean;
  resizable?: boolean;
  persistLayout?: boolean;
  
  // Callbacks
  onLayoutChange?: (layout: { leftWidth: number; rightWidth: number; showSplitView: boolean }) => void;
  onLeftPanelToggle?: (collapsed: boolean) => void;
}

export const SplitViewLayout: React.FC<SplitViewLayoutProps> = ({
  leftComponent,
  leftMinWidth = 280,
  leftDefaultWidth = 30, // percentage
  leftMaxWidth = 400,
  rightComponent,
  rightMinWidth = 400,
  collapsible = true,
  resizable = true,
  persistLayout = true,
  onLayoutChange,
  onLeftPanelToggle,
}) => {
  const [screenData, setScreenData] = useState(() => Dimensions.get('window'));
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [currentLeftWidth, setCurrentLeftWidth] = useState(leftDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  
  const panX = new Animated.Value(0);
  
  // Device info
  const deviceInfo = useMemo(() => getDeviceInfo(), [screenData]);
  
  // Layout calculations
  const layout = useMemo(() => {
    return calculateSplitViewLayout(
      screenData.width,
      leftPanelCollapsed ? 0 : currentLeftWidth,
      leftMinWidth,
      rightMinWidth
    );
  }, [screenData.width, leftPanelCollapsed, currentLeftWidth, leftMinWidth, rightMinWidth]);
  
  // Update screen dimensions on orientation change
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });
    
    return () => subscription?.remove();
  }, []);
  
  // Notify parent of layout changes
  useEffect(() => {
    onLayoutChange?.(layout);
  }, [layout, onLayoutChange]);
  
  // Toggle left panel
  const toggleLeftPanel = () => {
    const newCollapsed = !leftPanelCollapsed;
    setLeftPanelCollapsed(newCollapsed);
    onLeftPanelToggle?.(newCollapsed);
  };
  
  // Handle resize gesture
  const handlePanGesture = Animated.event(
    [{ nativeEvent: { translationX: panX } }],
    { useNativeDriver: false }
  );
  
  const handlePanStateChange = (event: any) => {
    if (event.nativeEvent.oldState === 4) { // ACTIVE
      setIsDragging(false);
      
      // Calculate new width based on gesture
      const newWidth = layout.leftWidth + event.nativeEvent.translationX;
      const clampedWidth = Math.max(
        leftMinWidth,
        Math.min(leftMaxWidth, newWidth)
      );
      
      // Convert back to percentage
      const newPercentage = (clampedWidth / screenData.width) * 100;
      setCurrentLeftWidth(newPercentage);
      
      // Reset animation value
      panX.setValue(0);
    } else if (event.nativeEvent.state === 4) { // ACTIVE
      setIsDragging(true);
    }
  };
  
  // Responsive behavior - auto-collapse on small screens
  useEffect(() => {
    if (!layout.showSplitView && !leftPanelCollapsed) {
      setLeftPanelCollapsed(true);
    } else if (layout.showSplitView && leftPanelCollapsed && deviceInfo.isTablet) {
      setLeftPanelCollapsed(false);
    }
  }, [layout.showSplitView, leftPanelCollapsed, deviceInfo.isTablet]);
  
  // Don't render split view on phones in portrait
  if (!deviceInfo.isTablet && deviceInfo.isPortrait) {
    return (
      <View style={splitViewStyles.container}>
        {leftPanelCollapsed ? rightComponent : leftComponent}
        {collapsible && (
          <View style={splitViewStyles.toggleButton}>
            <Button
              variant="secondary"
              size="sm"
              onPress={toggleLeftPanel}
              accessibilityLabel={leftPanelCollapsed ? 'Show list' : 'Show detail'}
            >
              <Ionicons
                name={leftPanelCollapsed ? 'list' : 'document-text'}
                size={20}
                color={COLORS.text.primary}
              />
            </Button>
          </View>
        )}
      </View>
    );
  }
  
  return (
    <GestureHandlerRootView style={splitViewStyles.container}>
      {/* Left Panel */}
      {!leftPanelCollapsed && (
        <Animated.View
          style={[
            splitViewStyles.leftPanel,
            {
              width: layout.leftWidth + (isDragging ? panX : 0),
            },
          ]}
        >
          {leftComponent}
        </Animated.View>
      )}
      
      {/* Resizable Divider */}
      {resizable && !leftPanelCollapsed && layout.showSplitView && (
        <PanGestureHandler
          onGestureEvent={handlePanGesture}
          onHandlerStateChange={handlePanStateChange}
        >
          <Animated.View
            style={[
              splitViewStyles.splitViewDivider,
              { transform: [{ translateX: isDragging ? panX : 0 }] },
            ]}
          >
            <View style={splitViewStyles.splitViewHandle} />
          </Animated.View>
        </PanGestureHandler>
      )}
      
      {/* Right Panel */}
      <View style={splitViewStyles.rightPanel}>
        {rightComponent}
        
        {/* Toggle Button */}
        {collapsible && (
          <View style={splitViewStyles.toggleButton}>
            <Button
              variant="secondary"
              size="sm"
              onPress={toggleLeftPanel}
              accessibilityLabel={leftPanelCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              <Ionicons
                name={leftPanelCollapsed ? 'menu' : 'close'}
                size={20}
                color={COLORS.text.primary}
              />
            </Button>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

// Hook for using split view state
export function useSplitViewLayout() {
  const [layout, setLayout] = useState<{
    leftWidth: number;
    rightWidth: number;
    showSplitView: boolean;
  } | null>(null);
  
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  
  const deviceInfo = useMemo(() => getDeviceInfo(), []);
  
  return {
    layout,
    leftPanelVisible,
    setLayout,
    setLeftPanelVisible,
    deviceInfo,
    isSplitViewCapable: deviceInfo.isTablet,
  };
}

// Pre-configured split view variants
export const InspectionSplitView: React.FC<{
  listComponent: React.ReactNode;
  detailComponent: React.ReactNode;
}> = ({ listComponent, detailComponent }) => (
  <SplitViewLayout
    leftComponent={listComponent}
    rightComponent={detailComponent}
    leftMinWidth={300}
    leftDefaultWidth={35}
    leftMaxWidth={450}
    rightMinWidth={500}
    collapsible={true}
    resizable={true}
  />
);

export const DashboardSplitView: React.FC<{
  sidebarComponent: React.ReactNode;
  mainComponent: React.ReactNode;
}> = ({ sidebarComponent, mainComponent }) => (
  <SplitViewLayout
    leftComponent={sidebarComponent}
    rightComponent={mainComponent}
    leftMinWidth={250}
    leftDefaultWidth={25}
    leftMaxWidth={350}
    rightMinWidth={600}
    collapsible={true}
    resizable={false}
  />
);

export const CustomerSplitView: React.FC<{
  customerListComponent: React.ReactNode;
  customerDetailComponent: React.ReactNode;
}> = ({ customerListComponent, customerDetailComponent }) => (
  <SplitViewLayout
    leftComponent={customerListComponent}
    rightComponent={customerDetailComponent}
    leftMinWidth={280}
    leftDefaultWidth={30}
    leftMaxWidth={400}
    rightMinWidth={450}
    collapsible={true}
    resizable={true}
  />
);