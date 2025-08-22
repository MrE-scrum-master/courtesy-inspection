// Generate bcrypt hash for test users
const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'password123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\n-- Update your SQL with this hash:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE email IN ('admin@shop.com', 'mike@shop.com', 'sarah@shop.com');`);
}

generateHash();