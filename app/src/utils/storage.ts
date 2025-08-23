/**
 * Cross-platform storage service
 * React Native will automatically choose the correct platform-specific implementation:
 * - storage.web.ts for web (no SecureStore)
 * - storage.native.ts for iOS/Android (with SecureStore)
 * 
 * This completely eliminates SecureStore errors on web! 🎉
 */

// The actual implementation is in platform-specific files
// Import from the main index which handles platform selection
import storageImpl from './storage';

// Re-export the platform-specific implementation
export const storage = storageImpl;
export default storage;

// Type exports for TypeScript
export interface IStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
  clearAsync(): Promise<void>;
  getAllKeysAsync(): Promise<string[]>;
  getObjectAsync<T>(key: string): Promise<T | null>;
  setObjectAsync<T>(key: string, value: T): Promise<void>;
  deleteMultipleAsync(keys: string[]): Promise<void>;
}