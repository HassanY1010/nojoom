import { pool } from '../config/db.js';

export const UserRepository = {
    async getProfileByUsername(username) {
        const [rows] = await pool.execute(
            `SELECT 
              u.id, u.username, u.email, u.avatar, u.bio, u.country, u.social_links, 
              u.total_watch_time, u.created_at, u.role,
              (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as followers_count,
              (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) as following_count,
              (SELECT COUNT(*) FROM likes l JOIN videos v ON l.video_id = v.id WHERE v.user_id = u.id) as likes_count,
              (SELECT COALESCE(SUM(v2.views), 0) FROM videos v2 WHERE v2.user_id = u.id AND v2.deleted_by_admin = FALSE) as views_count,
              (SELECT id FROM live_streams WHERE host_id = u.id AND status = 'active' LIMIT 1) as active_live_id
             FROM users u 
             WHERE u.username = ?`,
            [username]
        );
        return rows[0];
    },

    async getWatchHistory(userId, limit, offset) {
        const [history] = await pool.execute(
            `SELECT 
              wh.*,
              v.id as video_id,
              v.title,
              v.description,
              v.url,
              v.thumbnail,
              v.duration,
              v.views,
              v.likes,
              v.created_at as video_created_at,
              u.id as owner_id,
              u.username as owner_username,
              u.avatar as owner_avatar
             FROM watch_history wh
             JOIN videos v ON wh.video_id = v.id
             JOIN users u ON v.user_id = u.id
             WHERE wh.user_id = ?
             ORDER BY wh.updated_at DESC
             LIMIT ? OFFSET ?`,
            [userId, parseInt(limit), offset]
        );
        return history;
    },

    async getWatchHistoryCount(userId) {
        const [totalCount] = await pool.execute(
            'SELECT COUNT(*) as total FROM watch_history WHERE user_id = ?',
            [userId]
        );
        return totalCount[0].total;
    },

    async deleteWatchHistoryItem(userId, videoId) {
        await pool.execute(
            'DELETE FROM watch_history WHERE user_id = ? AND video_id = ?',
            [userId, videoId]
        );
    },

    async clearWatchHistory(userId) {
        await pool.execute(
            'DELETE FROM watch_history WHERE user_id = ?',
            [userId]
        );
    },
    async getFollowers(userId) {
        const [followers] = await pool.execute(
            `SELECT u.id, u.username, u.avatar, u.bio, u.created_at
             FROM followers f
             JOIN users u ON f.follower_id = u.id
             WHERE f.following_id = ? AND u.is_banned = FALSE
             ORDER BY f.created_at DESC`,
            [userId]
        );
        return followers;
    },

    async getFollowing(userId) {
        const [following] = await pool.execute(
            `SELECT u.id, u.username, u.avatar, u.bio, u.created_at
             FROM followers f
             JOIN users u ON f.following_id = u.id
             WHERE f.follower_id = ? AND u.is_banned = FALSE
             ORDER BY f.created_at DESC`,
            [userId]
        );
        return following;
    },
    async getLikesForUserVideos(userId) {
        const [likes] = await pool.execute(
            `SELECT DISTINCT u.id, u.username, u.avatar, l.created_at
             FROM likes l
             JOIN videos v ON l.video_id = v.id
             JOIN users u ON l.user_id = u.id
             WHERE v.user_id = ? AND u.is_banned = FALSE
             ORDER BY l.created_at DESC`,
            [userId]
        );
        return likes;
    },
    async getUserPreferences(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM user_preferences WHERE user_id = ?',
            [userId]
        );
        return rows[0];
    },

    async updateUserPreferences(userId, preferences) {
        await pool.execute(
            `INSERT INTO user_preferences (user_id, preferred_categories, content_weights, excluded_users, updated_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
             preferred_categories = VALUES(preferred_categories),
             content_weights = VALUES(content_weights),
             excluded_users = VALUES(excluded_users),
             updated_at = NOW()`,
            [
                userId,
                JSON.stringify(preferences.preferred_categories || []),
                JSON.stringify(preferences.content_weights || {}),
                JSON.stringify(preferences.excluded_users || [])
            ]
        );
    },

    async getUserStats(userId) {
        const [stats] = await pool.execute(
            `SELECT 
               followers_count,
               following_count,
               likes_count,
               views_count,
               total_watch_time,
               (SELECT COUNT(*) FROM videos WHERE user_id = ? AND deleted_by_admin = FALSE) as videos_count
             FROM users 
             WHERE id = ?`,
            [userId, userId]
        );
        return stats[0];
    },
    async getUserActivity(userId, limit, offset) {
        const [activities] = await pool.execute(
            `SELECT 'like' as type, l.created_at as timestamp, v.id as video_id, v.title, v.thumbnail,
                    u.id as target_user_id, u.username as target_username, u.avatar as target_avatar
             FROM likes l
             JOIN videos v ON l.video_id = v.id
             JOIN users u ON v.user_id = u.id
             WHERE l.user_id = ?
             
             UNION ALL
             
             SELECT 'follow' as type, f.created_at as timestamp, NULL as video_id, NULL as title, NULL as thumbnail,
                    u.id as target_user_id, u.username as target_username, u.avatar as target_avatar
             FROM followers f
             JOIN users u ON f.following_id = u.id
             WHERE f.follower_id = ?
             
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?`,
            [userId, userId, parseInt(limit), offset]
        );
        return activities;
    },

    async getUserActivityCount(userId) {
        const [totalCount] = await pool.execute(
            `SELECT (
                (SELECT COUNT(*) FROM likes WHERE user_id = ?) +
                (SELECT COUNT(*) FROM followers WHERE follower_id = ?)
            ) as total`,
            [userId, userId]
        );
        return totalCount[0].total;
    },

    async deleteAccount(userId) {
        await pool.execute(
            'UPDATE users SET is_banned = TRUE, email = CONCAT(email, "_deleted_", UUID()), username = CONCAT(username, "_deleted_", UUID()) WHERE id = ?',
            [userId]
        );
    },
    async getSuggestedUsers(userId, limit) {
        const [suggestedUsers] = await pool.execute(
            `SELECT u.id, u.username, u.avatar, u.bio, u.followers_count,
                    COUNT(DISTINCT f2.follower_id) as mutual_followers
             FROM users u
             LEFT JOIN followers f1 ON u.id = f1.following_id AND f1.follower_id = ?
             LEFT JOIN followers f2 ON u.id = f2.following_id 
                                  AND f2.follower_id IN (SELECT following_id FROM followers WHERE follower_id = ?)
             WHERE f1.follower_id IS NULL 
               AND u.id != ? 
               AND u.is_banned = FALSE
             GROUP BY u.id
             ORDER BY mutual_followers DESC, u.followers_count DESC
             LIMIT ?`,
            [userId, userId, userId, parseInt(limit)]
        );
        return suggestedUsers;
    },
    async blockUser(userId, targetUserId) {
        await pool.execute(
            'INSERT IGNORE INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)',
            [userId, targetUserId]
        );
    },

    async unblockUser(userId, targetUserId) {
        await pool.execute(
            'DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
            [userId, targetUserId]
        );
    },
    async getNotifications(userId, limit, offset) {
        const [notifications] = await pool.execute(
            `SELECT * FROM notifications 
             WHERE user_id = ? 
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, parseInt(limit), offset]
        );
        return notifications;
    },

    async getNotificationsCount(userId) {
        const [totalCount] = await pool.execute(
            'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
            [userId]
        );
        return totalCount[0].total;
    },

    async markNotificationAsRead(userId, notificationId) {
        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
    },

    async markAllNotificationsAsRead(userId) {
        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
    },

    async deleteNotification(userId, notificationId) {
        await pool.execute(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
    },

    async getBlockedUsers(userId) {
        const [blockedUsers] = await pool.execute(
            `SELECT bu.*, u.username, u.avatar
             FROM blocked_users bu
             JOIN users u ON bu.blocked_user_id = u.id
             WHERE bu.user_id = ?
             ORDER BY bu.created_at DESC`,
            [userId]
        );
        return blockedUsers;
    },
    async getFullUserData(userId) {
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];
        if (user) delete user.password; // Security

        const [videos] = await pool.execute('SELECT * FROM videos WHERE user_id = ?', [userId]);
        const [comments] = await pool.execute('SELECT * FROM comments WHERE user_id = ?', [userId]);
        const [likes] = await pool.execute('SELECT * FROM likes WHERE user_id = ?', [userId]);
        const [followers] = await pool.execute('SELECT * FROM followers WHERE following_id = ?', [userId]);
        const [following] = await pool.execute('SELECT * FROM followers WHERE follower_id = ?', [userId]);
        const [history] = await pool.execute('SELECT * FROM watch_history WHERE user_id = ?', [userId]);

        return {
            profile: user,
            videos: videos || [],
            comments: comments || [],
            likes: likes || [],
            followers: followers || [],
            following: following || [],
            watchHistory: history || []
        };
    },
    async updateNotificationSettings(userId, notifications) {
        await pool.execute(
            `INSERT INTO user_preferences (user_id, notifications, updated_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE
             notifications = VALUES(notifications),
             updated_at = NOW()`,
            [userId, notifications !== undefined ? notifications : true]
        );
    },
    async getUserPassword(userId) {
        const [users] = await pool.execute(
            'SELECT password FROM users WHERE id = ?',
            [userId]
        );
        return users[0]?.password;
    },

    async updateUserPassword(userId, hashedPassword) {
        await pool.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, userId]
        );
    },
    async getUsers({ excludeUserId, limit, offset }) {
        let query = `
            SELECT id, username, email, avatar, bio, followers_count, following_count, 
                   likes_count, views_count, created_at
            FROM users 
            WHERE is_banned = FALSE
        `;
        const params = [];

        if (excludeUserId) {
            query += ' AND id != ?';
            params.push(excludeUserId);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [users] = await pool.execute(query, params);
        return users;
    },

    async getUsersCount({ excludeUserId }) {
        let query = 'SELECT COUNT(*) as total FROM users WHERE is_banned = FALSE';
        const params = [];

        if (excludeUserId) {
            query += ' AND id != ?';
            params.push(excludeUserId);
        }

        const [totalResult] = await pool.execute(query, params);
        return totalResult[0].total;
    },
    async getRecommendationStats(userId) {
        const [interactionCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM user_interactions WHERE user_id = ?',
            [userId]
        );

        const [watchHistoryCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM watch_history WHERE user_id = ?',
            [userId]
        );

        return {
            interactions: interactionCount[0].count,
            watchHistory: watchHistoryCount[0].count
        };
    },

    async updatePrivacySettings(userId, { is_private, allow_dms, show_activity_status }) {
        await pool.execute(
            `UPDATE users SET 
              is_private = ?, 
              allow_dms = ?, 
              show_activity_status = ? 
             WHERE id = ?`,
            [is_private, allow_dms, show_activity_status, userId]
        );
    },

    async getPrivacySettings(userId) {
        const [users] = await pool.execute(
            'SELECT is_private, allow_dms, show_activity_status FROM users WHERE id = ?',
            [userId]
        );
        return users[0];
    },
    async getUserByEmail(email) {
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return users[0];
    },
    async updateUserAppearance(userId, { theme, language }) {
        const updates = [];
        const values = [];

        if (theme) {
            updates.push('theme = ?');
            values.push(theme);
        }

        if (language) {
            updates.push('language = ?');
            values.push(language);
        }

        if (updates.length > 0) {
            values.push(userId);
            await pool.execute(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }
    },
    async saveRefreshToken(userId, token) {
        await pool.execute(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
            [userId, token]
        );
    },

    async updateLastLogin(userId) {
        await pool.execute(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [userId]
        );
    },

    async getUserByEmailOrUsername(email, username) {
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        return users;
    },

    async createAdmin(username, email, password) {
        const [result] = await pool.execute(
            `INSERT INTO users (username, email, password, role, email_verified, is_banned) 
             VALUES (?, ?, ?, 'admin', TRUE, FALSE)`,
            [username, email, password]
        );
        return result;
    },
    async getUserCountry(userId) {
        const [rows] = await pool.execute('SELECT country FROM users WHERE id = ?', [userId]);
        return rows[0]?.country;
    },
    async getFollowingUserIds(userId) {
        const [rows] = await pool.execute(
            'SELECT following_id FROM follows WHERE follower_id = ?',
            [userId]
        );
        return rows.map(r => r.following_id);

    },
    async incrementTotalWatchTime(userId, watchTime) {
        await pool.execute(
            'UPDATE users SET total_watch_time = total_watch_time + ? WHERE id = ?',
            [watchTime, userId]
        );
    },
    async getUserViewsCount(userId, tenantId) {
        const [rows] = await pool.execute(
            'SELECT views_count FROM users WHERE id = ? AND tenant_id = ?',
            [userId, tenantId]
        );
        return rows[0]?.views_count || 0;
    },
    async findUserById(id) {
        const [rows] = await pool.execute(
            'SELECT id, username, is_banned FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    }
};

export default UserRepository;
