import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Video } from '../types';
import { useNavigate } from 'react-router-dom';
import { useHLS } from '../hooks/useHLS';
import { getMediaUrl } from '../utils/urlUtils';
import { formatNumber } from '../utils/numberUtils';

interface GuestVideoCardProps {
  video: Video;
  isActive: boolean;
  onSwipeUp?: () => void;
  autoPlay?: boolean; // ✅ أضفها كخيار اختياري
}


const GuestVideoCard: React.FC<GuestVideoCardProps> = ({
  video,
  isActive,
  onSwipeUp
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [showMuteIndicator, setShowMuteIndicator] = useState(false);

  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [useHlsStreaming, setUseHlsStreaming] = useState(false);

  // 🚀 VIDEO TURBO ENGINE: إدارة HLS
  const { hls } = useHLS({
    videoRef,
    manifestUrl,
    autoPlay: isActive
  });

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // 🚀 VIDEO TURBO ENGINE: تحميل HLS Manifest
  useEffect(() => {
    const loadManifest = async () => {
      try {
        const manifestUrl = `/api/videos/${video.id}/manifest`;
        const response = await fetch(getMediaUrl(manifestUrl));
        const data = await response.json();

        if (data.manifestUrl) {
          if (data.processingStatus === 'completed') {
            setManifestUrl(data.manifestUrl);
            setUseHlsStreaming(true);
            console.log('✅ Guest HLS enabled for video:', video.id);
          }
        }
      } catch (error) {
        console.log('ℹ️ Guest HLS not available');
        setUseHlsStreaming(false);
      }
    };

    if (video.id) {
      loadManifest();
    }
  }, [video.id]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isActive) {
      const playVideo = async () => {
        try {
          videoElement.muted = true;
          setIsMuted(true);
          if (!useHlsStreaming) {
            await videoElement.play();
          }
          setIsPlaying(true);
        } catch (error) {
          console.log('Auto-play failed:', error);
        }
      };

      playVideo();
    } else {
      videoElement.pause();
      setIsPlaying(false);
    }
  }, [isActive, useHlsStreaming]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;

    if (diff > 50 && onSwipeUp) {
      onSwipeUp();
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    if (e.target === videoRef.current) {
      // Single tap = toggle mute (TikTok-style UX)
      toggleMute();

      // Show mute indicator
      setShowMuteIndicator(true);
      setTimeout(() => setShowMuteIndicator(false), 1500);
    }
  };

  // ✅ SVG Icons with TikTok style
  const TikTokIcons = {
    like: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ),
    comment: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
      </svg>
    ),
    share: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
      </svg>
    ),
    music: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    ),
    mute: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 9H6c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h2v2c0 1.1.9 2 2 2h1.17l4.9 4.9c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .94-.2 1.82-.54 2.63l1.51 1.51C20.63 15.01 21 13.55 21 12c0-2.76-1.12-5.26-2.93-7.07l-1.06 1.06C19.45 7.53 20 9.66 20 12zm-4.46 3.63l1.45 1.45C17.41 16.97 18 14.56 18 12c0-1.25-.27-2.44-.75-3.51l-1.37 1.37c.26.73.43 1.51.51 2.32.13.34.2.7.2 1.08 0 .42-.09.82-.24 1.19z" />
      </svg>
    ),
    unmute: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
    )
  };

  // ✅ الهيكل الرئيسي للفيديو
  const renderVideoContent = () => (
    <div className="flex flex-col w-full h-full lg:h-auto lg:py-4">
      <div className="flex-1 flex items-end lg:items-center justify-center gap-4 relative">
        {/* 🔹 Video Player Container */}
        <div className={`relative bg-black overflow-hidden shadow-2xl group transition-all duration-500 ${isMobile ? 'w-screen h-screen fixed inset-0' : 'h-[calc(100vh-8rem)] w-auto aspect-[9/16] max-w-[56.25vh] rounded-2xl border border-white/5'}`}>
          <video
            ref={videoRef}
            className="w-full h-full cursor-pointer object-cover"
            loop
            muted={isMuted}
            playsInline
            onClick={handleVideoClick}
            preload="auto"
            poster={getMediaUrl(video.thumbnail, { width: 600, height: 1067, crop: 'fill' })}
          >
            <source
              src={getMediaUrl(video.video_url || video.path)}
              type="video/mp4"
            />
            {t('videoTagNotSupported')}
          </video>

          {/* User Info Overlay (Transparent) */}
          {!isMobile && (
            <div className="absolute bottom-16 left-4 z-20 text-left max-w-[55%] flex flex-col gap-1 pointer-events-none drop-shadow-lg">
              <Link to="/login" className="pointer-events-auto">
                <h3 className="text-white font-extrabold text-base truncate">@{video.username}</h3>
              </Link>
              <p className="text-white/90 text-sm line-clamp-2">{video.description}</p>
            </div>
          )}

          {/* Mobile Info Overlay */}
          {isMobile && (
            <div className="absolute bottom-16 right-4 z-20 text-right max-w-xs flex flex-col gap-1 pointer-events-none">
              <Link to="/login" className="pointer-events-auto">
                <h3 className="text-white font-bold text-base drop-shadow-md">{video.username}</h3>
              </Link>
              <p className="text-white text-sm line-clamp-2 drop-shadow-md">{video.description}</p>
            </div>
          )}

          {/* 🔊 Mute Indicator Overlay (TikTok-style) */}
          <AnimatePresence>
            {showMuteIndicator && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
              >
                <div className="bg-black/70 backdrop-blur-md rounded-full p-6 shadow-2xl border border-white/20">
                  <div className="text-white w-12 h-12 flex items-center justify-center">
                    {isMuted ? TikTokIcons.mute : TikTokIcons.unmute}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 🔹 Interaction Column (Side) */}
        <div className={`flex flex-col items-center gap-4 ${isMobile ? 'absolute left-4 bottom-24 z-30' : 'self-end'}`}>

          {/* Profile Stack (Mobile Only) */}
          {isMobile && (
            <div className="relative mb-2">
              <Link to="/login">
                <img
                  src={getMediaUrl(video.avatar, { width: 100, height: 100, crop: 'fill' })}
                  className="w-12 h-12 rounded-full border-2 border-white/20 object-cover"
                  alt={video.username}
                />
              </Link>
              <button onClick={() => window.location.href = '/login'} className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-[rgb(var(--primary-accent))] rounded-full flex items-center justify-center text-black text-xs border border-white/50">
                +
              </button>
            </div>
          )}

          {/* Like */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => window.location.href = '/login'}
              className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center hover:bg-white/10 transition-all active:scale-95 text-white"
            >
              {TikTokIcons.like}
            </button>
            <span className="text-[12px] font-bold mt-2 text-white/80">{formatNumber(video.likes || 0)}</span>
          </div>

          {/* Comments */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => window.location.href = '/login'}
              className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center hover:bg-white/10 transition-all active:scale-95 text-white"
            >
              {TikTokIcons.comment}
            </button>
            <span className="text-[12px] font-bold mt-2 text-white/80">{formatNumber(video.comment_count || 0)}</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center relative">
            <button
              onClick={() => window.location.href = '/login'}
              className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center hover:bg-white/10 transition-all active:scale-95 text-white"
            >
              {TikTokIcons.share}
            </button>
            <span className="text-[12px] font-bold mt-2 text-white/80">{formatNumber(video.shares || 0)}</span>
          </div>

        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`relative flex items-center justify-center w-full h-full ${isMobile ? 'bg-black' : 'bg-transparent'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`relative w-full h-full flex flex-col items-center ${isMobile ? '' : 'justify-center'}`}>
        {renderVideoContent()}
      </div>
    </div>
  );
};

export default GuestVideoCard;