import { pool } from './config/db.js';

async function listTables() {
  try {
    const [rows] = await pool.execute('SHOW TABLES');
    const tableNames = rows.map(row => Object.values(row)[0]);
    console.log('--- Database Tables ---');
    console.log(tableNames.join('\n'));
  } catch (error) {
    console.error('Error fetching tables:', error);
  } finally {
    process.exit();
  }
}

listTables();
