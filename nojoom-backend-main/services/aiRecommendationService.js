// services/aiRecommendationService.js
import { pool } from '../config/db.js';
import { AITracking } from '../models/AITracking.js';
import recommendationEngine from './recommendationEngine.js';

class AIRecommendationService {
    constructor() {
        // أوزان التوصية الذكية المعدلة (الاعتماد على التفاعلات الآمنة والمدة)
        this.weights = {
            watchTime: 3.0,        // وزن عالي - مدة المشاهدة مؤشر قوي
            completionRate: 3.0,   // وزن عالي - إكمال الفيديو بالكامل
            like: 2.5,             // وزن مرتفع - تسجيل الإعجاب
            comment: 2.0,          // وزن متوسط - إضافة تعليق
            share: 2.0,            // وزن متوسط - مشاركة الفيديو
            follow: 2.5,           // وزن مرتفع - متابعة صانع المحتوى
            scrollBehavior: 1.0,   // وزن منخفض - سلوك التمرير
            contentMatch: 1.5      // وزن أساسي للمطابقة مع الاهتمامات
        };

        // عتبات التقييم
        this.thresholds = {
            slowScroll: 100,       // سرعة تمرير بطيئة = اهتمام
            fastScroll: 500,       // سرعة تمرير سريعة = عدم اهتمام
            minWatchTime: 3        // 3 ثواني كحد أدنى
        };
    }

    /**
     * حساب درجة AI الشاملة للفيديو بناءً على تفاعلات المستخدم
     */
    async calculateAIScore(userId, videoId, tenantId) {
        try {
            const scores = {
                watchTime: await this.getWatchTimeScore(userId, videoId, tenantId),
                completionRate: await this.getCompletionRateScore(userId, videoId, tenantId),
                like: await this.getLikeScore(userId, videoId, tenantId),
                comment: await this.getCommentScore(userId, videoId, tenantId),
                share: await this.getShareScore(userId, videoId, tenantId),
                follow: await this.getFollowScore(userId, videoId, tenantId),
                scrollBehavior: await this.getScrollBehaviorScore(userId, videoId, tenantId),
                contentMatch: await this.getContentMatchScore(userId, videoId, tenantId)
            };

            // حساب الدرجة الإجمالية مع الأوزان الجديدة
            const totalScore = (
                scores.watchTime * this.weights.watchTime +
                scores.completionRate * this.weights.completionRate +
                scores.like * this.weights.like +
                scores.comment * this.weights.comment +
                scores.share * this.weights.share +
                scores.follow * this.weights.follow +
                scores.scrollBehavior * this.weights.scrollBehavior +
                scores.contentMatch * this.weights.contentMatch
            ) / (
                    this.weights.watchTime +
                    this.weights.completionRate +
                    this.weights.like +
                    this.weights.comment +
                    this.weights.share +
                    this.weights.follow +
                    this.weights.scrollBehavior +
                    this.weights.contentMatch
                );

            return {
                totalScore: parseFloat(totalScore.toFixed(2)),
                breakdown: scores,
                confidence: this.calculateConfidence(scores)
            };
        } catch (error) {
            console.error('Error calculating AI score:', error);
            return { totalScore: 0, breakdown: {}, confidence: 0 };
        }
    }

    /**
     * حساب درجة تتبع العين (تم تجميدها وإرجاع 0)
     */
    async getEyeTrackingScore(userId, videoId, tenantId) {
        return 0;
    }

    /**
     * حساب درجة التفاعل الصوتي (تم تجميدها وإرجاع 0)
     */
    async getVoiceInteractionScore(userId, videoId, tenantId) {
        return 0;
    }

    /**
     * حساب درجة سلوك التمرير
     */
    async getScrollBehaviorScore(userId, videoId, tenantId) {
        try {
            const [rows] = await pool.execute(
                `SELECT AVG(scroll_speed) as avg_speed, AVG(pause_duration) as avg_pause, AVG(engagement_score) as avg_engagement
         FROM scroll_behavior 
         WHERE user_id = ? AND video_id = ? AND tenant_id = ?`,
                [userId, videoId, tenantId]
            );

            if (!rows[0] || rows[0].avg_speed === null) return 0.5;

            const speed = rows[0].avg_speed;
            const pauseDuration = rows[0].avg_pause || 0;
            const engagement = rows[0].avg_engagement || 0;

            let speedScore = 0;
            if (speed < this.thresholds.slowScroll) {
                speedScore = 0.8;
            } else if (speed < this.thresholds.fastScroll) {
                speedScore = 0.5;
            } else {
                speedScore = 0.2;
            }

            const pauseBonus = Math.min(pauseDuration / 10000, 0.2);

            return Math.min(speedScore + pauseBonus + (engagement / 100), 1.0);
        } catch (error) {
            console.error('Error getting scroll behavior score:', error);
            return 0.5;
        }
    }

    /**
     * حساب درجة وقت المشاهدة
     */
    async getWatchTimeScore(userId, videoId, tenantId) {
        try {
            const [rows] = await pool.execute(
                `SELECT watch_time, completed FROM watch_history 
         WHERE user_id = ? AND video_id = ? AND tenant_id = ?`,
                [userId, videoId, tenantId]
            );

            if (!rows[0]) return 0;

            const watchTime = rows[0].watch_time || 0;
            const completed = rows[0].completed;

            if (completed) return 1.0;
            if (watchTime < this.thresholds.minWatchTime) return 0;

            const estimatedDuration = 30;
            const watchPercentage = Math.min(watchTime / estimatedDuration, 1.0);

            return watchPercentage;
        } catch (error) {
            console.error('Error getting watch time score:', error);
            return 0;
        }
    }

    /**
     * حساب درجة إكمال الفيديو
     */
    async getCompletionRateScore(userId, videoId, tenantId) {
        try {
            const [rows] = await pool.execute(
                `SELECT completed FROM watch_history 
         WHERE user_id = ? AND video_id = ? AND tenant_id = ?`,
                [userId, videoId, tenantId]
            );
            if (!rows[0]) return 0;
            return rows[0].completed ? 1.0 : 0.0;
        } catch (error) {
            console.error('Error getting completion rate score:', error);
            return 0;
        }
    }

    /**
     * حساب درجة الإعجاب
     */
    async getLikeScore(userId, videoId, tenantId) {
        try {
            const [rows] = await pool.execute(
                `SELECT 1 FROM likes WHERE user_id = ? AND video_id = ?`,
                [userId, videoId]
            );
            return rows.length > 0 ? 1.0 : 0.0;
        } catch (error) {
            console.error('Error getting like score:', error);
            return 0;
        }
    }

    /**
     * حساب درجة التعليق
     */
    async getCommentScore(userId, videoId, tenantId) {
        try {
            const [rows] = await pool.execute(
                `SELECT 1 FROM comments WHERE user_id = ? AND video_id = ? AND tenant_id = ?`,
                [userId, videoId, tenantId]
            );
            return rows.length > 0 ? 1.0 : 0.0;
        } catch (error) {
            console.error('Error getting comment score:', error);
            return 0;
        }
    }

    /**
     * حساب درجة المشاركة
     */
    async getShareScore(userId, videoId, tenantId) {
        try {
            const [rows] = await pool.execute(
                `SELECT 1 FROM video_shares WHERE user_id = ? AND video_id = ? AND tenant_id = ?`,
                [userId, videoId, tenantId]
            );
            return rows.length > 0 ? 1.0 : 0.0;
        } catch (error) {
            console.error('Error getting share score:', error);
            return 0;
        }
    }

    /**
     * حساب درجة المتابعة لصانع المحتوى
     */
    async getFollowScore(userId, videoId, tenantId) {
        try {
            const [videoRows] = await pool.execute(
                `SELECT user_id FROM videos WHERE id = ? AND tenant_id = ?`,
                [videoId, tenantId]
            );
            if (!videoRows[0]) return 0;
            const creatorId = videoRows[0].user_id;

            const [rows] = await pool.execute(
                `SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?`,
                [userId, creatorId]
            );
            return rows.length > 0 ? 1.0 : 0.0;
        } catch (error) {
            console.error('Error getting follow score:', error);
            return 0;
        }
    }

    /**
     * حساب درجة تطابق المحتوى
     */
    async getContentMatchScore(userId, videoId, tenantId) {
        try {
            const interests = await recommendationEngine.analyzeUserInterests(userId, tenantId);

            const [videoRows] = await pool.execute(
                `SELECT description, user_id FROM videos WHERE id = ? AND tenant_id = ?`,
                [videoId, tenantId]
            );

            if (!videoRows[0]) return 0;

            const video = videoRows[0];
            let score = 0;

            if (video.description) {
                const videoWords = new Set(
                    video.description.toLowerCase()
                        .replace(/[^\w\s#]/g, ' ')
                        .split(/\s+/)
                        .filter(word => word.length > 2)
                );

                for (const [tag, tagScore] of Object.entries(interests.tags || {})) {
                    if (videoWords.has(tag.toLowerCase())) {
                        score += tagScore * 0.3;
                    }
                }
            }

            if (interests.creators && interests.creators[video.user_id]) {
                score += interests.creators[video.user_id] * 0.5;
            }

            return Math.min(score, 1.0);
        } catch (error) {
            console.error('Error getting content match score:', error);
            return 0;
        }
    }

    /**
     * حساب مستوى الثقة في التوصية
     */
    calculateConfidence(scores) {
        const availableSources = Object.values(scores).filter(s => s > 0).length;
        const totalSources = Object.keys(scores).length;

        const sourceConfidence = availableSources / totalSources;
        const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / totalSources;

        return parseFloat(((sourceConfidence * 0.4 + avgScore * 0.6) * 100).toFixed(2));
    }

    /**
     * الحصول على توصيات مدعومة بالذكاء الاصطناعي
     */
    async getAIRecommendations(userId, limit = 20, tenantId) {
        try {
            console.log(`🤖 Generating AI-powered recommendations for user: ${userId}`);

            const baseRecommendations = await recommendationEngine.getRecommendedVideos(userId, tenantId, limit * 2);

            const enhancedRecommendations = await Promise.all(
                baseRecommendations.map(async (video) => {
                    const aiScore = await this.calculateAIScore(userId, video.id, tenantId);

                    return {
                        ...video,
                        ai_score: aiScore.totalScore,
                        ai_confidence: aiScore.confidence,
                        ai_breakdown: aiScore.breakdown,
                        final_score: (video.recommendation_score || 0) * 0.4 + aiScore.totalScore * 10 * 0.6
                    };
                })
            );

            const sortedRecommendations = enhancedRecommendations
                .sort((a, b) => b.final_score - a.final_score)
                .slice(0, limit);

            console.log(`✅ Generated ${sortedRecommendations.length} AI-powered recommendations`);

            return sortedRecommendations;
        } catch (error) {
            console.error('Error getting AI recommendations:', error);
            return await recommendationEngine.getRecommendedVideos(userId, tenantId, limit);
        }
    }

    /**
     * تحديث نموذج المستخدم بناءً على التفاعلات الجديدة
     */
    async updateUserModel(userId, tenantId) {
        try {
            const stats = await AITracking.getUserAIStats(userId, tenantId);

            // حساب التفاعل الإجمالي باستخدام المقاييس الجديدة
            const totalScore = (
                (stats.scrollBehavior.avgEngagement || 0) * this.weights.scrollBehavior
            ) / (
                this.weights.scrollBehavior
            );

            const profileData = {
                totalDataPoints: stats.totalDataPoints,
                avgEngagement: stats.scrollBehavior.avgEngagement,
                modelAccuracy: stats.modelAccuracy,
                lastUpdated: new Date()
            };

            await AITracking.updateProfileData(userId, tenantId, profileData);

            console.log(`✅ Updated AI model for user: ${userId}`);

            return { success: true, totalScore, stats };
        } catch (error) {
            console.error('Error updating user model:', error);
            throw error;
        }
    }

    /**
     * تسجيل تفاعل وتحديث النموذج
     */
    async recordAndLearn(userId, videoId, interactionType, data, tenantId) {
        try {
            switch (interactionType) {
                case 'scroll_behavior':
                    await AITracking.recordScrollBehavior({ userId, videoId, ...data, tenantId });
                    break;
                // تم تجميد تتبع العين وتفاعلات الصوت
            }

            const prediction = await this.calculateAIScore(userId, videoId, tenantId);

            await AITracking.recordTrainingData({
                userId,
                videoId,
                interactionData: { type: interactionType, ...data },
                predictionScore: prediction.totalScore,
                actualEngagement: data.engagementScore || null,
                tenantId
            });

            return { success: true };
        } catch (error) {
            console.error('Error recording and learning:', error);
            throw error;
        }
    }
}

const aiRecommendationService = new AIRecommendationService();

export { aiRecommendationService, AIRecommendationService };
export default aiRecommendationService;
