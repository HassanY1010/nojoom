import { pool } from './config/db.js';
const tables = ['tenants', 'users', 'videos'];
for (const table of tables) {
  console.log(`--- Table: ${table} ---`);
  const [rows] = await pool.query(`DESCRIBE ${table}`);
  console.table(rows);
}
process.exit(0);
