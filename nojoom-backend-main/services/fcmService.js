import { pool } from '../config/db.js';

let firebaseAdmin = null;

const initFirebase = async () => {
    if (firebaseAdmin) return firebaseAdmin;
    try {
        const adminModule = await import('firebase-admin');
        const admin = adminModule.default;
        
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        if (serviceAccountPath) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountPath)
            });
            firebaseAdmin = admin;
            console.log('🔥 Firebase Admin SDK initialized successfully');
        } else if (process.env.FIREBASE_PROJECT_ID) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                })
            });
            firebaseAdmin = admin;
            console.log('🔥 Firebase Admin SDK initialized via environment variables');
        } else {
            console.warn('⚠️ Firebase credentials not configured. FCM will run in dry-run/mock mode.');
        }
    } catch (error) {
        console.warn('⚠️ Firebase Admin SDK is not installed or failed to initialize:', error.message);
    }
    return firebaseAdmin;
};

// Initialize on load
initFirebase();

export const fcmService = {
    /**
     * Register an FCM token for a user
     */
    async registerToken(userId, fcmToken, deviceType = 'web') {
        try {
            await pool.execute(
                `INSERT INTO fcm_tokens (user_id, fcm_token, device_type) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE device_type = VALUES(device_type)`,
                [userId, fcmToken, deviceType]
            );
            return { success: true };
        } catch (error) {
            console.error('Error registering FCM token:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Unregister an FCM token
     */
    async unregisterToken(userId, fcmToken) {
        try {
            await pool.execute(
                'DELETE FROM fcm_tokens WHERE user_id = ? AND fcm_token = ?',
                [userId, fcmToken]
            );
            return { success: true };
        } catch (error) {
            console.error('Error unregistering FCM token:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Send push notification via FCM to a specific user
     */
    async sendFCMNotification(userId, notification) {
        try {
            const admin = await initFirebase();
            
            // Get user's active tokens
            const [rows] = await pool.execute(
                'SELECT fcm_token FROM fcm_tokens WHERE user_id = ?',
                [userId]
            );

            if (!rows || rows.length === 0) {
                return { success: false, message: 'No FCM tokens registered for user' };
            }

            const tokens = rows.map(r => r.fcm_token);

            const payload = {
                notification: {
                    title: 'Nojoom',
                    body: notification.message || 'New notification',
                },
                data: {
                    url: getNotificationUrl(notification),
                    notificationId: String(notification.id),
                    type: String(notification.type)
                }
            };

            if (admin) {
                // Send to multiple tokens
                const response = await admin.messaging().sendEachForMulticast({
                    tokens,
                    notification: payload.notification,
                    data: payload.data
                });

                // Clean up invalid tokens
                if (response.failureCount > 0) {
                    const tokensToRemove = [];
                    response.responses.forEach((resp, idx) => {
                        if (!resp.success) {
                            const errorCode = resp.error?.code;
                            if (
                                errorCode === 'messaging/invalid-registration-token' ||
                                errorCode === 'messaging/registration-token-not-registered'
                            ) {
                                tokensToRemove.push(tokens[idx]);
                            }
                        }
                    });

                    if (tokensToRemove.length > 0) {
                        const placeholders = tokensToRemove.map(() => '?').join(',');
                        await pool.execute(
                            `DELETE FROM fcm_tokens WHERE user_id = ? AND fcm_token IN (${placeholders})`,
                            [userId, ...tokensToRemove]
                        );
                        console.log(`🧹 Cleaned up ${tokensToRemove.length} expired FCM tokens`);
                    }
                }

                return { success: true, sentCount: response.successCount };
            } else {
                console.log(`[FCM Mock Send] To User ${userId} (${tokens.length} tokens):`, payload);
                return { success: true, mock: true };
            }
        } catch (error) {
            console.error('FCM Service Error:', error);
            return { success: false, error: error.message };
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
