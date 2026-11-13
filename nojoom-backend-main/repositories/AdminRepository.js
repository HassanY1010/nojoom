import { pool } from '../config/db.js';

export const AdminRepository = {
    async getUsers({ role, search, limit, offset }) {
        let query = `
          SELECT id, username, email, avatar, role, is_banned, ban_reason, 
                 created_at, last_seen, last_login, is_online, followers_count, following_count,
                 total_watch_time
          FROM users 
          WHERE 1=1
        `;
        const params = [];

        if (role !== 'super_admin') {
            query += " AND role != 'super_admin'";
        }

        if (search) {
            query += ' AND (username LIKE ? OR email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [users] = await pool.execute(query, params);
        return users;
    },

    async getUsersCount({ role, search }) {
        let query = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const params = [];

        if (role !== 'super_admin') {
            query += " AND role != 'super_admin'";
        }

        if (search) {
            query += ' AND (username LIKE ? OR email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        const [result] = await pool.execute(query, params);
        return result[0].total;
    },

    async getUserById(id) {
        const [users] = await pool.execute(
            `SELECT id, username, email, avatar, role, is_banned, ban_reason,
                    created_at, last_seen, last_login, is_online, followers_count, following_count,
                    total_watch_time, bio, social_links
             FROM users 
             WHERE id = ?`,
            [id]
        );
        return users[0];
    },

    async getUserVideoCount(userId) {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) as count FROM videos WHERE user_id = ? AND deleted_by_admin = FALSE',
            [userId]
        );
        return rows[0].count;
    },

    async getUserReportsCount(userId) {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) as count FROM reports WHERE reported_user_id = ?',
            [userId]
        );
        return rows[0].count;
    },
    async updateUser(id, data) {
        const { username, email, role, is_banned, ban_reason } = data;
        const [result] = await pool.execute(
            `UPDATE users 
           SET username = COALESCE(?, username),
               email = COALESCE(?, email),
               role = COALESCE(?, role),
               is_banned = COALESCE(?, is_banned),
               ban_reason = COALESCE(?, ban_reason),
               updated_at = NOW()
           WHERE id = ?`,
            [username, email, role, is_banned, ban_reason, id]
        );
        return result.affectedRows;
    },

    async banUser(id, reason) {
        const [result] = await pool.execute(
            'UPDATE users SET is_banned = TRUE, ban_reason = ? WHERE id = ?',
            [reason, id]
        );
        return result.affectedRows;
    },

    async unbanUser(id) {
        const [result] = await pool.execute(
            'UPDATE users SET is_banned = FALSE, ban_reason = NULL WHERE id = ?',
            [id]
        );
        return result.affectedRows;
    },

    async deleteUser(id) {
        const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        return result.affectedRows;
    },
    async getVideos({ search, limit, offset }) {
        let query = `
          SELECT v.*, u.username, u.email, u.avatar,
                 (SELECT COUNT(*) FROM likes WHERE video_id = v.id) as likes_count,
                 (SELECT COUNT(*) FROM reports WHERE video_id = v.id AND status = 'pending') as pending_reports_count
          FROM videos v
          JOIN users u ON v.user_id = u.id
          WHERE v.deleted_by_admin = FALSE
        `;
        const params = [];

        if (search) {
            const searchTerm = `%${search}%`;
            query += ' AND (v.description LIKE ? OR u.username LIKE ?)';
            params.push(searchTerm, searchTerm);
        }

        query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [videos] = await pool.execute(query, params);
        return videos;
    },

    async getVideosCount({ search }) {
        let query = `
          SELECT COUNT(*) as total 
          FROM videos v
          JOIN users u ON v.user_id = u.id
          WHERE v.deleted_by_admin = FALSE
        `;
        const params = [];

        if (search) {
            const searchTerm = `%${search}%`;
            query += ' AND (v.description LIKE ? OR u.username LIKE ?)';
            params.push(searchTerm, searchTerm);
        }

        const [result] = await pool.execute(query, params);
        return result[0].total;
    },
    async getVideoById(id) {
        const [videos] = await pool.execute(
            `SELECT v.*, u.username, u.email, u.avatar, u.is_banned, v.file_size,
                    (SELECT COUNT(*) FROM likes WHERE video_id = v.id) as likes_count,
                    (SELECT COUNT(*) FROM comments WHERE video_id = v.id AND deleted_by_admin = FALSE) as comments_count,
                    (SELECT COUNT(*) FROM reports WHERE video_id = v.id) as reports_count
             FROM videos v
             JOIN users u ON v.user_id = u.id
             WHERE v.id = ?`,
            [id]
        );
        return videos[0];
    },
    async deleteVideoAdmin(id, reason) {
        const [result] = await pool.execute(
            'UPDATE videos SET deleted_by_admin = TRUE, deletion_reason = ?, deleted_at = NOW() WHERE id = ?',
            [reason, id]
        );
        
        if (result.affectedRows > 0) {
            await pool.execute('DELETE FROM reports WHERE video_id = ?', [id]);
        }
        
        return result.affectedRows;
    },
    async pinVideo(id) {
        const [result] = await pool.execute(
            'UPDATE videos SET is_pinned = TRUE, pinned_at = NOW() WHERE id = ?',
            [id]
        );
        return result.affectedRows;
    },

    async unpinVideo(id) {
        const [result] = await pool.execute(
            'UPDATE videos SET is_pinned = FALSE, pinned_at = NULL WHERE id = ?',
            [id]
        );
        return result.affectedRows;
    },

    async getPinnedVideos() {
        const [videos] = await pool.execute(
            `SELECT v.*, u.username, u.avatar 
             FROM videos v 
             JOIN users u ON v.user_id = u.id 
             WHERE v.is_pinned = TRUE AND v.deleted_by_admin = FALSE
             ORDER BY v.pinned_at DESC`
        );
        return videos;
    },

    async getMostViewedVideos(limit) {
        const [videos] = await pool.execute(
            `SELECT v.*, u.username, u.avatar 
             FROM videos v 
             JOIN users u ON v.user_id = u.id 
             WHERE v.deleted_by_admin = FALSE
             ORDER BY v.views DESC 
             LIMIT ?`,
            [parseInt(limit)]
        );
        return videos;
    },
    async createBroadcast(adminId, content, target) {
        const [result] = await pool.execute(
            'INSERT INTO broadcasts (admin_id, content, target, created_at) VALUES (?, ?, ?, NOW())',
            [adminId, content, target]
        );
        return result.insertId;
    },

    async getBroadcasts(limit, offset) {
        const [broadcasts] = await pool.execute(
            `SELECT b.*, u.username as admin_username, u.avatar as admin_avatar
             FROM broadcasts b 
             LEFT JOIN users u ON b.admin_id = u.id 
             ORDER BY b.created_at DESC 
             LIMIT ? OFFSET ?`,
            [parseInt(limit), offset]
        );
        return broadcasts;
    },

    async getBroadcastsCount() {
        const [result] = await pool.execute('SELECT COUNT(*) as total FROM broadcasts');
        return result[0].total;
    },
    async getSystemSettings() {
        const [settings] = await pool.execute(
            'SELECT * FROM system_settings WHERE id = 1'
        );
        return settings[0];
    },

    async updateSystemSettings(data) {
        const {
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

        const [result] = await pool.execute(
            `INSERT INTO system_settings 
           (id, maintenance_mode, chat_enabled, upload_enabled, user_registration_enabled, max_video_size, max_video_duration, auto_ban_reports_threshold, allowed_video_formats, featured_hashtags, maintenance_message, updated_at) 
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
           maintenance_mode = COALESCE(VALUES(maintenance_mode), maintenance_mode),
           chat_enabled = COALESCE(VALUES(chat_enabled), chat_enabled),
           upload_enabled = COALESCE(VALUES(upload_enabled), upload_enabled),
           user_registration_enabled = COALESCE(VALUES(user_registration_enabled), user_registration_enabled),
           max_video_size = COALESCE(VALUES(max_video_size), max_video_size),
           max_video_duration = COALESCE(VALUES(max_video_duration), max_video_duration),
           auto_ban_reports_threshold = COALESCE(VALUES(auto_ban_reports_threshold), auto_ban_reports_threshold),
           allowed_video_formats = COALESCE(VALUES(allowed_video_formats), allowed_video_formats),
           featured_hashtags = COALESCE(VALUES(featured_hashtags), featured_hashtags),
           maintenance_message = COALESCE(VALUES(maintenance_message), maintenance_message),
           updated_at = NOW()`,
            [
                maintenance_mode ?? null,
                chat_enabled ?? null,
                upload_enabled ?? null,
                user_registration_enabled ?? null,
                max_video_size ?? null,
                max_video_duration ?? null,
                auto_ban_reports_threshold ?? null,
                allowed_video_formats ?? null,
                featured_hashtags ?? null,
                maintenance_message ?? null
            ]
        );
        return result.affectedRows;
    },
    async getChatStats(timeFilter) {
        const [
            activeChatsResult,
            messagesResult,
            activeUsersResult
        ] = await Promise.all([
            pool.execute(
                `SELECT COUNT(DISTINCT video_id) as count 
                 FROM messages 
                 WHERE created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})`
            ),
            pool.execute(
                `SELECT COUNT(*) as count 
                 FROM messages 
                 WHERE created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})`
            ),
            pool.execute(
                `SELECT COUNT(DISTINCT sender_id) as count 
                 FROM messages 
                 WHERE created_at > DATE_SUB(NOW(), INTERVAL ${timeFilter})`
            )
        ]);

        return {
            activeChats: activeChatsResult[0][0].count,
            totalMessages: messagesResult[0][0].count,
            activeUsers: activeUsersResult[0][0].count
        };
    },
    async getMessages({ videoId, limit, offset }) {
        let query = `
          SELECT m.*, u.username, u.avatar, u.role as user_role
          FROM messages m
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE 1=1
        `;
        const params = [];

        if (videoId) {
            query += ' AND m.video_id = ?';
            params.push(videoId);
        }

        query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [messages] = await pool.execute(query, params);
        return messages;
    },

    async getMessagesCount(videoId) {
        let query = 'SELECT COUNT(*) as total FROM messages WHERE 1=1';
        const params = [];

        if (videoId) {
            query += ' AND video_id = ?';
            params.push(videoId);
        }

        const [result] = await pool.execute(query, params);
        return result[0].total;
    },

    async getMessageById(messageId) {
        const [messages] = await pool.execute(
            'SELECT * FROM messages WHERE id = ?',
            [messageId]
        );
        return messages[0];
    },

    async deleteMessage(messageId, adminId, reason) {
        const message = await this.getMessageById(messageId);
        if (!message) return 0;

        // حفظ نسخة في السجل
        await pool.execute(
            `INSERT INTO deleted_messages 
             (original_id, sender_id, video_id, content, type, created_at, deleted_by, reason) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [message.id, message.sender_id, message.video_id, message.content,
            message.type, message.created_at, adminId, reason]
        );

        // حذف الرسالة الأصلية
        const [result] = await pool.execute('DELETE FROM messages WHERE id = ?', [messageId]);
        return result.affectedRows;
    },
    async boostVideo(id, boostScore) {
        const [result] = await pool.execute(
            'UPDATE videos SET boost_score = ? WHERE id = ?',
            [boostScore, id]
        );
        return result.affectedRows;
    },
    async getStats() {
        const [
            usersStats,
            videosStats,
            messagesStats,
            reportsStats,
            storageStats
        ] = await Promise.all([
            pool.execute(`
              SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN is_online = TRUE THEN 1 END) as active_users,
                COUNT(CASE WHEN is_banned = TRUE THEN 1 END) as banned_users,
                COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_users
              FROM users
            `),
            pool.execute(`
              SELECT 
                COUNT(*) as total_videos,
                COUNT(CASE WHEN is_pinned = TRUE THEN 1 END) as pinned_videos,
                COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as daily_uploads,
                COALESCE(SUM(views), 0) as total_views,
                COALESCE(SUM(likes), 0) as total_likes
              FROM videos 
              WHERE deleted_by_admin = FALSE
            `),
            pool.execute(`
              SELECT 
                COUNT(*) as total_messages
              FROM messages
            `),
            pool.execute(`
              SELECT 
                COUNT(*) as total_reports,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_reports,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_reports,
                COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_reports
              FROM reports
            `),
            pool.execute(`
              SELECT COALESCE(SUM(LENGTH(path)), 0) as storage_used
              FROM videos
              WHERE deleted_by_admin = FALSE
            `)
        ]);

        return {
            users: usersStats[0][0],
            videos: videosStats[0][0],
            messages: messagesStats[0][0],
            reports: reportsStats[0][0],
            storage: storageStats[0][0]
        };
    }
};

export default AdminRepository;
