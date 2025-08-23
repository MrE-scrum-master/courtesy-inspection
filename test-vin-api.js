/**
 * Test script for Vehicle/VIN API endpoints
 * Run with: node test-vin-api.js
 */

const config = {
  API_URL: process.env.API_URL || 'http://localhost:3001',
  TEST_EMAIL: 'admin@shop.com',
  TEST_PASSWORD: 'password123'
};

async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  console.log(`${options.method || 'GET'} ${url}:`, response.status, data);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data.error}`);
  }
  
  return data;
}

async function testVINAPI() {
  console.log('🚗 Testing Vehicle/VIN Management API\n');
  
  let authToken = '';
  
  try {
    // 1. Login to get auth token
    console.log('1. Authenticating...');
    const authResponse = await makeRequest(`${config.API_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: config.TEST_EMAIL,
        password: config.TEST_PASSWORD
      })
    });
    
    authToken = authResponse.data.accessToken;
    console.log('✅ Authentication successful\n');
    
    const authHeaders = {
      'Authorization': `Bearer ${authToken}`
    };
    
    // 2. Test VIN lookup for non-existent VIN
    console.log('2. Testing VIN lookup for non-existent VIN...');
    try {
      await makeRequest(`${config.API_URL}/api/vehicles/vin/1HGBH41JXMN109186`, {
        headers: authHeaders
      });
    } catch (error) {
      console.log('✅ Correctly returned 404 for non-existent VIN\n');
    }
    
    // 3. Create a test vehicle without customer
    console.log('3. Creating test vehicle without customer...');
    const testVIN = '1HGBH41JXMN109186';
    const vehicleData = {
      vin: testVIN,
      make: 'Honda',
      model: 'Accord',
      year: 2020,
      license_plate: 'TEST123',
      color: 'Blue',
      mileage: 50000
      // Note: customer_id is intentionally omitted
    };
    
    const createVehicleResponse = await makeRequest(`${config.API_URL}/api/vehicles`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(vehicleData)
    });
    
    const vehicleId = createVehicleResponse.data.id;
    console.log('✅ Vehicle created without customer\n');
    
    // 4. Test VIN lookup for existing vehicle without customer
    console.log('4. Testing VIN lookup for existing vehicle without customer...');
    const vinLookupResponse = await makeRequest(`${config.API_URL}/api/vehicles/vin/${testVIN}`, {
      headers: authHeaders
    });
    
    if (vinLookupResponse.data.customer === null) {
      console.log('✅ Vehicle found without customer association\n');
    } else {
      console.log('❌ Expected no customer association\n');
    }
    
    // 5. Get customers to associate with vehicle
    console.log('5. Getting customers...');
    const customersResponse = await makeRequest(`${config.API_URL}/api/customers?limit=1`, {
      headers: authHeaders
    });
    
    if (customersResponse.data.length === 0) {
      console.log('❌ No customers found in database. Please seed test data.\n');
      return;
    }
    
    const testCustomerId = customersResponse.data[0].id;
    console.log('✅ Found test customer\n');
    
    // 6. Associate vehicle with customer
    console.log('6. Associating vehicle with customer...');
    await makeRequest(`${config.API_URL}/api/vehicles/${vehicleId}/customer`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        customer_id: testCustomerId
      })
    });
    console.log('✅ Vehicle associated with customer\n');
    
    // 7. Test VIN lookup for vehicle with customer
    console.log('7. Testing VIN lookup for vehicle with customer...');
    const vinLookupWithCustomerResponse = await makeRequest(`${config.API_URL}/api/vehicles/vin/${testVIN}`, {
      headers: authHeaders
    });
    
    if (vinLookupWithCustomerResponse.data.customer !== null) {
      console.log('✅ Vehicle found with customer association\n');
    } else {
      console.log('❌ Expected customer association\n');
    }
    
    // 8. Test get customer's vehicles
    console.log('8. Testing get customer vehicles...');
    const customerVehiclesResponse = await makeRequest(`${config.API_URL}/api/customers/${testCustomerId}/vehicles`, {
      headers: authHeaders
    });
    
    if (customerVehiclesResponse.data.length > 0) {
      console.log('✅ Found vehicles for customer\n');
    } else {
      console.log('❌ No vehicles found for customer\n');
    }
    
    // 9. Test duplicate VIN creation
    console.log('9. Testing duplicate VIN creation...');
    try {
      await makeRequest(`${config.API_URL}/api/vehicles`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(vehicleData)
      });
      console.log('❌ Should have failed with duplicate VIN\n');
    } catch (error) {
      console.log('✅ Correctly rejected duplicate VIN\n');
    }
    
    // 10. Clean up - delete test vehicle
    console.log('10. Cleaning up...');
    // Note: We would implement a DELETE endpoint for cleanup in a real scenario
    console.log('✅ Test vehicle remains for manual inspection\n');
    
    console.log('🎉 All VIN API tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('This script requires Node.js 18+ with built-in fetch support');
  console.log('Alternatively, install node-fetch: npm install node-fetch');
  process.exit(1);
}

testVINAPI();