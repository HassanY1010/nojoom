// scripts/runMigrations.js
/**
 * Migration Runner
 * Executes all pending SQL migration files in order.
 * Tracks applied migrations in a `schema_migrations` table.
 * Safe to run multiple times (idempotent).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

/**
 * Ensure the migrations tracking table exists
 */
const ensureMigrationsTable = async (conn) => {
    await conn.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_filename (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
};

/**
 * Get list of already-applied migrations
 */
const getAppliedMigrations = async (conn) => {
    const [rows] = await conn.execute('SELECT filename FROM schema_migrations ORDER BY applied_at ASC');
    return new Set(rows.map(r => r.filename));
};

/**
 * Execute a single SQL file (handles multiple statements)
 */
const executeMigrationFile = async (conn, filepath, filename) => {
    const sql = fs.readFileSync(filepath, 'utf8');

    // Remove single-line comments (-- ...) then split by semicolons
    const cleanedSql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

    // Split by semicolons and filter empty statements
    const statements = cleanedSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 5); // min 5 chars to be a valid statement

    let successCount = 0;
    let skipCount = 0;

    for (const statement of statements) {
        try {
            await conn.execute(statement);
            successCount++;
        } catch (err) {
            // Some DDL errors are expected (e.g., index already exists)
            if (
                err.code === 'ER_DUP_KEYNAME' ||
                err.code === 'ER_TABLE_EXISTS_ERROR' ||
                err.message.includes('Duplicate key name') ||
                err.message.includes('already exists')
            ) {
                skipCount++;
            } else {
                console.error(`  ⚠️  Statement failed (continuing): ${statement.slice(0, 100)}...`);
                console.error(`     Error: ${err.message}`);
            }
        }
    }

    return { successCount, skipCount };
};

/**
 * Run all pending migrations
 */
export const runMigrations = async () => {
    const conn = await pool.getConnection();

    try {
        await ensureMigrationsTable(conn);
        const applied = await getAppliedMigrations(conn);

        // Get all .sql files sorted by name
        const allFiles = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        const pending = allFiles.filter(f => !applied.has(f));

        if (pending.length === 0) {
            console.log('✅ Migrations: All up to date. No pending migrations.');
            return;
        }

        console.log(`🔄 Migrations: Running ${pending.length} pending migration(s)...`);

        for (const filename of pending) {
            const filepath = path.join(MIGRATIONS_DIR, filename);
            console.log(`  ⏳ Applying: ${filename}`);

            try {
                const { successCount, skipCount } = await executeMigrationFile(conn, filepath, filename);

                // Mark as applied
                await conn.execute(
                    'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
                    [filename]
                );

                console.log(`  ✅ Applied: ${filename} (${successCount} statements executed, ${skipCount} skipped)`);
            } catch (err) {
                console.error(`  ❌ Failed: ${filename} → ${err.message}`);
                // Continue with other migrations even if one fails
            }
        }

        console.log('✅ Migrations: Completed.');

    } finally {
        conn.release();
    }
};

// Allow running directly from CLI: node scripts/runMigrations.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    import('../config/db.js').then(async () => {
        await runMigrations();
        process.exit(0);
    }).catch(err => {
        console.error('❌ Migration runner error:', err);
        process.exit(1);
    });
}

export default runMigrations;
