// models/AITracking.js
import { pool } from '../config/db.js';

class AITracking {
    // ============ Eye Tracking ============

    /**
     * تسجيل بيانات تتبع العين
     */
    static async recordEyeTracking(data) {
        // Stubbed for privacy-safe tracking: do not write to db
        return { success: true, id: 0 };
    }

    /**
     * الحصول على بيانات تتبع العين للمستخدم
     */
    static async getUserEyeTracking(userId, limit = 100) {
        try {
            const [rows] = await pool.execute(
                `SELECT * FROM eye_tracking 
         WHERE user_id = ? AND tenant_id = ?
         ORDER BY created_at DESC 
         LIMIT ?`,
                [userId, data.tenantId || 1, limit]
            );
            return rows;
        } catch (error) {
            console.error('Error getting user eye tracking:', error);
            throw error;
        }
    }

    /**
     * حساب متوسط درجة الانتباه للفيديو
     */
    static async getVideoAttentionScore(videoId, tenantId) {
        try {
            const [rows] = await pool.execute(
                `SELECT AVG(attention_score) as avg_attention 
         FROM eye_tracking 
         WHERE video_id = ? AND tenant_id = ?`,
                [videoId, tenantId]
            );
            return rows[0]?.avg_attention || 0;
        } catch (error) {
            console.error('Error getting video attention score:', error);
            return 0;
        }
    }

    // ============ Scroll Behavior ============

    /**
     * تسجيل سلوك التمرير
     */
    static async recordScrollBehavior(data) {
        try {
            const {
                userId,
                videoId,
                scrollSpeed,
                scrollPattern,
                pauseDuration,
                engagementScore,
                swipeDirection
            } = data;

            const [result] = await pool.execute(
                `INSERT INTO scroll_behavior 
          (user_id, video_id, scroll_speed, scroll_pattern, pause_duration, engagement_score, swipe_direction, tenant_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    videoId,
                    scrollSpeed || 0,
                    scrollPattern || 'normal',
                    pauseDuration || 0,
                    engagementScore || 0,
                    swipeDirection || 'down',
                    data.tenantId || 1
                ]
            );

            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error recording scroll behavior:', error);
            throw error;
        }
    }

    /**
     * تحليل أنماط التمرير للمستخدم
     */
    static async analyzeUserScrollPatterns(userId, data, limit = 50) {
        try {
            const [rows] = await pool.execute(
                `SELECT 
          AVG(scroll_speed) as avg_speed,
          AVG(engagement_score) as avg_engagement,
          COUNT(*) as total_scrolls,
          scroll_pattern,
          COUNT(*) as pattern_count
         FROM scroll_behavior 
         WHERE user_id = ? AND tenant_id = ?
         GROUP BY scroll_pattern
         ORDER BY pattern_count DESC
         LIMIT ?`,
                [userId, data.tenantId || 1, limit]
            );
            return rows;
        } catch (error) {
            console.error('Error analyzing scroll patterns:', error);
            return [];
        }
    }

    // ============ Voice Interactions ============

    /**
     * تسجيل التفاعل الصوتي
     */
    static async recordVoiceInteraction(data) {
        // Stubbed for privacy-safe tracking: do not write to db
        return { success: true, id: 0 };
    }

    /**
     * الحصول على التفاعلات الصوتية للمستخدم
     */
    static async getUserVoiceInteractions(userId, data, limit = 100) {
        try {
            const [rows] = await pool.execute(
                `SELECT * FROM voice_interactions 
         WHERE user_id = ? AND tenant_id = ?
         ORDER BY created_at DESC 
         LIMIT ?`,
                [userId, data.tenantId || 1, limit]
            );
            return rows;
        } catch (error) {
            console.error('Error getting voice interactions:', error);
            return [];
        }
    }

    // ============ AI User Profiles ============

    /**
     * إنشاء أو تحديث ملف المستخدم AI
     */
    static async upsertUserProfile(userId, profileData) {
        try {
            const {
                eyeTrackingEnabled,
                voiceTrackingEnabled,
                scrollTrackingEnabled,
                preferences,
                tenantId
            } = profileData;

            const [result] = await pool.execute(
                `INSERT INTO ai_user_profiles 
          (user_id, eye_tracking_enabled, voice_tracking_enabled, scroll_tracking_enabled, preferences, tenant_id) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          eye_tracking_enabled = VALUES(eye_tracking_enabled),
          voice_tracking_enabled = VALUES(voice_tracking_enabled),
          scroll_tracking_enabled = VALUES(scroll_tracking_enabled),
          preferences = VALUES(preferences),
          last_updated = CURRENT_TIMESTAMP`,
                [
                    userId,
                    eyeTrackingEnabled !== undefined ? eyeTrackingEnabled : false,
                    voiceTrackingEnabled !== undefined ? voiceTrackingEnabled : false,
                    scrollTrackingEnabled !== undefined ? scrollTrackingEnabled : true,
                    JSON.stringify(preferences || {}),
                    tenantId || 1
                ]
            );

            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error upserting user profile:', error);
            throw error;
        }
    }

    /**
     * الحصول على ملف المستخدم AI
     */
    static async getUserProfile(userId, tenantId) {
        try {
            const [rows] = await pool.execute(
                `SELECT * FROM ai_user_profiles WHERE user_id = ? AND tenant_id = ?`,
                [userId, tenantId]
            );

            if (rows.length === 0) {
                // إنشاء ملف افتراضي
                await this.upsertUserProfile(userId, {
                    eyeTrackingEnabled: false,
                    voiceTrackingEnabled: false,
                    scrollTrackingEnabled: true,
                    preferences: {},
                    tenantId
                });

                const [newRows] = await pool.execute(
                    `SELECT * FROM ai_user_profiles WHERE user_id = ? AND tenant_id = ?`,
                    [userId, tenantId]
                );
                return newRows[0];
            }

            return rows[0];
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    /**
     * تحديث تفضيلات المستخدم AI
     */
    static async updateUserPreferences(userId, tenantId, preferences) {
        try {
            await pool.execute(
                `UPDATE ai_user_profiles 
          SET preferences = ?, last_updated = CURRENT_TIMESTAMP 
          WHERE user_id = ? AND tenant_id = ?`,
                [JSON.stringify(preferences), userId, tenantId]
            );

            return { success: true };
        } catch (error) {
            console.error('Error updating user preferences:', error);
            throw error;
        }
    }

    /**
     * تحديث بيانات الملف الشخصي AI
     */
    static async updateProfileData(userId, tenantId, profileData) {
        try {
            await pool.execute(
                `UPDATE ai_user_profiles 
          SET profile_data = ?, last_updated = CURRENT_TIMESTAMP 
          WHERE user_id = ? AND tenant_id = ?`,
                [JSON.stringify(profileData), userId, tenantId]
            );

            return { success: true };
        } catch (error) {
            console.error('Error updating profile data:', error);
            throw error;
        }
    }

    // ============ AI Training Data ============

    /**
     * تسجيل بيانات التدريب
     */
    static async recordTrainingData(data) {
        try {
            const {
                userId,
                videoId,
                interactionData,
                predictionScore,
                actualEngagement
            } = data;

            const accuracy = predictionScore && actualEngagement
                ? 100 - Math.abs(predictionScore - actualEngagement)
                : null;

            const [result] = await pool.execute(
                `INSERT INTO ai_training_data 
          (user_id, video_id, interaction_data, prediction_score, actual_engagement, accuracy, tenant_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    videoId,
                    JSON.stringify(interactionData || {}),
                    predictionScore || null,
                    actualEngagement || null,
                    accuracy,
                    data.tenantId || 1
                ]
            );

            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error recording training data:', error);
            throw error;
        }
    }

    /**
     * الحصول على دقة النموذج
     */
    static async getModelAccuracy(userId = null, tenantId = null) {
        try {
            const query = userId
                ? `SELECT AVG(accuracy) as avg_accuracy FROM ai_training_data WHERE user_id = ? AND tenant_id = ? AND accuracy IS NOT NULL`
                : `SELECT AVG(accuracy) as avg_accuracy FROM ai_training_data WHERE accuracy IS NOT NULL`;

            const params = userId ? [userId, tenantId] : [];
            const [rows] = await pool.execute(query, params);

            return rows[0]?.avg_accuracy || 0;
        } catch (error) {
            console.error('Error getting model accuracy:', error);
            return 0;
        }
    }

    // ============ Data Management ============

    /**
     * حذف جميع بيانات AI للمستخدم
     */
    static async deleteUserAIData(userId, tenantId) {
        try {
            await pool.execute(`DELETE FROM eye_tracking WHERE user_id = ? AND tenant_id = ?`, [userId, tenantId]);
            await pool.execute(`DELETE FROM scroll_behavior WHERE user_id = ? AND tenant_id = ?`, [userId, tenantId]);
            await pool.execute(`DELETE FROM voice_interactions WHERE user_id = ? AND tenant_id = ?`, [userId, tenantId]);
            await pool.execute(`DELETE FROM ai_training_data WHERE user_id = ? AND tenant_id = ?`, [userId, tenantId]);
            await pool.execute(`DELETE FROM ai_user_profiles WHERE user_id = ? AND tenant_id = ?`, [userId, tenantId]);

            return { success: true, message: 'All AI data deleted successfully' };
        } catch (error) {
            console.error('Error deleting user AI data:', error);
            throw error;
        }
    }

    /**
     * الحصول على إحصائيات AI للمستخدم
     */
    static async getUserAIStats(userId, tenantId) {
        try {
            const [scrollBehavior] = await pool.execute(
                `SELECT COUNT(*) as count, AVG(engagement_score) as avg_engagement 
         FROM scroll_behavior WHERE user_id = ? AND tenant_id = ?`,
                [userId, tenantId]
            );

            const [watchHistory] = await pool.execute(
                `SELECT COUNT(*) as count, AVG(watch_time) as avg_watch_time, SUM(completed) as completed_count 
         FROM watch_history WHERE user_id = ? AND tenant_id = ?`,
                [userId, tenantId]
            );

            const [likes] = await pool.execute(
                `SELECT COUNT(*) as count FROM likes WHERE user_id = ?`,
                [userId]
            );

            const [comments] = await pool.execute(
                `SELECT COUNT(*) as count FROM comments WHERE user_id = ? AND tenant_id = ?`,
                [userId, tenantId]
            );

            const [shares] = await pool.execute(
                `SELECT COUNT(*) as count FROM video_shares WHERE user_id = ? AND tenant_id = ?`,
                [userId, tenantId]
            );

            const [follows] = await pool.execute(
                `SELECT COUNT(*) as count FROM followers WHERE follower_id = ?`,
                [userId]
            );

            const [trainingData] = await pool.execute(
                `SELECT COUNT(*) as count, AVG(accuracy) as avg_accuracy 
         FROM ai_training_data WHERE user_id = ? AND tenant_id = ? AND accuracy IS NOT NULL`,
                [userId, tenantId]
            );

            const watchHistoryCount = watchHistory[0]?.count || 0;
            const likesCount = likes[0]?.count || 0;
            const commentsCount = comments[0]?.count || 0;
            const sharesCount = shares[0]?.count || 0;
            const followsCount = follows[0]?.count || 0;
            const scrollCount = scrollBehavior[0]?.count || 0;

            return {
                eyeTracking: {
                    count: 0,
                    avgAttention: 0
                },
                scrollBehavior: {
                    count: scrollCount,
                    avgEngagement: scrollBehavior[0]?.avg_engagement || 0
                },
                voiceInteractions: {
                    count: 0,
                    avgIntensity: 0
                },
                watchHistory: {
                    count: watchHistoryCount,
                    avgWatchTime: watchHistory[0]?.avg_watch_time || 0,
                    avgCompletionRate: watchHistoryCount ? (watchHistory[0]?.completed_count || 0) / watchHistoryCount : 0
                },
                likes: { count: likesCount },
                comments: { count: commentsCount },
                shares: { count: sharesCount },
                follows: { count: followsCount },
                modelAccuracy: trainingData[0]?.avg_accuracy || 0,
                totalDataPoints: scrollCount + watchHistoryCount + likesCount + commentsCount + sharesCount + followsCount
            };
        } catch (error) {
            console.error('Error getting user AI stats:', error);
            throw error;
        }
    }
}

export { AITracking };
export default AITracking;
