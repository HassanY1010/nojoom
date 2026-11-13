const db = require('../config/db');

/**
 * Tenant-Aware Recommendation Engine
 * Ensures all recommendations are isolated within tenant boundaries
 */
class TenantRecommendationEngine {

    /**
     * Get personalized video recommendations for a user within their tenant
     */
    async getRecommendations(userId, tenantId, limit = 20) {
        try {
            // Get user's interaction history
            const [interactions] = await db.promise().query(`
        SELECT video_id, interaction_type, weight, created_at
        FROM user_interactions
        WHERE user_id = ? AND tenant_id = ?
        ORDER BY created_at DESC
        LIMIT 100
      `, [userId, tenantId]);

            // Get videos user has already watched
            const watchedVideoIds = interactions
                .filter(i => i.interaction_type === 'watch')
                .map(i => i.video_id);

            // Get user's liked categories/tags
            const [likedVideos] = await db.promise().query(`
        SELECT v.category, v.tags
        FROM videos v
        INNER JOIN user_interactions ui ON v.id = ui.video_id
        WHERE ui.user_id = ? AND ui.tenant_id = ? AND ui.interaction_type = 'like'
      `, [userId, tenantId]);

            // Extract categories and tags
            const categories = new Set();
            const tags = new Set();

            likedVideos.forEach(video => {
                if (video.category) categories.add(video.category);
                if (video.tags) {
                    try {
                        const videoTags = JSON.parse(video.tags);
                        videoTags.forEach(tag => tags.add(tag));
                    } catch (e) { }
                }
            });

            // Build recommendation query
            let query = `
        SELECT v.*, u.username, u.avatar,
               COUNT(DISTINCT l.user_id) as likes_count,
               COUNT(DISTINCT c.id) as comments_count,
               v.views as views_count,
               (
                 CASE 
                   WHEN v.category IN (?) THEN 2.0
                   ELSE 1.0
                 END *
                 (1 + LOG10(1 + v.views)) *
                 (1 + LOG10(1 + COUNT(DISTINCT l.user_id)))
               ) as recommendation_score
        FROM videos v
        INNER JOIN users u ON v.user_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id AND l.tenant_id = ?
        LEFT JOIN comments c ON v.id = c.video_id AND c.tenant_id = ?
        WHERE v.tenant_id = ? 
          AND v.status = 'active'
          AND v.id NOT IN (?)
        GROUP BY v.id
        ORDER BY recommendation_score DESC, v.created_at DESC
        LIMIT ?
      `;

            const categoryArray = Array.from(categories);
            const watchedIdsArray = watchedVideoIds.length > 0 ? watchedVideoIds : [0];

            const [recommendations] = await db.promise().query(query, [
                categoryArray.length > 0 ? categoryArray : [''],
                tenantId,
                tenantId,
                tenantId,
                watchedIdsArray,
                limit
            ]);

            return recommendations;

        } catch (error) {
            console.error('Error getting recommendations:', error);
            return [];
        }
    }

    /**
     * Get trending videos within tenant
     */
    async getTrendingVideos(tenantId, limit = 20) {
        try {
            const [trending] = await db.promise().query(`
        SELECT v.*, u.username, u.avatar,
               COUNT(DISTINCT l.user_id) as likes_count,
               COUNT(DISTINCT c.id) as comments_count,
               v.views as views_count,
               (
                 (COUNT(DISTINCT l.user_id) * 2) +
                 (COUNT(DISTINCT c.id) * 1.5) +
                 (v.views * 0.5) +
                 (CASE 
                   WHEN v.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 100
                   WHEN v.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 50
                   ELSE 10
                 END)
               ) as trending_score
        FROM videos v
        INNER JOIN users u ON v.user_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id AND l.tenant_id = ?
        LEFT JOIN comments c ON v.id = c.video_id AND c.tenant_id = ?
        WHERE v.tenant_id = ? AND v.status = 'active'
        GROUP BY v.id
        ORDER BY trending_score DESC, v.created_at DESC
        LIMIT ?
      `, [tenantId, tenantId, tenantId, limit]);

            return trending;
        } catch (error) {
            console.error('Error getting trending videos:', error);
            return [];
        }
    }

    /**
     * Record user interaction for recommendation algorithm
     */
    async recordInteraction(userId, tenantId, videoId, interactionType, metadata = {}) {
        try {
            const weights = {
                'watch': 1.0,
                'like': 2.0,
                'share': 1.5,
                'comment': 1.8,
                'follow': 2.5
            };

            const weight = weights[interactionType] || 1.0;

            await db.promise().query(`
        INSERT INTO user_interactions (user_id, tenant_id, video_id, interaction_type, weight, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, tenantId, videoId, interactionType, weight, JSON.stringify(metadata)]);

        } catch (error) {
            console.error('Error recording interaction:', error);
        }
    }
}

module.exports = new TenantRecommendationEngine();
