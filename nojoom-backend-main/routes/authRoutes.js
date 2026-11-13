//ملف authRoutes.js
import express from 'express';
import { authController } from '../controllers/authController.js';
import { uploadAvatar } from '../middleware/uploadMiddleware.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { registerValidation, loginValidation, updateProfileValidation, changePasswordValidation } from '../middleware/validationMiddleware.js';
import { authLimiter } from '../middleware/rateLimitMiddleware.js';
import { checkRegistrationEnabled } from '../middleware/settingsMiddleware.js';
import { csrfTokenHandler } from '../middleware/csrfMiddleware.js';

const router = express.Router();

router.get('/csrf', csrfTokenHandler);

// =======================
// AUTHENTICATION ROUTES
// =======================

// تسجيل مستخدم جديد مع رفع صورة
router.post('/register', authLimiter, checkRegistrationEnabled, uploadAvatar.single('avatar'), registerValidation, authController.register);

router.post('/check-username', authController.checkUsername);

// تسجيل الدخول
router.post('/login', authLimiter, loginValidation, authController.login);

// تجديد الـ token
router.post('/refresh', authController.refreshToken);

// التحقق من الـ token (محمي)
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user,
    message: 'Token is valid'
  });
});

// تسجيل الخروج (محمي)
router.post('/logout', authenticateToken, authController.logout);

// إرسال OTP
router.post("/send-otp", authLimiter, authController.sendOTP);

router.post("/verify-otp", authController.verifyOTP);

// =======================
// USER PROFILE ROUTES
// =======================

// الحصول على بيانات الملف الشخصي (محمي)
router.get('/profile', authenticateToken, authController.getProfile);

// تحديث الملف الشخصي (محمي) مع رفع صورة
router.put('/profile', authenticateToken, uploadAvatar.single('avatar'), updateProfileValidation, authController.updateProfile);

// تحديث الروابط الاجتماعية
router.put('/social-links', authenticateToken, authController.updateSocialLinks);

// تحديث التفضيلات
router.put('/preferences', authenticateToken, authController.updatePreferences);

// تغيير كلمة المرور
router.put('/change-password', authenticateToken, changePasswordValidation, authController.changePassword);

// إرسال بريد التحقق
router.post('/send-verification-email', authenticateToken, authController.sendVerificationEmail);

// التحقق من البريد الإلكتروني
router.post('/verify-email', authController.verifyEmail);

// حذف الحساب
router.delete('/account', authenticateToken, authController.deleteAccount);

export default router;
