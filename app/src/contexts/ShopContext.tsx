// Shop Context Provider
// Manages shop-wide settings including timezone configuration

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateTimeFormatter, updateDefaultTimezone } from '../utils/dateTime';
import { ENV } from '../config/environment';
const API_URL = ENV.API_URL;

interface BusinessHours {
  [key: string]: {
    open?: string;
    close?: string;
    closed?: boolean;
  };
}

interface ShopSettings {
  id: string;
  name: string;
  timezone: string;
  businessHours: BusinessHours;
  dateFormat: 'US' | 'ISO' | 'EU';
  use24HourTime: boolean;
  address?: string;
  phone?: string;
  email?: string;
}

interface ShopContextType {
  shopSettings: ShopSettings | null;
  dateFormatter: DateTimeFormatter;
  isLoading: boolean;
  error: string | null;
  updateShopSettings: (settings: Partial<ShopSettings>) => Promise<void>;
  refreshShopSettings: () => Promise<void>;
  isBusinessHours: () => boolean;
  getTimezoneAbbr: () => string;
}

const defaultShopSettings: ShopSettings = {
  id: '',
  name: 'Shop',
  timezone: 'America/Chicago',
  businessHours: {
    monday: { open: '08:00', close: '18:00' },
    tuesday: { open: '08:00', close: '18:00' },
    wednesday: { open: '08:00', close: '18:00' },
    thursday: { open: '08:00', close: '18:00' },
    friday: { open: '08:00', close: '18:00' },
    saturday: { open: '09:00', close: '14:00' },
    sunday: { closed: true }
  },
  dateFormat: 'US',
  use24HourTime: false
};

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [dateFormatter, setDateFormatter] = useState<DateTimeFormatter>(
    new DateTimeFormatter(defaultShopSettings)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch shop settings from API
  const fetchShopSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get auth token
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token');
      }

      // Get shop ID from user data
      const userDataStr = await AsyncStorage.getItem('userData');
      if (!userDataStr) {
        throw new Error('No user data');
      }
      const userData = JSON.parse(userDataStr);
      const shopId = userData.shopId || userData.shop_id;

      if (!shopId) {
        throw new Error('No shop ID found');
      }

      // Fetch shop settings
      const response = await fetch(`${API_URL}/shops/${shopId}/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch shop settings');
      }

      const data = await response.json();
      const settings: ShopSettings = {
        id: data.id,
        name: data.name,
        timezone: data.timezone || 'America/Chicago',
        businessHours: data.business_hours || data.businessHours || defaultShopSettings.businessHours,
        dateFormat: data.date_format || data.dateFormat || 'US',
        use24HourTime: data.use_24hour_time || data.use24HourTime || false,
        address: data.address,
        phone: data.phone,
        email: data.email
      };

      setShopSettings(settings);
      
      // Update date formatter with shop settings
      const formatter = new DateTimeFormatter({
        timezone: settings.timezone,
        use24Hour: settings.use24HourTime,
        dateFormat: settings.dateFormat
      });
      setDateFormatter(formatter);
      
      // Update default timezone for the app
      updateDefaultTimezone(settings.timezone);

      // Cache settings
      await AsyncStorage.setItem('shopSettings', JSON.stringify(settings));

    } catch (err) {
      console.error('Error fetching shop settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load shop settings');
      
      // Try to load cached settings
      try {
        const cached = await AsyncStorage.getItem('shopSettings');
        if (cached) {
          const settings = JSON.parse(cached);
          setShopSettings(settings);
          
          const formatter = new DateTimeFormatter({
            timezone: settings.timezone,
            use24Hour: settings.use24HourTime,
            dateFormat: settings.dateFormat
          });
          setDateFormatter(formatter);
          updateDefaultTimezone(settings.timezone);
        } else {
          // Use defaults if no cache
          setShopSettings(defaultShopSettings);
          setDateFormatter(new DateTimeFormatter(defaultShopSettings));
        }
      } catch (cacheErr) {
        console.error('Error loading cached settings:', cacheErr);
        setShopSettings(defaultShopSettings);
        setDateFormatter(new DateTimeFormatter(defaultShopSettings));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update shop settings
  const updateShopSettings = async (updates: Partial<ShopSettings>) => {
    try {
      if (!shopSettings) {
        throw new Error('No shop settings loaded');
      }

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token');
      }

      // Update on server
      const response = await fetch(`${API_URL}/shops/${shopSettings.id}/settings`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timezone: updates.timezone,
          business_hours: updates.businessHours,
          date_format: updates.dateFormat,
          use_24hour_time: updates.use24HourTime
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update shop settings');
      }

      // Update local state
      const newSettings = { ...shopSettings, ...updates };
      setShopSettings(newSettings);

      // Update formatter if timezone or format changed
      if (updates.timezone || updates.dateFormat !== undefined || updates.use24HourTime !== undefined) {
        const formatter = new DateTimeFormatter({
          timezone: newSettings.timezone,
          use24Hour: newSettings.use24HourTime,
          dateFormat: newSettings.dateFormat
        });
        setDateFormatter(formatter);
        
        if (updates.timezone) {
          updateDefaultTimezone(newSettings.timezone);
        }
      }

      // Update cache
      await AsyncStorage.setItem('shopSettings', JSON.stringify(newSettings));

    } catch (err) {
      console.error('Error updating shop settings:', err);
      throw err;
    }
  };

  // Check if shop is currently open
  const isBusinessHours = (): boolean => {
    if (!shopSettings) return false;
    return dateFormatter.isBusinessHours(shopSettings.businessHours);
  };

  // Get timezone abbreviation
  const getTimezoneAbbr = (): string => {
    return dateFormatter.getTimezoneAbbr();
  };

  // Load settings on mount
  useEffect(() => {
    fetchShopSettings();
  }, []);

  return (
    <ShopContext.Provider value={{
      shopSettings,
      dateFormatter,
      isLoading,
      error,
      updateShopSettings,
      refreshShopSettings: fetchShopSettings,
      isBusinessHours,
      getTimezoneAbbr
    }}>
      {children}
    </ShopContext.Provider>
  );
};

// Hook to use shop context
export const useShopContext = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShopContext must be used within ShopProvider');
  }
  return context;
};

// Convenience hooks
export const useShopTime = () => {
  const { dateFormatter } = useShopContext();
  return dateFormatter;
};

export const useShopSettings = () => {
  const { shopSettings, updateShopSettings } = useShopContext();
  return { shopSettings, updateShopSettings };
};

export const useBusinessHours = () => {
  const { isBusinessHours, shopSettings } = useShopContext();
  return {
    isOpen: isBusinessHours(),
    businessHours: shopSettings?.businessHours,
    timezone: shopSettings?.timezone
  };
};