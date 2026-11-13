import webpush from 'web-push';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';

dotenv.config();

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
    webpush.setVapidDetails(
        'mailto:support@nojoom.app',
        publicKey,
        privateKey
    );
}

export const pushService = {
    /**
     * Send a push notification to a specific user
     */
    async sendPushNotification(userId, notification) {
        try {
            const [subscriptions] = await pool.query(
                'SELECT subscription_json FROM push_subscriptions WHERE user_id = ?',
                [userId]
            );

            if (!subscriptions || subscriptions.length === 0) {
                return { success: false, message: 'No subscriptions found' };
            }

            const payload = JSON.stringify({
                title: 'Nojoom',
                body: notification.message || 'New notification',
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: {
                    url: getNotificationUrl(notification),
                    notificationId: notification.id
                }
            });

            const sendPromises = subscriptions.map(async (row) => {
                try {
                    const subscription = JSON.parse(row.subscription_json);
                    return await webpush.sendNotification(subscription, payload);
                } catch (error) {
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        // Subscription has expired or is no longer valid
                        await this.removeSubscription(userId, row.subscription_json);
                    }
                    console.error('Error sending push:', error.message);
                    return null;
                }
            });

            await Promise.all(sendPromises);
            return { success: true };
        } catch (error) {
            console.error('Push service error:', error);
            return { success: false, error: error.message };
        }
    },

    async removeSubscription(userId, subscriptionJson) {
        try {
            await pool.query(
                'DELETE FROM push_subscriptions WHERE user_id = ? AND subscription_json = ?',
                [userId, subscriptionJson]
            );
        } catch (error) {
            console.error('Error removing expired subscription:', error);
        }
    }
};

const getNotificationUrl = (notification) => {
    switch (notification.type) {
        case 'follow':
            return `/profile/${notification.actor_id}`;
        case 'comment':
        case 'like':
            return `/video/${notification.target_id}`;
        case 'message':
            return `/chat/${notification.actor_id}`;
        default:
            return '/notifications';
    }
};
