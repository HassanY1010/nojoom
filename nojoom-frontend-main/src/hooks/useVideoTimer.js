// src/hooks/useVideoTimer.js
import { useState, useEffect, useRef, useCallback } from 'react';

const MAX_WATCH_TIME = 3 * 60 * 60 * 1000; // 3 ساعات بالميلي ثانية

export const useVideoTimer = (videoId, isActive, onTimeLimitReached) => {
  const [watchTime, setWatchTime] = useState(0);
  const [isPausedBySystem, setIsPausedBySystem] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // تحميل الوقت المحفوظ من localStorage
  useEffect(() => {
    if (videoId) {
      const savedTime = localStorage.getItem(`video_watch_time_${videoId}`);
      const savedStartTime = localStorage.getItem(`video_start_time_${videoId}`);
      
      if (savedTime && savedStartTime) {
        const elapsed = Date.now() - parseInt(savedStartTime);
        const totalTime = parseInt(savedTime) + elapsed;
        
        setWatchTime(totalTime);
        
        if (totalTime >= MAX_WATCH_TIME) {
          setIsPausedBySystem(true);
          onTimeLimitReached?.();
        }
      }
    }
  }, [videoId, onTimeLimitReached]);

  // بدء/إيقاف المؤقت
  useEffect(() => {
    if (isActive && videoId && !isPausedBySystem) {
      // بدء المؤقت
      startTimeRef.current = Date.now();
      
      // حفظ وقت البدء
      localStorage.setItem(`video_start_time_${videoId}`, startTimeRef.current.toString());
      
      timerRef.current = setInterval(() => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTimeRef.current;
        const totalWatchTime = watchTime + elapsed;
        
        setWatchTime(totalWatchTime);
        
        // تحديث localStorage
        localStorage.setItem(`video_watch_time_${videoId}`, totalWatchTime.toString());
        
        // التحقق إذا تجاوز الحد
        if (totalWatchTime >= MAX_WATCH_TIME) {
          setIsPausedBySystem(true);
          onTimeLimitReached?.();
          clearInterval(timerRef.current);
        }
        
        // تحديث وقت البدء
        startTimeRef.current = currentTime;
        localStorage.setItem(`video_start_time_${videoId}`, currentTime.toString());
        
      }, 30000); // تحديث كل 30 ثانية
      
    } else {
      // إيقاف المؤقت
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, videoId, isPausedBySystem, watchTime, onTimeLimitReached]);

  // إعادة تعيين المؤقت
  const resetTimer = useCallback(() => {
    if (videoId) {
      setWatchTime(0);
      setIsPausedBySystem(false);
      localStorage.removeItem(`video_watch_time_${videoId}`);
      localStorage.removeItem(`video_start_time_${videoId}`);
    }
  }, [videoId]);

  // تخطي الحد مؤقتاً (لأغراض التطوير)
  const forceContinue = useCallback(() => {
    setIsPausedBySystem(false);
    setWatchTime(0);
    if (videoId) {
      localStorage.removeItem(`video_watch_time_${videoId}`);
      localStorage.removeItem(`video_start_time_${videoId}`);
    }
  }, [videoId]);

  return {
    watchTime,
    isPausedBySystem,
    resetTimer,
    forceContinue,
    timeLimit: MAX_WATCH_TIME,
    remainingTime: Math.max(0, MAX_WATCH_TIME - watchTime)
  };
};

export default useVideoTimer;