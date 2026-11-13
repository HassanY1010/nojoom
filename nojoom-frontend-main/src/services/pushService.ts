import api from './api';

const VAPID_PUBLIC_KEY = 'BJtR7m3Ai7ief5s1YEO9Uhe_rzL4jLzGUa0-ZIjuN--Qqc1RFGLh1D38Si6lzcZ_bOFp80c4YNoTtyK-6wqZsTw';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const PushService = {
    async registerAndSubscribe() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push messaging is not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Check if user is already subscribed
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                // Subscribe user
                const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });

                // Send subscription to backend
                await api.post('/push/subscribe', { subscription });
                console.log('Successfully subscribed to push notifications');
            }

            return subscription;
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
        }
    },

    async unsubscribe() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();
                await api.post('/push/unsubscribe', { subscription });
                console.log('Successfully unsubscribed from push notifications');
            }
        } catch (error) {
            console.error('Failed to unsubscribe from push notifications:', error);
        }
    },

    async checkPermission() {
        return Notification.permission;
    },

    async requestPermission() {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await this.registerAndSubscribe();
        }
        return permission;
    }
};
