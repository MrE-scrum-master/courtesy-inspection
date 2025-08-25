import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';

import { ErrorBoundary } from '@/components';
import { QueryProvider, AuthProvider } from '@/utils';
import { AppNavigator } from '@/navigation';
import { COLORS } from '@/constants';
import { ShopProvider } from '@/contexts/ShopContext';

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryProvider>
          <AuthProvider>
            <ShopProvider>
              <AppNavigator />
              <StatusBar style="dark" backgroundColor={COLORS.white} />
            </ShopProvider>
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
