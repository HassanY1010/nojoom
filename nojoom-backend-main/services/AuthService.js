import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import AuthRepository from '../repositories/AuthRepository.js';
import { User } from '../models/User.js';

export const AuthService = {
    /**
     * توليد رموز الوصول والتجديد لمستخدم
     */
    async generateTokens(user) {
        if (!user.tenant_id) {
            throw new Error('User must belong to a tenant');
        }

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id },
            jwtConfig.secret,
            { expiresIn: jwtConfig.expiresIn }
        );

        const refreshToken = jwt.sign(
            { id: user.id, tenantId: user.tenant_id },
            jwtConfig.refreshSecret,
            { expiresIn: jwtConfig.refreshExpiresIn }
        );

        // حفظ رمز التجديد في قاعدة البيانات
        await AuthRepository.createRefreshToken(user.id, refreshToken);

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
            tenant_id: tenantId
        });

        const user = await User.findById(userId, tenantId);
        const tokens = await this.generateTokens(user);

        return { user, ...tokens };
    },

    /**
     * تسجيل الدخول
     */
    async loginUser(email, password, tenantId) {
        const user = await User.findByEmail(email, tenantId);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // ✅ التحقق من حسابات الاختبار (في وضع التطوير فقط)
        const isMatch = await User.validatePassword(password, user.password);
        if (!isMatch) {
            throw new Error('Invalid credentials');
        }

        // تحديث وقت آخر تسجيل دخول
        await AuthRepository.updateLastLogin(user.id);
        
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
            jwt.verify(refreshToken, jwtConfig.refreshSecret);
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
        await AuthRepository.updateRefreshToken(refreshToken, newRefreshToken);

        return { accessToken, refreshToken: newRefreshToken };
    },

    /**
     * تسجيل الخروج
     */
    async logoutUser(refreshToken) {
        if (refreshToken) {
            await AuthRepository.deleteRefreshToken(refreshToken);
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

        // هنا يجب استدعاء خدمة إرسال البريد
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
