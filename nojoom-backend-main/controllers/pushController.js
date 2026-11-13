import PushRepository from '../repositories/PushRepository.js';
import { fcmService } from '../services/fcmService.js';

export const pushController = {
    async subscribe(req, res) {
        try {
            const userId = req.user.id;
            const { subscription } = req.body;

            if (!subscription) {
                return res.status(400).json({ error: 'Subscription is required' });
            }

            const subscriptionJson = JSON.stringify(subscription);

            // Check if subscription already exists to avoid duplicates
            const existing = await PushRepository.findSubscription(userId, subscriptionJson);
 
             if (!existing) {
                 await PushRepository.createSubscription(userId, subscriptionJson);
             }

            res.status(201).json({ message: 'Subscribed successfully' });
        } catch (error) {
            console.error('Subscribe error:', error);
            res.status(500).json({ error: 'Failed to subscribe' });
        }
    },

    async unsubscribe(req, res) {
        try {
            const userId = req.user.id;
            const { subscription } = req.body;

            if (!subscription) {
                return res.status(400).json({ error: 'Subscription is required' });
            }

            const subscriptionJson = JSON.stringify(subscription);

            await PushRepository.deleteSubscription(userId, subscriptionJson);

            res.json({ message: 'Unsubscribed successfully' });
        } catch (error) {
            console.error('Unsubscribe error:', error);
            res.status(500).json({ error: 'Failed to unsubscribe' });
        }
    },

    async getPublicKey(req, res) {
        res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
    },

    async subscribeFCM(req, res) {
        try {
            const userId = req.user.id;
            const { fcmToken, deviceType } = req.body;

            if (!fcmToken) {
                return res.status(400).json({ error: 'FCM Token is required' });
            }

            await fcmService.registerToken(userId, fcmToken, deviceType || 'web');
            res.status(201).json({ message: 'FCM Token registered successfully' });
        } catch (error) {
            console.error('FCM subscribe error:', error);
            res.status(500).json({ error: 'Failed to subscribe FCM' });
        }
    },

    async unsubscribeFCM(req, res) {
        try {
            const userId = req.user.id;
            const { fcmToken } = req.body;

            if (!fcmToken) {
                return res.status(400).json({ error: 'FCM Token is required' });
            }

            await fcmService.unregisterToken(userId, fcmToken);
            res.json({ message: 'FCM Token unregistered successfully' });
        } catch (error) {
            console.error('FCM unsubscribe error:', error);
            res.status(500).json({ error: 'Failed to unsubscribe FCM' });
        }
    }
};
