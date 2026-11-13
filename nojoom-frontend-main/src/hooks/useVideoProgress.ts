// hooks/useVideoProgress.ts
import { useState, useEffect, useCallback, RefObject, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';

interface VideoProgress {
  lastPosition: number;
  watchTime: number;
  completed: boolean;
}

// 🔹 إضافة ثوابت للتوقيت
const SAVE_INTERVAL = 10000; // 10 ثواني
const MIN_SAVE_INTERVAL = 5000; // 5 ثواني كحد أدنى
const DEBOUNCE_TIME = 2000; // 2 ثانية لمنع التكرار السريع

export const useVideoProgress = (
  videoRef: RefObject<HTMLVideoElement | null>,
  videoId: number | undefined,
  isActive: boolean
) => {
  const { user } = useAuthStore(); // ✅ جلب user من Zustand store
  const [isValidVideoId, setIsValidVideoId] = useState(false);
  const [progress, setProgress] = useState<VideoProgress>({
    lastPosition: 0,
    watchTime: 0,
    completed: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState(0);
  const [lastSaveAttempt, setLastSaveAttempt] = useState(0);
  const [saveQueue, setSaveQueue] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const hasResumedRef = useRef<boolean>(false);

  // 🔹 التحقق من صحة videoId
  useEffect(() => {
    if (videoId && typeof videoId === 'number' && videoId > 0) {
      setIsValidVideoId(true);
    } else {
      setIsValidVideoId(false);
    }
  }, [videoId]);

  // 🔹 تحميل التقدم
  useEffect(() => {
    if (!isValidVideoId || !videoId || !user) {
      setIsLoading(false);
      return;
    }

    const loadProgress = async () => {
      try {
        setIsLoading(true);
        console.log(`📊 Loading progress for video ${videoId}`);

        const response = await api.get(`/videos/${videoId}/progress`);
        const data = response.data;

        setProgress({
          lastPosition: data.lastPosition || 0,
          watchTime: data.watchTime || 0,
          completed: data.completed || false
        });

        console.log(`✅ Loaded progress for video ${videoId}`);
      } catch (error) {
        console.error('Failed to load video progress:', error);
        setProgress({ lastPosition: 0, watchTime: 0, completed: false });
      } finally {
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [videoId, isValidVideoId]);

  // 🔹 تطبيق نقطة الاستئناف
  useEffect(() => {
    if (!isLoading && videoRef.current && progress.lastPosition > 0 && isActive && isValidVideoId && !hasResumedRef.current) {
      const resumePosition = Math.max(0, progress.lastPosition - 2);
      videoRef.current.currentTime = resumePosition;
      hasResumedRef.current = true;
      console.log(`⏩ Resumed video ${videoId} at ${resumePosition}s`);
    }
  }, [isLoading, progress.lastPosition, videoId, isActive, isValidVideoId]);

  // 🔹 إعادة تعيين flag الاستئناف عند تغيير الفيديو
  useEffect(() => {
    hasResumedRef.current = false;
  }, [videoId]);

  // 🔹 دالة حفظ محسنة مع debounce وqueue
  const saveProgress = useCallback(async (force = false, currentTime?: number) => {
    if (!videoRef.current || !isValidVideoId || !videoId || isSaving) {
      return;
    }

    const now = Date.now();
    const videoCurrentTime = currentTime !== undefined ? currentTime : videoRef.current.currentTime;

    // 🔹 منع التكرار السريع
    if (!force && now - lastSaveAttempt < DEBOUNCE_TIME) {
      console.log('⏸️ Debouncing save progress');
      return;
    }

    // 🔹 التحقق من الفاصل الزمني
    if (!force && now - lastSaveTime < SAVE_INTERVAL) {
      // 🔹 إضافة إلى queue بدلاً من الحفظ المباشر
      if (saveQueue.length < 5) { // تحديد حجم queue
        setSaveQueue(prev => [...prev, videoCurrentTime]);
      }
      return;
    }

    setLastSaveAttempt(now);

    try {
      setIsSaving(true);
      const duration = videoRef.current.duration;
      const completed = duration > 0 && (videoCurrentTime / duration) >= 0.9;

      console.log(`💾 Saving progress for video ${videoId}: ${videoCurrentTime.toFixed(1)}s`);

      await api.post(`/videos/${videoId}/progress`, {
        lastPosition: videoCurrentTime,
        watchTime: Math.floor(videoCurrentTime),
        completed
      });

      setLastSaveTime(now);
      setProgress(prev => ({
        ...prev,
        lastPosition: videoCurrentTime,
        watchTime: Math.floor(videoCurrentTime),
        completed
      }));

      console.log(`✅ Saved progress for video ${videoId}`);

      // 🔹 معالجة queue بعد الحفظ الناجح
      if (saveQueue.length > 0) {
        setSaveQueue([]);
      }

    } catch (error) {
      console.error('Failed to save video progress:', error);
    } finally {
      setIsSaving(false);
    }
  }, [videoId, lastSaveTime, lastSaveAttempt, isValidVideoId, videoRef, isSaving, saveQueue]);

  // 🔹 معالجة queue تلقائياً
  useEffect(() => {
    if (saveQueue.length > 0 && !isSaving) {
      const processQueue = async () => {
        const latestTime = Math.max(...saveQueue);
        await saveProgress(false, latestTime);
      };

      const timer = setTimeout(processQueue, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveQueue, isSaving, saveProgress]);

  // 🔹 حفظ تلقائي كل 10 ثواني فقط
  useEffect(() => {
    if (!isActive || !videoRef.current || !isValidVideoId || !user) return;

    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.currentTime > 0) {
        saveProgress();
      }
    }, SAVE_INTERVAL);

    return () => {
      clearInterval(interval);
      // 🔹 حفظ نهائي عند unmount
      if (videoRef.current && videoRef.current.currentTime > 0 && isValidVideoId) {
        saveProgress(true);
      }
    };
  }, [isActive, saveProgress, isValidVideoId, user]);

  // 🔹 حفظ نهائي عند unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.currentTime > 0 && isValidVideoId && videoId) {
        console.log(`💾 Final save on unmount for video ${videoId}`);
        saveProgress(true);
      }
    };
  }, [saveProgress, isValidVideoId, videoId]);

  return {
    progress,
    isLoading,
    saveProgress,
    resumePosition: progress.lastPosition,
    isValidVideoId,
    isSaving
  };
};

export default useVideoProgress;