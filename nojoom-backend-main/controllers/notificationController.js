import NotificationRepository from '../repositories/NotificationRepository.js';
import { getIO } from '../socket/socketManager.js';
import { pool } from '../config/db.js';

// Get user notifications with pagination
export const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, type } = req.query;
        const offset = (page - 1) * limit;

        const notifications = await NotificationRepository.getNotifications({
             userId,
             tenantId: req.tenantId,
             type,
             limit,
             offset
         });
 
         const total = await NotificationRepository.getNotificationsCount({
             userId,
             tenantId: req.tenantId,
             type
         });

        res.json({
            notifications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

// Get unread count
export const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const count = await NotificationRepository.getUnreadCount(userId, req.tenantId);

        res.json({ count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await NotificationRepository.markAsRead(id, userId, req.tenantId);

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Failed to mark as read' });
    }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        await NotificationRepository.markAllAsRead(userId, req.tenantId);

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
};

// Delete notification
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await NotificationRepository.deleteNotification(id, userId, req.tenantId);

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};

// Create notification (helper function)
export const createNotification = async (userId, type, actorId, targetId, targetType, message, tenantId = 1) => {
    try {
        // Don't create notification if actor is the same as recipient
        if (userId === actorId) return;

        const insertId = await NotificationRepository.createNotification({ userId, type, actorId, targetId, targetType, message, tenantId });
         const notification = await NotificationRepository.getNotificationWithDetails(insertId);

        // Emit socket event for real-time notification
        const io = getIO();
        if (io) {
            io.to(`user:${userId}`).emit('new_notification', notification);
            io.to(`user_${userId}`).emit('new_notification', notification);
            console.log(`📡 Notification emitted to user ${userId}`);
        }

        // ✅ تسجيل الإشعار كـ Push Notification إذا كان المستخدم مشتركاً
        try {
            const { pushService } = await import('../services/pushService.js');
            await pushService.sendPushNotification(userId, notification);
        } catch (pushError) {
            console.error('Failed to send push notification:', pushError);
        }

        // ✅ إرسال إشعار Firebase Cloud Messaging (FCM)
        try {
            const { fcmService } = await import('../services/fcmService.js');
            await fcmService.sendFCMNotification(userId, notification);
        } catch (fcmError) {
            console.error('Failed to send FCM push notification:', fcmError);
        }

        // ✅ إرسال إشعار بالبريد الإلكتروني
        try {
            const [userRows] = await pool.execute('SELECT email, username FROM users WHERE id = ?', [userId]);
            if (userRows[0]) {
                const recipient = userRows[0];
                const { emailService } = await import('../services/emailService.js');
                const actorName = notification.actor_username || 'Someone';
                await emailService.sendActivityNotificationEmail(recipient, {
                    ...notification,
                    actor_username: actorName
                });
            }
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
        }

        return notification;
    } catch (error) {
        console.error('Create notification error:', error);
        throw error;
    }
};
