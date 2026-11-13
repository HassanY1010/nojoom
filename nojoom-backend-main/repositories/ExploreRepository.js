import { executeQuery } from '../config/db.js';

export const ExploreRepository = {
    async getExploreVideos({ tenantId = 1, userId, limit = 10, offset = 0, filter = 'recommended', search, hashtag }) {
        const tid = tenantId || 1;
        const lim = parseInt(limit, 10) || 10;
        const off = parseInt(offset, 10) || 0;

        let query = `
            SELECT 
                v.*,
                u.username,
                u.avatar,
                COALESCE(v.likes, 0) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE video_id = v.id) as comment_count,
                COALESCE(v.views, 0) as views_count,
                ${userId ? 'EXISTS(SELECT 1 FROM likes WHERE video_id = v.id AND user_id = ?)' : 'FALSE'} as is_liked,
                ${userId ? 'EXISTS(SELECT 1 FROM follows WHERE following_id = v.user_id AND follower_id = ?)' : 'FALSE'} as is_following
            FROM videos v
            JOIN users u ON v.user_id = u.id
            WHERE (v.is_public = true OR v.is_public = 1) 
              AND (v.deleted_by_admin = FALSE OR v.deleted_by_admin IS NULL) 
              AND (u.is_banned = FALSE OR u.is_banned IS NULL) 
              AND (v.tenant_id = ? OR v.tenant_id IS NULL)
        `;

        const queryParams = [];
        if (userId) {
            queryParams.push(userId); // for is_liked
            queryParams.push(userId); // for is_following
        }
        queryParams.push(tid); // for v.tenant_id

        if (search) {
            query += ` AND (v.description LIKE ? OR u.username LIKE ?)`;
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        if (hashtag) {
            query += ` AND v.hashtags LIKE ?`;
            queryParams.push(`%${hashtag}%`);
        }

        switch (filter) {
            case 'trending':
                query += ` ORDER BY (COALESCE(v.boost_score, 0) + COALESCE(v.likes, 0) * 0.4 + COALESCE(v.views, 0) * 0.3 + (SELECT COUNT(*) FROM comments WHERE video_id = v.id) * 0.3) DESC, v.created_at DESC`;
                break;
            case 'popular':
                query += ` ORDER BY COALESCE(v.views, 0) DESC, COALESCE(v.likes, 0) DESC`;
                break;
            case 'latest':
                query += ` ORDER BY v.created_at DESC`;
                break;
            case 'recommended':
            default:
                query += ` ORDER BY (COALESCE(v.likes, 0) * 0.3 + COALESCE(v.views, 0) * 0.7) DESC, v.created_at DESC`;
                break;
        }

        query += ` LIMIT ? OFFSET ?`;
        queryParams.push(lim, off);

        try {
            return await executeQuery(query, queryParams);
        } catch (err) {
            console.error('ExploreRepository.getExploreVideos error:', err.message);
            // Safe fallback query
            return await executeQuery(
                `SELECT v.*, u.username, u.avatar, COALESCE(v.likes, 0) as likes_count, COALESCE(v.views, 0) as views_count, 0 as comment_count, FALSE as is_liked, FALSE as is_following
                 FROM videos v
                 JOIN users u ON v.user_id = u.id
                 WHERE (v.is_public = true OR v.is_public = 1)
                 ORDER BY v.created_at DESC
                 LIMIT ? OFFSET ?`,
                [lim, off]
            );
        }
    },

    async getExploreUsers({ tenantId = 1, userId, limit = 10, offset = 0, search }) {
        const tid = tenantId || 1;
        const lim = parseInt(limit, 10) || 10;
        const off = parseInt(offset, 10) || 0;

        let query = `
            SELECT 
                u.*,
                COALESCE(u.followers_count, 0) as followers_count,
                COALESCE(u.following_count, 0) as following_count,
                COALESCE(u.likes_count, 0) as likes_count,
                COALESCE(u.views_count, 0) as views_count,
                COALESCE(u.total_watch_time, 0) as total_watch_time,
                ${userId ? 'EXISTS(SELECT 1 FROM follows WHERE following_id = u.id AND follower_id = ?)' : 'FALSE'} as is_following
            FROM users u
            WHERE (u.is_banned = false OR u.is_banned IS NULL) AND (u.tenant_id = ? OR u.tenant_id IS NULL)
        `;

        const queryParams = [];
        if (userId) {
            queryParams.push(userId);
        }
        queryParams.push(tid);

        if (search) {
            query += ` AND (u.username LIKE ? OR u.bio LIKE ?)`;
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        query += ` 
            ORDER BY 
                (COALESCE(u.followers_count, 0) * 0.4 + 
                 COALESCE(u.likes_count, 0) * 0.3 + 
                 COALESCE(u.views_count, 0) * 0.3) DESC,
                u.created_at DESC
            LIMIT ? OFFSET ?
        `;

        queryParams.push(lim, off);

        try {
            return await executeQuery(query, queryParams);
        } catch (err) {
            console.error('ExploreRepository.getExploreUsers error:', err.message);
            return [];
        }
    },

    async searchExploreVideos(tenantId = 1, searchQuery, limit = 20) {
        const lim = parseInt(limit, 10) || 20;
        const tid = tenantId || 1;
        return await executeQuery(`
            SELECT 
                v.*,
                u.username,
                u.avatar,
                COALESCE(v.likes, 0) as likes,
                0 as comment_count,
                COALESCE(v.views, 0) as views
            FROM videos v
            LEFT JOIN users u ON v.user_id = u.id
            WHERE (v.is_public = true OR v.is_public = 1) 
              AND (v.deleted_by_admin = FALSE OR v.deleted_by_admin IS NULL) 
              AND (u.is_banned = FALSE OR u.is_banned IS NULL)
              AND (v.description LIKE ? OR u.username LIKE ?) 
              AND (v.tenant_id = ? OR v.tenant_id IS NULL)
            ORDER BY COALESCE(v.views, 0) DESC
            LIMIT ?
        `, [`%${searchQuery}%`, `%${searchQuery}%`, tid, lim]);
    },

    async searchExploreUsers(tenantId = 1, searchQuery, limit = 20) {
        const lim = parseInt(limit, 10) || 20;
        const tid = tenantId || 1;
        return await executeQuery(`
            SELECT 
                u.*,
                COALESCE(u.followers_count, 0) as followers_count
            FROM users u
            WHERE (u.is_banned = false OR u.is_banned IS NULL) 
              AND (u.tenant_id = ? OR u.tenant_id IS NULL)
              AND (u.username LIKE ? OR u.bio LIKE ?)
            ORDER BY COALESCE(u.followers_count, 0) DESC
            LIMIT ?
        `, [tid, `%${searchQuery}%`, `%${searchQuery}%`, lim]);
    },

    async getSystemFeaturedHashtags() {
        try {
            const [settings] = await executeQuery('SELECT featured_hashtags FROM system_settings WHERE id = 1');
            return settings?.featured_hashtags || '';
        } catch (_) {
            return '';
        }
    },

    async getTrendingHashtags(tenantId = 1, limit = 10) {
        const lim = parseInt(limit, 10) || 10;
        const tid = tenantId || 1;
        try {
            return await executeQuery(`
                SELECT 
                    hashtag as name,
                    COUNT(*) as count,
                    COUNT(*) > 10 as trending
                FROM (
                    SELECT 
                        JSON_UNQUOTE(JSON_EXTRACT(v.hashtags, CONCAT('$[', numbers.n, ']'))) as hashtag
                    FROM videos v
                    JOIN (
                        SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
                        UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
                    ) numbers
                    WHERE v.hashtags IS NOT NULL 
                        AND JSON_LENGTH(v.hashtags) > numbers.n
                        AND v.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                        AND (v.deleted_by_admin = FALSE OR v.deleted_by_admin IS NULL)
                        AND (v.tenant_id = ? OR v.tenant_id IS NULL)
                ) AS extracted_hashtags
                WHERE hashtag IS NOT NULL AND hashtag != ''
                GROUP BY hashtag
                ORDER BY count DESC, hashtag ASC
                LIMIT ?
            `, [tid, lim]);
        } catch (_) {
            return [];
        }
    },

    async getStats(tenantId = 1) {
        const tid = tenantId || 1;
        try {
            const totalVideos = await executeQuery(
                'SELECT COUNT(*) as total_videos FROM videos WHERE is_public = true AND (deleted_by_admin = FALSE OR deleted_by_admin IS NULL) AND (tenant_id = ? OR tenant_id IS NULL)',
                [tid]
            );
            const totalUsers = await executeQuery(
                'SELECT COUNT(*) as total_users FROM users WHERE is_banned = false AND (tenant_id = ? OR tenant_id IS NULL)',
                [tid]
            );
            const dailyViews = await executeQuery(
                'SELECT COUNT(*) as daily_views FROM video_views WHERE created_at >= CURDATE() AND (tenant_id = ? OR tenant_id IS NULL)',
                [tid]
            );

            return {
                total_videos: parseInt(totalVideos[0]?.total_videos) || 0,
                total_users: parseInt(totalUsers[0]?.total_users) || 0,
                daily_views: parseInt(dailyViews[0]?.daily_views) || 0
            };
        } catch (_) {
            return { total_videos: 0, total_users: 0, daily_views: 0 };
        }
    },

    async recordExploreView(userId, videoId, source, tenantId = 1) {
        try {
            await executeQuery(
                'INSERT INTO explore_views (user_id, video_id, source, tenant_id) VALUES (?, ?, ?, ?)',
                [userId, videoId, source, tenantId || 1]
            );
        } catch (_) {}
    }
};

export default ExploreRepository;
