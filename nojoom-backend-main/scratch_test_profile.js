import { pool } from './config/db.js';
import { User } from './models/User.js';

try {
    console.log('🔄 Testing User.updateProfile for user 11...');
    const result = await User.updateProfile(11, {
        username: 'hassan1010',
        bio: 'PRO-MAX',
        country: 'Global'
    });
    console.log('✅ Update success:', result);
} catch (error) {
    console.error('❌ Update failed with error:', error);
} finally {
    process.exit(0);
}
