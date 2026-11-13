import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import xss from 'xss';
import { User } from '../models/User.js';
import { jwtConfig } from '../config/jwt.js';
import { emailService } from '../services/emailService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendEmail, sendVerificationCode } from "../utils/sendEmail.js";
import AuthRepository from '../repositories/AuthRepository.js';
import AuthService from '../services/AuthService.js';
import storageService from '../services/storageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const authController = {

  async sendVerificationCode(req, res) {
    const { email, code } = req.body;

    await sendEmail({
      to: email,
      subject: "Your Nojoom Verification Code",
      html: `
      <h1>Your Verification Code</h1>
      <p>Your code is: <b>${code}</b></p>
      <p>This code will expire in 5 minutes.</p>
    `
    });

    res.json({ success: true, message: "Verification email sent" });
  },
  async checkUsername(req, res) {
    try {
      const { username } = req.body;

      if (!username || username.length < 3) {
        return res.status(400).json({
          error: 'Username must be at least 3 characters long'
        });
      }

      console.log('🔍 Checking username availability:', username);

      const existingUser = await AuthRepository.findUserByUsername(username, req.tenantId);
      const isAvailable = !existingUser;

      if (isAvailable) {
        return res.json({
          available: true,
          message: 'Username is available'
        });
      } else {
        // توليد اقتراحات بديلة
        const suggestions = await authController.generateUsernameSuggestions(username, req.tenantId);

        return res.json({
          available: false,
          message: 'Username is already taken',
          suggestions: suggestions.slice(0, 3) // إرجاع 3 اقتراحات فقط
        });
      }

    } catch (error) {
      console.error('❌ Check username error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async generateUsernameSuggestions(baseUsername, tenantId) {
    try {
      const suggestions = [];
      const potentialUsernames = [];

      // 1. Prepare potential variations
      // Numbers
      for (let i = 1; i <= 20; i++) {
        potentialUsernames.push(`${baseUsername}${i}`);
      }

      // Suffixes
      const suffixes = ['1', '2', '3', '2024', 'official', 'real', 'tv', 'world', 'live', 'star', 'pro', 'max', 'plus'];
      suffixes.forEach(suffix => potentialUsernames.push(`${baseUsername}_${suffix}`));

      // Prefixes
      const prefixes = ['the', 'real', 'official', 'mr', 'ms'];
      prefixes.forEach(prefix => potentialUsernames.push(`${prefix}_${baseUsername}`));

      const existing = await AuthRepository.findExistingUsernames(potentialUsernames, tenantId);

      const takenUsernames = new Set(existing.map(row => row.username.toLowerCase()));

      // 3. Filter available ones
      for (const username of potentialUsernames) {
        if (!takenUsernames.has(username.toLowerCase())) {
          suggestions.push(username);
          if (suggestions.length >= 10) break;
        }
      }

      return suggestions;
    } catch (error) {
      console.error('❌ Error generating username suggestions:', error);
      return [];
    }
  },

  async register(req, res) {
    try {
      const { username, email, password, bio = '', country = 'Global', birthDate, birthDay, birthMonth, birthYear } = req.body;
      const avatarFile = req.file;

      console.log('📝 Registration attempt:', {
        username,
        email,
        bio,
        birthDate,
        birthDay,
        birthMonth,
        birthYear,
        hasAvatar: !!avatarFile
      });

      // ✅ XSS Sanitization
      const cleanUsername = xss(username);
      const cleanBio = bio ? xss(bio) : '';

      // ✅ Validation - التحقق من الحقول المطلوبة
      if (!cleanUsername || !email || !password) {
        return res.status(400).json({ error: 'Username, email and password are required' });
      }

      // ✅ التحقق من وجود birthDate أو birthDay/birthMonth/birthYear
      if (!birthDate && (!birthDay || !birthMonth || !birthYear)) {
        return res.status(400).json({ error: 'Birth date is required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Validate username length
      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters long' });
      }

      // ✅ معالجة تاريخ الميلاد
      let finalBirthDate = birthDate;
      if (!finalBirthDate && birthDay && birthMonth && birthYear) {
        finalBirthDate = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;
      }

      // Validate birth date
      const birthDateObj = new Date(finalBirthDate);
      if (isNaN(birthDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid birth date' });
      }

      // Check age (must be at least 13 years old)
      const today = new Date();
      const age = today.getFullYear() - birthDateObj.getFullYear();
      const hasBirthdayPassed = today.getMonth() > birthDateObj.getMonth() ||
        (today.getMonth() === birthDateObj.getMonth() && today.getDate() >= birthDateObj.getDate());

      const actualAge = hasBirthdayPassed ? age : age - 1;

      if (actualAge < 13) {
        return res.status(400).json({ error: 'You must be at least 13 years old to register' });
      }

      // استخراج أجزاء التاريخ إذا لم تكن موجودة
      const finalBirthDay = birthDay || birthDateObj.getDate();
      const finalBirthMonth = birthMonth || (birthDateObj.getMonth() + 1);
      const finalBirthYear = birthYear || birthDateObj.getFullYear();

      const existingUser = await AuthRepository.findUserByEmail(email, req.tenantId);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      const existingUserByUsername = await AuthRepository.findUserByUsername(username, req.tenantId);
      if (existingUserByUsername) {
        console.warn('⚠️ Username already taken in this tenant:', username);
        // توليد اقتراحات بديلة
        const suggestions = await authController.generateUsernameSuggestions(username, req.tenantId);
        return res.status(400).json({
          error: 'Username already taken',
          field: 'username',
          suggestions: suggestions.slice(0, 3)
        });
      }


      // ✅ Handle avatar upload
      let avatarPath = '/default-avatar.png';
      if (avatarFile) {
        if (['s3', 'supabase'].includes((process.env.STORAGE_PROVIDER || '').toLowerCase())) {
          const stored = await storageService.save(avatarFile, 'avatars');
          avatarPath = stored.url;
          console.log('✅ Avatar saved to S3/Supabase:', avatarPath);
        } else {
          avatarPath = `/uploads/avatars/${avatarFile.filename}`;
          console.log('✅ Avatar saved locally:', avatarPath);
        }
      }

      // ✅ Call Service
      const result = await AuthService.registerUser({
        username: cleanUsername,
        email,
        password,
        avatar: avatarPath,
        bio: cleanBio,
        birthDate: birthDate || null,
        birthDay: birthDay ? parseInt(birthDay) : null,
        birthMonth: birthMonth ? parseInt(birthMonth) : null,
        birthYear: birthYear ? parseInt(birthYear) : null,
        country: country || null,
        tenantId: req.tenantId || req.tenant?.id || 1
      });

      const userResponse = { ...result.user };
      delete userResponse.password;

      res.status(201).json({
        message: 'User registered successfully.',
        user: userResponse,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });

    } catch (error) {
      console.error('❌ Registration error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required' });

      const result = await AuthService.refreshAccessToken(refreshToken);

      res.json(result);

    } catch (error) {
      console.error('❌ Refresh token error:', error);
      if (error.message === 'Invalid refresh token' || error.message === 'Refresh token expired') {
        return res.status(401).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      await AuthService.logoutUser(refreshToken);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('❌ Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async createAdminIfNotExists(req, res) {
    try {
      // Check if admin exists
      const admin = await AuthRepository.findAdmin();

      if (admin) {
        return res.json({ message: "Admin already exists" });
      }

      // Create encrypted password for admin
      const passwordHash = await bcrypt.hash("admin123", 10);
      const defaultBirthDate = "1990-01-01";

      // Create admin in database
      await AuthRepository.createDefaultAdmin(passwordHash);

      res.json({ message: "Admin user created successfully" });
    } catch (error) {
      console.error("❌ Create admin error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },


  async login(req, res) {
    try {
      const { email, password } = req.body;
      const tenantId = req.tenantId || req.tenant?.id || 1;

      console.log(`🔑 Login attempt: ${email} (tenant: ${tenantId})`);

      const result = await AuthService.loginUser(email, password, tenantId);

      const userResponse = { ...result.user };
      delete userResponse.password;

      res.json({
        message: 'Login successful',
        user: userResponse,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });

    } catch (error) {
      console.error('❌ Login error:', error);
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

      // 1. التحقق من وجوده في قاعدة البيانات
      const tokenData = await AuthRepository.getRefreshToken(refreshToken);

      if (!tokenData) {
        // فحص إذا كان التوكن قد استُبدل مؤخراً (Concurrency Handle)
        // يمكننا التحقق من سجل التوكنات المستبدلة إذا كان لدينا جدول لها
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      // 2. التحقق من التوقيع والصلاحية
      try {
        jwt.verify(refreshToken, jwtConfig.refreshSecret);
      } catch (err) {
        // حذف التوكن المنتهي فعلياً
        await AuthRepository.deleteRefreshToken(refreshToken);
        return res.status(403).json({ error: 'Refresh token expired or invalid' });
      }

      // 3. إنشاء توكنات جديدة (Reuse user_id and tenant_id from token data)
      const userId = tokenData.user_id;
      const tenantId = tokenData.tenant_id;
      const newAccessToken = jwt.sign({ id: userId, tenantId }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
      const newRefreshToken = jwt.sign({ id: userId, tenantId }, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });

      // 4. تحديث التوكن (Atomic Update) مع التعامل مع التزامن
      const affectedRows = await AuthRepository.updateRefreshToken(refreshToken, newRefreshToken);

      // إذا لم يتم تحديث أي صف، فهذا يعني أن هناك طلباً آخر قام بتحديث التوكن بالفعل (Race Condition)
      if (affectedRows === 0) {
        console.log('🔄 Concurrency detected in refreshToken, fetching latest token for user:', userId);
        const latestToken = await AuthRepository.getLatestRefreshToken(userId);

        if (latestToken) {
          // نرسل التوكن الموجود حالياً في القاعدة بدلاً من الخطأ
          return res.json({
            accessToken: newAccessToken, // الأكسس توكن الجديد لا يهم استبداله لأنه صالح لفترة قصيرة
            refreshToken: latestToken
          });
        }

        return res.status(403).json({ error: 'Session expired' });
      }

      res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
      console.error('❌ Refresh token error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async getProfile(req, res) {
    try {
      // Check if user exists in request
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      console.log('📋 Fetching profile for user ID:', userId);

      // Get user data from database
      // 🔒 Multi-Tenant Security: Pass tenantId
      const user = await User.findById(userId, req.tenantId);

      if (!user) {
        console.log('❌ User not found for ID:', userId);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('✅ Profile found for user:', user.username);

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio || '',
        birthDate: user.birthDate || '',
        birthDay: user.birthDay || '',
        birthMonth: user.birthMonth || '',
        birthYear: user.birthYear || '',
        role: user.role,
        email_verified: user.email_verified,
        language: user.language,
        theme: user.theme,
        followers_count: user.followers_count || 0,
        following_count: user.following_count || 0,
        likes_count: user.likes_count || 0,
        views_count: user.views_count || 0,
        social_links: user.social_links,
        country: user.country,
        created_at: user.created_at
      });

    } catch (error) {
      console.error('❌ Get profile error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async logout(req, res) {
    try {
      const refreshToken = req.headers['refresh-token'] || req.body.refreshToken;

      if (refreshToken) {
        // Delete refresh token from database
        await AuthRepository.deleteRefreshToken(refreshToken);
        console.log('✅ Refresh token deleted for logout');
      }

      res.json({ message: 'Logout successful' });

    } catch (error) {
      console.error('❌ Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateProfile(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { username, bio, birthDate, birthDay, birthMonth, birthYear } = req.body;
      const avatarFile = req.file;

      console.log('🔄 Update profile request:', {
        userId, username, bio, birthDate, birthDay, birthMonth, birthYear, hasAvatar: !!avatarFile
      });

      // Validation
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }

      // Validate username length
      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters long' });
      }

      // ✅ معالجة تاريخ الميلاد
      let finalBirthDate = birthDate;
      if (!finalBirthDate && birthDay && birthMonth && birthYear) {
        finalBirthDate = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;
      }

      // Validate birth date if provided
      if (finalBirthDate) {
        const birthDateObj = new Date(finalBirthDate);
        if (isNaN(birthDateObj.getTime())) {
          return res.status(400).json({ error: 'Invalid birth date' });
        }

        // Check age (must be at least 13 years old)
        const today = new Date();
        const age = today.getFullYear() - birthDateObj.getFullYear();
        const hasBirthdayPassed = today.getMonth() > birthDateObj.getMonth() ||
          (today.getMonth() === birthDateObj.getMonth() && today.getDate() >= birthDateObj.getDate());

        const actualAge = hasBirthdayPassed ? age : age - 1;

        if (actualAge < 13) {
          return res.status(400).json({ error: 'You must be at least 13 years old' });
        }
      }

      // Check if username is taken by another user
      const existingUser = await AuthRepository.findUserByUsernameExcludeId(username, userId);

      if (existingUser) {
        // توليد اقتراحات بديلة
        const suggestions = await authController.generateUsernameSuggestions(username);
        return res.status(400).json({
          error: 'Username already taken',
          suggestions: suggestions.slice(0, 3)
        });
      }

      // ✅ Prepare update data مع تضمين الـ bio
      const updateData = {
        username: xss(username),
        bio: bio ? xss(bio) : '', // ✅ التأكد من حفظ الـ bio
        birthDate: finalBirthDate,
        birthDay: birthDay ? parseInt(birthDay) : null,
        birthMonth: birthMonth ? parseInt(birthMonth) : null,
        birthYear: birthYear ? parseInt(birthYear) : null
      };

      if (avatarFile) {
        // ✅ Handle avatar upload (محلي)
        updateData.avatar = `/uploads/avatars/${avatarFile.filename}`;
      }

      // Update user in database
      // 🔒 Multi-Tenant Security: Pass tenantId
      const success = await User.updateProfile(userId, updateData, req.tenantId);

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get updated user data
      // 🔒 Multi-Tenant Security: Pass tenantId
      const user = await User.findById(userId, req.tenantId);

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio, // ✅ إرجاع الـ bio
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          social_links: user.social_links
        }
      });

    } catch (error) {
      console.error('❌ Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateSocialLinks(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { social_links } = req.body;

      console.log('🔄 Updating social links for user:', userId, { social_links });

      if (!social_links) {
        return res.status(400).json({ error: 'Social links data is required' });
      }

      // Validate JSON format
      try {
        JSON.parse(social_links);
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid social links format' });
      }

      const success = await User.updateSocialLinks(userId, social_links);

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get updated user data
      // 🔒 Multi-Tenant Security: Pass tenantId
      const user = await User.findById(userId, req.tenantId);

      res.json({
        message: 'Social links updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          social_links: user.social_links
        }
      });

    } catch (error) {
      console.error('❌ Update social links error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async updatePreferences(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { language, theme } = req.body;

      console.log('🔄 Updating preferences for user:', userId, { language, theme });

      // Validation
      if (!language || !theme) {
        return res.status(400).json({ error: 'Language and theme are required' });
      }

      if (!['en', 'ar'].includes(language)) {
        return res.status(400).json({ error: 'Invalid language' });
      }

      if (!['light', 'dark'].includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme' });
      }

      const success = await User.updatePreferences(userId, { language, theme });

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get updated user data
      // 🔒 Multi-Tenant Security: Pass tenantId
      const user = await User.findById(userId, req.tenantId);

      res.json({
        message: 'Preferences updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          social_links: user.social_links
        }
      });

    } catch (error) {
      console.error('❌ Update preferences error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async updatePrivacySettings(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { is_private, allow_dms, show_activity_status } = req.body;

      console.log('🔄 Updating privacy settings for user:', userId, { is_private, allow_dms, show_activity_status });

      if (
        typeof is_private === 'undefined' ||
        typeof allow_dms === 'undefined' ||
        typeof show_activity_status === 'undefined'
      ) {
        return res.status(400).json({ error: 'Missing privacy settings' });
      }

      const success = await User.updatePrivacySettings(userId, { is_private, allow_dms, show_activity_status });

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'Privacy settings updated successfully' });
    } catch (error) {
      console.error('❌ Update privacy settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async changePassword(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      // Get current user password
      // 🔒 Multi-Tenant Security: Pass tenantId
      const user = await User.findById(userId, req.tenantId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await User.validatePassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Update password
      await User.updatePassword(userId, newPassword);

      res.json({ message: 'Password changed successfully' });

    } catch (error) {
      console.error('❌ Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async sendVerificationEmail(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.email_verified) {
        return res.status(400).json({ error: 'Email is already verified' });
      }

      const emailSent = await authController.sendVerificationEmailInternal(user);

      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email' });
      }

      res.json({ message: 'Verification email sent successfully' });

    } catch (error) {
      console.error('❌ Send verification email error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async sendVerificationEmailInternal(user) {
    try {
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Delete any existing tokens for this user
      await AuthRepository.deleteEmailVerificationTokens(user.id);

      // Save new token to database
      await AuthRepository.createEmailVerificationToken(user.id, verificationToken, expiresAt);

      // Send verification email
      const emailSent = await emailService.sendVerificationEmail(user, verificationToken);

      if (emailSent) {
        console.log('✅ Verification email sent to:', user.email);
        return true;
      } else {
        console.error('❌ Failed to send verification email to:', user.email);
        return false;
      }
    } catch (error) {
      console.error('❌ Error in sendVerificationEmailInternal:', error);
      return false;
    }
  },

  async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
      }

      const verificationToken = await AuthRepository.getValidEmailVerificationToken(token);

      if (!verificationToken) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      // Update user's email verification status
      const success = await User.setEmailVerified(verificationToken.user_id);

      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete the used token
      await AuthRepository.deleteEmailVerificationToken(token);

      // Get updated user data
      const user = await User.findById(verificationToken.user_id);

      res.json({
        message: 'Email verified successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          birthDate: user.birthDate,
          birthDay: user.birthDay,
          birthMonth: user.birthMonth,
          birthYear: user.birthYear,
          role: user.role,
          email_verified: user.email_verified,
          language: user.language,
          theme: user.theme,
          social_links: user.social_links
        }
      });

    } catch (error) {
      console.error('❌ Verify email error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async deleteAccount(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Password is required to delete account' });
      }

      // Verify password
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isValidPassword = await User.validatePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Password is incorrect' });
      }

      // Delete account
      const success = await User.deleteAccount(userId);

      if (!success) {
        return res.status(500).json({ error: 'Failed to delete account' });
      }

      // Delete all refresh tokens for this user
      await AuthRepository.deleteAllRefreshTokens(userId);

      // Delete all verification tokens for this user
      await AuthRepository.deleteEmailVerificationTokens(userId);

      console.log('✅ Account deleted for user ID:', userId);

      res.json({ message: 'Account deleted successfully' });

    } catch (error) {
      console.error('❌ Delete account error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async checkEmailVerification(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        email_verified: user.email_verified,
        email: user.email
      });

    } catch (error) {
      console.error('❌ Check email verification error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      await AuthService.changePassword(userId, currentPassword, newPassword);

      res.json({ message: 'Password changed successfully' });

    } catch (error) {
      console.error('❌ Change password error:', error);
      if (error.message === 'Current password is incorrect') {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async sendOTP(req, res) {
    try {
      const { email } = req.body;

      if (!email) return res.status(400).json({ error: "Email required" });

      const user = await AuthRepository.findUserByEmailOnly(email);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Anti-Spam: Allow OTP request every 1 minute
      if (user.otp_expires) {
        const lastRequest = new Date(user.otp_expires);
        const now = new Date();
        const diff = (now - lastRequest) / 1000 / 60;

        if (diff < -9.5) {
          return res.status(429).json({
            error: "Please wait before requesting another code",
          });
        }
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60000);

      await AuthRepository.updateOTP(email, code, expires);
      await sendVerificationCode(email, code);

      res.json({ success: true, message: "OTP sent successfully" });

    } catch (error) {
      console.error('❌ Send OTP error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async verifyOTP(req, res) {
    try {
      const { email, code } = req.body;

      if (!email || !code)
        return res.status(400).json({ error: "Email and code required" });

      const user = await AuthRepository.findUserByEmailOnly(email);
      if (!user)
        return res.status(404).json({ error: "User not found" });

      if (user.otp_code !== code)
        return res.status(400).json({ error: "Invalid code" });

      const now = new Date();
      const expires = new Date(user.otp_expires);

      if (now > expires)
        return res.status(400).json({ error: "Code expired" });

      await AuthRepository.clearOTP(email);

      res.json({ success: true, message: "Verification successful" });

    } catch (error) {
      console.error('❌ Verify OTP error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
