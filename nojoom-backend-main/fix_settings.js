import dotenv from 'dotenv';
import { pool } from './config/db.js';

dotenv.config();

async function fixSettings() {
    try {
        console.log('🔄 Disabling maintenance mode...');
        const [result] = await pool.execute(
            `UPDATE system_settings 
       SET maintenance_mode = 0, 
           upload_enabled = 1, 
           chat_enabled = 1, 
           user_registration_enabled = 1
       WHERE id = 1`
        );
        console.log('✅ Settings updated successfully!');
        console.log(result);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating settings:', error);
        process.exit(1);
    }
}

fixSettings();
