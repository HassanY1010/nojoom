// scripts/seed_dummy_users.js
import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
    console.log('🌱 Starting Seeding Dummy Users...');

    try {
        // 1. Create Default Tenant if not exists
        await pool.execute(
            'INSERT IGNORE INTO tenants (id, name, subdomain, is_active) VALUES (?, ?, ?, ?)',
            [1, 'Default Tenant', 'default', true]
        );
        const tenantId = 1;
        console.log(`✅ Using Tenant ID: ${tenantId}`);

        // 2. Prepare Dummy Users
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        const dummyUsers = [
            { username: 'super_admin_nojoom', email: 'super@test.com', role: 'super_admin' },
            { username: 'admin_nojoom', email: 'admin@test.com', role: 'admin' },
            { username: 'moderator_nojoom', email: 'mod@test.com', role: 'moderator' },
            { username: 'merchant_nojoom', email: 'merchant@test.com', role: 'merchant' },
            { username: 'user_nojoom', email: 'user@test.com', role: 'user' }
        ];

        for (const u of dummyUsers) {
            console.log(`👤 Creating user: ${u.username} (${u.role})...`);
            await pool.execute(
                `INSERT INTO users 
                (tenant_id, username, email, password, role, email_verified, language, theme) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE role = VALUES(role)`,
                [tenantId, u.username, u.email, hashedPassword, u.role, true, 'ar', 'dark']
            );
        }

        console.log('✅ Seeding Successful! You can now login with:');
        dummyUsers.forEach(u => {
            console.log(`   - ${u.role}: ${u.email} (Password: 123456)`);
        });

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        process.exit(0);
    }
}

seed();
