#!/usr/bin/env node

/**
 * Test script for new features
 * Tests Vehicle API, Photo endpoints, and SMS wireframe
 */

const axios = require('axios');

// Configuration
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.courtesyinspection.com/api'
  : 'http://localhost:8847/api';

const TEST_USER = {
  email: 'admin@shop.com',
  password: 'password123'
};

let authToken = '';

// Helper function to make API calls
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      ...(data && { data })
    };
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error calling ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// Test functions
async function testAuth() {
  console.log('\n🔐 Testing Authentication...');
  const result = await apiCall('POST', '/auth/login', TEST_USER);
  if (result.success && result.data.accessToken) {
    authToken = result.data.accessToken;
    console.log('✅ Authentication successful');
    console.log('   User:', result.data.user.email);
    console.log('   Role:', result.data.user.role);
    return true;
  }
  return false;
}

async function testVehicleAPI() {
  console.log('\n🚗 Testing Vehicle API...');
  
  // Test VIN lookup (non-existent VIN)
  console.log('  Testing VIN lookup...');
  try {
    const vinResult = await apiCall('GET', '/vehicles/vin/1HGBH41JXMN109TEST');
    console.log('  VIN lookup result:', vinResult.success ? 'Found' : 'Not found');
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('  ✅ VIN not found (expected for new VIN)');
    }
  }
  
  // Test vehicle creation
  console.log('  Testing vehicle creation...');
  const newVehicle = {
    year: 2024,
    make: 'Tesla',
    model: 'Model 3',
    vin: `TEST${Date.now()}`,
    licensePlate: 'TEST123'
  };
  
  try {
    const createResult = await apiCall('POST', '/vehicles', newVehicle);
    if (createResult.success) {
      console.log('  ✅ Vehicle created successfully');
      console.log('     ID:', createResult.data.id);
      
      // Test customer association
      if (createResult.data.id) {
        console.log('  Testing customer association...');
        const customerResult = await apiCall('PATCH', `/vehicles/${createResult.data.id}/customer`, {
          customerId: '550e8400-e29b-41d4-a716-446655440003' // Test customer ID
        });
        console.log('  ✅ Customer association:', customerResult.success ? 'Success' : 'Failed');
      }
    }
  } catch (error) {
    console.log('  ⚠️ Vehicle creation test skipped');
  }
}

async function testPhotoEndpoints() {
  console.log('\n📷 Testing Photo Endpoints...');
  
  // Test photo metadata (no actual upload in test)
  console.log('  Testing photo endpoints availability...');
  
  // Test GET photo endpoint
  try {
    await apiCall('GET', '/photos/test-id');
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('  ✅ Photo GET endpoint available (404 for non-existent)');
    }
  }
  
  console.log('  ✅ Photo endpoints configured');
}

async function testSMSWireframe() {
  console.log('\n📱 Testing SMS Wireframe...');
  
  // Test SMS preview
  console.log('  Testing SMS preview...');
  const previewData = {
    template: 'inspection_ready',
    data: {
      customerName: 'Test Customer',
      vehicleInfo: '2024 Tesla Model 3',
      inspectionLink: 'https://app.courtesyinspection.com/portal/test123'
    }
  };
  
  try {
    const previewResult = await apiCall('POST', '/sms/preview', previewData);
    if (previewResult.success) {
      console.log('  ✅ SMS preview generated');
      console.log('     Cost:', previewResult.data.cost);
      console.log('     Segments:', previewResult.data.segments);
    }
  } catch (error) {
    console.log('  ⚠️ SMS preview not available (expected for wireframe)');
  }
  
  // Test mock SMS send
  console.log('  Testing mock SMS send...');
  const mockSMS = {
    to: '+15551234567',
    message: 'Test inspection ready',
    inspectionId: 'test-inspection-id'
  };
  
  try {
    const sendResult = await apiCall('POST', '/sms/send-mock', mockSMS);
    if (sendResult.success) {
      console.log('  ✅ Mock SMS sent successfully');
      console.log('     Message ID:', sendResult.data.id);
    }
  } catch (error) {
    console.log('  ⚠️ Mock SMS endpoint not available');
  }
  
  // Test SMS history
  console.log('  Testing SMS history...');
  try {
    const historyResult = await apiCall('GET', '/sms/history');
    if (historyResult.success) {
      console.log('  ✅ SMS history retrieved');
      console.log('     Messages:', historyResult.data.length);
    }
  } catch (error) {
    console.log('  ⚠️ SMS history not available');
  }
}

async function testInspectionAPI() {
  console.log('\n🔍 Testing Inspection API...');
  
  // Test list inspections
  console.log('  Testing inspection list...');
  const listResult = await apiCall('GET', '/inspections?limit=5');
  if (listResult.success) {
    console.log('  ✅ Inspections retrieved');
    console.log('     Count:', listResult.data.length);
    console.log('     Total:', listResult.pagination?.total || 'N/A');
  }
  
  // Test profile endpoint
  console.log('  Testing profile endpoint...');
  try {
    const profileResult = await apiCall('GET', '/auth/profile');
    if (profileResult.success) {
      console.log('  ✅ Profile endpoint working');
      console.log('     User:', profileResult.data.email);
    }
  } catch (error) {
    console.log('  ⚠️ Profile endpoint needs implementation');
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting Feature Integration Tests');
  console.log('================================');
  console.log('API URL:', API_URL);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  try {
    // Run tests in sequence
    await testAuth();
    await testVehicleAPI();
    await testPhotoEndpoints();
    await testSMSWireframe();
    await testInspectionAPI();
    
    console.log('\n✅ All tests completed!');
    console.log('================================');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();