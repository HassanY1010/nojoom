// scripts/nuke_database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nojoom',
    port: process.env.DB_PORT || 3306
};

async function nuke() {
    console.log('🚀 Starting Database Nuke (Clearing all data)...');
    
    const connection = await mysql.createConnection(config);

    try {
        // 1. Get all tables
        const [tables] = await connection.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = ?
        `, [config.database]);

        console.log(`🔍 Found ${tables.length} tables.`);

        // 2. Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        console.log('🔓 Foreign key checks disabled.');

        // 3. Truncate each table
        for (const row of tables) {
            const tableName = row.TABLE_NAME || row.table_name;
            
            // We might want to keep the migration history so we don't have to re-run migrations
            // but if the user wants "EVERYTHING", we can clear it too.
            // Let's keep schema_migrations just in case, but clear everything else.
            if (tableName === 'schema_migrations') {
                console.log(`⏩ Skipping table: ${tableName}`);
                continue;
            }

            console.log(`🧹 Truncating table: ${tableName}`);
            await connection.query(`TRUNCATE TABLE \`${tableName}\``);
        }

        // 4. Re-enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('🔒 Foreign key checks re-enabled.');

        console.log('✅ Database Nuke Successful! All data cleared.');
    } catch (error) {
        console.error('❌ Nuke failed:', error);
    } finally {
        await connection.end();
    }
}

nuke();
