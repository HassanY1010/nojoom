// scripts/update_roles_enum.js
import { pool } from '../config/db.js';

async function update() {
    try {
        console.log('🔄 Updating roles ENUM...');
        await pool.execute("ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'moderator', 'merchant', 'user') DEFAULT 'user'");
        console.log('✅ Role ENUM updated successfully.');
    } catch (error) {
        console.error('❌ Failed to update roles ENUM:', error);
    } finally {
        process.exit(0);
    }
}

update();
