// ============================================
// Password Hash Generator for Tenant Setup
// Run: node generate_tenant_passwords.js
// ============================================

import bcrypt from 'bcryptjs';

async function generatePasswords() {
    const saltRounds = 10;

    // Define passwords for each tenant
    const passwords = {
        // Tenant 1: Nojoom Platform
        nojoom_admin: 'Nojoom@Admin123',
        nojoom_users: 'Nojoom@User123',

        // Tenant 2: Star Platform
        star_admin: 'Star@Admin123',
        star_users: 'Star@User123',

        // Tenant 3: Moon Platform
        moon_admin: 'Moon@Admin123',
        moon_users: 'Moon@User123'
    };

    console.log('='.repeat(60));
    console.log('TENANT PASSWORD HASHES');
    console.log('='.repeat(60));
    console.log('\nGenerated at:', new Date().toISOString());
    console.log('\n');

    // Generate hashes
    for (const [key, password] of Object.entries(passwords)) {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log(`-- ${key}`);
        console.log(`-- Password: ${password}`);
        console.log(`'${hash}'`);
        console.log('');
    }

    console.log('='.repeat(60));
    console.log('COPY THE HASHES ABOVE TO setup_tenants.sql');
    console.log('='.repeat(60));
    console.log('\nLogin Credentials Summary:');
    console.log('-'.repeat(60));
    console.log('\nTENANT 1 - Nojoom Platform:');
    console.log('  Admin: nojoom_admin / Nojoom@Admin123');
    console.log('  Users: nojoom_user1, nojoom_user2, nojoom_user3 / Nojoom@User123');
    console.log('\nTENANT 2 - Star Platform:');
    console.log('  Admin: star_admin / Star@Admin123');
    console.log('  Users: star_user1, star_user2, star_user3 / Star@User123');
    console.log('\nTENANT 3 - Moon Platform:');
    console.log('  Admin: moon_admin / Moon@Admin123');
    console.log('  Users: moon_user1, moon_user2, moon_user3 / Moon@User123');
    console.log('\n' + '='.repeat(60));
}

generatePasswords().catch(console.error);
