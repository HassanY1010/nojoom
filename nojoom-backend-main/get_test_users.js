
import { pool } from './config/db.js';
const [users] = await pool.query('SELECT username, email FROM users LIMIT 5');
console.table(users);
process.exit(0);
