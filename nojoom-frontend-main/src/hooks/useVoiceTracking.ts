// hooks/useVoiceTracking.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import aiTrackingService from '../services/aiTrackingService';

interface VoiceTrackingOptions {
    videoId: number;
    enabled?: boolean;
    sensitivity?: number; // 0-100, default 50
}

interface VoiceMetrics {
    isActive: boolean;
    intensity: number;
    duration: number;
    interactionCount: number;
}

export const useVoiceTracking = ({ videoId, enabled = false, sensitivity = 50 }: VoiceTrackingOptions) => {
    const [metrics, setMetrics] = useState<VoiceMetrics>({
        isActive: false,
        intensity: 0,
        duration: 0,
        interactionCount: 0
    });

    const [hasPermission, setHasPermission] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const voiceStartTime = useRef<number | null>(null);
    const interactionCount = useRef<number>(0);

    /**
     * طلب إذن الميكروفون
     */
    const requestPermission = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            streamRef.current = stream;
            setHasPermission(true);
            setError(null);

            return true;
        } catch (err) {
            console.error('Microphone permission denied:', err);
            setError('Microphone permission denied');
            setHasPermission(false);
            return false;
        }
    }, []);

    /**
     * بدء تتبع الصوت
     */
    const startTracking = useCallback(async () => {
        if (!enabled || !streamRef.current) return;

        try {
            // إنشاء AudioContext
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

            // إنشاء Analyser
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            analyserRef.current.smoothingTimeConstant = 0.8;

            // ربط الميكروفون بالـ Analyser
            microphoneRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
            microphoneRef.current.connect(analyserRef.current);

            // بدء التحليل
            analyzeAudio();
        } catch (err) {
            console.error('Error starting voice tracking:', err);
            setError('Failed to start voice tracking');
        }
    }, [enabled]);

    /**
     * تحليل الصوت
     */
    const analyzeAudio = useCallback(() => {
        if (!analyserRef.current || !enabled) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const analyze = () => {
            if (!analyserRef.current || !enabled) return;

            analyserRef.current.getByteFrequencyData(dataArray);

            // حساب متوسط الشدة
            const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;

            // تطبيع الشدة (0-100)
            const normalizedIntensity = Math.min((average / 255) * 100, 100);

            // عتبة الكشف بناءً على الحساسية
            const threshold = (100 - sensitivity) / 2;

            const isVoiceActive = normalizedIntensity > threshold;

            // تتبع بداية ونهاية النشاط الصوتي
            if (isVoiceActive && !voiceStartTime.current) {
                // بداية تفاعل صوتي
                voiceStartTime.current = Date.now();
                interactionCount.current++;
            } else if (!isVoiceActive && voiceStartTime.current) {
                // نهاية تفاعل صوتي
                const duration = Date.now() - voiceStartTime.current;

                // تسجيل التفاعل إذا كان أطول من 500ms
                if (duration > 500) {
                    aiTrackingService.recordVoiceInteraction({
                        videoId,
                        interactionType: 'reaction',
                        duration,
                        intensity: normalizedIntensity,
                        timestampInVideo: 0 // يمكن تحديثه من الفيديو بلاير
                    });
                }

                voiceStartTime.current = null;
            }

            // تحديث المقاييس
            setMetrics({
                isActive: isVoiceActive,
                intensity: normalizedIntensity,
                duration: voiceStartTime.current ? Date.now() - voiceStartTime.current : 0,
                interactionCount: interactionCount.current
            });

            // الاستمرار في التحليل
            animationFrameRef.current = requestAnimationFrame(analyze);
        };

        analyze();
    }, [enabled, videoId, sensitivity]);

    /**
     * إيقاف التتبع
     */
    const stopTracking = useCallback(() => {
        // إيقاف التحليل
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        // إغلاق AudioContext
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        // قطع الاتصال
        if (microphoneRef.current) {
            microphoneRef.current.disconnect();
            microphoneRef.current = null;
        }

        // إيقاف Stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // إعادة تعيين المقاييس
        setMetrics({
            isActive: false,
            intensity: 0,
            duration: 0,
            interactionCount: 0
        });

        voiceStartTime.current = null;
        interactionCount.current = 0;
    }, []);

    /**
     * تبديل التتبع
     */
    const toggleTracking = useCallback(async () => {
        if (!enabled) {
            stopTracking();
            return false;
        }

        if (!hasPermission) {
            const granted = await requestPermission();
            if (!granted) return false;
        }

        await startTracking();
        return true;
    }, [enabled, hasPermission, requestPermission, startTracking, stopTracking]);

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
        error,
        requestPermission,
        toggleTracking,
        stopTracking
    };
};

export default useVoiceTracking;
