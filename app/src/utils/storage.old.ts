/**
 * Cross-platform storage service for Expo apps
 * 
 * Provides secure storage on mobile (SecureStore) and web-compatible storage (AsyncStorage)
 * with automatic platform detection and proper security handling.
 * 
 * Security Levels:
 * - SECURE: Uses SecureStore on mobile, AsyncStorage on web (for tokens, sensitive data)
 * - NORMAL: Uses AsyncStorage on all platforms (for settings, preferences)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '@/constants';

// Conditionally import SecureStore only on mobile
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

// Platform detection
const isWeb = Platform.OS === 'web';
const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

// Define which keys require secure storage
const SECURE_KEYS = [
  STORAGE_KEYS.ACCESS_TOKEN,
  STORAGE_KEYS.REFRESH_TOKEN,
  STORAGE_KEYS.USER_DATA,
] as const;

type SecureKey = typeof SECURE_KEYS[number];
type StorageKey = string;

// Storage interface for type safety
interface IStorage {
  getItemAsync(key: StorageKey): Promise<string | null>;
  setItemAsync(key: StorageKey, value: string): Promise<void>;
  deleteItemAsync(key: StorageKey): Promise<void>;
  clearAsync(): Promise<void>;
  getAllKeysAsync(): Promise<string[]>;
}

// Error types for better error handling
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly operation: string,
    public readonly platform: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Secure storage implementation
 * Uses SecureStore on mobile, AsyncStorage on web
 */
class SecureStorageAdapter implements IStorage {
  private shouldUseSecureStore(key: string): boolean {
    return isMobile && SECURE_KEYS.includes(key as SecureKey);
  }

  private async safeOperation<T>(
    operation: string,
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error';
      throw new StorageError(
        `Storage ${operation} failed for key '${key}': ${message}`,
        key,
        operation,
        Platform.OS,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getItemAsync(key: string): Promise<string | null> {
    return this.safeOperation('get', key, async () => {
      // On web, always use AsyncStorage even for secure keys
      if (isWeb) {
        return await AsyncStorage.getItem(key);
      }
      
      if (this.shouldUseSecureStore(key) && SecureStore) {
        return await SecureStore.getItemAsync(key);
      }
      return await AsyncStorage.getItem(key);
    });
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    if (!value || typeof value !== 'string') {
      throw new StorageError(
        `Invalid value for storage. Must be a non-empty string.`,
        key,
        'set',
        Platform.OS
      );
    }

    return this.safeOperation('set', key, async () => {
      // On web, always use AsyncStorage even for secure keys
      if (isWeb) {
        await AsyncStorage.setItem(key, value);
        return;
      }
      
      if (this.shouldUseSecureStore(key) && SecureStore) {
        await SecureStore.setItemAsync(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    });
  }

  async deleteItemAsync(key: string): Promise<void> {
    return this.safeOperation('delete', key, async () => {
      // On web, always use AsyncStorage even for secure keys
      if (isWeb) {
        await AsyncStorage.removeItem(key);
        return;
      }
      
      if (this.shouldUseSecureStore(key) && SecureStore) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    });
  }

  async clearAsync(): Promise<void> {
    return this.safeOperation('clear', 'all', async () => {
      // Clear all secure keys only on mobile
      if (isMobile && SecureStore) {
        await Promise.allSettled(
          SECURE_KEYS.map(key => SecureStore.deleteItemAsync(key))
        );
      }
      
      // Clear AsyncStorage (handles all keys on web, non-secure keys on mobile)
      await AsyncStorage.clear();
    });
  }

  async getAllKeysAsync(): Promise<string[]> {
    return this.safeOperation('getAllKeys', 'all', async () => {
      const asyncKeys = await AsyncStorage.getAllKeys();
      
      // On web, all keys are in AsyncStorage
      if (isWeb) {
        return asyncKeys;
      }
      
      if (isMobile && SecureStore) {
        // Add secure keys that might exist
        // Note: SecureStore doesn't have getAllKeys, so we check known keys
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
      }
      
      return asyncKeys;
    });
  }
}

/**
 * Enhanced storage service with additional utilities
 */
class StorageService {
  private storage = new SecureStorageAdapter();
  
  // Core storage operations
  async getItemAsync(key: string): Promise<string | null> {
    return this.storage.getItemAsync(key);
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    return this.storage.setItemAsync(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    return this.storage.deleteItemAsync(key);
  }

  async clearAsync(): Promise<void> {
    return this.storage.clearAsync();
  }

  async getAllKeysAsync(): Promise<string[]> {
    return this.storage.getAllKeysAsync();
  }

  // Convenience methods for JSON data
  async getObjectAsync<T = any>(key: string): Promise<T | null> {
    const value = await this.getItemAsync(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new StorageError(
        `Failed to parse JSON for key '${key}'`,
        key,
        'parseJSON',
        Platform.OS,
        error instanceof Error ? error : undefined
      );
    }
  }

  async setObjectAsync<T = any>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.setItemAsync(key, serialized);
    } catch (error) {
      throw new StorageError(
        `Failed to serialize object for key '${key}'`,
        key,
        'serializeJSON',
        Platform.OS,
        error instanceof Error ? error : undefined
      );
    }
  }

  // Boolean convenience methods
  async getBooleanAsync(key: string, defaultValue = false): Promise<boolean> {
    const value = await this.getItemAsync(key);
    if (value === null) return defaultValue;
    return value === 'true';
  }

  async setBooleanAsync(key: string, value: boolean): Promise<void> {
    await this.setItemAsync(key, value.toString());
  }

  // Number convenience methods
  async getNumberAsync(key: string, defaultValue = 0): Promise<number> {
    const value = await this.getItemAsync(key);
    if (value === null) return defaultValue;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  async setNumberAsync(key: string, value: number): Promise<void> {
    await this.setItemAsync(key, value.toString());
  }

  // Batch operations
  async setMultipleAsync(items: Array<{ key: string; value: string }>): Promise<void> {
    await Promise.all(
      items.map(item => this.setItemAsync(item.key, item.value))
    );
  }

  async getMultipleAsync(keys: string[]): Promise<Array<{ key: string; value: string | null }>> {
    const results = await Promise.all(
      keys.map(async key => ({
        key,
        value: await this.getItemAsync(key)
      }))
    );
    return results;
  }

  async deleteMultipleAsync(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(key => this.deleteItemAsync(key))
    );
  }

  // Migration utilities
  async migrateDataAsync(
    oldKey: string, 
    newKey: string, 
    transform?: (oldValue: string) => string
  ): Promise<boolean> {
    try {
      const oldValue = await this.getItemAsync(oldKey);
      if (oldValue === null) return false;
      
      const newValue = transform ? transform(oldValue) : oldValue;
      await this.setItemAsync(newKey, newValue);
      await this.deleteItemAsync(oldKey);
      
      return true;
    } catch (error) {
      throw new StorageError(
        `Failed to migrate data from '${oldKey}' to '${newKey}'`,
        oldKey,
        'migrate',
        Platform.OS,
        error instanceof Error ? error : undefined
      );
    }
  }

  // Debug utilities (dev mode only)
  async dumpStorageAsync(): Promise<Record<string, string | null>> {
    if (!__DEV__) {
      throw new Error('Storage dump is only available in development mode');
    }
    
    const keys = await this.getAllKeysAsync();
    const items = await this.getMultipleAsync(keys);
    
    return items.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, string | null>);
  }

  // Platform information
  getPlatformInfo() {
    return {
      platform: Platform.OS,
      isWeb,
      isMobile,
      usesSecureStore: isMobile,
      secureKeys: SECURE_KEYS,
    };
  }
}

// Export singleton instance
export const storage = new StorageService();

// Export types for TypeScript users
export type { StorageKey, SecureKey, IStorage };

// Export the service class for testing
export { StorageService };

// Legacy compatibility export
export default storage;