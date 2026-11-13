import { pool } from '../config/db.js';

export class Story {
    // Create a new story
    static async create(storyData) {
        const { tenant_id, user_id, media_url, media_type, duration_hours = 24 } = storyData;

        // Calculate expiration time (default 24 hours)
        const expires_at = new Date();
        expires_at.setHours(expires_at.getHours() + duration_hours);

        // 🔒 Multi-Tenant Security: tenant_id is REQUIRED
        const [result] = await pool.execute(
            'INSERT INTO stories (tenant_id, user_id, media_url, media_type, expires_at) VALUES (?, ?, ?, ?, ?)',
            [tenant_id, user_id, media_url, media_type, expires_at]
        );

        return result.insertId;
    }

    // Get active stories for a user (not expired)
    static async getActiveByUser(userId, tenantId) {
        const [rows] = await pool.execute(
            `SELECT s.*, u.username, u.avatar
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = ? AND s.tenant_id = ? AND s.expires_at > NOW()
       ORDER BY s.created_at DESC`,
            [userId, tenantId]
        );
        return rows;
    }

    // Get stories from followed users
    static async getFeedStories(userId, tenantId) {
        const [rows] = await pool.execute(
            `SELECT s.*, u.username, u.avatar
       FROM stories s
       JOIN users u ON s.user_id = u.id
       JOIN follows f ON f.following_id = s.user_id
       WHERE f.follower_id = ? AND s.tenant_id = ? AND s.expires_at > NOW()
       ORDER BY s.created_at DESC`,
            [userId, tenantId]
        );
        return rows;
    }

    // Get all active stories grouped by user (for the stories bar)
    static async getStoriesOverview(userId, tenantId) {
        const [rows] = await pool.execute(
            `SELECT DISTINCT u.id as user_id, u.username, u.avatar,
              (SELECT COUNT(*) FROM stories WHERE user_id = u.id AND tenant_id = ? AND expires_at > NOW()) as active_stories_count
       FROM users u
       JOIN stories s ON u.id = s.user_id
       WHERE s.expires_at > NOW() AND s.tenant_id = ?
         AND (s.user_id = ? OR s.user_id IN (SELECT following_id FROM follows WHERE follower_id = ? AND tenant_id = ?))
       GROUP BY u.id
       ORDER BY MAX(s.created_at) DESC`,
            [tenantId, tenantId, userId, userId, tenantId]
        );
        return rows;
    }

    // Delete a story
    static async delete(storyId, userId, tenantId) {
        const [result] = await pool.execute(
            'DELETE FROM stories WHERE id = ? AND user_id = ? AND tenant_id = ?',
            [storyId, userId, tenantId]
        );
        return result.affectedRows > 0;
    }

    // Increment view count
    static async incrementViews(storyId) {
        await pool.execute(
            'UPDATE stories SET views_count = views_count + 1 WHERE id = ?',
            [storyId]
        );
    }
}
