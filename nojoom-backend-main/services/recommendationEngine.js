import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { Video } from '../models/Video.js';
import path from 'path';

class RecommendationEngine {
  constructor() {
    this.weights = {
      like: 2.0,
      share: 1.5,
      watch_complete: 2.0,
      watch_partial: 1.0,
      follow: 1.5,
      comment: 1.2,
      report: -2.0,
      view: 0.5
    };

    this.minWatchTimeForScore = 10; // 10 seconds minimum
    this.completionThreshold = 0.8; // 80% completion
    this.recommendationCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  getCachedRecommendations(userId) {
    const cacheKey = `rec_${userId}`;
    const cached = this.recommendationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log(`🎯 Using cached recommendations for user ${userId}`);
      return cached.data;
    }
    return null;
  }

  setCachedRecommendations(userId, recommendations) {
    const cacheKey = `rec_${userId}`;
    this.recommendationCache.set(cacheKey, {
      data: recommendations,
      timestamp: Date.now()
    });

    setTimeout(() => {
      this.cleanupCache();
    }, this.cacheTimeout);
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.recommendationCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.recommendationCache.delete(key);
      }
    }
  }

  /**
   * تسجيل تفاعل المستخدم في النظام
   */
  async recordInteraction(interaction) {
    try {
      const safeVideoId = interaction.videoId ?? null;
      const { userId, type, weight, metadata, timestamp } = interaction;

      console.log(`📝 Recording interaction: ${type} for user ${userId}, video ${safeVideoId}`);

      const result = await pool.execute(
        `INSERT INTO user_interactions 
          (user_id, video_id, interaction_type, weight, metadata, created_at, tenant_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          safeVideoId,
          type,
          weight || this.weights[type] || 1.0,
          JSON.stringify(metadata || {}),
          timestamp || new Date(),
          interaction.tenantId || 1
        ]
      );

      console.log(`✅ Successfully recorded interaction: ${type}`);
      return { success: true, id: result[0].insertId };
    } catch (error) {
      console.error('❌ Error recording interaction:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        console.log('⚠️ Interaction already recorded, skipping...');
        return { success: true, duplicate: true };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * استخراج تفاصيل محتوى الفيديو لبناء السمات
   */
  extractVideoTags(description) {
    if (!description) return [];
    return description.toLowerCase()
      .replace(/[^\w\s#]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.startsWith('#') ? word.slice(1) : word)
      .filter(tag => tag.length > 1);
  }

  /**
   * بناء مصفوفة التفاعلات لبناء نموذج التصفية التعاونية
   */
  async buildEngagementMatrix(tenantId) {
    const ratings = {};
    const userPreferences = {};
    const userWatchHistory = {};
    const userFollowing = {};

    try {
      // 1. استرجاع المشاهدات والمدة من watch_history
      const [watchRows] = await pool.execute(
        `SELECT user_id, video_id, watch_time, completed FROM watch_history WHERE tenant_id = ?`,
        [tenantId]
      );
      for (const row of watchRows) {
        const uid = row.user_id;
        const vid = row.video_id;
        
        if (!ratings[uid]) ratings[uid] = {};
        if (!userWatchHistory[uid]) userWatchHistory[uid] = new Set();
        
        userWatchHistory[uid].add(vid);

        let score = 0;
        if (row.watch_time) {
          score += Math.min(row.watch_time / 30.0, 1.0) * 1.5;
        }
        if (row.completed) {
          score += 1.5;
        }
        ratings[uid][vid] = (ratings[uid][vid] || 0) + score;
      }

      // 2. استرجاع التفاعلات الصريحة من user_interactions
      const [interRows] = await pool.execute(
        `SELECT user_id, video_id, interaction_type FROM user_interactions WHERE tenant_id = ?`,
        [tenantId]
      );
      for (const row of interRows) {
        const uid = row.user_id;
        const vid = row.video_id;
        if (!vid) continue;

        if (!ratings[uid]) ratings[uid] = {};
        
        let score = 0;
        if (row.interaction_type === 'like') score += 1.5;
        else if (row.interaction_type === 'comment') score += 1.0;
        else if (row.interaction_type === 'share') score += 1.0;
        else if (row.interaction_type === 'report') score -= 2.0;

        ratings[uid][vid] = Math.max(0, (ratings[uid][vid] || 0) + score);
      }

      // 3. استرجاع المتابعات
      const [followRows] = await pool.execute(`SELECT follower_id, following_id FROM followers`);
      for (const row of followRows) {
        const uid = row.follower_id;
        const fid = row.following_id;
        if (!userFollowing[uid]) userFollowing[uid] = new Set();
        userFollowing[uid].add(fid);
      }

      // 4. استرجاع الاهتمامات المحددة يدوياً من التفضيلات
      const [prefRows] = await pool.execute(
        `SELECT user_id, preferred_categories FROM user_preferences WHERE tenant_id = ?`,
        [tenantId]
      );
      for (const row of prefRows) {
        const uid = row.user_id;
        if (!userPreferences[uid]) userPreferences[uid] = { categories: {}, creators: {}, tags: {} };
        
        try {
          const cats = JSON.parse(row.preferred_categories || '[]');
          cats.forEach(cat => {
            userPreferences[uid].categories[cat] = 5.0; // درجة تفضيل عالية للمحدد يدوياً
          });
        } catch (e) {
          // ignore parsing error
        }
      }

      // تطبيق حد أقصى للتقييم R_u_i بـ 5.0
      for (const uid in ratings) {
        for (const vid in ratings[uid]) {
          ratings[uid][vid] = Math.min(5.0, ratings[uid][vid]);
        }
      }
    } catch (error) {
      console.error('Error building engagement matrix:', error);
    }

    return { ratings, userPreferences, userWatchHistory, userFollowing };
  }

  /**
   * حساب تشابه جيب التمام بين مستخدمين (User Cosine Similarity)
   */
  calculateUserSimilarity(ratings, userId1, userId2) {
    const u1 = ratings[userId1] || {};
    const u2 = ratings[userId2] || {};

    const commonVids = Object.keys(u1).filter(vid => vid in u2);
    if (commonVids.length === 0) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const vid of commonVids) {
      dotProduct += u1[vid] * u2[vid];
    }
    for (const vid of Object.keys(u1)) {
      norm1 += u1[vid] * u1[vid];
    }
    for (const vid of Object.keys(u2)) {
      norm2 += u2[vid] * u2[vid];
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * الحصول على الجيران المتشابهين للمستخدم
   */
  getNeighbors(ratings, targetUserId, limit = 10) {
    const similarities = [];
    for (const otherId in ratings) {
      const parsedOther = parseInt(otherId);
      if (parsedOther === targetUserId) continue;

      const sim = this.calculateUserSimilarity(ratings, targetUserId, parsedOther);
      if (sim > 0.05) {
        similarities.push({ userId: parsedOther, similarity: sim });
      }
    }
    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  /**
   * التنبؤ بدرجة الفيديو بناءً على الجيران (Collaborative Filtering Score)
   */
  predictCollaborativeScore(ratings, neighbors, videoId) {
    let weightedSum = 0;
    let similaritySum = 0;

    for (const neighbor of neighbors) {
      const nRatings = ratings[neighbor.userId] || {};
      if (videoId in nRatings) {
        weightedSum += neighbor.similarity * nRatings[videoId];
        similaritySum += neighbor.similarity;
      }
    }

    if (similaritySum === 0) return 0;
    return weightedSum / similaritySum; // Predict score in range [0, 5.0]
  }

  /**
   * حساب تشابه جيب التمام بناءً على متجه السمات والمحتوى (Content-Based Filtering)
   */
  calculateContentSimilarity(userPrefs, videoFeatures) {
    let dotProduct = 0;
    let normUser = 0;
    let normVideo = 0;

    const allKeys = new Set([...Object.keys(userPrefs), ...Object.keys(videoFeatures)]);
    for (const key of allKeys) {
      const uVal = userPrefs[key] || 0;
      const vVal = videoFeatures[key] || 0;
      dotProduct += uVal * vVal;
      normUser += uVal * uVal;
      normVideo += vVal * vVal;
    }

    if (normUser === 0 || normVideo === 0) return 0;
    return dotProduct / (Math.sqrt(normUser) * Math.sqrt(normVideo));
  }

  /**
   * تحليل تفضيلات واهتمامات المستخدم التقليدية
   */
  async analyzeUserInterests(userId, tenantId) {
    try {
      const [interactions] = await pool.execute(
        `SELECT ui.*, v.description, v.user_id as video_owner_id, v.category 
         FROM user_interactions ui 
         LEFT JOIN videos v ON ui.video_id = v.id 
         WHERE ui.user_id = ? AND ui.tenant_id = ?
         ORDER BY ui.created_at DESC 
         LIMIT 100`,
        [userId, tenantId]
      );

      const interests = {
        categories: {},
        creators: {},
        tags: {},
        totalScore: 0
      };

      for (const interaction of interactions) {
        const weight = interaction.weight || 1.0;
        if (interaction.category) {
          interests.categories[interaction.category] = (interests.categories[interaction.category] || 0) + weight;
        }
        if (interaction.video_owner_id) {
          interests.creators[interaction.video_owner_id] = (interests.creators[interaction.video_owner_id] || 0) + weight;
        }
        if (interaction.description) {
          const tags = this.extractVideoTags(interaction.description);
          tags.forEach(tag => {
            interests.tags[tag] = (interests.tags[tag] || 0) + weight;
          });
        }
      }

      this.normalizeInterests(interests);
      return interests;
    } catch (error) {
      console.error('Error analyzing interests:', error);
      return { categories: {}, creators: {}, tags: {}, totalScore: 0 };
    }
  }

  normalizeInterests(interests) {
    const keys = ['categories', 'creators', 'tags'];
    for (const key of keys) {
      const scores = Object.values(interests[key]);
      if (scores.length > 0) {
        const maxScore = Math.max(...scores);
        for (const k in interests[key]) {
          interests[key][k] = interests[key][k] / maxScore;
        }
      }
    }
  }

  async getFollowingVideos(userId, followingIds, limit = 10) {
    try {
      const parsedUserId = parseInt(userId);
      if (!parsedUserId || isNaN(parsedUserId)) return [];

      let cleanIds = [];
      if (Array.isArray(followingIds)) {
        cleanIds = followingIds
          .map(id => parseInt(id))
          .filter(id => Number.isInteger(id) && id > 0 && !isNaN(id));
      } else if (followingIds) {
        const id = parseInt(followingIds);
        if (Number.isInteger(id) && id > 0 && !isNaN(id)) {
          cleanIds = [id];
        }
      }

      if (cleanIds.length === 0) return [];

      const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
      const placeholders = cleanIds.map(() => '?').join(',');

      const sql = `
      SELECT v.*, u.username, u.avatar,
             COUNT(DISTINCT l.user_id) AS likes,
             EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) AS is_liked
      FROM videos v
      JOIN users u ON v.user_id = u.id
      LEFT JOIN likes l ON v.id = l.video_id
      WHERE v.user_id IN (${placeholders})
        AND v.deleted_by_admin = FALSE
        AND u.is_banned = FALSE
      GROUP BY v.id
      ORDER BY v.created_at DESC
      LIMIT ?`;

      const [rows] = await pool.execute(sql, [parsedUserId, ...cleanIds, safeLimit]);
      return this.mapVideoUrls(rows);
    } catch (err) {
      console.error('❌ getFollowingVideos error:', err);
      return [];
    }
  }

  async getPopularVideos(userId, tenantId, limit) {
    try {
      const safeUserId = parseInt(userId) || 0;
      const safeTenantId = parseInt(tenantId) || 0;
      const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

      const sql = `
      SELECT v.*, u.username, u.avatar,
             COUNT(DISTINCT l.user_id) AS likes,
             EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) AS is_liked
      FROM videos v
      JOIN users u ON v.user_id = u.id
      LEFT JOIN likes l ON v.id = l.video_id
      WHERE v.deleted_by_admin = FALSE
        AND u.is_banned = FALSE
        AND v.tenant_id = ?
      GROUP BY v.id
      ORDER BY v.views DESC, v.created_at DESC
      LIMIT ?`;

      const [rows] = await pool.execute(sql, [safeUserId, safeTenantId, safeLimit]);
      return this.mapVideoUrls(rows);
    } catch (err) {
      console.error('❌ getPopularVideos error:', err);
      return [];
    }
  }

  mapVideoUrls(rows) {
    return rows.map(video => {
      const videoFilename = video.path ? path.basename(video.path) : '';
      const thumbFilename = video.thumbnail ? path.basename(video.thumbnail) : '';

      return {
        ...video,
        video_url: videoFilename ? `/uploads/videos/${videoFilename}` : (video.video_url || '/default-video.mp4'),
        thumbnail_url: thumbFilename ? `/uploads/videos/thumbnails/${thumbFilename}` : '/default-thumbnail.jpg',
        thumbnail: thumbFilename ? `/uploads/videos/thumbnails/${thumbFilename}` : '/default-thumbnail.jpg'
      };
    });
  }

  /**
   * الحصول على توصيات هجينة قوية (Hybrid Collaborative + Content-Based + Ranking Model)
   */
  async getRecommendedVideos(userId, tenantId, limit = 10) {
    try {
      const safeUserId = parseInt(userId) || 0;
      const safeTenantId = parseInt(tenantId) || 0;
      const safeLimit = parseInt(limit) || 10;

      // 1. التحقق من الذاكرة المؤقتة
      const cached = this.getCachedRecommendations(safeUserId);
      if (cached && cached.length >= safeLimit) {
        return cached.slice(0, safeLimit);
      }

      // 2. بناء مصفوفة التفاعل
      const matrix = await this.buildEngagementMatrix(safeTenantId);
      const userRatings = matrix.ratings[safeUserId] || {};
      const neighbors = this.getNeighbors(matrix.ratings, safeUserId, 15);
      const following = matrix.userFollowing[safeUserId] || new Set();

      // 3. بناء متجه تفضيلات المحتوى للمستخدم (User Preference Vector)
      const userPrefVector = {};
      const userHighEngagementVideos = Object.keys(userRatings).filter(vid => userRatings[vid] >= 2.5);

      if (userHighEngagementVideos.length > 0) {
        for (const vid of userHighEngagementVideos) {
          const rating = userRatings[vid];
          // جلب سمات الفيديو المفضل
          const [videoRows] = await pool.execute(`SELECT category, user_id, description FROM videos WHERE id = ?`, [vid]);
          if (videoRows[0]) {
            const v = videoRows[0];
            if (v.category) {
              const key = `cat:${v.category}`;
              userPrefVector[key] = (userPrefVector[key] || 0) + rating;
            }
            if (v.user_id) {
              const key = `creator:${v.user_id}`;
              userPrefVector[key] = (userPrefVector[key] || 0) + rating;
            }
            const tags = this.extractVideoTags(v.description);
            tags.forEach(tag => {
              const key = `tag:${tag}`;
              userPrefVector[key] = (userPrefVector[key] || 0) + rating;
            });
          }
        }
        // إضافة التفضيلات المحددة يدوياً للمستند المجمع
        const manuals = matrix.userPreferences[safeUserId];
        if (manuals) {
          for (const cat in manuals.categories) {
            const key = `cat:${cat}`;
            userPrefVector[key] = (userPrefVector[key] || 0) + 5.0;
          }
        }
      }

      // 4. استرجاع كافة الفيديوهات النشطة (Candidates)
      const sql = `
      SELECT v.*, u.username, u.avatar,
             COUNT(DISTINCT l.user_id) AS likes,
             EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) AS is_liked
      FROM videos v
      JOIN users u ON v.user_id = u.id
      LEFT JOIN likes l ON v.id = l.video_id
      WHERE v.deleted_by_admin = FALSE
        AND u.is_banned = FALSE
        AND v.tenant_id = ?
      GROUP BY v.id`;

      const [candidates] = await pool.execute(sql, [safeUserId, safeTenantId]);
      const mappedCandidates = this.mapVideoUrls(candidates);

      // 5. تقييم وترتيب الفيديوهات
      const scoredVideos = [];
      const nowTime = Date.now();

      for (const video of mappedCandidates) {
        // فلترة الفيديوهات التي تمت مشاهدتها بالكامل مسبقاً (إلا لو كانت خياراً وحيداً)
        if (matrix.userWatchHistory[safeUserId]?.has(video.id)) {
          const historyRow = userRatings[video.id];
          if (historyRow && historyRow >= 3.0 && mappedCandidates.length > safeLimit) {
            continue; // Skip highly engaged completed videos to guarantee fresh content
          }
        }

        // أ. التصفية التعاونية (Collaborative Filtering Score)
        const cfRating = this.predictCollaborativeScore(matrix.ratings, neighbors, video.id);
        const cfScore = cfRating / 5.0; // Normalize to [0, 1]

        // ب. التصفية بناءً على المحتوى (Content-Based Score)
        const videoVector = {};
        if (video.category) videoVector[`cat:${video.category}`] = 1.0;
        if (video.user_id) videoVector[`creator:${video.user_id}`] = 1.0;
        const tags = this.extractVideoTags(video.description);
        tags.forEach(tag => videoVector[`tag:${tag}`] = 1.0);

        const contentScore = this.calculateContentSimilarity(userPrefVector, videoVector);

        // ج. الشعبية (Popularity Score)
        const popularityScore = Math.min((video.views || 0) / 1000 + (video.likes || 0) / 100, 1.0);

        // د. التضاؤل الزمني (Recency Decay)
        const createdDate = new Date(video.created_at);
        const diffDays = Math.max(0, (nowTime - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        const recencyScore = Math.exp(-0.05 * diffDays); // Exponential decay (lambda = 0.05)

        // هـ. حساب النقاط الهجينة
        let hybridScore = 0;
        if (Object.keys(userPrefVector).length > 0) {
          hybridScore += contentScore * 0.4;
        } else {
          hybridScore += popularityScore * 0.4; // Cold start content match fallback
        }

        if (neighbors.length > 0) {
          hybridScore += cfScore * 0.3;
        } else {
          hybridScore += popularityScore * 0.3; // Cold start collaborative fallback
        }

        hybridScore += popularityScore * 0.15;
        hybridScore += recencyScore * 0.15;

        // و. علاوة المتابعة (Creator Affinity Boost)
        if (following.has(video.user_id)) {
          hybridScore += 0.2; // 20% bonus
        }

        scoredVideos.push({
          ...video,
          recommendation_score: parseFloat((hybridScore * 5).toFixed(2)), // Scale to 0-5
          score_breakdown: {
            collaborative: cfScore,
            content: contentScore,
            popularity: popularityScore,
            recency: recencyScore,
            isFollowing: following.has(video.user_id)
          }
        });
      }

      // 6. ترتيب وإرجاع النتائج النهائية
      const finalRecommendations = scoredVideos
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, safeLimit);

      this.setCachedRecommendations(safeUserId, finalRecommendations);
      console.log(`✅ Hybrid engine generated ${finalRecommendations.length} recommendations for user ${safeUserId}`);
      return finalRecommendations;
    } catch (error) {
      console.error('❌ Error getting recommended videos (hybrid):', error);
      return await this.getPopularVideos(userId, tenantId, limit);
    }
  }

  /**
   * الحصول على فيديوهات مشابهة بناءً على متجه السمات والمحتوى
   */
  async getSimilarVideos(videoId, userId = null, limit = 10) {
    try {
      const [currentVideo] = await pool.execute(
        'SELECT * FROM videos WHERE id = ? AND deleted_by_admin = FALSE',
        [videoId]
      );
      if (currentVideo.length === 0) return [];

      const targetVideo = currentVideo[0];
      const targetVector = {};
      if (targetVideo.category) targetVector[`cat:${targetVideo.category}`] = 1.0;
      if (targetVideo.user_id) targetVector[`creator:${targetVideo.user_id}`] = 1.0;
      const targetTags = this.extractVideoTags(targetVideo.description);
      targetTags.forEach(tag => targetVector[`tag:${tag}`] = 1.0);

      // استرجاع كل الفيديوهات للمقارنة
      const [allVideos] = await pool.execute(
        `SELECT v.*, u.username, u.avatar 
         FROM videos v 
         JOIN users u ON v.user_id = u.id 
         WHERE v.id != ? AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE`,
        [videoId]
      );

      const similarVideos = [];
      for (const video of allVideos) {
        const videoVector = {};
        if (video.category) videoVector[`cat:${video.category}`] = 1.0;
        if (video.user_id) videoVector[`creator:${video.user_id}`] = 1.0;
        const tags = this.extractVideoTags(video.description);
        tags.forEach(tag => videoVector[`tag:${tag}`] = 1.0);

        const sim = this.calculateContentSimilarity(targetVector, videoVector);
        if (sim > 0.1) {
          similarVideos.push({
            ...video,
            similarity: sim
          });
        }
      }

      const mapped = this.mapVideoUrls(similarVideos);
      return mapped.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
    } catch (error) {
      console.error('Error getting similar videos:', error);
      return [];
    }
  }

  /**
   * تحديث نموذج التوصية للمستخدم
   */
  async updateUserModel(userId) {
    try {
      const interests = await this.analyzeUserInterests(userId, 1);
      console.log(`✅ Updated user model for: ${userId}`);
      return interests;
    } catch (error) {
      console.error('Error updating user model:', error);
      throw error;
    }
  }

  getDefaultInterests() {
    return {
      categories: {},
      creators: {},
      tags: {},
      totalScore: 0
    };
  }

  /**
   * الحصول على إحصائيات التوصية
   */
  async getRecommendationStats(userId) {
    try {
      const [interactionCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM user_interactions WHERE user_id = ?',
        [userId]
      );

      const [watchHistoryCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM watch_history WHERE user_id = ?',
        [userId]
      );

      const [followingCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM followers WHERE follower_id = ?',
        [userId]
      );

      return {
        interactions: interactionCount[0].count,
        watchHistory: watchHistoryCount[0].count,
        following: followingCount[0].count,
        modelUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting recommendation stats:', error);
      return {
        interactions: 0,
        watchHistory: 0,
        following: 0,
        modelUpdated: new Date()
      };
    }
  }
}

const recommendationEngine = new RecommendationEngine();

export { recommendationEngine, RecommendationEngine };
export default recommendationEngine;
