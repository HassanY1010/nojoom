import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations() {
    console.log('🚀 Starting Database Migrations...');

    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Create tracking table if it doesn't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Get already executed migrations
        const [executedRows] = await connection.execute('SELECT filename FROM _migrations');
        const executedMigrations = new Set(executedRows.map(row => row.filename));

        // 3. Read all SQL files from migrations directory
        if (!fs.existsSync(MIGRATIONS_DIR)) {
            console.log('📂 Migrations directory not found. Skipping.');
            return;
        }

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Sort alphabetically to run in order

        let appliedCount = 0;

        for (const file of files) {
            if (!executedMigrations.has(file)) {
                console.log(`\n⚙️ Executing migration: ${file}...`);
                
                const filePath = path.join(MIGRATIONS_DIR, file);
                const sqlContent = fs.readFileSync(filePath, 'utf8');

                // Split by ';' but be careful with triggers/procedures if they exist.
                // Assuming simple statements for now.
                const statements = sqlContent
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                await connection.beginTransaction();

                try {
                    for (const statement of statements) {
                        if (statement) {
                            await connection.execute(statement);
                        }
                    }

                    // Record success
                    await connection.execute('INSERT INTO _migrations (filename) VALUES (?)', [file]);
                    await connection.commit();
                    
                    console.log(`✅ Successfully applied: ${file}`);
                    appliedCount++;
                } catch (migrationError) {
                    await connection.rollback();
                    console.error(`❌ Failed applying ${file}:`, migrationError.message);
                    throw migrationError; // Stop on first failure
                }
            }
        }

        if (appliedCount === 0) {
            console.log('\n✨ Database is up to date. No new migrations to apply.');
        } else {
            console.log(`\n🎉 Successfully applied ${appliedCount} migrations!`);
        }

    } catch (error) {
        console.error('\n💥 Migration Process Failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

runMigrations();
