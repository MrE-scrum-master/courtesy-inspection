// Quick test to verify storage fixes are applied
import { Platform } from 'react-native';
import { storage } from './storage';

export async function testStorageFix() {
  console.log('🔍 Testing storage implementation...');
  console.log('Platform:', Platform.OS);
  
  try {
    // This should not throw on web/iPad
    await storage.setItemAsync('test_key', 'test_value');
    const value = await storage.getItemAsync('test_key');
    console.log('✅ Storage working! Retrieved:', value);
    
    // Clean up
    await storage.deleteItemAsync('test_key');
    console.log('✅ Storage operations successful on', Platform.OS);
    return true;
  } catch (error) {
    console.error('❌ Storage error:', error);
    return false;
  }
}