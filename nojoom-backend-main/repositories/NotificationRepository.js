import { pool } from '../config/db.js';

const NotificationRepository = {
    async getNotifications({ userId, tenantId, type, limit, offset }) {
        let query = `
          SELECT 
            n.*,
            u.username as actor_username,
            u.avatar as actor_avatar
          FROM notifications n
          JOIN users u ON n.actor_id = u.id
          WHERE n.user_id = ? AND n.tenant_id = ?
        `;

        const params = [userId, tenantId];

        if (type && type !== 'all') {
            query += ' AND n.type = ?';
            params.push(type);
        }

        query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        return rows;
    },

    async getNotificationsCount({ userId, tenantId, type }) {
        let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND tenant_id = ?';
        const countParams = [userId, tenantId];

        if (type && type !== 'all') {
            countQuery += ' AND type = ?';
            countParams.push(type);
        }

        const [[{ total }]] = await pool.query(countQuery, countParams);
        return total;
    },

    async getUnreadCount(userId, tenantId) {
        const [[{ count }]] = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND tenant_id = ? AND is_read = FALSE',
            [userId, tenantId]
        );
        return count;
    },

    async markAsRead(id, userId, tenantId) {
        const [result] = await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ? AND tenant_id = ?',
            [id, userId, tenantId]
        );
        return result.affectedRows;
    },

    async markAllAsRead(userId, tenantId) {
        const [result] = await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND tenant_id = ? AND is_read = FALSE',
            [userId, tenantId]
        );
        return result.affectedRows;
    },

    async deleteNotification(id, userId, tenantId) {
        const [result] = await pool.query(
            'DELETE FROM notifications WHERE id = ? AND user_id = ? AND tenant_id = ?',
            [id, userId, tenantId]
        );
        return result.affectedRows;
    },

    async createNotification({ userId, type, actorId, targetId, targetType, message, tenantId }) {
        const [result] = await pool.query(
            'INSERT INTO notifications (user_id, type, actor_id, target_id, target_type, message, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, type, actorId, targetId, targetType, message, tenantId]
        );
        return result.insertId;
    },

    async getNotificationWithDetails(id) {
        const [[notification]] = await pool.query(
            `SELECT 
                n.*,
                u.username as actor_username,
                u.avatar as actor_avatar
              FROM notifications n
              JOIN users u ON n.actor_id = u.id
              WHERE n.id = ?`,
            [id]
        );
        return notification;
    }
};

export default NotificationRepository;
