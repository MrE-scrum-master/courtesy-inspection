// Add test vehicle for VIN Scanner demo
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addTestVehicle() {
  try {
    // Add a test vehicle without a customer (simulating VIN scan of unknown vehicle)
    const testVehicle1 = await pool.query(`
      INSERT INTO vehicles (vin, make, model, year, license_plate, color, mileage, shop_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (vin) DO UPDATE
      SET make = EXCLUDED.make
      RETURNING *
    `, [
      '1HGBH41JXMN109186',  // Test VIN
      'Honda',
      'Civic',
      2020,
      'TEST123',
      'Blue',
      25000,
      '550e8400-e29b-41d4-a716-446655440001'  // Test shop ID
    ]);
    
    console.log('✅ Added test vehicle (no customer):', testVehicle1.rows[0]);
    
    // Add another test vehicle WITH a customer
    // First get a customer ID
    const customer = await pool.query(`
      SELECT id FROM customers LIMIT 1
    `);
    
    if (customer.rows.length > 0) {
      const testVehicle2 = await pool.query(`
        INSERT INTO vehicles (vin, make, model, year, license_plate, color, mileage, customer_id, shop_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (vin) DO UPDATE
        SET make = EXCLUDED.make, customer_id = EXCLUDED.customer_id
        RETURNING *
      `, [
        '2HGFC2F53JH123456',  // Test VIN
        'Toyota',
        'Camry', 
        2019,
        'ABC789',
        'Silver',
        35000,
        customer.rows[0].id,
        '550e8400-e29b-41d4-a716-446655440001'
      ]);
      
      console.log('✅ Added test vehicle with customer:', testVehicle2.rows[0]);
    }
    
    console.log('\n📋 Test VINs you can use:');
    console.log('1. 1HGBH41JXMN109186 - Honda Civic (no customer)');
    console.log('2. 2HGFC2F53JH123456 - Toyota Camry (has customer)');
    console.log('\nTry these in the VIN Scanner!');
    
  } catch (error) {
    console.error('Error adding test vehicle:', error);
  } finally {
    await pool.end();
  }
}

addTestVehicle();