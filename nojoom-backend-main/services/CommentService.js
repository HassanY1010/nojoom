import { Comment } from '../models/Comment.js';
import { Video } from '../models/Video.js';
import { createNotification } from '../controllers/notificationController.js';

export const CommentService = {
    /**
     * إضافة تعليق جديد مع الإشعارات والتفاعلات
     */
    async addComment(data) {
        const { videoId, userId, username, content, videoReplyId, tenantId } = data;

        const commentId = await Comment.create({
            tenant_id: tenantId,
            video_id: videoId,
            user_id: userId,
            username: username,
            content: content,
            video_reply_id: videoReplyId || null
        });

        const comment = await Comment.findById(commentId, tenantId);
        if (!comment) throw new Error('Failed to create comment');

        // ✅ تسجيل التفاعل في نظام التوصية
        try {
            const { recommendationEngine } = await import('./recommendationEngine.js');
            await recommendationEngine.recordInteraction({
                userId: userId,
                videoId: parseInt(videoId),
                type: 'comment',
                weight: 2.5,
                metadata: { commentId, content: content.substring(0, 50) },
                timestamp: new Date()
            });
        } catch (recError) {
            console.error('Failed to record comment interaction:', recError);
            // 🔒 Multi-Tenant Security: Pass tenantId
            await Video.recordUserInteraction(userId, videoId, 'comment', 2.5, tenantId);
        }

        // 🔔 ارسال إشعار لمالك الفيديو
        try {
            const video = await Video.findById(videoId, tenantId);
            if (video && video.user_id !== userId) {
                await createNotification(
                    video.user_id,
                    'comment',
                    userId,
                    commentId,
                    'comment',
                    `علق ${username} على فيديو الخاص بك: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
                    tenantId
                );
            }
        } catch (notifError) {
            console.error('Failed to send comment notification:', notifError);
        }

        return comment;
    }
};

export default CommentService;
