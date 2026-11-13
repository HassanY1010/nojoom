import AdminRepository from '../repositories/AdminRepository.js';
import reportController from './reportController.js';
import aiService from '../services/aiService.js';

const adminController = {
  // إدارة المستخدمين
  async getUsers(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const offset = (page - 1) * limit;

      const users = await AdminRepository.getUsers({ 
        role: req.user?.role, 
        search, 
        limit, 
        offset 
      });
      const total = await AdminRepository.getUsersCount({ 
        role: req.user?.role, 
        search 
      });
 
       res.json({
         users,
         pagination: {
           page: parseInt(page),
           limit: parseInt(limit),
           total: total,
           pages: Math.ceil(total / parseInt(limit))
         }
       });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getUser(req, res) {
    try {
      const { id } = req.params;

      const user = await AdminRepository.getUserById(id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // الحصول على إحصائيات إضافية
      const videoCount = await AdminRepository.getUserVideoCount(id);
      const reportsCount = await AdminRepository.getUserReportsCount(id);

      res.json({
        user,
        stats: {
          videos: videoCount,
          reports: reportsCount
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      let { username, email, role, is_banned, ban_reason } = req.body;

      // التحقق من أن المستخدم لا يقوم بتعديل صلاحياته أو حظر نفسه
      if (parseInt(id) === req.user.id) {
        if (role && role !== req.user.role) {
          return res.status(400).json({ error: 'Cannot change your own role' });
        }
        if (is_banned) {
          return res.status(400).json({ error: 'Cannot ban your own account' });
        }
      }

      // تحويل undefined إلى null
      username = username ?? null;
      email = email ?? null;
      role = role ?? null;
      is_banned = is_banned ?? null;
      ban_reason = ban_reason ?? null;

      const affectedRows = await AdminRepository.updateUser(id, { username, email, role, is_banned, ban_reason });
 
       if (affectedRows === 0) {
         return res.status(404).json({ error: 'User not found' });
       }

      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async banUser(req, res) {
    try {
      const { id } = req.params;
      const { reason = 'Violation of terms of service' } = req.body;

      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot ban yourself' });
      }

      const affectedRows = await AdminRepository.banUser(id, reason);

      if (affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User banned successfully', reason });
    } catch (error) {
      console.error('Ban user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async unbanUser(req, res) {
    try {
      const { id } = req.params;

      const affectedRows = await AdminRepository.unbanUser(id);

      if (affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User unbanned successfully' });
    } catch (error) {
      console.error('Unban user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const affectedRows = await AdminRepository.deleteUser(id);

      if (affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // إدارة الفيديوهات
  async getVideos(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const offset = (page - 1) * limit;

      const videos = await AdminRepository.getVideos({ search, limit, offset });
      const total = await AdminRepository.getVideosCount({ search });
 
       res.json({
         videos,
         pagination: {
           page: parseInt(page),
           limit: parseInt(limit),
           total: total,
           pages: Math.ceil(total / parseInt(limit))
         }
       });
    } catch (error) {
      console.error('Get videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getVideo(req, res) {
    try {
      const { id } = req.params;

      const video = await AdminRepository.getVideoById(id);
 
       if (!video) {
         return res.status(404).json({ error: 'Video not found' });
       }
 
       res.json({ video });
    } catch (error) {
      console.error('Get video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteVideoAdmin(req, res) {
    try {
      const { id } = req.params;
      const { reason = 'Violation of terms of service' } = req.body;

      const affectedRows = await AdminRepository.deleteVideoAdmin(id, reason);
 
       if (affectedRows === 0) {
         return res.status(404).json({ error: 'Video not found' });
       }

      res.json({ message: 'Video deleted successfully', reason });
    } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async pinVideo(req, res) {
    try {
      const { id } = req.params;

      const affectedRows = await AdminRepository.pinVideo(id);

      if (affectedRows === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({ message: 'Video pinned successfully' });
    } catch (error) {
      console.error('Pin video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async unpinVideo(req, res) {
    try {
      const { id } = req.params;

      const affectedRows = await AdminRepository.unpinVideo(id);

      if (affectedRows === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({ message: 'Video unpinned successfully' });
    } catch (error) {
      console.error('Unpin video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getPinnedVideos(req, res) {
    try {
      const videos = await AdminRepository.getPinnedVideos();

      res.json({ videos });
    } catch (error) {
      console.error('Get pinned videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getMostViewedVideos(req, res) {
    try {
      const { limit = 10 } = req.query;

      const videos = await AdminRepository.getMostViewedVideos(limit);

      res.json({ videos });
    } catch (error) {
      console.error('Get most viewed videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // البث  // تحليل الترندات بالذكاء الاصطناعي
  getTrendAnalysis: async (req, res) => {
    try {
      const stats = await aiService.analyzeTrends();
      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async sendBroadcast(req, res) {
    try {
      const { content, target = 'all' } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({
          error: 'Broadcast content is required'
        });
      }

      if (content.length > 500) {
        return res.status(400).json({
          error: 'Broadcast content too long (max 500 characters)'
        });
      }

      const insertId = await AdminRepository.createBroadcast(req.user.id, content.trim(), target);
 
       const broadcast = {
         id: insertId,
        content: content.trim(),
        type: 'admin',
        target: target,
        created_at: new Date(),
        admin_username: req.user.username
      };

      res.status(201).json({
        message: 'Broadcast sent successfully',
        broadcast: broadcast
      });

    } catch (error) {
      console.error('Broadcast error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getBroadcasts(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const broadcasts = await AdminRepository.getBroadcasts(limit, offset);
      const total = await AdminRepository.getBroadcastsCount();
 
       res.json({
         broadcasts,
         pagination: {
           page: parseInt(page),
           limit: parseInt(limit),
           total: total,
           pages: Math.ceil(total / parseInt(limit))
         }
       });
    } catch (error) {
      console.error('Get broadcasts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getStats(req, res) {
    try {
      const statsData = await AdminRepository.getStats();
       const users = statsData.users;
       const videos = statsData.videos;
       const messages = statsData.messages;
       const reports = statsData.reports;
       const storage = statsData.storage;

      res.json({
        stats: {
          totalUsers: users.total_users || 0,
          totalVideos: videos.total_videos || 0,
          totalMessages: messages.total_messages || 0,
          activeUsers: users.active_users || 0,
          storageUsed: storage.storage_used || 0,
          dailyUploads: videos.daily_uploads || 0,
          serverLoad: 0, // Placeholder - would need system monitoring
          responseTime: 0, // Placeholder - would need performance monitoring
          pendingReports: reports.pending_reports || 0,
          totalReports: reports.total_reports || 0,
          bannedUsers: users.banned_users || 0,
          pinnedVideos: videos.pinned_videos || 0,
          totalViews: parseInt(videos.total_views) || 0,
          totalLikes: parseInt(videos.total_likes) || 0,
          todayUsers: users.today_users || 0,
          todayReports: reports.today_reports || 0,
          resolvedReports: reports.resolved_reports || 0,
          rejectedReports: reports.rejected_reports || 0
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // التحكم في النظام
  async getSystemSettings(req, res) {
    try {
      const settings = await AdminRepository.getSystemSettings();
 
       if (!settings) {
         // إعدادات افتراضية
         const defaultSettings = {
           maintenance_mode: false,
           chat_enabled: true,
           upload_enabled: true,
           user_registration_enabled: true,
           max_video_size: 104857600, // 100 MB
           max_video_duration: 300,
           auto_ban_reports_threshold: 5,
           allowed_video_formats: 'mp4,mov,avi',
           featured_hashtags: ''
         };
         return res.json({ settings: defaultSettings });
       }
 
       res.json({ settings });
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateSystemSettings(req, res) {
    try {
      // دعم الاستلام المباشر أو داخل كائن settings
      const data = req.body.settings || req.body;

      let {
        maintenance_mode,
        chat_enabled,
        upload_enabled,
        user_registration_enabled,
        max_video_size,
        max_video_duration,
        auto_ban_reports_threshold,
        allowed_video_formats,
        featured_hashtags,
        maintenance_message
      } = data;

      await AdminRepository.updateSystemSettings(data);

      res.json({ message: 'System settings updated successfully' });
    } catch (error) {
      console.error('Update system settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async boostVideo(req, res) {
    try {
      const { id } = req.params;
      const { boost_score = 1000 } = req.body;

      const affectedRows = await AdminRepository.boostVideo(id, boost_score);
 
       if (affectedRows === 0) {
         return res.status(404).json({ error: 'Video not found' });
       }

      res.json({ message: 'Video boosted successfully', boost_score });
    } catch (error) {
      console.error('Boost video error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  // دوال الدردشة والإحصائيات (مطلوبة في الـ routes)
  async getChatStats(req, res) {
    try {
      const { period = '24h' } = req.query;

      let timeFilter = '1 HOUR';
      if (period === '7d') timeFilter = '7 DAY';
      if (period === '30d') timeFilter = '30 DAY';

      const stats = await AdminRepository.getChatStats(timeFilter);
 
       res.json({
         period: period,
         stats
       });
    } catch (error) {
      console.error('Get chat stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getMessages(req, res) {
    try {
      const { page = 1, limit = 50, videoId } = req.query;
      const offset = (page - 1) * limit;

      const messages = await AdminRepository.getMessages({ videoId, limit, offset });
      const total = await AdminRepository.getMessagesCount(videoId);
 
       res.json({
         messages,
         pagination: {
           page: parseInt(page),
           limit: parseInt(limit),
           total: total,
           pages: Math.ceil(total / parseInt(limit))
         }
       });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { reason = 'Administrative action' } = req.body;

      const message = await AdminRepository.getMessageById(messageId);
 
       if (!message) {
         return res.status(404).json({ error: 'Message not found' });
       }
 
       await AdminRepository.deleteMessage(messageId, req.user.id, reason);

      res.json({
        message: 'Message deleted successfully',
        details: {
          messageId: messageId,
          content: message.content,
          senderId: message.sender_id
        }
      });

    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default adminController;