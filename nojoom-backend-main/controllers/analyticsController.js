import { pool } from '../config/db.js';

export const analyticsController = {
  /**
   * الحصول على تحليلات الأداء الشاملة للمنصة (للملاك والمدراء)
   */
  async getOverviewAnalytics(req, res) {
    try {
      const tenantId = req.tenantId || 1;
      
      // جلب آخر 30 سجل من الإحصائيات التاريخية لتوضيح المنحنى
      const [history] = await pool.query(`
        SELECT 
          metric_date,
          active_users as dau,
          mau,
          total_videos,
          total_views,
          avg_watch_time,
          engagement_rate,
          retention_d1,
          retention_d7,
          retention_d30
        FROM usage_metrics
        WHERE tenant_id = ?
        ORDER BY metric_date DESC
        LIMIT 30
      `, [tenantId]);

      // جلب إجمالي أعداد المستخدمين والمقاطع والتفاعلات الحالية
      const [userStats] = await pool.query('SELECT COUNT(*) as total_users FROM users WHERE tenant_id = ?', [tenantId]);
      const [videoStats] = await pool.query('SELECT COUNT(*) as total_videos, COALESCE(SUM(views), 0) as total_views FROM videos WHERE tenant_id = ?', [tenantId]);

      // الحصول على لقطة إحصائية اليوم الحالي (من الجدول أو حساب تقريبي)
      const currentSnapshot = history[0] || {
        dau: 0,
        mau: 0,
        avg_watch_time: 0.0,
        engagement_rate: 0.0,
        retention_d1: 0.0,
        retention_d7: 0.0,
        retention_d30: 0.0
      };

      res.json({
        success: true,
        summary: {
          totalUsers: userStats[0]?.total_users || 0,
          totalVideos: videoStats[0]?.total_videos || 0,
          totalViews: videoStats[0]?.total_views || 0,
          dau: currentSnapshot.dau,
          mau: currentSnapshot.mau,
          avgWatchTimeSeconds: currentSnapshot.avg_watch_time,
          engagementRate: currentSnapshot.engagement_rate,
          retention: {
            d1: currentSnapshot.retention_d1,
            d7: currentSnapshot.retention_d7,
            d30: currentSnapshot.retention_d30
          }
        },
        trends: history.reverse()
      });
    } catch (error) {
      console.error('Error fetching overview analytics:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch overview analytics' });
    }
  },

  /**
   * الحصول على تحليلات الأداء المخصصة لصانع المحتوى
   */
  async getCreatorAnalytics(req, res) {
    try {
      const creatorId = req.user.id;
      const tenantId = req.tenantId || 1;

      // 1. حساب إجمالي المشاهدات والإعجابات لصانع المحتوى
      const [videoSummary] = await pool.query(`
        SELECT 
          COUNT(id) as total_videos,
          COALESCE(SUM(views), 0) as total_views,
          COALESCE(SUM(likes), 0) as total_likes
        FROM videos
        WHERE user_id = ? AND tenant_id = ? AND deleted_by_admin = FALSE
      `, [creatorId, tenantId]);

      // 2. حساب إجمالي تعليقات فيديوهات هذا الصانع
      const [commentSummary] = await pool.query(`
        SELECT COUNT(*) as total_comments
        FROM comments c
        JOIN videos v ON c.video_id = v.id
        WHERE v.user_id = ? AND v.tenant_id = ? AND v.deleted_by_admin = FALSE
      `, [creatorId, tenantId]);

      // 3. حساب إجمالي مشاركات فيديوهات هذا الصانع
      const [shareSummary] = await pool.query(`
        SELECT COUNT(*) as total_shares
        FROM video_shares s
        JOIN videos v ON s.video_id = v.id
        WHERE v.user_id = ? AND v.tenant_id = ? AND v.deleted_by_admin = FALSE
      `, [creatorId, tenantId]);

      // 4. جلب إجمالي المتابعين الحاليين
      const [followSummary] = await pool.query(`
        SELECT followers_count, following_count 
        FROM users 
        WHERE id = ? AND tenant_id = ?
      `, [creatorId, tenantId]);

      // 5. حساب متوسط زمن المشاهدة لفيديوهات هذا الصانع (بالثواني)
      const [watchTimeSummary] = await pool.query(`
        SELECT COALESCE(AVG(w.watch_time) / 1000, 0) as avg_watch_time
        FROM watch_history w
        JOIN videos v ON w.video_id = v.id
        WHERE v.user_id = ? AND v.tenant_id = ? AND v.deleted_by_admin = FALSE
      `, [creatorId, tenantId]);

      // 6. قائمة المقاطع الفردية وتفاصيلها للتوضيح التفصيلي
      const [videoList] = await pool.query(`
        SELECT 
          id,
          title,
          views,
          likes,
          created_at,
          (SELECT COUNT(*) FROM comments WHERE video_id = videos.id) as comment_count,
          (SELECT COUNT(*) FROM video_shares WHERE video_id = videos.id) as share_count
        FROM videos
        WHERE user_id = ? AND tenant_id = ? AND deleted_by_admin = FALSE
        ORDER BY views DESC, created_at DESC
        LIMIT 10
      `, [creatorId, tenantId]);

      const totalViews = videoSummary[0]?.total_views || 0;
      const totalLikes = videoSummary[0]?.total_likes || 0;
      const totalComments = commentSummary[0]?.total_comments || 0;
      const totalShares = shareSummary[0]?.total_shares || 0;
      const totalEngagements = totalLikes + totalComments + totalShares;
      const engagementRate = totalViews > 0 ? parseFloat(((totalEngagements / totalViews) * 100).toFixed(2)) : 0.0;

      res.json({
        success: true,
        summary: {
          followers: followSummary[0]?.followers_count || 0,
          following: followSummary[0]?.following_count || 0,
          totalVideos: videoSummary[0]?.total_videos || 0,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          engagementRate,
          avgWatchTimeSeconds: parseFloat((watchTimeSummary[0]?.avg_watch_time || 0).toFixed(1))
        },
        videos: videoList
      });
    } catch (error) {
      console.error('Error fetching creator analytics:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch creator analytics' });
    }
  }
};
