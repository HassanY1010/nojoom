import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  console.log('🛡️  Secure Admin Bootstrap Tool');
  console.log('-------------------------------');

  try {
    const email = await question('Enter Admin Email (default: admin@example.com): ') || 'admin@example.com';
    const password = await question('Enter Admin Password (default: admin123): ') || 'admin123';
    const tenantId = await question('Enter Tenant ID (default: 1): ') || '1';

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? AND tenant_id = ?', [email, tenantId]);
    
    if (existing.length > 0) {
      console.log(`❌ Error: User with email ${email} already exists in tenant ${tenantId}`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const defaultBirthDate = "1990-01-01";

    await pool.execute(
      "INSERT INTO users (username, email, password, role, birth_date, birth_day, birth_month, birth_year, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["admin_" + Date.now().toString().slice(-4), email, passwordHash, "super_admin", defaultBirthDate, 1, 1, 1990, tenantId]
    );

    console.log('✅ Super Admin created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

createAdmin();
