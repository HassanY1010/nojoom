import { createNotification } from './controllers/notificationController.js';
import { pool } from './config/db.js';

async function testNotifications() {
    console.log('🧪 Starting notification system test...');

    try {
        // استخدم معرفات مستخدمين موجودة في قاعدة بياناتك للاختبار
        // سنحاول الحصول على مستخدمين حقيقيين من قاعدة البيانات بدلاً من تخمين المعرفات
        const [users] = await pool.query('SELECT id FROM users LIMIT 2');
        if (users.length < 2) {
            console.error('❌ Test requires at least 2 users in the database.');
            process.exit(1);
        }

        const testUserId = users[0].id;
        const testActorId = users[1].id;

        console.log(`🔍 Using testUserId: ${testUserId}, testActorId: ${testActorId}`);

        // 1. اختبار إشعار متابعة
        console.log('📝 Testing "follow" notification...');
        await createNotification(testUserId, 'follow', testActorId, testActorId, 'user', 'متابع جديد بدأ في متابعتك!', 1);

        // 2. اختبار إشعار تعليق
        console.log('📝 Testing "comment" notification...');
        await createNotification(testUserId, 'comment', testActorId, 1, 'video', 'علق شخص ما على فيديوهاتك', 1);

        // 3. اختبار إشعار رسالة خاصة (New)
        console.log('📝 Testing "message" notification...');
        await createNotification(testUserId, 'message', testActorId, testActorId, 'user', 'لديك رسالة جديدة من صديق', 1);

        // 4. اختبار إشعار فيديو رائج (New)
        console.log('📝 Testing "trending_video" notification...');
        await createNotification(testUserId, 'trending_video', testActorId, 1, 'video', '🔥 فيديو رائج الآن: شاهد أحدث الفيديوهات!', 1);

        // التحقق من قاعدة البيانات
        const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [testUserId]);

        console.log('\n✅ Last 5 notifications in DB:');
        rows.forEach(n => console.log(`- [${n.type}] ${n.message} (Read: ${n.is_read})`));

        console.log('\n✨ Notification system test completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testNotifications();
