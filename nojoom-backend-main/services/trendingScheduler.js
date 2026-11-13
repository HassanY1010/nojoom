import cron from 'node-cron';
import { Video } from '../models/Video.js';
import { pool } from '../config/db.js';
import { createNotification } from '../controllers/notificationController.js';

export class TrendingScheduler {
    static init() {
        console.log('🔄 Initializing Trending Video Scheduler...');

        // ✅ كل يوم الساعة 7 مساءً - إرسال إشعار بالفيديوهات الرائجة
        cron.schedule('0 19 * * *', async () => {
            console.log('⏰ Running daily trending video notification job...');
            try {
                await this.notifyTrendingVideos();
            } catch (error) {
                console.error('❌ Error in trending video notification job:', error);
            }
        }, {
            timezone: 'Asia/Riyadh'
        });

        console.log('✅ Trending Video Scheduler initialized successfully');
    }

    static async notifyTrendingVideos() {
        try {
            // 1. الحصول على أفضل فيديو رائج في آخر 3 أيام
            const trendingVideos = await Video.getTrendingVideos(1, 3);

            if (!trendingVideos || trendingVideos.length === 0) {
                console.log('ℹ️ No trending videos found for notification.');
                return;
            }

            const topVideo = trendingVideos[0];
            const message = `🔥 فيديو رائج الآن: شاهد "${topVideo.title || topVideo.description?.substring(0, 30) || 'فيديو جديد'}" على نجوم!`;

            // 2. الحصول على عينة من المستخدمين النشطين (مثلاً 100 مستخدم لتجنب الضغط)
            // في تطبيق حقيقي قد ترسل للجميع عبر نظام Broadcast متخصص أو دفعات
            const [users] = await pool.query(
                'SELECT id, tenant_id FROM users WHERE is_banned = FALSE AND last_seen > DATE_SUB(NOW(), INTERVAL 7 DAY) LIMIT 100'
            );

            console.log(`🔔 Sending trending notification to ${users.length} active users...`);

            for (const user of users) {
                // تجنب إرسال إشعار لصاحب الفيديو نفسه
                if (user.id === topVideo.user_id) continue;

                await createNotification(
                    user.id,
                    'trending_video',
                    topVideo.user_id, // المنشئ هو الـ actor
                    topVideo.id,
                    'video',
                    message,
                    user.tenant_id || 1
                ).catch(err => console.error(`Failed to notify user ${user.id}:`, err.message));
            }

            console.log('✅ Trending notifications sent successfully');
        } catch (error) {
            console.error('❌ Error notifying trending videos:', error);
        }
    }

    // دالة للاختبار اليدوي
    static async testNow() {
        console.log('🧪 Testing trending notification now...');
        return await this.notifyTrendingVideos();
    }
}
