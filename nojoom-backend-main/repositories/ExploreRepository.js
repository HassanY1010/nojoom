import { executeQuery } from '../config/db.js';

export const ExploreRepository = {
    async getExploreVideos({ tenantId, userId, limit, offset, filter, search, hashtag }) {
        let query = `
            SELECT 
                v.*,
                u.username,
                u.avatar,
                v.likes as likes_count,
                (SELECT COUNT(*) FROM comments WHERE video_id = v.id) as comment_count,
                v.views as views_count,
                ${userId ? 'EXISTS(SELECT 1 FROM likes WHERE video_id = v.id AND user_id = ?)' : 'FALSE'} as is_liked,
                ${userId ? 'EXISTS(SELECT 1 FROM follows WHERE following_id = v.user_id AND follower_id = ?)' : 'FALSE'} as is_following
            FROM videos v
            JOIN users u ON v.user_id = u.id
            WHERE v.is_public = true AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE AND v.tenant_id = ?
        `;

        const queryParams = userId ? [tenantId, userId, userId] : [tenantId];

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
                query += ` ORDER BY (v.boost_score + v.likes * 0.4 + v.views * 0.3 + (SELECT COUNT(*) FROM comments WHERE video_id = v.id) * 0.3) DESC, v.created_at DESC`;
                break;
            case 'popular':
                query += ` ORDER BY v.views DESC, v.likes DESC`;
                break;
            case 'latest':
                query += ` ORDER BY v.created_at DESC`;
                break;
            case 'recommended':
            default:
                query += ` ORDER BY (v.likes * 0.3 + v.views * 0.7) DESC, v.created_at DESC`;
                break;
        }

        query += ` LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);

        return await executeQuery(query, queryParams);
    },

    async getExploreUsers({ tenantId, userId, limit, offset, search }) {
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
            WHERE u.is_banned = false AND u.tenant_id = ?
        `;

        const queryParams = userId ? [tenantId, userId] : [tenantId];

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

        queryParams.push(limit, offset);

        return await executeQuery(query, queryParams);
    },

    async searchExploreVideos(tenantId, searchQuery, limit) {
        return await executeQuery(`
            SELECT 
                v.*,
                u.username,
                u.avatar,
                COUNT(DISTINCT l.user_id) as likes,
                COUNT(DISTINCT c.id) as comment_count,
                COUNT(DISTINCT vw.id) as views
            FROM videos v
            LEFT JOIN users u ON v.user_id = u.id
            LEFT JOIN likes l ON v.id = l.video_id
            LEFT JOIN comments c ON v.id = c.video_id
            LEFT JOIN video_views vw ON v.id = vw.video_id
            WHERE v.is_public = true AND v.deleted_by_admin = FALSE AND u.is_banned = FALSE
                AND (v.description LIKE ? OR u.username LIKE ?) AND v.tenant_id = ?
            GROUP BY v.id
            ORDER BY (COUNT(DISTINCT l.user_id) + COUNT(DISTINCT vw.id)) DESC
            LIMIT ?
        `, [searchQuery, searchQuery, tenantId, limit]);
    },

    async searchExploreUsers(tenantId, searchQuery, limit) {
        return await executeQuery(`
            SELECT 
                u.*,
                COUNT(DISTINCT f.follower_id) as followers_count
            FROM users u
            LEFT JOIN followers f ON u.id = f.following_id
            WHERE u.is_banned = false AND u.tenant_id = ?
                AND (u.username LIKE ? OR u.bio LIKE ?)
            GROUP BY u.id
            ORDER BY COUNT(DISTINCT f.follower_id) DESC
            LIMIT ?
        `, [tenantId, searchQuery, searchQuery, limit]);
    },

    async getSystemFeaturedHashtags() {
        const [settings] = await executeQuery('SELECT featured_hashtags FROM system_settings WHERE id = 1');
        return settings?.featured_hashtags || '';
    },

    async getTrendingHashtags(tenantId, limit) {
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
                    AND v.deleted_by_admin = FALSE
                    AND v.tenant_id = ?
            ) AS extracted_hashtags
            WHERE hashtag IS NOT NULL AND hashtag != ''
            GROUP BY hashtag
            ORDER BY count DESC, hashtag ASC
            LIMIT ?
        `, [tenantId, limit]);
    },

    async getStats(tenantId) {
        const totalVideos = await executeQuery(
            'SELECT COUNT(*) as total_videos FROM videos WHERE is_public = true AND deleted_by_admin = FALSE AND tenant_id = ?',
            [tenantId]
        );
        const totalUsers = await executeQuery(
            'SELECT COUNT(*) as total_users FROM users WHERE is_banned = false AND tenant_id = ?',
            [tenantId]
        );
        const dailyViews = await executeQuery(
            'SELECT COUNT(*) as daily_views FROM video_views WHERE created_at >= CURDATE() AND tenant_id = ?',
            [tenantId]
        );

        return {
            total_videos: parseInt(totalVideos[0]?.total_videos) || 0,
            total_users: parseInt(totalUsers[0]?.total_users) || 0,
            daily_views: parseInt(dailyViews[0]?.daily_views) || 0
        };
    },

    async recordExploreView(userId, videoId, source, tenantId) {
        await executeQuery(
            'INSERT INTO explore_views (user_id, video_id, source, tenant_id) VALUES (?, ?, ?, ?)',
            [userId, videoId, source, tenantId]
        );
    }
};

export default ExploreRepository;
