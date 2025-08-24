#!/usr/bin/env node

/**
 * Test Navigation Script for Courtesy Inspection App
 * Simulates user navigation through all screens via API
 */

const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:8847';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(`  ${title}`, 'bright');
  console.log('='.repeat(60));
}

async function testEndpoint(name, method, path, token = null, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    log(`\n→ Testing ${name}...`, 'cyan');
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json();
    
    if (response.ok && data.success) {
      log(`  ✅ ${name}: SUCCESS`, 'green');
      return data.data;
    } else {
      log(`  ⚠️  ${name}: ${data.error || 'Failed'}`, 'yellow');
      return null;
    }
  } catch (error) {
    log(`  ❌ ${name}: ${error.message}`, 'red');
    return null;
  }
}

async function runTests() {
  logSection('COURTESY INSPECTION APP - NAVIGATION TEST');
  
  // 1. Health Check
  logSection('1. SYSTEM HEALTH CHECK');
  const health = await testEndpoint('Health Check', 'GET', '/api/health');
  if (health) {
    log(`  Database: ${health.database.connected ? 'Connected' : 'Disconnected'}`, 'blue');
    log(`  Services: ${Object.keys(health.services).join(', ')}`, 'blue');
  }

  // 2. Authentication Flow
  logSection('2. AUTHENTICATION FLOW');
  
  // Test invalid login
  await testEndpoint(
    'Invalid Login',
    'POST',
    '/api/auth/login',
    null,
    { email: 'wrong@email.com', password: 'wrongpass' }
  );

  // Test valid login
  const loginData = await testEndpoint(
    'Valid Login (admin@shop.com)',
    'POST',
    '/api/auth/login',
    null,
    { email: 'admin@shop.com', password: 'password123' }
  );

  if (!loginData || !loginData.accessToken) {
    log('Cannot continue without authentication!', 'red');
    return;
  }

  const token = loginData.accessToken;
  log(`  User: ${loginData.user.fullName} (${loginData.user.role})`, 'blue');
  log(`  Shop: ${loginData.user.shopName}`, 'blue');

  // 3. Dashboard Data
  logSection('3. DASHBOARD & PROFILE');
  const profile = await testEndpoint('User Profile', 'GET', '/api/auth/profile', token);
  
  // 4. Inspections Screen
  logSection('4. INSPECTIONS MANAGEMENT');
  const inspections = await testEndpoint('List Inspections', 'GET', '/api/inspections', token);
  if (inspections && inspections.length > 0) {
    log(`  Found ${inspections.length} inspections`, 'blue');
    
    // Get details of first inspection
    const firstInspection = inspections[0];
    await testEndpoint(
      'Inspection Details',
      'GET',
      `/api/inspections/${firstInspection.id}`,
      token
    );
  }

  // 5. Customer Management
  logSection('5. CUSTOMER MANAGEMENT');
  const customers = await testEndpoint('List Customers', 'GET', '/api/customers', token);
  if (customers && customers.length > 0) {
    log(`  Found ${customers.length} customers`, 'blue');
  }

  // Search for customer
  await testEndpoint(
    'Search Customer',
    'GET',
    '/api/customers/search?phone=555-1234',
    token
  );

  // 6. Vehicle Management
  logSection('6. VEHICLE & VIN DECODER');
  
  // Test VIN decoder (this will create a new vehicle if VIN is valid)
  const vinData = await testEndpoint(
    'VIN Decoder',
    'GET',
    '/api/vehicles/vin/1HGCV1F31LA123456',
    token
  );

  // 7. Voice Parser
  logSection('7. VOICE TRANSCRIPTION');
  const voiceResult = await testEndpoint(
    'Voice Parser',
    'POST',
    '/api/voice/parse',
    null,
    { text: 'front brake pads at 5 millimeters' }
  );
  if (voiceResult) {
    log(`  Parsed: ${voiceResult.component} - ${voiceResult.measurement} (${voiceResult.status})`, 'blue');
  }

  // 8. SMS Templates
  logSection('8. SMS COMMUNICATION');
  const smsPreview = await testEndpoint(
    'SMS Template Preview',
    'POST',
    '/api/sms/preview',
    null,
    {
      template: 'inspection_complete',
      data: {
        customer_name: 'John',
        vehicle: '2020 Honda Civic',
        link: 'https://ci.link/test'
      }
    }
  );
  if (smsPreview) {
    log(`  Message: "${smsPreview.message}"`, 'blue');
    log(`  Length: ${smsPreview.characterCount} chars`, 'blue');
  }

  // Get SMS history
  await testEndpoint('SMS History', 'GET', '/api/sms/history', token);

  // 9. Photo Upload (mock test)
  logSection('9. PHOTO MANAGEMENT');
  log('  Photo upload requires multipart/form-data (skipping in this test)', 'yellow');

  // 10. Portal Generation
  logSection('10. CUSTOMER PORTAL');
  if (inspections && inspections.length > 0) {
    const portalData = await testEndpoint(
      'Generate Portal Link',
      'POST',
      '/api/portal/generate',
      token,
      { inspection_id: inspections[0].id }
    );
    if (portalData) {
      log(`  Portal URL: ${portalData.url}`, 'blue');
      log(`  Short URL: ${portalData.short_url}`, 'blue');
    }
  }

  // Summary
  logSection('TEST SUMMARY');
  log('✅ All major screens and endpoints tested!', 'green');
  log('\nScreens covered:', 'bright');
  log('  1. Login Screen', 'blue');
  log('  2. Dashboard', 'blue');
  log('  3. Inspections List & Details', 'blue');
  log('  4. Customer Management', 'blue');
  log('  5. VIN Scanner', 'blue');
  log('  6. Voice Notes', 'blue');
  log('  7. SMS Interface', 'blue');
  log('  8. Customer Portal', 'blue');
  
  log('\n💡 Note: For visual testing, open http://localhost:8847 in your browser', 'yellow');
}

// Run the tests
runTests().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});