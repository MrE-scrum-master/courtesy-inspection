/**
 * Refactored Storage Service - SOLID/DRY/KISS Compliant
 * Implements Strategy Pattern for platform-specific storage
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ==================== INTERFACES (SOLID - Dependency Inversion) ====================

interface IStorageStrategy {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

interface IStorageService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
  getObject<T>(key: string): Promise<T | null>;
  setObject<T>(key: string, value: T): Promise<void>;
}

// ==================== STRATEGIES (SOLID - Open/Closed) ====================

/**
 * Web Storage Strategy - Uses AsyncStorage for all operations
 */
class WebStorageStrategy implements IStorageStrategy {
  async get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  }

  async getAllKeys(): Promise<string[]> {
    return AsyncStorage.getAllKeys();
  }
}

/**
 * Mobile Storage Strategy - Uses SecureStore for sensitive data
 */
class MobileStorageStrategy implements IStorageStrategy {
  private readonly secureKeys = new Set([
    'access_token',
    'refresh_token',
    'user_data',
  ]);

  private isSecure(key: string): boolean {
    return this.secureKeys.has(key);
  }

  async get(key: string): Promise<string | null> {
    if (this.isSecure(key)) {
      return SecureStore.getItemAsync(key);
    }
    return AsyncStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    if (this.isSecure(key)) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    if (this.isSecure(key)) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  }

  async clear(): Promise<void> {
    // Clear secure keys
    const clearOps = Array.from(this.secureKeys).map(key =>
      SecureStore.deleteItemAsync(key).catch(() => null)
    );
    await Promise.all(clearOps);
    
    // Clear regular storage
    await AsyncStorage.clear();
  }

  async getAllKeys(): Promise<string[]> {
    const asyncKeys = await AsyncStorage.getAllKeys();
    
    // Check which secure keys exist
    const secureKeyChecks = Array.from(this.secureKeys).map(async key => {
      const value = await SecureStore.getItemAsync(key).catch(() => null);
      return value ? key : null;
    });
    
    const existingSecureKeys = (await Promise.all(secureKeyChecks))
      .filter((key): key is string => key !== null);
    
    return [...new Set([...asyncKeys, ...existingSecureKeys])];
  }
}

// ==================== FACTORY (SOLID - Single Responsibility) ====================

class StorageStrategyFactory {
  static create(): IStorageStrategy {
    return Platform.OS === 'web' 
      ? new WebStorageStrategy()
      : new MobileStorageStrategy();
  }
}

// ==================== SERVICE (KISS - Simple Interface) ====================

class StorageService implements IStorageService {
  private strategy: IStorageStrategy;

  constructor() {
    this.strategy = StorageStrategyFactory.create();
  }

  // Core operations delegate to strategy
  async get(key: string): Promise<string | null> {
    try {
      return await this.strategy.get(key);
    } catch (error) {
      console.error(`Storage get failed for ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!value || typeof value !== 'string') {
      throw new Error('Storage value must be a non-empty string');
    }
    
    try {
      await this.strategy.set(key, value);
    } catch (error) {
      console.error(`Storage set failed for ${key}:`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.strategy.remove(key);
    } catch (error) {
      console.error(`Storage remove failed for ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.strategy.clear();
    } catch (error) {
      console.error('Storage clear failed:', error);
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return await this.strategy.getAllKeys();
    } catch (error) {
      console.error('Storage getAllKeys failed:', error);
      return [];
    }
  }

  // Convenience methods (DRY - Reusable utilities)
  async getObject<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setObject<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.set(key, serialized);
  }
}

// ==================== EXPORT (YAGNI - Only what's needed) ====================

export const storage = new StorageService();
export type { IStorageService };
export default storage;