// hooks/useHLS.ts
import { useEffect, useRef, RefObject } from 'react';
import Hls from 'hls.js';
import { getMediaUrl } from '../utils/urlUtils';

interface UseHLSOptions {
    videoRef: RefObject<HTMLVideoElement | null>; // ✅ السماح بأن يكون null
    manifestUrl: string | null;
    autoPlay?: boolean;
    onError?: (error: any) => void;
    onManifestParsed?: () => void;
}

/**
 * Custom hook لإدارة HLS streaming
 * يتعامل مع تحميل وتشغيل الفيديو باستخدام chunks
 */
export const useHLS = ({
    videoRef,
    manifestUrl,
    autoPlay = true,
    onError,
    onManifestParsed
}: UseHLSOptions) => {
    const hlsRef = useRef<Hls | null>(null);

    useEffect(() => {
        if (!manifestUrl || !videoRef.current) return;

        const video = videoRef.current;

        // التحقق من دعم HLS
        if (Hls.isSupported()) {
            console.log('🎬 Initializing HLS player');

            // إنشاء instance جديد من HLS
            const hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                maxBufferSize: 60 * 1000 * 1000, // 60MB
                maxBufferHole: 0.5,
                // تحسينات للهواتف الضعيفة
                abrEwmaDefaultEstimate: 500000, // 500kbps default
                abrBandWidthFactor: 0.95,
                abrBandWidthUpFactor: 0.7,
                startLevel: 0 // ابدأ بأقل جودة (360p)
            });

            hlsRef.current = hls;

            // تحميل الـ manifest
            console.log('🔗 Loading HLS source:', getMediaUrl(manifestUrl));
            hls.loadSource(getMediaUrl(manifestUrl));
            hls.attachMedia(video);

            // Event listeners
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('✅ HLS manifest parsed');
                console.log('📊 Available quality levels:', hls.levels.length);

                if (autoPlay) {
                    video.play().catch(err => {
                        console.log('Auto-play prevented:', err);
                    });
                }

                onManifestParsed?.();
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('❌ HLS error:', data);

                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('🔄 Network error, trying to recover...');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('🔄 Media error, trying to recover...');
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error('💥 Fatal error, cannot recover');
                            hls.destroy();
                            onError?.(data);
                            break;
                    }
                }
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
                const level = hls.levels[data.level];
                console.log(`📺 Quality switched to: ${level.height}p`);
            });

            // Cleanup
            return () => {
                console.log('🧹 Cleaning up HLS player');
                if (hlsRef.current) {
                    hlsRef.current.destroy();
                    hlsRef.current = null;
                }
            };

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // دعم native HLS (Safari)
            console.log('🍎 Using native HLS support');
            video.src = getMediaUrl(manifestUrl);

            if (autoPlay) {
                video.play().catch(err => {
                    console.log('Auto-play prevented:', err);
                });
            }

            return () => {
                video.src = '';
            };
        } else {
            console.error('❌ HLS is not supported in this browser');
            onError?.(new Error('HLS not supported'));
        }
    }, [manifestUrl, videoRef, autoPlay, onError, onManifestParsed]);

    /**
     * تغيير الجودة يدوياً
     */
    const setQuality = (levelIndex: number) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex;
            console.log(`🎚️ Quality manually set to level ${levelIndex}`);
        }
    };

    /**
     * تفعيل/تعطيل الجودة التلقائية
     */
    const setAutoQuality = (enabled: boolean) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = enabled ? -1 : hlsRef.current.currentLevel;
            console.log(`🤖 Auto quality ${enabled ? 'enabled' : 'disabled'}`);
        }
    };

    /**
     * الحصول على الجودات المتاحة
     */
    const getQualityLevels = () => {
        if (hlsRef.current) {
            return hlsRef.current.levels.map((level, index) => ({
                index,
                height: level.height,
                width: level.width,
                bitrate: level.bitrate,
                name: `${level.height}p`
            }));
        }
        return [];
    };

    return {
        hls: hlsRef.current,
        setQuality,
        setAutoQuality,
        getQualityLevels
    };
};

export default useHLS;
