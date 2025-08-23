/**
 * Web-specific storage implementation
 * Uses AsyncStorage only - no SecureStore
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants';

class StorageService {
  async getItemAsync(key: string): Promise<string | null> {
    try {
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
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Storage set failed for ${key}:`, error);
      throw error;
    }
  }

  async deleteItemAsync(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Storage remove failed for ${key}:`, error);
      throw error;
    }
  }

  async clearAsync(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Storage clear failed:', error);
      throw error;
    }
  }

  async getAllKeysAsync(): Promise<string[]> {
    try {
      return await AsyncStorage.getAllKeys();
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