// services/aiTrackingService.ts
import axios from 'axios';
import { authSession } from './authSession';

const API_URL = import.meta.env.VITE_API_URL;

interface EyeTrackingData {
    videoId: number;
    gazePoints: Array<{ x: number, y: number, timestamp: number }>;
    attentionScore: number;
    focusDuration: number;
    viewportData: {
        width: number;
        height: number;
        videoRect: DOMRect;
    };
}

interface ScrollBehaviorData {
    videoId: number;
    scrollSpeed: number;
    scrollPattern: string;
    pauseDuration: number;
    engagementScore: number;
    swipeDirection: string;
}

interface VoiceInteractionData {
    videoId: number;
    interactionType: string;
    duration: number;
    intensity: number;
    timestampInVideo: number;
}

interface BatchInteraction {
    type: 'eye_tracking' | 'scroll_behavior' | 'voice_interaction';
    videoId: number;
    data: any;
}

class AITrackingService {
    private batchQueue: BatchInteraction[] = [];
    private batchInterval: number = 5000; // 5 seconds
    private batchTimer: NodeJS.Timeout | null = null;

    constructor() {
        this.startBatchTimer();
    }

    /**
     * تسجيل بيانات تتبع العين
     */
    async recordEyeTracking(data: EyeTrackingData) {
        // Stubbed for privacy-safe tracking: do not write to db or send request
        return { success: true };
    }

    /**
     * تسجيل سلوك التمرير
     */
    async recordScrollBehavior(data: ScrollBehaviorData) {
        try {
            const token = authSession.getAccessToken();
            if (!token) return;

            const response = await axios.post(
                `${API_URL}/ai/track/scroll`,
                data,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error recording scroll behavior:', error);
            this.addToBatch('scroll_behavior', data.videoId, data);
        }
    }

    /**
     * تسجيل التفاعل الصوتي
     */
    async recordVoiceInteraction(data: VoiceInteractionData) {
        // Stubbed for privacy-safe tracking: do not write to db or send request
        return { success: true };
    }

    /**
     * إضافة تفاعل إلى الـ batch queue
     */
    private addToBatch(type: BatchInteraction['type'], videoId: number, data: any) {
        this.batchQueue.push({ type, videoId, data });

        // إرسال فوري إذا وصل الحد الأقصى
        if (this.batchQueue.length >= 10) {
            this.sendBatch();
        }
    }

    /**
     * بدء مؤقت الـ batch
     */
    private startBatchTimer() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }

        this.batchTimer = setInterval(() => {
            if (this.batchQueue.length > 0) {
                this.sendBatch();
            }
        }, this.batchInterval);
    }

    /**
     * إرسال الـ batch
     */
    private async sendBatch() {
        if (this.batchQueue.length === 0) return;

        const interactions = [...this.batchQueue];
        this.batchQueue = [];

        try {
            const token = authSession.getAccessToken();
            if (!token) return;

            await axios.post(
                `${API_URL}/ai/track/batch`,
                { interactions },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Sent batch of ${interactions.length} interactions`);
        } catch (error) {
            console.error('Error sending batch:', error);
            // إعادة التفاعلات إلى الـ queue
            this.batchQueue.unshift(...interactions);
        }
    }

    /**
     * الحصول على توصيات AI
     */
    async getAIRecommendations(limit: number = 20) {
        try {
            const token = authSession.getAccessToken();
            if (!token) return null;

            const response = await axios.get(
                `${API_URL}/ai/recommendations?limit=${limit}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error getting AI recommendations:', error);
            return null;
        }
    }

    /**
     * الحصول على ملف المستخدم AI
     */
    async getAIProfile() {
        try {
            const token = authSession.getAccessToken();
            if (!token) return null;

            const response = await axios.get(
                `${API_URL}/ai/profile`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error getting AI profile:', error);
            return null;
        }
    }

    /**
     * تحديث إعدادات AI
     */
    async updateAISettings(settings: {
        eyeTrackingEnabled?: boolean;
        voiceTrackingEnabled?: boolean;
        scrollTrackingEnabled?: boolean;
        preferences?: any;
    }) {
        try {
            const token = authSession.getAccessToken();
            if (!token) return null;

            const response = await axios.put(
                `${API_URL}/ai/settings`,
                settings,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error updating AI settings:', error);
            return null;
        }
    }

    /**
     * حذف بيانات AI
     */
    async deleteAIData() {
        try {
            const token = authSession.getAccessToken();
            if (!token) return null;

            const response = await axios.delete(
                `${API_URL}/ai/data`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error deleting AI data:', error);
            return null;
        }
    }

    /**
     * الحصول على إحصائيات AI
     */
    async getAIStats() {
        try {
            const token = authSession.getAccessToken();
            if (!token) return null;

            const response = await axios.get(
                `${API_URL}/ai/stats`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error getting AI stats:', error);
            return null;
        }
    }

    /**
     * تنظيف عند إلغاء التحميل
     */
    cleanup() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }
        // إرسال أي بيانات متبقية
        if (this.batchQueue.length > 0) {
            this.sendBatch();
        }
    }
}

// إنشاء instance واحد
const aiTrackingService = new AITrackingService();

// تنظيف عند إغلاق الصفحة
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        aiTrackingService.cleanup();
    });
}

export default aiTrackingService;
