import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { Platform, useWindowDimensions } from 'react-native';

import { useAuthContext } from '@/utils';
import { LoadingSpinner } from '@/components';
import { COLORS } from '@/constants';

// Import screens
import {
  LoginScreen,
  DashboardScreen,
  InspectionListScreen,
  InspectionDetailScreen,
  CreateInspectionScreen,
  CustomerScreen,
  SettingsScreen,
  VINScannerScreen,
} from '@/screens';

import type {
  RootStackParamList,
  MainTabParamList,
} from '@/types/common';

const RootStack = createStackNavigator<RootStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const Drawer = createDrawerNavigator();

// Tab Navigator for mobile
const MainTabNavigator: React.FC = () => {
  const { user } = useAuthContext();

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Inspections':
              iconName = focused ? 'clipboard' : 'clipboard-outline';
              break;
            case 'VINScanner':
              iconName = focused ? 'qr-code' : 'qr-code-outline';
              break;
            case 'Customers':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.text.secondary,
        headerShown: false,
      })}
    >
      <MainTab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <MainTab.Screen 
        name="Inspections" 
        component={InspectionListScreen}
        options={{ title: 'Inspections' }}
      />
      <MainTab.Screen 
        name="VINScanner" 
        component={VINScannerScreen}
        options={{ title: 'VIN Scanner' }}
      />
      <MainTab.Screen 
        name="Customers" 
        component={CustomerScreen}
        options={{ title: 'Customers' }}
      />
      <MainTab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </MainTab.Navigator>
  );
};

// Drawer Navigator for iPad/larger screens
const MainDrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerActiveTintColor: COLORS.primary,
        drawerInactiveTintColor: COLORS.text.secondary,
        headerTintColor: COLORS.text.primary,
        headerStyle: {
          backgroundColor: COLORS.white,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border.primary,
        },
      }}
    >
      <Drawer.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="Inspections" 
        component={InspectionListScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="VIN Scanner" 
        component={VINScannerScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="Customers" 
        component={CustomerScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

// Main Navigator that chooses between Tab/Drawer based on screen size
const MainNavigator: React.FC = () => {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // iPad threshold

  // Use drawer for iPad, tabs for mobile
  if (isLargeScreen && Platform.OS !== 'android') {
    return <MainDrawerNavigator />;
  }

  return <MainTabNavigator />;
};

// Placeholder component for screens not yet implemented
const PlaceholderScreen: React.FC = () => {
  return (
    <LoadingSpinner
      fullScreen
      text="Coming soon..."
    />
  );
};

// Auth Navigator
const AuthNavigator: React.FC = () => {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <RootStack.Screen name="Login" component={LoginScreen} />
    </RootStack.Navigator>
  );
};

// Root Navigator
const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <LoadingSpinner
        fullScreen
        text="Loading..."
      />
    );
  }

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animationTypeForReplace: isAuthenticated ? 'push' : 'pop',
      }}
    >
      {isAuthenticated ? (
        <RootStack.Screen name="Main" component={MainNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
};

// App Navigator with Navigation Container
export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
};

export default AppNavigator;