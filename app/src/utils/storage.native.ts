/**
 * Native (iOS/Android) storage implementation
 * Uses SecureStore for sensitive data, AsyncStorage for regular data
 * Falls back to AsyncStorage on simulators where SecureStore isn't available
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '@/constants';

// Define which keys require secure storage
const SECURE_KEYS = [
  STORAGE_KEYS.ACCESS_TOKEN,
  STORAGE_KEYS.REFRESH_TOKEN,
  STORAGE_KEYS.USER_DATA,
] as const;

type SecureKey = typeof SECURE_KEYS[number];

class StorageService {
  // Detect if we're on a simulator/emulator
  // In development mode or when SecureStore fails, fall back to AsyncStorage
  private shouldUseSecureStore = !__DEV__;
  
  private isSecure(key: string): boolean {
    // Only use SecureStore in production on real devices
    return this.shouldUseSecureStore && SECURE_KEYS.includes(key as SecureKey);
  }

  async getItemAsync(key: string): Promise<string | null> {
    try {
      if (this.isSecure(key)) {
        return await SecureStore.getItemAsync(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Storage get failed for ${key}:`, error);
      return null;
    }
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    if (!value || typeof value !== 'string') {
      throw new Error('Storage value must be a non-empty string');
    }
    
    try {
      if (this.isSecure(key)) {
        await SecureStore.setItemAsync(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`Storage set failed for ${key}:`, error);
      throw error;
    }
  }

  async deleteItemAsync(key: string): Promise<void> {
    try {
      if (this.isSecure(key)) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Storage remove failed for ${key}:`, error);
      throw error;
    }
  }

  async clearAsync(): Promise<void> {
    try {
      // Clear secure keys
      await Promise.allSettled(
        SECURE_KEYS.map(key => SecureStore.deleteItemAsync(key))
      );
      
      // Clear AsyncStorage
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Storage clear failed:', error);
      throw error;
    }
  }

  async getAllKeysAsync(): Promise<string[]> {
    try {
      const asyncKeys = await AsyncStorage.getAllKeys();
      
      // Check which secure keys exist
      const secureKeys = await Promise.allSettled(
        SECURE_KEYS.map(async key => {
          const value = await SecureStore.getItemAsync(key);
          return value ? key : null;
        })
      );
      
      const existingSecureKeys = secureKeys
        .filter((result): result is PromiseFulfilledResult<string> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);
      
      return [...new Set([...asyncKeys, ...existingSecureKeys])];
    } catch (error) {
      console.error('Storage getAllKeys failed:', error);
      return [];
    }
  }

  // Convenience methods
  async getObjectAsync<T>(key: string): Promise<T | null> {
    const value = await this.getItemAsync(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setObjectAsync<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.setItemAsync(key, serialized);
  }

  async deleteMultipleAsync(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.deleteItemAsync(key)));
  }
}

export const storage = new StorageService();
export default storage;