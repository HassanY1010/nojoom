import { User } from '../models/User.js';
import UserRepository from '../repositories/UserRepository.js';
import VideoRepository from '../repositories/VideoRepository.js';
import searchService from '../services/searchService.js';
import { createNotification } from './notificationController.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import UserService from '../services/UserService.js';
import AuthService from '../services/AuthService.js';

import storageService from '../services/storageService.js';

export const usersController = {

  // Helper to construct full URL
  getFullUrl(req, pathStr) {
    if (!pathStr) return null;
    if (pathStr.startsWith('http://') || pathStr.startsWith('https://')) {
      return pathStr;
    }


    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = `${protocol}://${host}`;

    // إذا كان المسار يحتوي على المسار الكامل للمجلد المحلي، استخرج النهاية فقط
    let cleanPath = pathStr;
    if (pathStr.includes('uploads')) {
      cleanPath = pathStr.substring(pathStr.indexOf('/uploads'));
      // تصحيح باك سلاش الويندوز
      cleanPath = cleanPath.replace(/\\/g, '/');
    }

    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;

    return `${baseUrl}${cleanPath}`;
  },

  // ==================== تسجيل الدخول ====================

  // ✅ تسجيل الدخول مع إرسال role في الاستجابة
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // 🔒 Multi-Tenant Security: We need a way to get tenantId here. 
      // If usersRoutes.js doesn't have tenant middleware, this might fail.
      // But let's assume it has or uses a default for now, or we can use the user's tenant if found.
      
      const result = await AuthService.loginUser(email, password, req.tenantId);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        message: 'Login successful',
        accessToken: result.accessToken,
        user: result.user
      });

    } catch (error) {
      console.error('❌ Login error:', error);
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  // ==================== إنشاء حساب مدير (للتطوير) ====================

  // ✅ دالة لإنشاء حساب مدير بدون تشفير
  async createAdminIfNotExists(req, res) {
    try {
      const adminEmail = 'admin@nojoom.com';
      const adminPassword = 'admin123'; // كلمة مرور واضحة
      const adminUsername = 'admin';

      // التحقق إذا كان المدير موجوداً بالفعل
      const existingAdmins = await UserRepository.getUserByEmailOrUsername(adminEmail, adminUsername);

      if (existingAdmins.length > 0) {
        console.log('✅ Admin account already exists:', existingAdmins[0].email);
        return res.json({
          message: 'Admin account already exists',
          admin: {
            id: existingAdmins[0].id,
            email: existingAdmins[0].email,
            username: existingAdmins[0].username,
            role: existingAdmins[0].role,
            password: 'admin123'
          }
        });
      }

      // ⚠️ إنشاء حساب مدير بدون تشفير (للتطوير فقط)
      const result = await UserRepository.createAdmin(adminUsername, adminEmail, adminPassword);

      console.log('✅ Admin account created (PLAIN PASSWORD):', {
        id: result.insertId,
        email: adminEmail,
        username: adminUsername
      });

      res.json({
        message: 'Admin account created successfully',
        admin: {
          id: result.insertId,
          email: adminEmail,
          username: adminUsername,
          password: adminPassword,
          note: '⚠️ Password is NOT hashed - for development only!'
        }
      });

    } catch (error) {
      console.error('❌ Error creating admin account:', error);
      res.status(500).json({
        error: 'Failed to create admin account',
        details: error.message
      });
    }
  },

  // ==================== الملف الشخصي ====================
  // ✅ الحصول على بيانات مستخدم مع فيديوهاته
  async getProfile(req, res) {
    try {
      const { username } = req.params;
      const currentUserId = req.user?.id;

      console.log('🔄 Fetching profile for:', { username, currentUserId });

      // الحصول على بيانات المستخدم (مع حساب الإحصائيات الحقيقية مباشرة)
      const user = await UserRepository.getProfileByUsername(username);

      if (!user) {
        console.log('❌ User not found:', username);
        return res.status(404).json({ error: 'User not found' });
      }

      // ✅ بناء الرابط للصورة
      const avatarUrl = usersController.getFullUrl(req, user.avatar || '/default-avatar.png');

      // Parse social links
      let socialLinks = user.social_links;
      try {
        if (typeof socialLinks === 'string') {
          socialLinks = JSON.parse(socialLinks);
        }
      } catch (e) {
        console.error('Error parsing social links in getProfile:', e);
        socialLinks = {};
      }

      console.log('✅ User found:', user.id, user.username, 'Role:', user.role);

      // التحقق إذا كان المستخدم الحالي يتابع هذا المستخدم
      let isFollowing = false;
      if (currentUserId) {
        try {
          // 🔒 Multi-Tenant Security: Pass tenantId
          isFollowing = await User.isFollowing(currentUserId, user.id, req.tenantId);
          console.log('📊 Following status:', isFollowing);
        } catch (followError) {
          console.error('Error checking follow status:', followError);
          isFollowing = false;
        }
      }

      // الحصول على فيديوهات المستخدم
      let videos = [];
      try {
        const videoRows = await VideoRepository.getUserVideos({
          reqUserId: currentUserId || 0,
          targetUserId: user.id,
          tenantId: req.tenantId,
          orderBy: 'v.created_at DESC'
        });
        videos = videoRows.map(video => {
          let rawVideoUrl = video.video_url || video.path || '/default-video.mp4';
          if (rawVideoUrl && !rawVideoUrl.startsWith('http')) {
            rawVideoUrl = `/uploads/videos/${path.basename(rawVideoUrl)}`;
          }

          let rawThumbUrl = video.thumbnail || '/default-thumbnail.jpg';
          if (rawThumbUrl && !rawThumbUrl.startsWith('http')) {
            const thumbFilename = path.basename(rawThumbUrl);
            rawThumbUrl = thumbFilename.includes('default') ? '/default-thumbnail.jpg' : `/uploads/videos/thumbnails/${thumbFilename}`;
          }

          return {
            ...video,
            video_url: rawVideoUrl.startsWith('http') ? rawVideoUrl : usersController.getFullUrl(req, rawVideoUrl),
            thumbnail: rawThumbUrl.startsWith('http') ? rawThumbUrl : usersController.getFullUrl(req, rawThumbUrl)
          };
        });
        console.log('🎥 Videos standardized:', videos.length);
      } catch (videoError) {
        console.error('Error fetching videos:', videoError);
        videos = [];
      }

      res.json({
        user: {
          ...user,
          avatar: avatarUrl, // استبدل بالرابط الكامل
          social_links: socialLinks,
          points: user.points,
          total_earnings: user.total_earnings
        },
        videos,
        isFollowing
      });

    } catch (error) {
      console.error('❌ Get profile error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message,
        code: error.code
      });
    }
  },

  // ✅ تحديث الملف الشخصي
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { username, bio, country } = req.body;
      const avatarFile = req.file;

      console.log('🔄 Updating profile for user:', userId, {
        username,
        bio,
        country,
        hasAvatar: !!avatarFile
      });

      let avatarPath = null;

      if (avatarFile) {
        if ((process.env.STORAGE_PROVIDER || '').toLowerCase() === 's3') {
          const stored = await storageService.save(avatarFile, 'avatars');
          avatarPath = stored.url;
          console.log('✅ Avatar uploaded to S3/Supabase success:', avatarPath);
        } else {
          avatarPath = `/uploads/avatars/${avatarFile.filename}`;
          console.log('✅ Avatar uploaded locally success:', avatarPath);
        }
      }

      const updateData = {
        username: username || null,
        bio: bio || null,
        country: country || 'Global',
        ...(avatarPath && { avatar: avatarPath })
      };

      // 🔒 Multi-Tenant Security: Pass tenantId
      const success = await User.updateProfile(userId, updateData, req.tenantId);

      if (!success) return res.status(404).json({ error: 'User not found' });

      await User.updateUserStats(userId).catch(err => console.error('Stats update error:', err));

      // 🔒 Multi-Tenant Security: Pass tenantId
      const user = await User.findById(userId, req.tenantId);
      if (!user) return res.status(404).json({ error: 'User not found after update' });

      // ✅ بناء الرابط للصورة
      const avatarUrl = usersController.getFullUrl(req, user.avatar || '/default-avatar.png');

      let socialLinks = user.social_links;
      try {
        if (typeof socialLinks === 'string') {
          socialLinks = JSON.parse(socialLinks);
        }
      } catch (e) {
        console.error('Error parsing social links in updateProfile:', e);
        socialLinks = {};
      }

      // ✅ الفهرسة في Elasticsearch / OpenSearch للبحث السريع
      try {
        await searchService.indexUser(user);
      } catch (esError) {
        console.error('Failed to index user in ES:', esError.message);
      }

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: avatarUrl, // أرسل الرابط الكامل
          bio: user.bio,
          social_links: socialLinks,
          role: user.role
        }
      });

    } catch (error) {
      console.error('❌ Update profile error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ تحديث الروابط الاجتماعية
  async updateSocialLinks(req, res) {
    try {
      const userId = req.user.id;
      const { social_links } = req.body;

      console.log('🔄 Updating social links for user:', userId);

      const success = await User.updateSocialLinks(userId, social_links);
      if (!success) return res.status(404).json({ error: 'User not found' });

      // 🔒 Multi-Tenant Security: Pass tenantId
      const user = await User.findById(userId, req.tenantId);

      // ✅ بناء الرابط للصورة
      const avatarUrl = usersController.getFullUrl(req, user.avatar || '/default-avatar.png');

      let currentSocialLinks = user.social_links;
      try {
        if (typeof currentSocialLinks === 'string') {
          currentSocialLinks = JSON.parse(currentSocialLinks);
        }
      } catch (e) {
        console.error('Error parsing social links in updateSocialLinks:', e);
        currentSocialLinks = {};
      }

      res.json({
        message: 'Social links updated successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: avatarUrl, // أرسل الرابط الكامل
          bio: user.bio,
          social_links: currentSocialLinks,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Update social links error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ==================== الفيديوهات ====================

  // ✅ الحصول على الفيديوهات التي أعجب بها المستخدم
  async getLikedVideos(req, res) {
    try {
      const currentUserId = req.user.id;
      console.log('🔄 Fetching liked videos for user:', currentUserId);

      const videos = await VideoRepository.getLikedVideos(currentUserId);

      const standardizedVideos = videos.map(video => {
        let rawVideoUrl = video.video_url || video.path || '/default-video.mp4';
        if (rawVideoUrl && !rawVideoUrl.startsWith('http')) {
          rawVideoUrl = `/uploads/videos/${path.basename(rawVideoUrl)}`;
        }
        let rawThumbUrl = video.thumbnail || '/default-thumbnail.jpg';
        if (rawThumbUrl && !rawThumbUrl.startsWith('http')) {
          const thumbFilename = path.basename(rawThumbUrl);
          rawThumbUrl = thumbFilename.includes('default') ? '/default-thumbnail.jpg' : `/uploads/videos/thumbnails/${thumbFilename}`;
        }

        return {
          ...video,
          video_url: rawVideoUrl.startsWith('http') ? rawVideoUrl : usersController.getFullUrl(req, rawVideoUrl),
          thumbnail: rawThumbUrl.startsWith('http') ? rawThumbUrl : usersController.getFullUrl(req, rawThumbUrl)
        };
      });

      console.log('❤️ Liked videos standardized:', standardizedVideos.length);
      res.json({ videos: standardizedVideos });

    } catch (error) {
      console.error('Get liked videos error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ الحصول على فيديوهات المستخدم
  async getUserVideos(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const videos = await VideoRepository.getUserVideos({
        reqUserId: userId,
        targetUserId: userId,
        tenantId: req.tenantId,
        orderBy: 'v.created_at DESC',
        limit: limit,
        offset: offset
      });

      const total = await VideoRepository.getUserVideosCount(userId);

      const standardizedVideos = videos.map(video => {
        let rawVideoUrl = video.video_url || video.path || '/default-video.mp4';
        if (rawVideoUrl && !rawVideoUrl.startsWith('http')) {
          rawVideoUrl = `/uploads/videos/${path.basename(rawVideoUrl)}`;
        }

        let rawThumbUrl = video.thumbnail || '/default-thumbnail.jpg';
        if (rawThumbUrl && !rawThumbUrl.startsWith('http')) {
          const thumbFilename = path.basename(rawThumbUrl);
          rawThumbUrl = thumbFilename.includes('default') ? '/default-thumbnail.jpg' : `/uploads/videos/thumbnails/${thumbFilename}`;
        }

        return {
          ...video,
          video_url: rawVideoUrl.startsWith('http') ? rawVideoUrl : usersController.getFullUrl(req, rawVideoUrl),
          thumbnail: rawThumbUrl.startsWith('http') ? rawThumbUrl : usersController.getFullUrl(req, rawThumbUrl)
        };
      });

      res.json({
        success: true,
        data: standardizedVideos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get user videos error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ الحصول على فيديوهات ملف المستخدم (عام مع الفرز)
  async getProfileVideos(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, sort = 'latest' } = req.query;
      const currentUserId = req.user ? req.user.id : null;
      const offset = (page - 1) * limit;

      let orderBy = 'v.created_at DESC';
      if (sort === 'trending') {
        orderBy = 'v.views DESC';
      } else if (sort === 'oldest') {
        orderBy = 'v.created_at ASC';
      }

      const videos = await VideoRepository.getUserVideos({
        reqUserId: currentUserId || 0,
        targetUserId: userId,
        tenantId: req.tenantId,
        orderBy: orderBy,
        limit: limit,
        offset: offset
      });

      const total = await VideoRepository.getUserVideosCount(userId);

      const standardizedVideos = videos.map(video => {
        let rawVideoUrl = video.video_url || video.path || '/default-video.mp4';
        if (rawVideoUrl && !rawVideoUrl.startsWith('http')) {
          rawVideoUrl = `/uploads/videos/${path.basename(rawVideoUrl)}`;
        }

        let rawThumbUrl = video.thumbnail || '/default-thumbnail.jpg';
        if (rawThumbUrl && !rawThumbUrl.startsWith('http')) {
          const thumbFilename = path.basename(rawThumbUrl);
          rawThumbUrl = thumbFilename.includes('default') ? '/default-thumbnail.jpg' : `/uploads/videos/thumbnails/${thumbFilename}`;
        }

        return {
          ...video,
          video_url: rawVideoUrl.startsWith('http') ? rawVideoUrl : usersController.getFullUrl(req, rawVideoUrl),
          thumbnail: rawThumbUrl.startsWith('http') ? rawThumbUrl : usersController.getFullUrl(req, rawThumbUrl)
        };
      });

      res.json({
        success: true,
        data: standardizedVideos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get profile videos error:', error);
      res.status(500).json({ success: false, message: 'Failed to get profile videos' });
    }
  },

  // ==================== سجل المشاهدة ====================

  // ✅ الحصول على سجل المشاهدة
  async getWatchHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const history = await UserRepository.getWatchHistory(userId, limit, offset);
      const total = await UserRepository.getWatchHistoryCount(userId);

      res.json({
        success: true,
        data: history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('❌ Get watch history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get watch history'
      });
    }
  },

  // ✅ حذف عنصر من سجل المشاهدة
  async deleteWatchHistoryItem(req, res) {
    try {
      const userId = req.user.id;
      const { videoId } = req.params;

      await UserRepository.deleteWatchHistoryItem(userId, videoId);

      res.json({
        success: true,
        message: 'Video removed from watch history'
      });
    } catch (error) {
      console.error('❌ Delete watch history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete watch history item'
      });
    }
  },

  // ✅ مسح سجل المشاهدة بالكامل
  async clearWatchHistory(req, res) {
    try {
      const userId = req.user.id;

      await UserRepository.clearWatchHistory(userId);

      res.json({
        success: true,
        message: 'Watch history cleared successfully'
      });
    } catch (error) {
      console.error('❌ Clear watch history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear watch history'
      });
    }
  },

  // ==================== تفاعلات المستخدم ====================

  async userInteraction(req, res) {
    try {
      const userId = req.user.id;
      const { videoId, action } = req.body;

      if (!videoId || !action) {
        return res.status(400).json({ error: 'Video ID and action are required' });
      }

      const videoExists = await VideoRepository.checkVideoExists(videoId);

      if (!videoExists) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (action === 'like') {
        await VideoRepository.likeVideo(userId, videoId);
      } else if (action === 'dislike') {
        await VideoRepository.unlikeVideo(userId, videoId);
      } else if (action === 'watch') {
        await VideoRepository.recordWatchHistory(userId, videoId);
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

      res.json({ success: true, message: 'Interaction recorded successfully' });

    } catch (error) {
      console.error('User interaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ==================== المتابعة والمتابَعين ====================

  // ✅ البحث عن مستخدمين
  async searchUsers(req, res) {
    try {
      const { q } = req.query;
      const currentUserId = req.user.id;

      if (!q || q.trim().length < 2) {
        return res.json({ users: [] });
      }
      // 🔒 Multi-Tenant Security: Pass tenantId
      const users = await User.searchUsers(q.trim(), currentUserId, req.tenantId);

      res.json({ users });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ الحصول على قائمة المستخدمين (مع فلترة)
  async getUsers(req, res) {
    try {
      // 🔹 التحقق من المعاملات وتحويلها بشكل آمن
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
      const userId = req.query.userId ? parseInt(req.query.userId) : null;

      console.log('🔄 Fetching users:', { page, limit, userId });

      // 🔹 التحقق من صحة userId
      if (userId && (isNaN(userId) || userId <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId parameter'
        });
      }

      const offset = (page - 1) * limit;

      // 🔹 بناء الاستعلام بشكل آمن
      const users = await UserRepository.getUsers({ excludeUserId: userId, limit, offset });

      // 🔹 بناء روابط الصور الكاملة
      const standardizedUsers = users.map(user => ({
        ...user,
        avatar: usersController.getFullUrl(req, user.avatar || '/default-avatar.png')
      }));

      // 🔹 حساب إجمالي العدد للصفحات
      const total = await UserRepository.getUsersCount({ excludeUserId: userId });

      res.json({
        success: true,
        data: standardizedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('❌ Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error.message
      });
    }
  },

  // ✅ متابعة مستخدم
  async followUser(req, res) {
    try {
      const { userId } = req.params;
      const followerId = req.user.id;
      const { username } = req.user;

      await UserService.followUser(followerId, userId, username, req.tenantId);

      res.json({ message: 'User followed successfully' });
    } catch (error) {
      console.error('❌ Follow user error:', error);
      res.status(500).json({
        error: error.message === 'Cannot follow yourself' || error.message === 'Already following this user' 
          ? error.message 
          : 'Internal server error'
      });
    }
  },

  // ✅ إلغاء متابعة مستخدم
  async unfollowUser(req, res) {
    try {
      const { userId } = req.params;
      const followerId = req.user.id;

      await UserService.unfollowUser(followerId, userId);

      res.json({ message: 'User unfollowed successfully' });
    } catch (error) {
      console.error('❌ Unfollow user error:', error);
      res.status(500).json({
        error: error.message === 'Not following this user' ? error.message : 'Internal server error'
      });
    }
  },

  // ✅ الحصول على المتابعين لمستخدم معين
  async getFollowers(req, res) {
    try {
      const { userId } = req.params;

      console.log('🔄 Fetching followers for user:', userId);

      const followers = await UserRepository.getFollowers(userId);

      const standardizedFollowers = (followers || []).map(f => ({
        ...f,
        avatar: usersController.getFullUrl(req, f.avatar || '/default-avatar.png')
      }));

      res.json({
        success: true,
        followers: standardizedFollowers
      });
    } catch (error) {
      console.error('❌ Get followers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch followers'
      });
    }
  },

  // ✅ الحصول على المتابَعين لمستخدم معين
  async getFollowing(req, res) {
    try {
      const { userId } = req.params;

      console.log('🔄 Fetching following for user:', userId);

      const following = await UserRepository.getFollowing(userId);

      const standardizedFollowing = (following || []).map(f => ({
        ...f,
        avatar: usersController.getFullUrl(req, f.avatar || '/default-avatar.png')
      }));

      res.json({
        success: true,
        following: standardizedFollowing
      });
    } catch (error) {
      console.error('❌ Get following error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch following'
      });
    }
  },

  // ✅ الحصول على الإعجابات لمستخدم معين
  async getLikes(req, res) {
    try {
      const { userId } = req.params;

      console.log('🔄 Fetching likes for user:', userId);

      const likes = await UserRepository.getLikesForUserVideos(userId);

      const standardizedLikes = (likes || []).map(l => ({
        ...l,
        avatar: usersController.getFullUrl(req, l.avatar || '/default-avatar.png')
      }));

      res.json({
        success: true,
        likes: standardizedLikes
      });
    } catch (error) {
      console.error('❌ Get likes error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch likes'
      });
    }
  },

  // ✅ الحصول على المتابعين للمستخدم الحالي
  async getMyFollowers(req, res) {
    try {
      const userId = req.user.id;
      // 🔒 Multi-Tenant Security: Pass tenantId
      const followers = await User.getUserFollowers(userId, req.tenantId);
      const standardizedFollowers = (followers || []).map(f => ({
        ...f,
        avatar: usersController.getFullUrl(req, f.avatar || '/default-avatar.png')
      }));
      res.json({ followers: standardizedFollowers });
    } catch (error) {
      console.error('Get followers error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ الحصول على المتابَعين للمستخدم الحالي
  async getMyFollowing(req, res) {
    try {
      const userId = req.user.id;
      // 🔒 Multi-Tenant Security: Pass tenantId
      const following = await User.getUserFollowing(userId, req.tenantId);
      const standardizedFollowing = (following || []).map(f => ({
        ...f,
        avatar: usersController.getFullUrl(req, f.avatar || '/default-avatar.png')
      }));
      res.json({ following: standardizedFollowing });
    } catch (error) {
      console.error('Get following error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ التحقق من حالة المتابعة
  async getFollowStatus(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      // 🔒 Multi-Tenant Security: Pass tenantId
      const isFollowing = await User.isFollowing(userId, parseInt(targetUserId), req.tenantId);

      res.json({
        success: true,
        isFollowing
      });
    } catch (error) {
      console.error('Get follow status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get follow status'
      });
    }
  },

  // ==================== التفضيلات والإعدادات ====================

  // ✅ الحصول على تفضيلات المستخدم
  async getUserPreferences(req, res) {
    try {
      const userId = req.user.id;
      console.log('🔄 Getting user preferences for:', userId);

        const prefs = await UserRepository.getUserPreferences(userId);

        if (prefs) {
          const preferences = {
            preferred_categories: JSON.parse(prefs.preferred_categories || '[]'),
            content_weights: JSON.parse(prefs.content_weights || '{}'),
            excluded_users: JSON.parse(prefs.excluded_users || '[]')
          };

          return res.json({ preferences });
        }

      const defaultPreferences = {
        preferred_categories: [],
        content_weights: {},
        excluded_users: []
      };

      res.json({
        preferences: defaultPreferences
      });
    } catch (error) {
      console.error('Get user preferences error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ تحديث تفضيلات المستخدم
  async updateUserPreferences(req, res) {
    try {
      const userId = req.user.id;
      const { preferences } = req.body;

      console.log('🔄 Updating user preferences for:', userId, preferences);

      try {
        await UserRepository.updateUserPreferences(userId, preferences);
      } catch (dbError) {
        console.error('Error saving preferences to DB:', dbError);
      }

      res.json({
        message: 'Preferences updated successfully',
        preferences: preferences
      });
    } catch (error) {
      console.error('Update user preferences error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ الحصول على إحصائيات المستخدم
  async getUserStats(req, res) {
    try {
      const userId = req.user.id;

      const stats = await UserRepository.getUserStats(userId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user statistics'
      });
    }
  },

  // ✅ تحديث إعدادات الإشعارات
  async updateNotificationSettings(req, res) {
    try {
      const userId = req.user.id;
      const { notifications } = req.body;

      await UserRepository.updateNotificationSettings(userId, notifications);

      res.json({
        success: true,
        message: 'Notification settings updated successfully'
      });
    } catch (error) {
      console.error('Update notification settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification settings'
      });
    }
  },

  // ✅ الحصول على إعدادات الخصوصية
  async getPrivacySettings(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          is_private: !!user.is_private,
          allow_dms: !!user.allow_dms,
          show_activity_status: !!user.show_activity_status
        }
      });
    } catch (error) {
      console.error('Get privacy settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get privacy settings'
      });
    }
  },

  // ✅ تحديث إعدادات الخصوصية
  async updatePrivacySettings(req, res) {
    try {
      const userId = req.user.id;
      const { is_private, allow_dms, show_activity_status } = req.body;

      await UserRepository.updatePrivacySettings(userId, { is_private, allow_dms, show_activity_status });

      res.json({
        success: true,
        message: 'Privacy settings updated successfully'
      });
    } catch (error) {
      console.error('Update privacy settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update privacy settings'
      });
    }
  },

  // ✅ تحديث المظهر واللغة
  async updateAppearance(req, res) {
    try {
      const userId = req.user.id;
      const { theme, language } = req.body;

      await UserRepository.updateUserAppearance(userId, { theme, language });

      res.json({
        success: true,
        message: 'Appearance settings updated'
      });
    } catch (error) {
      console.error('Update appearance error:', error);
      res.status(500).json({ success: false, message: 'Failed to update appearance' });
    }
  },

  // ==================== البحث والإكتشاف ====================

  // ✅ الحصول على المستخدمين المقترحين للمتابعة
  async getSuggestedUsers(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;

      const suggestedUsers = await UserRepository.getSuggestedUsers(userId, limit);

      res.json({
        success: true,
        data: suggestedUsers
      });
    } catch (error) {
      console.error('Get suggested users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get suggested users'
      });
    }
  },

  // ==================== الإدارة والأمان ====================

  // ✅ تغيير كلمة المرور
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      const password = await UserRepository.getUserPassword(userId);

      if (!password) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // التحقق من كلمة المرور الحالية
      const isValidPassword = await bcrypt.compare(currentPassword, password);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // تشفير كلمة المرور الجديدة
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await UserRepository.updateUserPassword(userId, hashedPassword);

      console.log('✅ Password changed successfully for user:', userId);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password'
      });
    }
  },

  // ✅ إلغاء الحساب
  async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }

      const userPassword = await UserRepository.getUserPassword(userId);

      if (!userPassword) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // التحقق من كلمة المرور
      const isValidPassword = await bcrypt.compare(password, userPassword);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Password is incorrect'
        });
      }

      // تحديث الحساب بدلاً من حذفه (لحفظ البيانات)
      await UserRepository.deleteAccount(userId);

      console.log('✅ Account deleted successfully for user:', userId);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  },

  // ✅ الحصول على نشاط المستخدم
  async getUserActivity(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const activities = await UserRepository.getUserActivity(userId, limit, offset);
      const total = await UserRepository.getUserActivityCount(userId);

      res.json({
        success: true,
        data: activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get user activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user activity'
      });
    }
  },

  // ==================== الإشعارات ====================

  // ✅ الحصول على إشعارات المستخدم
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const notifications = await UserRepository.getNotifications(userId, limit, offset);
      const total = await UserRepository.getNotificationsCount(userId);

      res.json({
        success: true,
        data: notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications'
      });
    }
  },

  // ✅ تحديد الإشعار كمقروء
  async markNotificationAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      await UserRepository.markNotificationAsRead(userId, notificationId);

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  },

  // ✅ تحديد جميع الإشعارات كمقروءة
  async markAllNotificationsAsRead(req, res) {
    try {
      const userId = req.user.id;

      await UserRepository.markAllNotificationsAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  },

  // ✅ حذف إشعار
  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      await UserRepository.deleteNotification(userId, notificationId);

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }
  },

  // ==================== البلوك والحظر ====================

  // ✅ حظر مستخدم
  async blockUser(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      if (parseInt(targetUserId) === userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot block yourself'
        });
      }

      await UserRepository.blockUser(userId, targetUserId);

      res.json({
        success: true,
        message: 'User blocked successfully'
      });
    } catch (error) {
      console.error('Block user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to block user'
      });
    }
  },

  // ✅ إلغاء حظر مستخدم
  async unblockUser(req, res) {
    try {
      const userId = req.user.id;
      const { userId: targetUserId } = req.params;

      await UserRepository.unblockUser(userId, targetUserId);

      res.json({
        success: true,
        message: 'User unblocked successfully'
      });
    } catch (error) {
      console.error('Unblock user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unblock user'
      });
    }
  },

  // ✅ الحصول على قائمة المستخدمين المحظورين
  async getBlockedUsers(req, res) {
    try {
      const userId = req.user.id;

      const blockedUsers = await UserRepository.getBlockedUsers(userId);

      res.json({
        success: true,
        data: blockedUsers
      });
    } catch (error) {
      console.error('Get blocked users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get blocked users'
      });
    }
  },

  // ==================== دوال إضافية ====================

  // ✅ الحصول على إحصائيات التوصية
  async getRecommendationStats(req, res) {
    try {
      const userId = req.user.id;

      const stats = await UserRepository.getRecommendationStats(userId);

      res.json({
        interactions: stats.interactions,
        watchHistory: stats.watchHistory,
        modelUpdated: new Date()
      });
    } catch (error) {
      console.error('Get recommendation stats error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  // ✅ تحديث إعدادات الخصوصية
  async updatePrivacySettings(req, res) {
    try {
      const userId = req.user.id;
      const { is_private, allow_dms, show_activity_status } = req.body;

      console.log('🔄 Updating privacy settings for user:', userId, {
        is_private,
        allow_dms,
        show_activity_status
      });

      // التحقق من وجود الحقول المطلوبة
      if (is_private === undefined || allow_dms === undefined || show_activity_status === undefined) {
        return res.status(400).json({
          success: false,
          message: 'All privacy settings are required'
        });
      }

      await UserRepository.updatePrivacySettings(userId, { is_private, allow_dms, show_activity_status });

      console.log('✅ Privacy settings updated successfully for user:', userId);

      res.json({
        success: true,
        message: 'Privacy settings updated successfully'
      });
    } catch (error) {
      console.error('Update privacy settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update privacy settings'
      });
    }
  },

  // ✅ الحصول على إعدادات الخصوصية
  async getPrivacySettings(req, res) {
    try {
      const userId = req.user.id;

      const user = await UserRepository.getPrivacySettings(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          is_private: user.is_private || false,
          allow_dms: user.allow_dms || true,
          show_activity_status: user.show_activity_status || true
        }
      });
    } catch (error) {
      console.error('Get privacy settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get privacy settings'
      });
    }
  },

  // ✅ تنزيل بيانات المستخدم
  async downloadUserData(req, res) {
    try {
      const userId = req.user.id;

      // Fetch all user related data
      const fullData = await UserRepository.getFullUserData(userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=user_data_${userId}.json`);
      res.json(fullData);

    } catch (error) {
      console.error('Download user data error:', error);
      res.status(500).json({ error: 'Failed to download data' });
    }
  }
};
