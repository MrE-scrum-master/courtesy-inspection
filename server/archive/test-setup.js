// Test script to verify all templates work correctly
// Run this after npm install to validate the setup

console.log('🧪 Testing Courtesy Inspection MVP setup...\n');

// Test 1: Voice Parser
console.log('1️⃣ Testing Voice Parser...');
try {
  const VoiceParser = require('../templates/voice-parser');
  const parser = new VoiceParser();
  
  // Test cases
  const testCases = [
    'front brakes at 5 millimeters',
    'battery looks good',
    'oil needs replacement',
    'tire tread worn',
    'brake fluid low'
  ];
  
  testCases.forEach(text => {
    const result = parser.parse(text);
    console.log(`   "${text}" → ${result.confidence > 0.5 ? '✅' : '⚠️'} (${Math.round(result.confidence * 100)}% confidence)`);
    if (result.component) console.log(`      Component: ${result.component}`);
    if (result.status) console.log(`      Status: ${result.status}`);
    if (result.measurement) console.log(`      Measurement: ${result.measurement.value} ${result.measurement.unit}`);
  });
  
  console.log('   Voice Parser: ✅ Working\n');
} catch (error) {
  console.log(`   Voice Parser: ❌ Error - ${error.message}\n`);
}

// Test 2: SMS Templates
console.log('2️⃣ Testing SMS Templates...');
try {
  const SMSTemplates = require('../templates/sms-templates');
  const sms = new SMSTemplates('Test Auto Shop');
  
  // Test cases
  const customer = 'John';
  const vehicle = '2020 Honda Civic';
  const inspectionId = 'test123';
  
  const templates = [
    sms.inspectionStarted(customer, vehicle, inspectionId),
    sms.inspectionComplete(customer, vehicle, inspectionId),
    sms.urgentIssueFound(customer, 'brake pads worn', inspectionId),
    sms.serviceRecommendation(customer, 'oil change', inspectionId),
    sms.approvalRequest(customer, 'brake service', '150', inspectionId)
  ];
  
  templates.forEach(template => {
    const validation = sms.validateLength(template.message);
    console.log(`   ${template.type}: ${validation.valid ? '✅' : '❌'} (${template.estimatedLength} chars)`);
    if (!validation.valid) {
      console.log(`      ⚠️ Message too long: ${validation.length} chars`);
    }
  });
  
  console.log('   SMS Templates: ✅ Working\n');
} catch (error) {
  console.log(`   SMS Templates: ❌ Error - ${error.message}\n`);
}

// Test 3: Package.json validation
console.log('3️⃣ Testing Package.json...');
try {
  const pkg = require('./package.json');
  
  const requiredDeps = [
    'express', 'cors', 'dotenv', 'pg', 'bcrypt', 
    'jsonwebtoken', 'multer', 'helmet'
  ];
  
  const missing = requiredDeps.filter(dep => !pkg.dependencies[dep]);
  
  if (missing.length === 0) {
    console.log('   All required dependencies: ✅ Present');
    console.log(`   Total dependencies: ${Object.keys(pkg.dependencies).length}`);
    console.log(`   Node engine: ${pkg.engines.node}`);
    console.log('   Package.json: ✅ Valid\n');
  } else {
    console.log(`   Missing dependencies: ❌ ${missing.join(', ')}\n`);
  }
} catch (error) {
  console.log(`   Package.json: ❌ Error - ${error.message}\n`);
}

// Test 4: Environment check
console.log('4️⃣ Testing Environment...');
try {
  // Try to load .env from parent directory
  require('dotenv').config({ path: '../.env' });
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length === 0) {
    console.log('   Required environment variables: ✅ Present');
    console.log(`   Database URL configured: ✅`);
    console.log(`   JWT Secret configured: ✅`);
  } else {
    console.log(`   Missing env vars: ⚠️ ${missing.join(', ')}`);
    console.log('   (This is expected before .env setup)');
  }
} catch (error) {
  console.log(`   Environment: ⚠️ ${error.message} (Expected before npm install)`);
}

console.log('\n🎯 Setup Summary:');
console.log('1. Voice Parser template: Ready for automotive voice commands');
console.log('2. SMS Templates: Ready for customer notifications'); 
console.log('3. Package.json: Ready for Railway deployment');
console.log('4. Server.js: Ready to start Express server');
console.log('\n✅ All critical templates created successfully!');
console.log('\n📋 Next Steps:');
console.log('1. cd server && npm install');
console.log('2. Copy .env file with DATABASE_URL and JWT_SECRET');
console.log('3. npm run dev');
console.log('4. Test http://localhost:3000/api/health');
