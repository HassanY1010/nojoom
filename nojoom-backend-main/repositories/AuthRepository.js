import { pool } from '../config/db.js';

export const AuthRepository = {
    async findUserByEmail(email, tenantId = 1) {
        const tid = tenantId || 1;
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE email = ? AND (tenant_id = ? OR tenant_id IS NULL)',
            [email, tid]
        );
        return rows[0];
    },

    async findUserByUsername(username, tenantId = 1) {
        const tid = tenantId || 1;
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ? AND (tenant_id = ? OR tenant_id IS NULL)',
            [username, tid]
        );
        return rows[0];
    },

    async createUser(userData) {
        const { username, email, password, role, tenant_id, avatar, bio } = userData;
        const [result] = await pool.execute(
            `INSERT INTO users (username, email, password, role, tenant_id, avatar, bio) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [username, email, password, role || 'user', tenant_id || 1, avatar || null, bio || null]
        );
        return result.insertId;
    },

    async updateLastLogin(userId) {
        await pool.execute(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [userId]
        );
    },

    async getRefreshToken(token) {
        const [rows] = await pool.execute(
            'SELECT * FROM refresh_tokens WHERE token = ?',
            [token]
        );
        return rows[0];
    },

    async deleteRefreshToken(token) {
        await pool.execute(
            'DELETE FROM refresh_tokens WHERE token = ?',
            [token]
        );
    },

    async createRefreshToken(userId, token, expiresAt = null, tenantId = 1) {
        const expires = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        try {
            await pool.execute(
                'INSERT INTO refresh_tokens (user_id, token, expires_at, tenant_id) VALUES (?, ?, ?, ?)',
                [userId, token, expires, tenantId || 1]
            );
        } catch (e) {
            try {
                await pool.execute(
                    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
                    [userId, token, expires]
                );
            } catch (fallbackErr) {
                console.error('⚠️ AuthRepository.createRefreshToken fallback error:', fallbackErr.message);
            }
        }
    },

    async findExistingUsernames(usernames, tenantId = 1) {
        if (!usernames || usernames.length === 0) return [];
        const tid = tenantId || 1;
        const placeholders = usernames.map(() => '?').join(',');
        const [rows] = await pool.execute(
            `SELECT username FROM users WHERE username IN (${placeholders}) AND (tenant_id = ? OR tenant_id IS NULL)`,
            [...usernames, tid]
        );
        return rows;
    },

    async updateRefreshToken(oldToken, newToken) {
        const [result] = await pool.execute(
            'UPDATE refresh_tokens SET token = ?, created_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE token = ?',
            [newToken, oldToken]
        );
        return result.affectedRows;
    },

    async findAdmin() {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE role = "admin"'
        );
        return rows[0];
    },

    async createDefaultAdmin(passwordHash) {
        const defaultBirthDate = "1990-01-01";
        await pool.execute(
            "INSERT INTO users (username, email, password, role, birth_date, birth_day, birth_month, birth_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ["admin", "admin@example.com", passwordHash, "admin", defaultBirthDate, 1, 1, 1990]
        );
    },

    async getLatestRefreshToken(userId) {
        const [rows] = await pool.execute(
            'SELECT token FROM refresh_tokens WHERE user_id = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        return rows[0]?.token;
    },

    async findUserByUsernameExcludeId(username, userId) {
        const [rows] = await pool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );
        return rows[0];
    },

    async deleteEmailVerificationTokens(userId) {
        await pool.execute(
            'DELETE FROM email_verification_tokens WHERE user_id = ?',
            [userId]
        );
    },

    async deleteAllRefreshTokens(userId) {
        await pool.execute(
            'DELETE FROM refresh_tokens WHERE user_id = ?',
            [userId]
        );
    },

    async createEmailVerificationToken(userId, token, expiresAt) {
        await pool.execute(
            'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, token, expiresAt]
        );
    },

    async getValidEmailVerificationToken(token) {
        const [rows] = await pool.execute(
            'SELECT * FROM email_verification_tokens WHERE token = ? AND expires_at > NOW()',
            [token]
        );
        return rows[0];
    },

    async deleteEmailVerificationToken(token) {
        await pool.execute(
            'DELETE FROM email_verification_tokens WHERE token = ?',
            [token]
        );
    },
    async findUserById(userId, tenantId) {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE id = ? AND tenant_id = ?',
            [userId, tenantId]
        );
        return rows[0];
    },
    async saveResetCode(email, code) {
        await pool.execute(
            "INSERT INTO reset_codes (email, code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
            [email, code]
        );
    },

    async verifyResetCode(email, code) {
        const [rows] = await pool.execute(
            "SELECT * FROM reset_codes WHERE email = ? AND code = ? AND expires_at > NOW()",
            [email, code]
        );
        return rows.length > 0;
    },

    async updatePasswordByEmail(email, hashedPassword) {
        const [result] = await pool.execute(
            "UPDATE users SET password = ? WHERE email = ?",
            [hashedPassword, email]
        );
        return result.affectedRows;
    },

    async deleteResetCodeByEmail(email) {
        await pool.execute(
            "DELETE FROM reset_codes WHERE email = ?",
            [email]
        );
    },

    async findUserByEmailOnly(email) {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return rows[0];
    },
    async updateOTP(email, code, expires) {
        await pool.execute(
            "UPDATE users SET otp_code = ?, otp_expires = ? WHERE email = ?",
            [code, expires, email]
        );
    },

    async clearOTP(email) {
        await pool.execute(
            "UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE email = ?",
            [email]
        );
    }
};

export default AuthRepository;
