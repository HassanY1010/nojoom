// hooks/useScrollTracking.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import aiTrackingService from '../services/aiTrackingService';

interface ScrollTrackingOptions {
    videoId: number;
    enabled?: boolean;
    threshold?: number; // Minimum scroll distance to record
}

interface ScrollMetrics {
    scrollSpeed: number;
    scrollPattern: string;
    pauseDuration: number;
    engagementScore: number;
    swipeDirection: string;
}

export const useScrollTracking = ({ videoId, enabled = true, threshold = 50 }: ScrollTrackingOptions) => {
    const [metrics, setMetrics] = useState<ScrollMetrics>({
        scrollSpeed: 0,
        scrollPattern: 'normal',
        pauseDuration: 0,
        engagementScore: 0,
        swipeDirection: 'down'
    });

    const lastScrollY = useRef(0);
    const lastScrollTime = useRef(Date.now());
    const pauseStartTime = useRef<number | null>(null);
    const scrollSpeeds = useRef<number[]>([]);
    const isScrolling = useRef(false);
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

    const calculateEngagementScore = useCallback((speed: number, pauseDuration: number): number => {
        // التمرير البطيء = اهتمام عالي
        let speedScore = 0;
        if (speed < 100) {
            speedScore = 0.8; // اهتمام عالي
        } else if (speed < 300) {
            speedScore = 0.5; // اهتمام متوسط
        } else {
            speedScore = 0.2; // تمرير سريع
        }

        // مكافأة للتوقف المؤقت
        const pauseBonus = Math.min(pauseDuration / 10000, 0.2);

        return Math.min((speedScore + pauseBonus) * 100, 100);
    }, []);

    const determineScrollPattern = useCallback((speeds: number[]): string => {
        if (speeds.length < 3) return 'normal';

        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

        if (avgSpeed < 100) return 'slow_browse'; // تصفح بطيء
        if (avgSpeed < 300) return 'normal'; // تصفح عادي
        if (avgSpeed < 600) return 'fast_scroll'; // تمرير سريع
        return 'skip'; // تخطي سريع
    }, []);

    const handleScroll = useCallback(() => {
        if (!enabled) return;

        const currentScrollY = window.scrollY;
        const currentTime = Date.now();
        const timeDiff = currentTime - lastScrollTime.current;
        const scrollDiff = Math.abs(currentScrollY - lastScrollY.current);

        // تحديد اتجاه التمرير
        const direction = currentScrollY > lastScrollY.current ? 'down' : 'up';

        // حساب سرعة التمرير (pixels per second)
        const speed = timeDiff > 0 ? (scrollDiff / timeDiff) * 1000 : 0;

        // تسجيل السرعة
        scrollSpeeds.current.push(speed);
        if (scrollSpeeds.current.length > 10) {
            scrollSpeeds.current.shift(); // الاحتفاظ بآخر 10 قياسات فقط
        }

        // تحديد نمط التمرير
        const pattern = determineScrollPattern(scrollSpeeds.current);

        // حساب متوسط السرعة
        const avgSpeed = scrollSpeeds.current.reduce((a, b) => a + b, 0) / scrollSpeeds.current.length;

        // إذا بدأ التمرير، إنهاء التوقف المؤقت
        if (pauseStartTime.current) {
            const pauseDuration = currentTime - pauseStartTime.current;
            pauseStartTime.current = null;

            // حساب درجة التفاعل
            const engagementScore = calculateEngagementScore(avgSpeed, pauseDuration);

            // تحديث المقاييس
            const newMetrics = {
                scrollSpeed: avgSpeed,
                scrollPattern: pattern,
                pauseDuration,
                engagementScore,
                swipeDirection: direction
            };

            setMetrics(newMetrics);

            // إرسال البيانات إلى الخادم
            if (scrollDiff > threshold) {
                aiTrackingService.recordScrollBehavior({
                    videoId,
                    ...newMetrics
                });
            }
        }

        // تحديث القيم المرجعية
        lastScrollY.current = currentScrollY;
        lastScrollTime.current = currentTime;
        isScrolling.current = true;

        // إعادة تعيين مؤقت التوقف
        if (scrollTimeout.current) {
            clearTimeout(scrollTimeout.current);
        }

        scrollTimeout.current = setTimeout(() => {
            isScrolling.current = false;
            pauseStartTime.current = Date.now();
        }, 150); // 150ms بدون تمرير = توقف مؤقت

    }, [enabled, videoId, threshold, calculateEngagementScore, determineScrollPattern]);

    useEffect(() => {
        if (!enabled) return;

        // إضافة مستمع التمرير
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeout.current) {
                clearTimeout(scrollTimeout.current);
            }
        };
    }, [enabled, handleScroll]);

    return {
        metrics,
        isScrolling: isScrolling.current
    };
};

export default useScrollTracking;
