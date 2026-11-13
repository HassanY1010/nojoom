import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import AuthRepository from '../repositories/AuthRepository.js';
import { User } from '../models/User.js';

export const AuthService = {
    /**
     * توليد رموز الوصول والتجديد لمستخدم
     */
    async generateTokens(user) {
        const tenantId = user?.tenant_id || 1;

        const secret = jwtConfig.secret || process.env.JWT_SECRET || 'nojoom_super_secret_jwt_key_default_32_chars';
        const refreshSecret = jwtConfig.refreshSecret || process.env.JWT_REFRESH_SECRET || 'nojoom_super_secret_refresh_jwt_key_default_32';

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role, tenantId },
            secret,
            { expiresIn: jwtConfig.expiresIn || '1h' }
        );

        const refreshToken = jwt.sign(
            { id: user.id, tenantId },
            refreshSecret,
            { expiresIn: jwtConfig.refreshExpiresIn || '7d' }
        );

        // حفظ رمز التجديد في قاعدة البيانات
        try {
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await AuthRepository.createRefreshToken(user.id, refreshToken, expiresAt, tenantId);
        } catch (tokenErr) {
            console.error('⚠️ Could not persist refresh token to database:', tokenErr.message);
        }

        return { accessToken, refreshToken };
    },

    /**
     * تسجيل مستخدم جديد
     */
    async registerUser(userData) {
        const {
            username,
            email,
            password,
            avatar,
            bio,
            birthDate,
            birthDay,
            birthMonth,
            birthYear,
            country,
            tenantId
        } = userData;

        const activeTenantId = tenantId || 1;

        // إنشاء المستخدم
        const userId = await User.create({
            username,
            email,
            password,
            avatar,
            bio,
            birthDate,
            birthDay,
            birthMonth,
            birthYear,
            country,
            tenant_id: activeTenantId
        });

        const user = await User.findById(userId, activeTenantId);
        const tokens = await this.generateTokens(user);

        return { user, ...tokens };
    },

    /**
     * تسجيل الدخول
     */
    async loginUser(email, password, tenantId) {
        const activeTenantId = tenantId || 1;
        const user = await User.findByEmail(email, activeTenantId);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // ✅ التحقق من كلمة المرور
        const isMatch = await User.validatePassword(password, user.password);
        if (!isMatch) {
            throw new Error('Invalid credentials');
        }

        // تحديث وقت آخر تسجيل دخول
        try {
            await AuthRepository.updateLastLogin(user.id);
        } catch (loginErr) {
            console.warn('⚠️ Could not update last login:', loginErr.message);
        }
        
        const tokens = await this.generateTokens(user);

        return { user, ...tokens };
    },

    /**
     * تغيير كلمة المرور
     */
    async changePassword(userId, currentPassword, newPassword) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const isMatch = await User.validatePassword(currentPassword, user.password);
        if (!isMatch) {
            throw new Error('Current password is incorrect');
        }

        await User.updatePassword(userId, newPassword);
        return true;
    },

    /**
     * تجديد التوكن
     */
    async refreshAccessToken(refreshToken) {
        const tokenData = await AuthRepository.getRefreshToken(refreshToken);
        if (!tokenData) {
            throw new Error('Invalid refresh token');
        }

        try {
            const refreshSecret = jwtConfig.refreshSecret || process.env.JWT_REFRESH_SECRET || 'nojoom_super_secret_refresh_jwt_key_default_32';
            jwt.verify(refreshToken, refreshSecret);
        } catch (err) {
            await AuthRepository.deleteRefreshToken(refreshToken);
            throw new Error('Refresh token expired');
        }

        const user = await User.findById(tokenData.user_id, tokenData.tenant_id);
        if (!user) {
            throw new Error('User not found');
        }

        const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(user);
        
        // تحديث التوكن في قاعدة البيانات
        try {
            await AuthRepository.updateRefreshToken(refreshToken, newRefreshToken);
        } catch (updateErr) {
            console.warn('⚠️ Could not update refresh token in DB:', updateErr.message);
        }

        return { accessToken, refreshToken: newRefreshToken };
    },

    /**
     * تسجيل الخروج
     */
    async logoutUser(refreshToken) {
        if (refreshToken) {
            try {
                await AuthRepository.deleteRefreshToken(refreshToken);
            } catch (logoutErr) {
                console.warn('⚠️ Could not delete refresh token from DB:', logoutErr.message);
            }
        }
        return true;
    },

    /**
     * إرسال رمز إعادة التعيين
     */
    async sendResetCode(email) {
        const user = await AuthRepository.findUserByEmailOnly(email);
        if (!user) {
            throw new Error('Email not found');
        }

        const code = Math.floor(100000 + Math.random() * 900000);
        await AuthRepository.saveResetCode(email, code);

        return code;
    },

    /**
     * التحقق من رمز إعادة التعيين
     */
    async verifyResetCode(email, code) {
        const isValid = await AuthRepository.verifyResetCode(email, code);
        if (!isValid) {
            throw new Error('Invalid or expired code');
        }
        return true;
    },

    /**
     * تغيير كلمة المرور عبر رمز التعيين
     */
    async resetPasswordWithCode(email, code, newPassword) {
        const isValid = await AuthRepository.verifyResetCode(email, code);
        if (!isValid) {
            throw new Error('Invalid or expired code');
        }

        const { default: bcrypt } = await import('bcryptjs');
        const hashed = await bcrypt.hash(newPassword, 10);
        
        await AuthRepository.updatePasswordByEmail(email, hashed);
        await AuthRepository.deleteResetCodeByEmail(email);
        
        return true;
    }
};

export default AuthService;
