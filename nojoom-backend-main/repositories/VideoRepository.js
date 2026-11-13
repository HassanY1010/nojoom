import { pool } from '../config/db.js';

export const VideoRepository = {
    async getUserVideos({ reqUserId, targetUserId, tenantId, orderBy, limit, offset }) {
        const params = [reqUserId, targetUserId, tenantId];
        let query = `SELECT v.*, u.username, u.avatar,
                  COUNT(DISTINCT l.user_id) as likes,
                  EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) as is_liked
           FROM videos v
           JOIN users u ON v.user_id = u.id
           LEFT JOIN likes l ON v.id = l.video_id
           WHERE v.user_id = ? AND v.tenant_id = ? AND v.deleted_by_admin = FALSE
           GROUP BY v.id
           ORDER BY ${orderBy}`;

        if (limit !== undefined && offset !== undefined) {
            query += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), offset);
        }

        const [videos] = await pool.execute(query, params);
        return videos;
    },

    async getUserVideosCount(userId) {
        const [totalCount] = await pool.execute(
            'SELECT COUNT(*) as total FROM videos WHERE user_id = ? AND deleted_by_admin = FALSE',
            [userId]
        );
        return totalCount[0].total;
    },

    async checkExistingView(videoId, userId) {
        const [existingViews] = await pool.execute(
            'SELECT id FROM video_views WHERE video_id = ? AND user_id = ?',
            [videoId, userId]
        );
        return existingViews.length > 0;
    },

    async recordView(videoId, userId) {
        await pool.execute(
            'INSERT INTO video_views (video_id, user_id) VALUES (?, ?)',
            [videoId, userId]
        );
    },

    async incrementVideoViews(videoId) {
        await pool.execute(
            'UPDATE videos SET views = views + 1 WHERE id = ?',
            [videoId]
        );
    },

    async incrementUserViewsCount(userId) {
        await pool.execute(
            'UPDATE users SET views_count = views_count + 1 WHERE id = ?',
            [userId]
        );
    },

    async getCommentCount(videoId) {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND deleted_by_admin = FALSE',
            [videoId]
        );
        return rows[0]?.count || 0;
    },

    async getLikedVideos(userId) {
        const [videos] = await pool.execute(
            `SELECT v.*, u.username, u.avatar
             FROM likes l
             JOIN videos v ON l.video_id = v.id
             JOIN users u ON v.user_id = u.id
             WHERE l.user_id = ? AND v.deleted_by_admin = FALSE`,
            [userId]
        );
        return videos;
    },

    async getVideoOwner(videoId) {
        const [rows] = await pool.execute(
            'SELECT user_id FROM videos WHERE id = ?',
            [videoId]
        );
        return rows[0]?.user_id;
    },
    async checkVideoExists(videoId) {
        const [rows] = await pool.execute(
            'SELECT id FROM videos WHERE id = ? AND deleted_by_admin = FALSE',
            [videoId]
        );
        return rows.length > 0;
    },

    async likeVideo(userId, videoId) {
        await pool.execute(
            `INSERT INTO likes (user_id, video_id, created_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE created_at = NOW()`,
            [userId, videoId]
        );
    },

    async unlikeVideo(userId, videoId) {
        await pool.execute(
            'DELETE FROM likes WHERE user_id = ? AND video_id = ?',
            [userId, videoId]
        );
    },

    async recordWatchHistory(userId, videoId) {
        await pool.execute(
            `INSERT INTO watch_history (user_id, video_id, updated_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE updated_at = NOW()`,
            [userId, videoId]
        );
    },

    async updateVideo(videoId, userId, data) {
        await pool.execute(
            `UPDATE videos
             SET video_url = ?, thumbnail = ?, description = ?, title = ?, duration = ?, path = ?, category = ?
            WHERE id = ? AND user_id = ?`,
            [
                data.video_url,
                data.thumbnail,
                data.description,
                data.title,
                data.duration,
                data.path,
                data.category,
                videoId,
                userId
            ]
        );
    },
    async recordDetailedWatchHistory(userId, videoId, watchTime, completed) {
        await pool.execute(
            `INSERT INTO watch_history (user_id, video_id, watch_time, completed, created_at) 
             VALUES (?, ?, ?, ?, NOW()) 
             ON DUPLICATE KEY UPDATE 
             watch_time = watch_time + VALUES(watch_time),
             completed = VALUES(completed),
             updated_at = NOW()`,
            [userId, videoId, watchTime || 0, completed || false]
        );
    },
    async getPublicVideos({ userId, sortBy, limit, offset }) {
        let orderSQL = 'v.created_at DESC';
        switch (sortBy) {
            case 'views': orderSQL = 'v.views DESC'; break;
            case 'likes': orderSQL = 'likes DESC'; break;
            case 'oldest': orderSQL = 'v.created_at ASC'; break;
        }

        const sql = `
          SELECT 
            v.id, v.user_id, v.description, v.path, v.video_url, v.thumbnail, v.views, v.created_at,
            u.username, u.avatar,
            COUNT(DISTINCT l.user_id) AS likes,
            COUNT(DISTINCT c.id)      AS comment_count,
            EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND video_id = v.id) AS is_liked
          FROM videos v
          JOIN users u ON u.id = v.user_id
          LEFT JOIN likes  l ON l.video_id = v.id
          LEFT JOIN comments c ON c.video_id = v.id AND c.deleted_by_admin = FALSE
          WHERE v.deleted_by_admin = FALSE
          GROUP BY v.id, u.id, u.username, u.avatar
          ORDER BY ${orderSQL}
          LIMIT ? OFFSET ?
        `;

        const [rows] = await pool.execute(sql, [userId, parseInt(limit), offset]);
        return rows;
    },

    async getPublicVideosCount() {
        const [totalRes] = await pool.execute(
            'SELECT COUNT(*) AS total FROM videos WHERE is_public = TRUE AND deleted_by_admin = FALSE'
        );
        return totalRes[0].total;
    }
};

export default VideoRepository;
