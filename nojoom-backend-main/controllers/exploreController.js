import ExploreRepository from '../repositories/ExploreRepository.js';
import recommendationEngine from '../services/recommendationEngine.js';

export const exploreController = {
  // جلب فيديوهات الـ Explore
  async getExploreVideos(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        filter = 'recommended',
        search,
        hashtag,
        userId
      } = req.query;

      const offset = (page - 1) * limit;

      let videos = [];
      if (filter === 'recommended' && userId) {
        try {
          const recommendedVideos = await recommendationEngine.getRecommendedVideos(userId, parseInt(limit));
          if (recommendedVideos && recommendedVideos.length > 0) {
              return res.json({
                videos: recommendedVideos,
                pagination: { page: parseInt(page), limit: parseInt(limit), hasMore: recommendedVideos.length === parseInt(limit) }
              });
          }
        } catch (recommendationError) {
          console.warn('Recommendation engine fallback triggered');
        }
      }

      videos = await ExploreRepository.getExploreVideos({
          tenantId: req.tenantId || req.tenant?.id || 1,
          userId,
          limit: parseInt(limit, 10) || 10,
          offset: parseInt(offset, 10) || 0,
          filter,
          search,
          hashtag
      });

      const formattedVideos = (videos || []).map(video => ({
        id: video.id,
        user_id: video.user_id,
        path: video.path,
        url: video.url || video.video_url || video.path,
        thumbnail: video.thumbnail,
        description: video.description,
        hashtags: video.hashtags ? (typeof video.hashtags === 'string' ? JSON.parse(video.hashtags) : video.hashtags) : [],
        is_public: video.is_public,
        views: parseInt(video.views_count) || 0,
        likes: parseInt(video.likes_count) || 0,
        duration: parseInt(video.duration) || 0,
        created_at: video.created_at,
        username: video.username,
        avatar: video.avatar,
        comment_count: parseInt(video.comment_count) || 0,
        is_liked: Boolean(video.is_liked),
        is_following: Boolean(video.is_following)
      }));

      res.json({
        videos: formattedVideos,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
          hasMore: formattedVideos.length === (parseInt(limit) || 10)
        }
      });

    } catch (error) {
      console.error('Explore videos error:', error);
      res.json({
        videos: [],
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 10,
          hasMore: false
        }
      });
    }
  },

  // جلب مستخدمي الـ Explore
  async getExploreUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        userId
      } = req.query;

      const offset = (page - 1) * limit;

      const users = await ExploreRepository.getExploreUsers({
          tenantId: req.tenantId || req.tenant?.id || 1,
          userId,
          limit: parseInt(limit, 10) || 10,
          offset: parseInt(offset, 10) || 0,
          search
      });

      const formattedUsers = (users || []).map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        social_links: user.social_links ? (typeof user.social_links === 'string' ? JSON.parse(user.social_links) : user.social_links) : {},
        followers_count: parseInt(user.followers_count) || 0,
        following_count: parseInt(user.following_count) || 0,
        likes_count: parseInt(user.likes_count) || 0,
        views_count: parseInt(user.views_count) || 0,
        total_watch_time: parseInt(user.total_watch_time) || 0,
        is_following: Boolean(user.is_following),
        created_at: user.created_at
      }));

      res.json({
        users: formattedUsers,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
          hasMore: formattedUsers.length === (parseInt(limit) || 10)
        }
      });

    } catch (error) {
      console.error('Explore users error:', error);
      res.json({
        users: [],
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 10,
          hasMore: false
        }
      });
    }
  },

  // البحث الشامل في الـ Explore
  async searchExplore(req, res) {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const searchQuery = `%${query}%`;
      const parsedLimit = parseInt(limit);

      const [videos, users] = await Promise.all([
          ExploreRepository.searchExploreVideos(req.tenantId, searchQuery, parsedLimit),
          ExploreRepository.searchExploreUsers(req.tenantId, searchQuery, parsedLimit)
      ]);

      res.json({
        videos: videos.slice(0, 5),
        users: users.slice(0, 5),
        hashtags: []
      });

    } catch (error) {
      console.error('Explore search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  },

  // جلب الهاشتاجات الشائعة
  async getTrendingHashtags(req, res) {
    try {
      const { limit = 10 } = req.query;
      const parsedLimit = parseInt(limit);

      const featuredHashtagsStr = await ExploreRepository.getSystemFeaturedHashtags();
      const featured = featuredHashtagsStr
        ? featuredHashtagsStr.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(Boolean)
        : [];

      const hashtags = await ExploreRepository.getTrendingHashtags(req.tenantId, parsedLimit);

      const featuredHashtags = featured.map(name => ({
        name,
        count: 999, // قيمة افتراضية للفرز
        trending: true,
        isFeatured: true
      }));

      const finalHashtags = [
        ...featuredHashtags,
        ...hashtags.filter(h => !featured.includes(h.name))
      ].slice(0, parsedLimit);

      res.json({ hashtags: finalHashtags });

    } catch (error) {
      console.error('Trending hashtags error:', error);
      res.status(500).json({ error: 'Failed to fetch trending hashtags' });
    }
  },

  // جلب إحصائيات الـ Explore
  async getExploreStats(req, res) {
    try {
      const stats = await ExploreRepository.getStats(req.tenantId);

      res.json({
        ...stats,
        trending_hashtags: []
      });

    } catch (error) {
      console.error('Explore stats error:', error);
      res.status(500).json({ error: 'Failed to fetch explore stats' });
    }
  },

  // تسجيل مشاهدة من الـ Explore
  async recordExploreView(req, res) {
    try {
      const { videoId, source = 'explore' } = req.body;
      const userId = req.user?.id;

      await ExploreRepository.recordExploreView(userId, videoId, source, req.tenantId);

      res.json({ success: true });

    } catch (error) {
      console.error('Record explore view error:', error);
      res.status(500).json({ error: 'Failed to record view' });
    }
  }
};

export default exploreController;