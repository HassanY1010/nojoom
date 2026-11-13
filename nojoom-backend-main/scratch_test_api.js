import jwt from 'jsonwebtoken';

const secret = 'NojoomSuperSecretKey123!';
const userPayload = {
    id: 11,
    email: 'hassan@gmail.com',
    role: 'user',
    tenantId: 1
};

const token = jwt.sign(userPayload, secret, { expiresIn: '1d' });
console.log('🔄 Generated token:', token);

try {
    const form = new FormData();
    form.append('username', 'hassan1010');
    form.append('bio', 'PRO-MAX-TEST');
    form.append('country', 'Global');

    console.log('🔄 Making PUT request to http://localhost:3333/api/users/profile ...');
    const response = await fetch('http://localhost:3333/api/users/profile', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: form
    });

    console.log('✅ Server response status:', response.status);
    const data = await response.json();
    console.log('✅ Server response data:', data);
} catch (error) {
    console.error('❌ Request error:', error.message);
}
process.exit(0);
