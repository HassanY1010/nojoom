// hooks/useEyeTracking.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import aiTrackingService from '../services/aiTrackingService';

interface EyeTrackingOptions {
    videoId: number;
    videoElement: HTMLVideoElement | null;
    enabled?: boolean;
}

interface GazePoint {
    x: number;
    y: number;
    timestamp: number;
}

interface EyeMetrics {
    attentionScore: number;
    focusDuration: number;
    gazePoints: GazePoint[];
    isLookingAtVideo: boolean;
}

/**
 * Hook لتتبع حركة العين (مبسط باستخدام تتبع الماوس)
 * ملاحظة: للحصول على تتبع دقيق للعين، يمكن دمج WebGazer.js لاحقاً
 */
export const useEyeTracking = ({ videoId, videoElement, enabled = false }: EyeTrackingOptions) => {
    const [metrics, setMetrics] = useState<EyeMetrics>({
        attentionScore: 0,
        focusDuration: 0,
        gazePoints: [],
        isLookingAtVideo: false
    });

    const [hasPermission, setHasPermission] = useState<boolean>(false);

    const gazePoints = useRef<GazePoint[]>([]);
    const focusStartTime = useRef<number | null>(null);
    const totalFocusTime = useRef<number>(0);
    const lastRecordTime = useRef<number>(Date.now());
    const recordInterval = useRef<NodeJS.Timeout | null>(null);

    /**
     * طلب إذن الكاميرا (للتوسع المستقبلي مع WebGazer)
     */
    const requestPermission = useCallback(async () => {
        try {
            // في الوقت الحالي، نستخدم تتبع الماوس كبديل
            // يمكن إضافة طلب الكاميرا هنا لاحقاً
            setHasPermission(true);
            return true;
        } catch (err) {
            console.error('Permission denied:', err);
            setHasPermission(false);
            return false;
        }
    }, []);

    /**
     * التحقق مما إذا كانت النقطة داخل عنصر الفيديو
     */
    const isPointInVideo = useCallback((x: number, y: number): boolean => {
        if (!videoElement) return false;

        const rect = videoElement.getBoundingClientRect();
        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }, [videoElement]);

    /**
     * حساب درجة الانتباه
     */
    const calculateAttentionScore = useCallback((points: GazePoint[]): number => {
        if (points.length === 0 || !videoElement) return 0;

        const pointsOnVideo = points.filter(p => isPointInVideo(p.x, p.y));
        const score = (pointsOnVideo.length / points.length) * 100;

        return Math.min(score, 100);
    }, [videoElement, isPointInVideo]);

    /**
     * معالج حركة الماوس
     */
    const handleMouseMove = useCallback((event: MouseEvent) => {
        if (!enabled || !videoElement) return;

        const point: GazePoint = {
            x: event.clientX,
            y: event.clientY,
            timestamp: Date.now()
        };

        // إضافة النقطة
        gazePoints.current.push(point);

        // الاحتفاظ بآخر 100 نقطة فقط
        if (gazePoints.current.length > 100) {
            gazePoints.current.shift();
        }

        // التحقق من التركيز على الفيديو
        const isOnVideo = isPointInVideo(point.x, point.y);

        if (isOnVideo && !focusStartTime.current) {
            // بداية التركيز
            focusStartTime.current = Date.now();
        } else if (!isOnVideo && focusStartTime.current) {
            // نهاية التركيز
            const focusDuration = Date.now() - focusStartTime.current;
            totalFocusTime.current += focusDuration;
            focusStartTime.current = null;
        }

        // تحديث المقاييس
        const attentionScore = calculateAttentionScore(gazePoints.current);
        const currentFocusDuration = focusStartTime.current
            ? totalFocusTime.current + (Date.now() - focusStartTime.current)
            : totalFocusTime.current;

        setMetrics({
            attentionScore,
            focusDuration: currentFocusDuration,
            gazePoints: [...gazePoints.current],
            isLookingAtVideo: isOnVideo
        });
    }, [enabled, videoElement, isPointInVideo, calculateAttentionScore]);

    /**
     * تسجيل البيانات بشكل دوري
     */
    const recordData = useCallback(() => {
        if (!enabled || gazePoints.current.length === 0 || !videoElement) return;

        const now = Date.now();
        const timeSinceLastRecord = now - lastRecordTime.current;

        // تسجيل كل 10 ثواني
        if (timeSinceLastRecord >= 10000) {
            const attentionScore = calculateAttentionScore(gazePoints.current);
            const focusDuration = focusStartTime.current
                ? totalFocusTime.current + (now - focusStartTime.current)
                : totalFocusTime.current;

            const rect = videoElement.getBoundingClientRect();

            aiTrackingService.recordEyeTracking({
                videoId,
                gazePoints: gazePoints.current.slice(-20), // آخر 20 نقطة فقط
                attentionScore,
                focusDuration,
                viewportData: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    videoRect: rect
                }
            });

            lastRecordTime.current = now;
        }
    }, [enabled, videoId, videoElement, calculateAttentionScore]);

    /**
     * بدء التتبع
     */
    const startTracking = useCallback(() => {
        if (!enabled) return;

        // إضافة مستمع حركة الماوس
        window.addEventListener('mousemove', handleMouseMove, { passive: true });

        // بدء التسجيل الدوري
        recordInterval.current = setInterval(recordData, 5000); // كل 5 ثواني

    }, [enabled, handleMouseMove, recordData]);

    /**
     * إيقاف التتبع
     */
    const stopTracking = useCallback(() => {
        // إزالة المستمع
        window.removeEventListener('mousemove', handleMouseMove);

        // إيقاف التسجيل الدوري
        if (recordInterval.current) {
            clearInterval(recordInterval.current);
            recordInterval.current = null;
        }

        // تسجيل البيانات النهائية
        if (gazePoints.current.length > 0 && videoElement) {
            const attentionScore = calculateAttentionScore(gazePoints.current);
            const focusDuration = focusStartTime.current
                ? totalFocusTime.current + (Date.now() - focusStartTime.current)
                : totalFocusTime.current;

            const rect = videoElement.getBoundingClientRect();

            aiTrackingService.recordEyeTracking({
                videoId,
                gazePoints: gazePoints.current.slice(-20),
                attentionScore,
                focusDuration,
                viewportData: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    videoRect: rect
                }
            });
        }

        // إعادة تعيين
        gazePoints.current = [];
        focusStartTime.current = null;
        totalFocusTime.current = 0;
        lastRecordTime.current = Date.now();

        setMetrics({
            attentionScore: 0,
            focusDuration: 0,
            gazePoints: [],
            isLookingAtVideo: false
        });
    }, [videoId, videoElement, handleMouseMove, calculateAttentionScore]);

    // Effect للتحكم في التتبع
    useEffect(() => {
        if (enabled && hasPermission) {
            startTracking();
        } else {
            stopTracking();
        }

        return () => {
            stopTracking();
        };
    }, [enabled, hasPermission, startTracking, stopTracking]);

    return {
        metrics,
        hasPermission,
        requestPermission,
        stopTracking
    };
};

export default useEyeTracking;
