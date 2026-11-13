import { User } from '../models/User.js';
import UserRepository from '../repositories/UserRepository.js';
import { createNotification } from '../controllers/notificationController.js';

export const UserService = {
    /**
     * متابعة مستخدم
     */
    async followUser(followerId, targetUserId, username, tenantId) {
        if (parseInt(targetUserId) === followerId) {
            throw new Error('Cannot follow yourself');
        }

        const success = await User.followUser(followerId, parseInt(targetUserId));
        if (!success) {
            throw new Error('Already following this user');
        }

        // ✅ تسجيل التفاعل في نظام التوصية
        try {
            const { recommendationEngine } = await import('./recommendationEngine.js');
            await recommendationEngine.recordInteraction({
                userId: followerId,
                targetUserId: parseInt(targetUserId),
                type: 'follow',
                weight: 1.5,
                timestamp: new Date()
            });
        } catch (recError) {
            console.error('Failed to record follow interaction:', recError);
        }

        // 🔔 ارسال إشعار عند المتابعة
        try {
            await createNotification(
                parseInt(targetUserId),
                'follow',
                followerId,
                followerId,
                'user',
                `بدأ ${username} في متابعتك`,
                tenantId
            );
        } catch (notifError) {
            console.error('Failed to send follow notification:', notifError);
        }

        return true;
    },

    /**
     * إلغاء متابعة مستخدم
     */
    async unfollowUser(followerId, targetUserId) {
        const success = await User.unfollowUser(followerId, parseInt(targetUserId));
        if (!success) {
            throw new Error('Not following this user');
        }

        // ✅ تسجيل التفاعل في نظام التوصية
        try {
            const { recommendationEngine } = await import('./recommendationEngine.js');
            await recommendationEngine.recordInteraction({
                userId: followerId,
                targetUserId: parseInt(targetUserId),
                type: 'unfollow',
                weight: -1.0,
                timestamp: new Date()
            });
        } catch (recError) {
            console.error('Failed to record unfollow interaction:', recError);
        }

        return true;
    }
};

export default UserService;
