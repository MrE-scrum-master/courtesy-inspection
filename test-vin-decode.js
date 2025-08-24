#!/usr/bin/env node

/**
 * Test VIN Decode - Shows how the VIN scanner actually works
 * This simulates what the frontend does
 */

const fetch = require('node-fetch');

async function decodeVIN(vin) {
  console.log(`\n🔍 Decoding VIN: ${vin}`);
  console.log('=' .repeat(50));
  
  // Step 1: Call NHTSA API (what the frontend does)
  console.log('\n1️⃣ Calling NHTSA API...');
  const nhtsa_url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`;
  
  try {
    const response = await fetch(nhtsa_url);
    const data = await response.json();
    
    if (data.Results) {
      const vehicleInfo = {};
      
      // Extract key fields
      data.Results.forEach(item => {
        switch(item.Variable) {
          case 'Make':
            vehicleInfo.make = item.Value;
            break;
          case 'Model':
            vehicleInfo.model = item.Value;
            break;
          case 'Model Year':
            vehicleInfo.year = item.Value;
            break;
          case 'Body Class':
            vehicleInfo.bodyClass = item.Value;
            break;
          case 'Engine Number of Cylinders':
            vehicleInfo.cylinders = item.Value;
            break;
          case 'Fuel Type - Primary':
            vehicleInfo.fuelType = item.Value;
            break;
          case 'Plant City':
            vehicleInfo.plantCity = item.Value;
            break;
          case 'Trim':
            vehicleInfo.trim = item.Value;
            break;
        }
      });
      
      console.log('\n✅ VIN Decoded Successfully!');
      console.log('Vehicle Information:');
      console.log(`  Make: ${vehicleInfo.make || 'Unknown'}`);
      console.log(`  Model: ${vehicleInfo.model || 'Unknown'}`);
      console.log(`  Year: ${vehicleInfo.year || 'Unknown'}`);
      console.log(`  Body: ${vehicleInfo.bodyClass || 'Unknown'}`);
      console.log(`  Trim: ${vehicleInfo.trim || 'Unknown'}`);
      console.log(`  Engine: ${vehicleInfo.cylinders || '?'} cylinders`);
      console.log(`  Fuel: ${vehicleInfo.fuelType || 'Unknown'}`);
      
      // Step 2: Check database (what the backend does)
      console.log('\n2️⃣ Checking database for existing vehicle...');
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMGE3MWQ3NS0wZDdlLTQ2NTgtYWNmZS01ZGFkNWIyMTU2ZTIiLCJlbWFpbCI6ImFkbWluQHNob3AuY29tIiwicm9sZSI6InNob3BfbWFuYWdlciIsInNob3BJZCI6ImFkMjg5NGU1LWQ3OGYtNDkyMS1hNzVkLTUzNDcwNDY0NmZkZiIsImlhdCI6MTc1NjAxNzk0MywiZXhwIjoxNzU2MTA0MzQzfQ.EjFbUZxCi_ed6E0o9ntuRl3xyxmMEY6C_ojdEYKDssQ';
      
      const dbResponse = await fetch(`http://localhost:8847/api/vehicles/vin/${vin}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (dbResponse.status === 404) {
        console.log('❌ Vehicle not in database (expected for new VINs)');
        console.log('\n3️⃣ Next step in app: Create new vehicle with decoded data');
        console.log('   The app would now show:');
        console.log('   - Vehicle info from NHTSA');
        console.log('   - "Create Customer" button');
        console.log('   - "Start Inspection" button');
      } else if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        console.log('✅ Vehicle found in database!');
        console.log(`   Customer: ${dbData.data.customer ? dbData.data.customer.first_name + ' ' + dbData.data.customer.last_name : 'None'}`);
      }
      
      return vehicleInfo;
    }
  } catch (error) {
    console.error('Error decoding VIN:', error.message);
  }
}

// Test with sample VINs
async function runTests() {
  console.log('🚗 VIN SCANNER TEST - How It Actually Works');
  console.log('=' .repeat(50));
  
  // Test VIN 1: Honda Accord
  await decodeVIN('1HGCV1F31LA123456');
  
  console.log('\n' + '=' .repeat(50));
  console.log('\n💡 SUMMARY:');
  console.log('1. Frontend decodes VIN using NHTSA API (free, no key needed)');
  console.log('2. Backend checks if vehicle exists in database');
  console.log('3. If new vehicle: show decoded info + create customer flow');
  console.log('4. If existing vehicle: show customer info + start inspection');
  
  console.log('\n📱 In the actual app:');
  console.log('- User enters/scans VIN');
  console.log('- App calls VINDecoder.decode() in frontend');
  console.log('- App also checks backend /api/vehicles/vin/:vin');
  console.log('- Shows appropriate UI based on results');
}

runTests().catch(console.error);