import { Video } from '../models/Video.js';
import searchService from '../services/searchService.js';
import path, { join, dirname } from 'path';
import fs from 'fs';
import { ThumbnailService } from '../services/thumbnailService.js';
import aiService from '../services/aiService.js';
import { fileURLToPath } from 'url';
import { createNotification } from './notificationController.js';
import { auditService } from '../services/auditService.js';
import logger from '../utils/logger.js';
import VideoRepository from '../repositories/VideoRepository.js';
import VideoService from '../services/VideoService.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const videoController = {

  // Helper to construct full URL
  getFullUrl(req, pathStr) {
    if (!pathStr || pathStr.startsWith('http')) return pathStr;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protocol}://${host}${pathStr.startsWith('/') ? '' : '/'}${pathStr}`;
  },


  // ==================== دوال المشاركة الجديدة ====================

  // ✅ تسجيل مشاركة الفيديو
  async addShare(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user?.id;
      const { shareMethod = 'direct' } = req.body;

      const result = await VideoService.addShare(videoId, userId, shareMethod);

      res.json({
        success: true,
        message: 'Share recorded successfully',
        shareCount: result.shareCount,
        alreadyShared: result.alreadyShared
      });
    } catch (error) {
      console.error('❌ Add share error:', error);
      res.status(500).json({ success: false, error: 'Failed to record share' });
    }
  },

  // ✅ الحصول على عدد المشاركات
  async getShareCount(req, res) {
    try {
      const { videoId } = req.params;

      const shareCount = await Video.getShareCount(videoId);

      res.json({
        success: true,
        shareCount: shareCount
      });
    } catch (error) {
      console.error('❌ Get share count error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get share count'
      });
    }
  },

  // ==================== دوال جديدة ====================

  // ✅ الحصول على فيديوهات المستخدم مع إمكانية الفرز
  async getUserVideos(req, res) {
    try {
      const { userId } = req.params;
      const { sortBy = 'latest' } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
      }

      const targetUserId = parseInt(userId);
      const reqUserId = parseInt(req.user?.id) || 0;

      let orderBy = 'v.created_at DESC';
      switch (sortBy) {
        case 'trending':
          orderBy = 'v.views DESC, v.likes DESC, v.shares DESC';
          break;
        case 'oldest':
          orderBy = 'v.created_at ASC';
          break;
        case 'latest':
        default:
          orderBy = 'v.created_at DESC';
      }

      const videos = await VideoRepository.getUserVideos({
        reqUserId,
        targetUserId,
        tenantId: req.tenantId,
        orderBy
      });

      // ✅ إضافة التعليقات الافتراضية و thumbnail و video_url
      for (let video of videos) {
        video.comment_count = await VideoRepository.getCommentCount(video.id);
        videoController.standardizeVideo(req, video);
      }

      res.json({ success: true, videos: videos || [] });

    } catch (error) {
      console.error('❌ Get user videos error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch user videos' });
    }
  },

  // ✅ تسجيل مشاهدة الفيديو
  async addView(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user?.id;

      console.log(`👁️ Recording view for video ${videoId} by user ${userId}`);

      const hasViewed = await VideoRepository.checkExistingView(videoId, userId);

      if (!hasViewed) {
        await VideoRepository.recordView(videoId, userId);
        await VideoRepository.incrementVideoViews(videoId);

        // ✅ تحديث إجمالي مشاهدات المستخدم (صاحب الفيديو)
        const ownerId = await VideoRepository.getVideoOwner(videoId);
        if (ownerId) {
          await VideoRepository.incrementUserViewsCount(ownerId);
        }

        // ✅ تسجيل التفاعل في نظام التوصية
        try {
          const { recommendationEngine } = await import('../services/recommendationEngine.js');
          await recommendationEngine.recordInteraction({
            userId,
            videoId: parseInt(videoId),
            type: 'view',
            weight: 0.5,
            timestamp: new Date()
          });
        } catch (recError) {
          console.error('Failed to record view interaction:', recError);
          await Video.recordUserInteraction(userId, videoId, 'view', 0.5);
        }

        console.log(`✅ View recorded for video ${videoId}`);
        res.json({ success: true, message: 'View recorded' });
      } else {
        console.log(`ℹ️ View already recorded for video ${videoId} by user ${userId}`);
        res.json({ success: true, message: 'View already recorded' });
      }

    } catch (error) {
      console.error('❌ Add view error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record view'
      });
    }
  },

  // ✅ هيلبر موحد لمعالجة بيانات الفيديو (محلي فقط)
  standardizeVideo(req, v) {
    if (!v) return v;

    // 1. معالجة الفيديو (محلي فقط)
    let videoFilename = v.path || (v.video_url ? path.basename(v.video_url) : '');

    // إذا كان رابطاً كاملاً، نأخذ اسم الملف فقط
    if (videoFilename && (videoFilename.startsWith('http') || videoFilename.includes('/'))) {
      videoFilename = path.basename(videoFilename);
    }

    if (videoFilename) {
      v.video_url = videoController.getFullUrl(req, `/uploads/videos/${videoFilename}`);
    } else {
      v.video_url = v.video_url || '/default-video.mp4';
    }

    // 2. معالجة الصورة المصغرة (محلي فقط)
    let thumbFilename = v.thumbnail ? path.basename(v.thumbnail) : '';
    if (thumbFilename) {
      thumbFilename = path.basename(thumbFilename);
      if (thumbFilename.includes('default')) {
        v.thumbnail = videoController.getFullUrl(req, '/default-thumbnail.jpg');
      } else {
        v.thumbnail = videoController.getFullUrl(req, `/uploads/videos/thumbnails/${thumbFilename}`);
      }
    } else {
      v.thumbnail = videoController.getFullUrl(req, '/default-thumbnail.jpg');
    }

    // 3. معالجة الأفاتار
    let avatarUrl = v.avatar || '/default-avatar.png';
    if (avatarUrl) {
      const avatarFilename = path.basename(avatarUrl);
      if (avatarFilename.includes('default')) {
        v.avatar = videoController.getFullUrl(req, '/default-avatar.png');
      } else {
        v.avatar = videoController.getFullUrl(req, `/uploads/avatars/${avatarFilename}`);
      }
    }

    // تحويل الأرقام لضمان النوع
    v.likes = parseInt(v.likes) || 0;
    v.views = parseInt(v.views) || 0;
    v.comment_count = parseInt(v.comment_count) || 0;

    return v;
  },

  // ==================== دوال الرفع والحصول على الفيديوهات ====================
  // اقتراح عنوان بالذكاء الاصطناعي
  suggestTitle: async (req, res) => {
    try {
      const { description, category } = req.body;
      if (!description) return res.status(400).json({ error: 'Description is required' });

      const suggestion = await aiService.suggestTitle(description, category);
      res.json({ success: true, suggestion });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async uploadVideo(req, res) {
    try {
      const { getVideoLimits } = await import('../middleware/settingsMiddleware.js');
      const limits = await getVideoLimits();

      if (!req.file) return res.status(400).json({ error: 'Video file is required' });

      // ✅ Validate file signature beyond client MIME type
      const { validateUploadedFileSignature } = await import('../middleware/uploadMiddleware.js');
      if (!validateUploadedFileSignature(req.file)) {
        return res.status(400).json({ error: 'Invalid or unsupported video file signature' });
      }

      if (req.file.size > limits.maxSize) {
        return res.status(400).json({
          error: `File too large. Maximum allowed size is ${limits.maxSize / (1024 * 1024)}MB`
        });
      }

      const { duration } = req.body;
      if (duration && parseFloat(duration) > limits.maxDuration) {
        return res.status(400).json({
          error: `Video too long. Maximum allowed duration is ${limits.maxDuration} seconds`
        });
      }

      const userCountry = await UserRepository.getUserCountry(req.user.id) || 'Global';

      const video = await VideoService.uploadVideo(
        { userId: req.user.id, tenantId: req.tenantId, userCountry },
        { filename: req.file.filename, path: req.file.path },
        req.body
      );

      // ✅ Log Action for Audit
      await auditService.logAction({
        tenant_id: req.tenantId,
        user_id: req.user.id,
        action: req.body.replaceVideoId ? 'update_video' : 'upload_video',
        resource_type: 'video',
        resource_id: video.id,
        details: { title: video.title, category: video.category },
        ip_address: req.ip || req.connection.remoteAddress
      });

      // ✅ الفهرسة في Elasticsearch / OpenSearch للبحث السريع
      try {
        await searchService.indexVideo(video);
      } catch (esError) {
        console.error('Failed to index video in ES:', esError.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Video uploaded and processing started',
        video: videoController.standardizeVideo(req, video)
      });

    } catch (err) {
      logger.error('❌ uploadVideo error:', err);
      if (err.name !== 'ValidationError') {
        await auditService.alertSuperAdmin(err, { user_id: req.user?.id, tenant_id: req.tenantId });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  },


  async getRecommendedVideos(req, res) {
    try {
      const userId = parseInt(req.user?.id) || 0;
      const limit = Math.max(1, parseInt(req.query.limit) || 10);

      const videos = await VideoService.getRecommendedVideos(userId, req.tenantId, limit);

      for (const v of videos) {
        videoController.standardizeVideo(req, v);
      }

      res.json({
        videos,
        message: videos.length ? 'Recommended videos' : 'Popular videos'
      });

    } catch (error) {
      console.error('❌ getRecommendedVideos error:', error);
      res.status(500).json({ error: 'Failed to load videos', videos: [] });
    }
  },
  async getFollowingVideos(req, res) {
    try {
      const userId = parseInt(req.user?.id) || 0;
      const limit = parseInt(req.query.limit) || 10;

      console.log(`🔄 Getting following videos for user: ${userId}`);

      // 1️⃣ جلب قائمة المستخدمين الذين يتابعهم المستخدم الحالي
      const followingIds = await UserRepository.getFollowingUserIds(userId);

      // 2️⃣ جلب الفيديوهات من المتابعين إذا وجدوا
      let videos = [];
      if (followingIds.length > 0) {
        videos = await RecommendationEngine.getFollowingVideos(userId, followingIds, limit);
      }

      // 3️⃣ إذا لم يتم جلب أي فيديوهات، استخدم fallback للفيديوهات العامة
      if (!videos || videos.length === 0) {
        console.log('⚠️ No following videos found, using general videos fallback');
        // 🔒 Multi-Tenant Security: Pass tenantId
        videos = await Video.getVideos(req.tenantId, limit, 0);
      }

      // 4️⃣ إضافة عدد التعليقات وروابط الفيديو وthumbnail
      for (let video of videos) {
        try {
          video.comment_count = await VideoRepository.getCommentCount(video.id);

          // ✅ مسارات موحدة
          const videoPath = video.path || '';
          video.video_url = (videoPath.startsWith('http')) ? videoPath : (video.video_url || '/default-video.mp4');

          const thumbPath = video.thumbnail || '';
          video.thumbnail = (thumbPath.startsWith('http')) ? thumbPath : (thumbPath.includes('default')
            ? '/default-thumbnail.jpg'
            : `/uploads/videos/thumbnails/${path.basename(thumbPath)}`);

        } catch (error) {
          console.warn(`⚠️ Error processing video ${video.id}:`, error.message);
          video.comment_count = 0;
          video.thumbnail = '/default-thumbnail.jpg';
          video.video_url = 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-the-night-sky-121-large.mp4';
        }
      }

      res.json({
        videos,
        message: followingIds.length > 0 ? 'Videos from users you follow' : 'Popular videos'
      });

    } catch (error) {
      console.error('❌ Get following videos error:', error);
      res.status(500).json({ error: 'Failed to load videos', videos: [] });
    }
  }

  ,
  async getVideo(req, res) {
    try {
      const { id } = req.params;
      const userId = parseInt(req.user?.id) || 0;

      console.log('🔍 Fetching video:', id);

      // 🔒 Multi-Tenant Security: Pass tenantId
      const video = await Video.getVideoWithLikes(id, userId, req.tenantId);
      if (!video) return res.status(404).json({ error: 'Video not found' });

      // معالجة الصورة المصغرة
      if (!video.thumbnail || video.thumbnail === 'null' || video.thumbnail === 'undefined') {
        video.thumbnail = '/default-thumbnail.jpg';
      }

      // التحقق من وجود ملف الفيديو
      const vFilename = video.path ? path.basename(video.path) : '';
      const vPath = path.join(process.cwd(), 'uploads', 'videos', vFilename);

      if (!vFilename || !fs.existsSync(vPath)) {
        console.log('❌ Video file missing on server:', vPath);
        return res.status(404).json({
          error: 'Video file not found on server',
          details: 'The video record exists but the file is missing'
        });
      }

      // الحصول على عدد التعليقات
      video.comment_count = await VideoRepository.getCommentCount(id);

      // زيادة عدد المشاهدات
      await Video.incrementViews(id);

      // ✅ مسارات موحدة
      video.video_url = `/uploads/videos/${vFilename}`;

      const tFilename = video.thumbnail ? path.basename(video.thumbnail) : '';
      video.thumbnail = tFilename.includes('default')
        ? '/default-thumbnail.jpg'
        : `/uploads/videos/thumbnails/${tFilename}`;

      res.json({
        video: {
          ...video,
          file_exists: true,
          likes: parseInt(video.likes) || 0,
          views: parseInt(video.views) || 0,
          user_id: parseInt(video.user_id) || 0
        }
      });

    } catch (error) {
      console.error('❌ Get video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getUserVideo(req, res) {
    try {
      // ✅ التعديل: الحصول على آخر فيديو للمستخدم بدلاً من فيديو واحد فقط
      // 🔒 Multi-Tenant Security: Pass tenantId
      const videos = await Video.getVideosByUser(req.user.id, req.tenantId, 1, 0);
      const video = videos.length > 0 ? videos[0] : null;

      if (video) {
        // ✅ إضافة عدد التعليقات لفيديو المستخدم
        video.comment_count = await VideoRepository.getCommentCount(video.id);

        // ✅ التأكد من وجود thumbnail ورابط فيديو
        const videoFilename = video.path ? path.basename(video.path) : '';
        video.video_url = videoFilename ? `/uploads/videos/${videoFilename}` : (video.video_url || 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-the-night-sky-121-large.mp4');

        const thumbFilename = video.thumbnail ? path.basename(video.thumbnail) : '';
        video.thumbnail = thumbFilename.includes('default')
          ? '/default-thumbnail.jpg'
          : `/uploads/videos/thumbnails/${thumbFilename}`;
      }

      res.json({ video });
    } catch (error) {
      console.error('Get user video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ==================== دوال التفاعل مع الفيديوهات ====================

  async deleteVideo(req, res) {
    try {
      const { id } = req.params;

      console.log('🗑️ Deleting video:', id);

      // الحصول على معلومات الفيديو قبل الحذف
      // 🔒 Multi-Tenant Security: Pass tenantId
      const video = await Video.findById(id, req.tenantId);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // ✅ التحقق من أن المستخدم هو صاحب الفيديو
      if (video.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // ✅ التعديل: المسار الصحيح لحذف الملف
      const filePath = path.join(process.cwd(), 'uploads', 'videos', path.basename(video.path));
      console.log('📍 File to delete:', filePath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('✅ Video file deleted from server');
      } else {
        console.log('⚠️ Video file not found on server:', filePath);
      }

      // ✅ حذف thumbnail
      if (video.thumbnail && !video.thumbnail.includes('default-thumbnail')) {
        ThumbnailService.deleteThumbnail(video.thumbnail);
      }

      // 🔒 Multi-Tenant Security: Verify ownership and tenant
      const deleted = await Video.delete(id, req.user.id, req.tenantId);

      if (!deleted) {
        return res.status(404).json({ error: 'Video not found or access denied' });
      }

      // ✅ Log Action for Audit
      await auditService.logAction({
        tenant_id: req.tenantId,
        user_id: req.user.id,
        action: 'delete_video',
        resource_type: 'video',
        resource_id: id,
        details: { title: video.title },
        ip_address: req.ip || req.connection.remoteAddress
      });

      // ✅ الحذف من فهرس Elasticsearch / OpenSearch للبحث السريع
      try {
        await searchService.deleteVideoFromIndex(id);
      } catch (esError) {
        console.error('Failed to delete video from ES:', esError.message);
      }

      res.json({ message: 'Video deleted successfully' });
    } catch (error) {
      logger.error('Delete video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }

  },

  async likeVideo(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.id;

      console.log(`Like/Unlike request - User: ${userId}, Video: ${videoId}`);

      // 🔒 Multi-Tenant Security: Validate tenant ownership
      const video = await Video.findById(videoId, req.tenantId);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const result = await Video.likeVideo(userId, parseInt(videoId));

      if (!result.success) {
        return res.status(500).json({
          error: 'Like action failed',
          details: result.error
        });
      }

      const likeCount = await Video.getLikeCount(parseInt(videoId));
      const isLiked = result.liked;

      // تسجيل التفاعل في نظام التوصية
      try {
        const { recommendationEngine } = await import('../services/recommendationEngine.js');
        await recommendationEngine.recordInteraction({
          userId,
          videoId: parseInt(videoId),
          type: result.liked ? 'like' : 'unlike',
          weight: result.liked ? 1.0 : -1.0,
          timestamp: new Date()
        });
      } catch (recError) {
        console.error('Failed to record interaction:', recError);
        // تسجيل بديل في قاعدة البيانات
        await Video.recordUserInteraction(userId, videoId, result.liked ? 'like' : 'unlike', result.liked ? 1.0 : -1.0);
      }

      // 🔔 ارسال إشعار عند الإعجاب
      if (result.liked) {
        try {
          // 🔒 Multi-Tenant Security: Pass tenantId
          const video = await Video.findById(videoId, req.tenantId);
          if (video && video.user_id !== userId) {
            await createNotification(
              video.user_id,
              'like',
              userId,
              videoId,
              'video',
              `أعجب ${req.user.username} بفيديو الخاص بك`,
              req.tenantId
            );
          }
        } catch (notifError) {
          console.error('Failed to send like notification:', notifError);
        }
      }

      res.json({
        message: `Video ${result.action} successfully`,
        likes: likeCount,
        isLiked: isLiked,
        action: result.action
      });

    } catch (error) {
      console.error('Like video error in controller:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async unlikeVideo(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.id;

      console.log(`Unlike request - User: ${userId}, Video: ${videoId}`);

      const result = await Video.unlikeVideo(userId, parseInt(videoId));

      if (!result.success) {
        return res.status(404).json({ error: 'Video not liked' });
      }

      const likeCount = await Video.getLikeCount(parseInt(videoId));

      res.json({
        message: 'Video unliked successfully',
        likes: likeCount,
        isLiked: false,
        action: 'unliked'
      });
    } catch (error) {
      console.error('Unlike video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getLikedVideos(req, res) {
    try {
      const userId = req.user.id;

      const videos = await Video.getUserLikedVideos(userId);

      // ✅ إضافة عدد التعليقات لكل فيديو محبب والتحقق من thumbnail و video_url
      for (let video of videos) {
        // عدد التعليقات
        video.comment_count = await VideoRepository.getCommentCount(video.id);

        // ✅ مسارات موحدة
        const videoFilename = video.path ? path.basename(video.path) : '';
        const rawVideoUrl = videoFilename ? `/uploads/videos/${videoFilename}` : (video.video_url || '/default-video.mp4');
        video.video_url = videoController.getFullUrl(req, rawVideoUrl);

        const thumbFilename = video.thumbnail ? path.basename(video.thumbnail) : '';
        const rawThumbUrl = (thumbFilename && !thumbFilename.includes('default'))
          ? `/uploads/videos/thumbnails/${thumbFilename}`
          : '/default-thumbnail.jpg';
        video.thumbnail = videoController.getFullUrl(req, rawThumbUrl);

        // Ensure user avatar is also full URL if present
        if (video.avatar) {
          video.avatar = videoController.getFullUrl(req, video.avatar);
        }
      }

      res.json({ videos });
    } catch (error) {
      console.error('Get liked videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },


  // ==================== دوال سجل المشاهدة والتفاعل ====================

  async recordWatchHistory(req, res) {
    try {
      const userId = req.user.id;
      const { videoId, watchTime, completed } = req.body;

      console.log(`📊 Recording watch history - User: ${userId}, Video: ${videoId}, Time: ${watchTime}s`);

      // تسجيل في سجل المشاهدة
      await VideoRepository.recordDetailedWatchHistory(userId, videoId, watchTime, completed);

      // تحديث إحصائيات المستخدم
      await UserRepository.incrementTotalWatchTime(userId, watchTime || 0);

      // تسجيل في نظام التوصية
      try {
        const { recommendationEngine } = await import('../services/recommendationEngine.js');
        await recommendationEngine.recordInteraction({
          userId,
          videoId,
          type: 'watch',
          weight: completed ? 2.0 : Math.min((watchTime || 0) / 60, 1.5),
          metadata: { watchTime, completed }
        });
      } catch (recError) {
        console.error('Failed to record watch interaction:', recError);
        // تسجيل بديل في قاعدة البيانات
        await Video.recordUserInteraction(userId, videoId, 'watch', completed ? 2.0 : Math.min((watchTime || 0) / 60, 1.5));
      }

      res.json({ message: 'Watch history recorded successfully' });
    } catch (error) {
      console.error('Record watch history error:', error);
      res.status(500).json({ error: 'Failed to record watch history' });
    }
  },

  async recordInteraction(req, res) {
    try {
      const userId = req.user.id;
      const { videoId, type, weight, metadata } = req.body;

      console.log(`🎯 Recording interaction - User: ${userId}, Video: ${videoId}, Type: ${type}`);

      // استخدام محرك التوصية إذا كان موجوداً
      try {
        const { recommendationEngine } = await import('../services/recommendationEngine.js');
        await recommendationEngine.recordInteraction({
          userId,
          videoId,
          type,
          weight: weight || 1.0,
          metadata,
          timestamp: new Date()
        });
      } catch (recError) {
        console.error('Failed to record interaction in engine:', recError);
        // تسجيل بديل في قاعدة البيانات
        await Video.recordUserInteraction(userId, videoId, type, weight || 1.0);
      }

      res.json({ message: 'Interaction recorded successfully' });
    } catch (error) {
      console.error('Record interaction error:', error);
      res.status(500).json({ error: 'Failed to record interaction' });
    }
  },

  // ==================== دوال البحث والإحصائيات ====================

  // ==================== 📋 GET /api/videos (عام) ====================
  async getVideos(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const sortBy = ['views', 'likes', 'latest', 'oldest'].includes(req.query.sortBy)
        ? req.query.sortBy : 'latest';

      const userId = req.user?.id || 0;
      const rows = await VideoRepository.getPublicVideos({ userId, sortBy, limit, offset });

      const standardizedVideos = rows.map(v => videoController.standardizeVideo(req, v));

      const total = await VideoRepository.getPublicVideosCount();

      res.json({
        success: true,
        videos: standardizedVideos,
        pagination: {
          page,
          limit,
          total: total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('❌ getVideos error:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch videos' });
    }
  },
  async searchVideos(req, res) {
    try {
      const { q } = req.query;
      // ✅ استخدام قيم افتراضية آمنة
      const userId = req.user?.id || 0;
      const limit = parseInt(req.query.limit) || 20;

      if (!q || q.trim().length < 2) {
        return res.json({ videos: [] });
      }

      // 🔒 Multi-Tenant Security: Pass tenantId
      const videos = await Video.searchVideos(q.trim(), req.tenantId, userId, limit);

      const standardizedVideos = videos.map(v => videoController.standardizeVideo(req, v));
      res.json({ videos: standardizedVideos });
    } catch (error) {
      console.error('Search videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getTrendingVideos(req, res) {
    try {
      // ✅ استخدام قيم افتراضية آمنة
      const limit = parseInt(req.query.limit) || 10;
      const days = parseInt(req.query.days) || 7;

      // 🔒 Multi-Tenant Security: Pass tenantId
      const videos = await Video.getTrendingVideos(req.tenantId, limit, days);

      const standardizedVideos = videos.map(v => videoController.standardizeVideo(req, v));
      res.json({ videos: standardizedVideos });
    } catch (error) {
      console.error('Get trending videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getVideoStats(req, res) {
    try {
      const { videoId } = req.params;
      const stats = await Video.getVideoStats(videoId);

      res.json({ stats });
    } catch (error) {
      console.error('Get video stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getCommentCount(req, res) {
    try {
      const { videoId } = req.params;

      const count = await VideoRepository.getCommentCount(videoId);
      res.json({ count });
    } catch (error) {
      console.error('Get comment count error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ==================== 🚀 VIDEO TURBO ENGINE ENDPOINTS ====================

  /**
   * الحصول على manifest file للفيديو (HLS)
   */
  async getManifest(req, res) {
    try {
      const { videoId } = req.params;
      // 🔒 Multi-Tenant Security: Pass tenantId
      const video = await Video.findById(videoId, req.tenantId);

      if (!video) return res.status(404).json({ error: 'Video not found' });

      // 1️⃣ Check for Local HLS Manifest (Old way)
      const manifestPath = path.join(process.cwd(), 'uploads', 'chunks', videoId, 'master.m3u8');
      if (fs.existsSync(manifestPath)) {
        const manifestUrl = videoController.getFullUrl(req, `/uploads/chunks/${videoId}/master.m3u8`);
        return res.json({
          manifestUrl,
          processingStatus: 'completed'
        });
      }

      // 2️⃣ Check for Cloudinary HLS (New way)
      // video.path stores the public_id in Cloudinary (e.g., "nojoom/videos/video-123")
      if (video.path && (video.path.includes('nojoom/videos') || video.path.startsWith('video-'))) {
        const publicId = video.path.includes('nojoom/videos')
          ? video.path
          : `nojoom/videos/${video.path}`;

        // Cloudinary HLS URL format: https://res.cloudinary.com/<cloud_name>/video/upload/sp_hd/v1/<public_id>.m3u8
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dg7m2vey6';
        const hlsUrl = `https://res.cloudinary.com/${cloudName}/video/upload/sp_hd/${publicId}.m3u8`;

        console.log(`📡 Returning Cloudinary HLS for video ${videoId}: ${hlsUrl}`);

        return res.json({
          manifestUrl: hlsUrl,
          processingStatus: 'completed'
        });
      }

      // 3️⃣ Fallback to MP4
      const vStd = videoController.standardizeVideo(req, { ...video });
      const fallbackUrl = vStd.video_url;
      console.log(`ℹ️ HLS manifest not found for video ${videoId}, returning fallback: ${fallbackUrl}`);

      res.json({
        manifestUrl: null,
        processingStatus: 'not_available',
        message: 'HLS streaming not available',
        fallbackUrl
      });

    } catch (error) {
      console.error('Get manifest error:', error);
      res.json({
        manifestUrl: null,
        processingStatus: 'error',
        error: 'Manifest load failed'
      });
    }
  },

  async getChunk(req, res) {
    try {
      const { videoId, quality, index } = req.params;

      const chunkPath = path.join(
        process.cwd(),
        'uploads',
        'chunks',
        videoId,
        quality,
        `segment_${String(index).padStart(3, '0')}.ts`
      );

      if (!fs.existsSync(chunkPath)) {
        return res.status(404).json({ error: 'Chunk not found' });
      }

      // إرسال الـ chunk
      res.sendFile(chunkPath);

    } catch (error) {
      console.error('Get chunk error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * الحصول على حالة معالجة الفيديو
   */
  async getProcessingStatus(req, res) {
    try {
      const { videoId } = req.params;
      const { videoChunkService } = await import('../services/videoChunkService.js');

      const status = await videoChunkService.getProcessingStatus(videoId);

      if (!status) {
        return res.status(404).json({ error: 'Processing status not found' });
      }

      res.json({
        videoId: parseInt(videoId),
        status: status.processing_status,
        totalChunks: status.total_chunks,
        manifestPath: status.manifest_path,
        errorMessage: status.error_message,
        createdAt: status.created_at,
        updatedAt: status.updated_at
      });

    } catch (error) {
      console.error('Get processing status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * الحصول على تقدم المشاهدة للفيديو
   */
  async getVideoProgress(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.id;

      const { videoProgressService } = await import('../services/videoProgressService.js');
      const progress = await videoProgressService.getProgress(userId, parseInt(videoId));

      // إذا لم يوجد أي تقدم، نرجع الافتراضيات مع رابط فيديو افتراضي
      if (!progress) {
        return res.json({
          lastPosition: 0,
          watchTime: 0,
          completed: false,
          video_url: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-the-night-sky-121-large.mp4" // رابط افتراضي
        });
      }

      // إذا الفيديو موجود ولكن بدون رابط
      if (!progress.video_url) {
        progress.video_url = "/default-video.mp4";
      }

      res.json(progress);

    } catch (error) {
      console.error('Get video progress error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },


  /**
   * حفظ تقدم المشاهدة
   */
  async saveVideoProgress(req, res) {
    try {
      const { videoId } = req.params;
      const userId = req.user.id;
      const { lastPosition, watchTime, completed } = req.body;

      const { videoProgressService } = await import('../services/videoProgressService.js');
      const success = await videoProgressService.saveProgress(
        userId,
        parseInt(videoId),
        parseFloat(lastPosition) || 0,
        parseInt(watchTime) || 0,
        completed || false
      );

      if (success) {
        res.json({ message: 'Progress saved successfully' });
      } else {
        res.status(500).json({ error: 'Failed to save progress' });
      }

    } catch (error) {
      console.error('Save video progress error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * الحصول على الفيديوهات غير المكتملة (للاستئناف)
   */
  async getIncompleteVideos(req, res) {
    try {
      const userId = req.user.id;
      // ✅ استخدام قيم افتراضية آمنة
      const limit = parseInt(req.query.limit) || 10;

      const { videoProgressService } = await import('../services/videoProgressService.js');
      const videos = await videoProgressService.getIncompleteVideos(userId, limit);

      res.json({ videos });

    } catch (error) {
      console.error('Get incomplete videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ==================== دوال مساعدة ====================

  // دالة مساعدة لإزالة التكرارات
  removeDuplicates(videos) {
    const seen = new Set();
    return videos.filter(video => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    });
  }
};
