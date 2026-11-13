
import { pool } from './config/db.js';
import fs from 'fs';
const [users] = await pool.query('SELECT username, email FROM users LIMIT 5');
fs.writeFileSync('test_accounts.json', JSON.stringify(users, null, 2));
console.log('Test accounts saved to test_accounts.json');
process.exit(0);
