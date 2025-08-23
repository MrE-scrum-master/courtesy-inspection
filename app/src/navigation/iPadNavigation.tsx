// iPad Navigation - Role-based adaptive navigation with drawer and split-view support
import React, { useMemo } from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDeviceInfo, getNavigationType } from '../utils/responsive';
import { useAuth } from '../utils/AuthContext';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/theme';
import { iPadNavigationStyles } from '../styles/ipad.styles';

// Import screens
import { DashboardScreen } from '../screens/DashboardScreen';
import { ShopDashboardScreen } from '../screens/ShopDashboardScreen';
import { ApprovalQueueScreen } from '../screens/ApprovalQueueScreen';
import { CustomerPortalScreen } from '../screens/CustomerPortalScreen';
import { InspectionDetailScreen } from '../screens/InspectionDetailScreen';
import { CustomerScreen } from '../screens/CustomerScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CreateInspectionScreen } from '../screens/CreateInspectionScreen';

// Navigation types
type DrawerParamList = {
  DashboardTab: undefined;
  InspectionsTab: undefined;
  CustomersTab: undefined;
  ApprovalQueue: undefined;
  Reports: undefined;
  SettingsTab: undefined;
};

type TabParamList = {
  Dashboard: undefined;
  Inspections: undefined;
  Customers: undefined;
  Settings: undefined;
};

type StackParamList = {
  Main: undefined;
  InspectionDetail: { inspectionId: string };
  CreateInspection: { customerId?: string };
  CustomerPortal: { token: string };
};

const Drawer = createDrawerNavigator<DrawerParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<StackParamList>();

// Navigation item interface
interface NavigationItem {
  name: string;
  title: string;
  icon: string;
  component: React.ComponentType<any>;
  roles: string[];
  badge?: () => number | null;
  children?: NavigationItem[];
}

// Role-based navigation configuration
const useNavigationItems = () => {
  const { user } = useAuth();
  
  return useMemo((): NavigationItem[] => {
    const baseItems: NavigationItem[] = [
      {
        name: 'DashboardTab',
        title: 'Dashboard',
        icon: 'speedometer-outline',
        component: user?.role === 'manager' ? ShopDashboardScreen : DashboardScreen,
        roles: ['admin', 'manager', 'mechanic'],
      },
      {
        name: 'InspectionsTab',
        title: 'Inspections',
        icon: 'document-text-outline',
        component: InspectionTabNavigator,
        roles: ['admin', 'manager', 'mechanic'],
      },
      {
        name: 'CustomersTab',
        title: 'Customers',
        icon: 'people-outline',
        component: CustomerTabNavigator,
        roles: ['admin', 'manager', 'mechanic'],
      },
    ];
    
    // Manager and admin specific items
    const managerItems: NavigationItem[] = [
      {
        name: 'ApprovalQueue',
        title: 'Approvals',
        icon: 'checkmark-circle-outline',
        component: ApprovalQueueScreen,
        roles: ['admin', 'manager'],
        badge: () => {
          // This would connect to approval queue hook
          // const { totalPending } = useApprovalQueue();
          // return totalPending;
          return null;
        },
      },
      {
        name: 'Reports',
        title: 'Reports',
        icon: 'bar-chart-outline',
        component: ReportsScreen,
        roles: ['admin', 'manager'],
      },
    ];
    
    // Settings for all users
    const settingsItems: NavigationItem[] = [
      {
        name: 'SettingsTab',
        title: 'Settings',
        icon: 'settings-outline',
        component: SettingsTabNavigator,
        roles: ['admin', 'manager', 'mechanic'],
      },
    ];
    
    // Filter items based on user role
    const allItems = [...baseItems, ...managerItems, ...settingsItems];
    return allItems.filter(item => 
      user?.role && item.roles.includes(user.role)
    );
  }, [user?.role]);
};

// iPad Drawer Navigator
export const IPadDrawerNavigator: React.FC = () => {
  const deviceInfo = getDeviceInfo();
  const navigationItems = useNavigationItems();
  const { user } = useAuth();
  
  if (!deviceInfo.isTablet) {
    return <MobileTabNavigator />;
  }
  
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerType: 'permanent',
        drawerStyle: {
          width: deviceInfo.isLandscape ? 280 : 240,
          backgroundColor: COLORS.background.secondary,
        },
        headerShown: false,
        drawerActiveTintColor: COLORS.white,
        drawerActiveBackgroundColor: COLORS.primary,
        drawerInactiveTintColor: COLORS.text.primary,
        drawerInactiveBackgroundColor: 'transparent',
        drawerLabelStyle: {
          fontSize: TYPOGRAPHY.fontSize.base,
          fontWeight: TYPOGRAPHY.fontWeight.medium,
          marginLeft: -10,
        },
        drawerItemStyle: {
          borderRadius: 8,
          marginHorizontal: 8,
          marginVertical: 2,
        },
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      {navigationItems.map((item) => (
        <Drawer.Screen
          key={item.name}
          name={item.name as keyof DrawerParamList}
          component={item.component}
          options={{
            title: item.title,
            drawerIcon: ({ color, size }) => (
              <View style={styles.drawerIconContainer}>
                <Ionicons name={item.icon as any} size={size} color={color} />
                {item.badge?.() && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge()}</Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
      ))}
    </Drawer.Navigator>
  );
};

// Custom Drawer Content for iPad
const CustomDrawerContent: React.FC<any> = (props) => {
  const { user } = useAuth();
  const deviceInfo = getDeviceInfo();
  
  return (
    <View style={styles.drawerContainer}>
      {/* Header */}
      <View style={iPadNavigationStyles.drawerHeader}>
        <View style={styles.shopLogo}>
          <Ionicons name="car-outline" size={32} color={COLORS.primary} />
        </View>
        <Text style={iPadNavigationStyles.drawerTitle}>
          Courtesy Inspection
        </Text>
        <Text style={iPadNavigationStyles.drawerSubtitle}>
          {user?.name} • {user?.role}
        </Text>
      </View>
      
      {/* Navigation Items */}
      <View style={styles.navigationSection}>
        {props.state.routes.map((route: any, index: number) => {
          const focused = props.state.index === index;
          const item = props.descriptors[route.key];
          
          return (
            <TouchableOpacity
              key={route.key}
              style={[
                iPadNavigationStyles.drawerItem,
                focused && iPadNavigationStyles.drawerItemActive,
              ]}
              onPress={() => props.navigation.navigate(route.name)}
            >
              {item.options.drawerIcon?.({
                color: focused ? COLORS.white : COLORS.text.primary,
                size: 24,
                focused,
              })}
              <Text
                style={[
                  iPadNavigationStyles.drawerItemText,
                  focused && iPadNavigationStyles.drawerItemTextActive,
                ]}
              >
                {item.options.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Footer */}
      <View style={styles.drawerFooter}>
        <TouchableOpacity
          style={iPadNavigationStyles.drawerItem}
          onPress={() => {
            // Handle logout
          }}
        >
          <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
          <Text style={[iPadNavigationStyles.drawerItemText, { color: COLORS.error }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Mobile Tab Navigator
const MobileTabNavigator: React.FC = () => {
  const navigationItems = useNavigationItems();
  
  // Filter to main tabs for mobile
  const mainTabs = navigationItems.filter(item => 
    ['DashboardTab', 'InspectionsTab', 'CustomersTab', 'SettingsTab'].includes(item.name)
  );
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const item = mainTabs.find(item => item.name === route.name);
          const iconName = item?.icon || 'help-outline';
          
          return (
            <View style={styles.tabIconContainer}>
              <Ionicons name={iconName as any} size={size} color={color} />
              {item?.badge?.() && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{item.badge()}</Text>
                </View>
              )}
            </View>
          );
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray[500],
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border.primary,
          paddingBottom: Platform.OS === 'ios' ? 20 : 5,
          height: Platform.OS === 'ios' ? 85 : 60,
        },
        tabBarLabelStyle: {
          fontSize: TYPOGRAPHY.fontSize.xs,
          fontWeight: TYPOGRAPHY.fontWeight.medium,
        },
        headerShown: false,
      })}
    >
      {mainTabs.map((item) => (
        <Tab.Screen
          key={item.name}
          name={item.name as keyof TabParamList}
          component={item.component}
          options={{
            title: item.title,
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

// Tab Navigators for different sections
const InspectionTabNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="InspectionList" component={InspectionListScreen} />
      <Stack.Screen name="InspectionDetail" component={InspectionDetailScreen} />
      <Stack.Screen name="CreateInspection" component={CreateInspectionScreen} />
    </Stack.Navigator>
  );
};

const CustomerTabNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="CustomerList" component={CustomerScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
    </Stack.Navigator>
  );
};

const SettingsTabNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
};

// Placeholder components (these would be real components in full implementation)
const InspectionListScreen = () => (
  <View style={styles.placeholder}>
    <Text>Inspection List</Text>
  </View>
);

const CustomerDetailScreen = () => (
  <View style={styles.placeholder}>
    <Text>Customer Detail</Text>
  </View>
);

const ProfileScreen = () => (
  <View style={styles.placeholder}>
    <Text>Profile Settings</Text>
  </View>
);

const ReportsScreen = () => (
  <View style={styles.placeholder}>
    <Text>Reports</Text>
  </View>
);

// Navigation utilities
export const getNavigationConfig = () => {
  const deviceInfo = getDeviceInfo();
  const navigationType = getNavigationType();
  
  return {
    deviceInfo,
    navigationType,
    isTablet: deviceInfo.isTablet,
    useDrawer: deviceInfo.isTablet && deviceInfo.isLandscape,
    useTabs: !deviceInfo.isTablet || deviceInfo.isPortrait,
  };
};

// Hook for navigation state
export const useNavigationState = () => {
  const config = getNavigationConfig();
  const { user } = useAuth();
  
  const canAccess = (requiredRoles: string[]) => {
    return user?.role && requiredRoles.includes(user.role);
  };
  
  const shouldShowApprovals = canAccess(['admin', 'manager']);
  const shouldShowReports = canAccess(['admin', 'manager']);
  
  return {
    ...config,
    canAccess,
    shouldShowApprovals,
    shouldShowReports,
    userRole: user?.role,
  };
};

// Main App Navigator (to be used in App.tsx)
export const AppNavigator: React.FC = () => {
  const deviceInfo = getDeviceInfo();
  
  // Use appropriate navigator based on device
  if (deviceInfo.isTablet) {
    return <IPadDrawerNavigator />;
  } else {
    return <MobileTabNavigator />;
  }
};

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: COLORS.background.secondary,
  },
  shopLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  navigationSection: {
    flex: 1,
    paddingTop: SPACING.md,
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border.primary,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  drawerIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  tabIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  tabBadgeText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },
});