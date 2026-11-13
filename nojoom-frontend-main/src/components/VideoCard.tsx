import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ChatBox from './ChatBox';
import CommentsBox from './CommentsBox';
import FloatingChatBar from './FloatingChatBar';
import BroadcastTicker from './BroadcastTicker';
import UploadModal from './UploadModal';
import { Video } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { reportService } from '../services/reportService';
import { useHLS } from '../hooks/useHLS';
import { useVideoProgress } from '../hooks/useVideoProgress';
import { getMediaUrl } from '../utils/urlUtils';

import { formatNumber } from '../utils/numberUtils';


interface VideoCardProps {
  video: Video;
  isActive: boolean;
  compact?: boolean;
  autoPlay?: boolean;
  tiktokStyle?: boolean;
  showUserInfo?: boolean;
  showStats?: boolean;
  onWatchTimeUpdate?: (watchTime: number) => void;
  onSwipeUp?: () => void;
  onInteraction?: (videoId: number, interactionType: string) => void;
  shouldPreload?: boolean;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isActive,
  autoPlay = true,
  onWatchTimeUpdate,
  onSwipeUp,
  onInteraction,
  compact = false,
  shouldPreload = false
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [subtitles, setSubtitles] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuthStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(video.is_liked || false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [commentCount, setCommentCount] = useState(video.comment_count || 0);
  const [shareCount, setShareCount] = useState(video.shares || 0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [watchStartTime, setWatchStartTime] = useState<number | null>(null);
  const [totalWatchTime, setTotalWatchTime] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showMuteIndicator, setShowMuteIndicator] = useState(false);

  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [useHlsStreaming, setUseHlsStreaming] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('unknown');
  const [hasViewed, setHasViewed] = useState(false);

  // 🔹 إضافة حالات جديدة
  const [commentCountLoading, setCommentCountLoading] = useState(false);
  const [commentsCountFetched, setCommentsCountFetched] = useState(false);
  const [shareCountFetched, setShareCountFetched] = useState(false);
  const [shareCountLoading, setShareCountLoading] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>('Auto');

  // ✅ إصلاح: ترتيب المعاملات الصحيح لـ useVideoProgress
  // Ensure video and video.id are valid before using them in the hook
  const isValidVideo = video && typeof video.id === 'number' && video.id > 0;

  // ⚡️ Always call hooks unconditionally (Rules of Hooks)
  const videoProgressHook = useVideoProgress(
    videoRef,
    isValidVideo ? video.id : undefined,
    isActive
  );

  // ✅ إصلاح: تمرير معامل واحد فقط
  const hlsHook = useHLS({ videoRef, manifestUrl });

  useEffect(() => {
    if (manifestUrl && hlsHook && hlsHook.hls) {
      // ✅ إصلاح: استخدام loadSource بدلاً من load
      hlsHook.hls.loadSource(manifestUrl);
    }
  }, [manifestUrl, hlsHook]);

  useEffect(() => {
    if (video.ai_transcription) {
      setSubtitles(video.ai_transcription);
    } else if (video.subtitles_path) {
      setSubtitles('Translation Available'); // Placeholder if only path exists
    }
  }, [video]);

  useEffect(() => {
    if (!hlsHook && manifestUrl) {
      console.log('Fallback to MP4 since HLS not initialized');
      setUseHlsStreaming(false);
    }
  }, [hlsHook, manifestUrl]);

  // ✅ الكشف عن نوع الجهاز
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => window.removeEventListener('resize', checkDevice);
  }, []);

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
    report: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
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
    ),
    music: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    ),
    check: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    )
  };

  // ✅ في VideoCard.tsx - إصلاح fetchCommentCount
  const fetchCommentCount = useCallback(async () => {
    // 🔹 التحقق من عدم التحميل حالياً ومن صحة الفيديو
    if (commentCountLoading || !video?.id || video.id <= 0) return;

    setCommentCountLoading(true);
    try {
      const response = await api.get(`/videos/${video.id}/comments/count`);
      setCommentCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch comment count:', error);
      setCommentCount(video.comment_count || 0);
    } finally {
      setCommentCountLoading(false);
    }
  }, [video?.id, video?.comment_count, commentCountLoading]);

  // 🔹 إصلاح fetchShareCount
  const fetchShareCount = useCallback(async () => {
    if (shareCountLoading || !video?.id || video.id <= 0) return;

    setShareCountLoading(true);
    try {
      const response = await api.get(`/videos/${video.id}/shares/count`);
      setShareCount(response.data.shareCount);
    } catch (error) {
      console.error('Failed to fetch share count:', error);
      setShareCount(video.shares || 0);
    } finally {
      setShareCountLoading(false);
    }
  }, [video?.id, video?.shares, shareCountLoading]);

  const handleNewComment = useCallback(() => {
    setCommentCount(prev => prev + 1);
  }, []);

  const handleDeleteComment = useCallback(() => {
    setCommentCount(prev => Math.max(0, prev - 1));
  }, []);

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  const handleOpenUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadModal(true);
    }
    // Reset input value to allow selecting the same file again
    if (event.target) {
      event.target.value = '';
    }
  };

  // ✅ Intersection Observer for visibility tracking
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && isActive) {
            // Video entered view and is active
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                setIsPlaying(true);
                setWatchStartTime(Date.now());
              }).catch(err => {
                console.log('Autoplay blocked by browser', err);
              });
            }
          } else {
            // Video left view or is not active
            videoElement.pause();
            setIsPlaying(false);
            recordWatchTime();
          }
        });
      },
      { threshold: 0.6 } // Play when 60% of video is visible
    );

    observer.observe(videoElement);

    return () => {
      observer.unobserve(videoElement);
      observer.disconnect();
    };
  }, [isActive]);

  // Sync state with prop
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (!isActive) {
      videoElement.pause();
      setIsPlaying(false);
      recordWatchTime();
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      recordWatchTime();
    };
  }, []);

  // 🚀 VIDEO TURBO ENGINE: تحميل HLS Manifest مع fallback
  useEffect(() => {
    const loadManifest = async () => {
      try {
        const manifestUrlPath = `/api/videos/${video.id}/manifest`;
        const fetchResponse = await fetch(getMediaUrl(manifestUrlPath));
        const responseData = await fetchResponse.json();

        if (responseData.manifestUrl) {
          setProcessingStatus(responseData.processingStatus);
          if (responseData.processingStatus === 'completed') {
            setManifestUrl(responseData.manifestUrl);
            setUseHlsStreaming(true);
            console.log('✅ HLS streaming enabled for video:', video.id);
          } else if (responseData.fallbackUrl) {
            // 🔹 استخدام fallback إذا كان متوفراً
            console.log('🔄 Using MP4 fallback for video:', video.id);
            setUseHlsStreaming(false);
            // تحديث مصدر الفيديو مع fallback
            video.path = responseData.fallbackUrl;
          }
        }
      } catch (error) {
        console.log('ℹ️ HLS not available, using regular MP4');
        setUseHlsStreaming(false);
      }
    };

    if (video.id) {
      loadManifest();
    }
  }, [video.id]);

  const handleQualityChange = (index: number, name: string) => {
    if (hlsHook) {
      if (index === -1) {
        hlsHook.setAutoQuality(true);
        setCurrentQuality('Auto');
      } else {
        hlsHook.setQuality(index);
        setCurrentQuality(name);
      }
    }
    setShowQualityMenu(false);
  };

  // في VideoCard.tsx - تحسين تسجيل وقت المشاهدة
  const recordWatchTime = () => {
    if (!user || !video?.id || video.id <= 0) return;

    if (watchStartTime && totalWatchTime > 0) {
      onWatchTimeUpdate?.(totalWatchTime);

      // 🔹 استخدام debounce للحفظ
      if (videoProgressHook && typeof videoProgressHook.saveProgress === 'function') {
        // تأخير الحفظ قليلاً لتجميع التحديثات
        const saveTimer = setTimeout(() => {
          videoProgressHook.saveProgress(true);
        }, 1000);

        return () => clearTimeout(saveTimer);
      } else {
        // Fallback مع debounce
        const saveTimer = setTimeout(() => {
          api.post('/user/watch-history', {
            videoId: video.id,
            watchTime: totalWatchTime,
            completed: progress >= 80
          }).catch(console.error);
        }, 2000);

        return () => clearTimeout(saveTimer);
      }
    }
  };

  // 🔹 تحسين timeupdate listener
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 5000; // تحديث كل 5 ثواني

    const updateProgress = () => {
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;
      const now = Date.now();

      if (duration > 0) {
        const newProgress = (currentTime / duration) * 100;
        setProgress(newProgress);

        // ✅ تسجيل مشاهدة بعد 5 ثواني
        if (currentTime > 5 && !hasViewed && user) {
          setHasViewed(true);
          api.post(`/videos/${video.id}/view`)
            .then(res => {
              if (res.data.success) {
                console.log('✅ View recorded successfully');
                // يمكنك تحديث العداد محلياً إذا أردت
              }
            })
            .catch(err => console.error('Failed to record view:', err));
        }

        if (watchStartTime) {
          setTotalWatchTime(currentTime);
        }

        // 🔹 تحديث أقل تكراراً
        if (user && now - lastUpdateTime > UPDATE_INTERVAL) {
          onWatchTimeUpdate?.(currentTime);
          lastUpdateTime = now;
        }
      }
    };
  }, [watchStartTime, user]);

  useEffect(() => {
    setProgress(0);
    setTotalWatchTime(0);
    setWatchStartTime(null);
    setHasViewed(false);
  }, [video.id]);

  // 🔹 تعديل useEffect ليكون أكثر كفاءة
  useEffect(() => {
    if (showComments && video.id && !commentsCountFetched) {
      fetchCommentCount();
      setCommentsCountFetched(true);
    }
  }, [showComments, video.id, commentsCountFetched, fetchCommentCount]);

  // 🔹 تعديل الـ useEffect الرئيسي
  useEffect(() => {
    if (video.id && isActive && !shareCountFetched) {
      fetchShareCount();
      setShareCountFetched(true);
    }
  }, [video.id, isActive, shareCountFetched, fetchShareCount]);

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
        recordWatchTime();
      } else {
        videoRef.current.play();
        setWatchStartTime(Date.now());
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleComments = () => {
    setShowComments(!showComments);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      // Always invert current state
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;

      // Force unmuting to max volume
      if (!nextMuted) {
        videoRef.current.volume = 1.0;
      }

      setIsMuted(nextMuted);
    }
  };

  const handleLike = async () => {
    if (!user) {
      alert('يرجى تسجيل الدخول للإعجاب بالفيديوهات');
      return;
    }
    try {
      const oldIsLiked = isLiked;
      const oldLikeCount = likeCount;
      setIsLiked(!oldIsLiked);
      setLikeCount(oldIsLiked ? oldLikeCount - 1 : oldLikeCount + 1);

      const response = await api.post(`/videos/${video.id}/like`);
      setIsLiked(response.data.isLiked);
      setLikeCount(response.data.likes);

      onInteraction?.(video.id, 'like');

      if (!oldIsLiked) {
        api.post('/user/interaction', {
          videoId: video.id,
          type: 'like',
          weight: 1.0
        }).catch(console.error);
      }
    } catch (error: any) {
      console.error('Like action failed:', error);
      setIsLiked(isLiked);
      setLikeCount(likeCount);
      if (error.response?.status === 401) {
        alert('يرجى تسجيل الدخول للإعجاب بالفيديوهات');
      }
    }
  };

  const shareVideo = async () => {
    const videoUrl = `${window.location.origin}/video/${video.id}`;

    try {
      await navigator.clipboard.writeText(videoUrl);
      alert('تم نسخ رابط الفيديو!');
      setShowShareMenu(false);

      if (user) {
        try {
          const response = await api.post(`/videos/${video.id}/share`, {
            shareMethod: 'direct'
          });
          setShareCount(response.data.shareCount);
          onInteraction?.(video.id, 'share');
        } catch (shareError) {
          console.error('Failed to record share:', shareError);
        }
      }
    } catch (copyError) {
      const textArea = document.createElement('textarea');
      textArea.value = videoUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('تم نسخ رابط الفيديو!');
      setShowShareMenu(false);
    }
  };

  const shareOnSocialMedia = async (platform: string) => {
    const videoUrl = `${window.location.origin}/video/${video.id}`;
    const text = `شاهد هذا الفيديو الرائع!`;
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(videoUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(videoUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + videoUrl)}`
    };

    window.open(urls[platform as keyof typeof urls], '_blank', 'width=600,height=400');
    setShowShareMenu(false);

    if (user) {
      try {
        const response = await api.post(`/videos/${video.id}/share`, {
          shareMethod: platform
        });
        setShareCount(response.data.shareCount);
        onInteraction?.(video.id, 'share');
      } catch (shareError) {
        console.error('Failed to record social share:', shareError);
      }
    }
  };

  const reportVideo = async (reason: string) => {
    if (!user) {
      alert('يرجى تسجيل الدخول للإبلاغ عن الفيديوهات');
      return;
    }

    if (user.id === video.user_id) {
      alert('لا يمكنك الإبلاغ عن الفيديو الخاص بك');
      setShowReportMenu(false);
      return;
    }

    setIsReporting(true);
    try {
      await reportService.createReport(video.id, reason);
      setReportSuccess(true);

      api.post('/user/interaction', {
        videoId: video.id,
        type: 'report',
        weight: -2.0
      }).catch(console.error);

      setTimeout(() => {
        setReportSuccess(false);
        setShowReportMenu(false);
      }, 2000);
    } catch (error: any) {
      console.error('Report failed:', error);
      if (error.response?.status === 400) {
        alert('لقد أبلغت عن هذا الفيديو مسبقاً');
      } else if (error.response?.status === 401) {
        alert('يرجى تسجيل الدخول للإبلاغ عن الفيديوهات');
      } else {
        alert('فشل في الإبلاغ عن الفيديو. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsReporting(false);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (!target.closest('.share-menu') && !target.closest('.share-button')) {
        setShowShareMenu(false);
      }

      if (!target.closest('.report-menu') && !target.closest('.report-button')) {
        setShowReportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ عرض مضغوط للبحث
  if (compact) {
    return (
      <div className="flex flex-col h-full bg-black group/card relative overflow-hidden premium-card">
        {/* Thumbnail Section */}
        <div className="relative aspect-[9/16] w-full overflow-hidden bg-gray-900 group-hover/card:brightness-90 transition-all duration-300">
          <Link to={`/video/${video.id}`} className="block w-full h-full">
            <img
              src={getMediaUrl(video.thumbnail || video.path, { width: 400, height: 711, crop: 'fill' })}
              className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110"
              alt={video.description || 'فيديو'}
              onError={(e) => { e.currentTarget.src = '/video-placeholder.png'; }}
            />
          </Link>

          {/* Stats Overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-xl px-3 py-1 rounded-full border border-white/10 shadow-2xl">
              <svg className="w-3.5 h-3.5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              </svg>
              <span className="text-white text-[11px] font-bold tracking-wider">{formatNumber(video.views || 0)}</span>
            </div>
          </div>

          <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
            <div className="bg-red-500 p-1.5 rounded-full shadow-lg">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="p-4 flex flex-col flex-1 bg-gradient-to-b from-transparent to-black/80">
          {video.description && (
            <h3 className="text-white font-bold text-xs sm:text-sm line-clamp-2 leading-tight mb-3 group-hover/card:text-[rgb(var(--primary-accent))] transition-colors duration-300">
              {video.description}
            </h3>
          )}

          <div className="mt-auto flex items-center justify-between">
            <Link
              to={`/profile/${video.username}`}
              className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-100 group/user transition-all"
            >
              <img
                src={getMediaUrl(video.avatar, { width: 40, height: 40, crop: 'fill' })}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border-2 border-white/10 group-hover/user:border-[rgb(var(--primary-accent))] transition-colors"
                alt={video.username}
                onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }}
              />
              <span className="text-gray-400 text-[10px] sm:text-xs font-bold truncate group-hover/user:text-white transition-colors">@{video.username}</span>
            </Link>

            <div className="flex items-center gap-2 text-gray-500 group-hover/card:text-[rgb(var(--primary-accent))] transition-colors">
              <span className="text-[10px] sm:text-xs font-bold">{formatNumber(likeCount)}</span>
              <svg className={`w-3.5 h-3.5 ${isLiked ? 'text-[rgb(var(--primary-accent))]' : 'currentColor'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ الهيكل الرئيسي للفيديو مع دعم متعدد الأجهزة
  const renderVideoContent = () => (
    <div className="flex flex-col w-full h-full lg:h-auto lg:py-4">
      {/* Desktop User Info (Moved to overlay inside video for immersive feel) */}

      <div className="flex-1 flex items-end lg:items-center justify-center gap-4 relative">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="video/*"
          className="hidden"
        />

        {/* 🔹 Video Player Container */}
        <div className={`relative bg-black overflow-hidden shadow-2xl group transition-all duration-500 ${isMobile ? 'w-screen h-screen fixed inset-0' : 'h-[calc(100vh-8rem)] w-auto aspect-[9/16] max-w-[56.25vh] rounded-2xl border border-gray-800/30'}`}>
          <video
            ref={videoRef}
            className={`w-full h-full cursor-pointer ${isMobile ? 'object-cover' : 'object-cover'}`} // Force object-cover for full immersion
            loop
            muted
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            preload={isActive || shouldPreload ? "auto" : "metadata"}
            onClick={handleVideoClick}
            poster={getMediaUrl(video.thumbnail, { width: 600, height: 1067, crop: 'fill' })}
            src={!useHlsStreaming ? getMediaUrl(video.video_url || video.path) : undefined}
          >
            {subtitles && (
              <track
                kind="subtitles"
                src={getMediaUrl(video.subtitles_path || '')}
                srcLang="ar"
                label="Arabic"
                default={showSubtitles}
              />
            )}
            Your browser does not support the video tag.
          </video>

          {/* Subtitle Overlay (Manual for ai_transcription) */}
          {showSubtitles && subtitles && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[80%] bg-black/60 backdrop-blur-sm text-white text-center p-2 rounded-lg z-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-sm font-medium leading-tight">
                {subtitles === 'Translation Available' ? 'جاري تحميل الترجمة...' : subtitles}
              </p>
            </div>
          )}

          {/* Desktop User Info Overlay (Transparent) */}
          {!isMobile && (
            <div className="absolute bottom-16 left-4 z-20 text-left max-w-[55%] flex flex-col gap-1 pointer-events-none drop-shadow-lg">
              <Link to={`/profile/${video.username}`} className="pointer-events-auto">
                <h3 className="text-white font-bold text-base truncate">@{video.username}</h3>
              </Link>
              <p className="text-white/90 text-sm line-clamp-2">{video.description}</p>
            </div>
          )}

          {/* Progress Bar (Bottom) */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-30 overflow-hidden ${isMobile ? 'bottom-[56px] (mb-[env(safe-area-inset-bottom)])' : ''}`}>
            <div
              className="h-full bg-[rgb(var(--primary-accent))] transition-all duration-100 shadow-[0_0_10px_rgba(var(--primary-accent),0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Mobile Info Overlay (Only for mobile) */}
          {isMobile && (
            <div className="absolute bottom-16 right-4 z-20 text-right max-w-xs flex flex-col gap-1 pointer-events-none">
              <Link to={`/profile/${video.username}`} className="pointer-events-auto">
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

        {/* 🔹 Interaction Column (Fixed on side for both) */}
        <div className={`flex flex-col items-center gap-5 ${isMobile ? 'absolute left-4 bottom-24 z-30' : 'absolute left-2 bottom-20 z-30'}`}>

          {/* Profile Stack (Desktop/Mobile diff) */}
          {isMobile && (
            <div className="relative mb-2">
              <Link to={`/profile/${video.username}`}>
                <img
                  src={getMediaUrl(video.avatar, { width: 100, height: 100, crop: 'fill' })}
                  className="w-12 h-12 rounded-full border-2 border-white object-cover"
                  alt={video.username}
                />
              </Link>
              <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs border border-white">
                +
              </button>
            </div>
          )}

          {/* Subtitles Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSubtitles(!showSubtitles);
            }}
            className={`flex flex-col items-center gap-1 transition-all`}
            disabled={!subtitles}
          >
            <div className={`w-12 h-12 rounded-2xl glass-panel flex items-center justify-center shadow-2xl hover:bg-white/10 transition-all ${showSubtitles ? 'ring-2 ring-[rgb(var(--primary-accent))] shadow-[0_0_15px_rgba(var(--primary-accent),0.4)]' : ''}`}>
              <span className="text-white text-sm font-extrabold italic">CC</span>
            </div>
            <span className="text-white text-[10px] font-bold mt-1 text-center block min-w-[48px] uppercase tracking-tight opacity-80">{t('subtitles')}</span>
          </button>

          {/* Quality Selector (Enterprise Feature) */}
          {useHlsStreaming && hlsHook && (
            <div className="relative flex flex-col items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQualityMenu(!showQualityMenu);
                }}
                className={`flex flex-col items-center gap-1 transition-all`}
              >
                <div className={`w-12 h-12 rounded-2xl glass-panel flex items-center justify-center shadow-2xl hover:bg-white/10 transition-all ${showQualityMenu ? 'ring-2 ring-[rgb(var(--primary-accent))] shadow-[0_0_15px_rgba(var(--primary-accent),0.4)]' : ''}`}>
                  <span className="text-white text-[10px] font-extrabold uppercase leading-none">{currentQuality}</span>
                </div>
                <span className="text-white text-[10px] font-bold mt-1 text-center block min-w-[48px] uppercase tracking-tight opacity-80">{t('quality') || 'Quality'}</span>
              </button>

              <AnimatePresence>
                {showQualityMenu && (
                  <motion.div
                    initial={{ opacity: 0, x: -10, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -10, scale: 0.9 }}
                    className="absolute left-14 bottom-0 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-2 w-32 z-50 shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleQualityChange(-1, 'Auto')}
                        className={`text-xs py-2 px-3 rounded-xl transition-all text-right font-bold ${currentQuality === 'Auto' ? 'bg-[rgb(var(--primary-accent))] text-white' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        Auto (تلقائي)
                      </button>
                      {hlsHook.getQualityLevels().map((level: any) => (
                        <button
                          key={level.index}
                          onClick={() => handleQualityChange(level.index, level.name)}
                          className={`text-xs py-2 px-3 rounded-xl transition-all text-right font-bold ${currentQuality === level.name ? 'bg-[rgb(var(--primary-accent))] text-white' : 'text-gray-300 hover:bg-white/10'}`}
                        >
                          {level.name}
                        </button>
                      )).reverse()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Like */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleLike}
              aria-label={isLiked ? t('unlike') || "إلغاء الإعجاب" : t('like') || "إعجاب"}
              className={`w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-105 ${isLiked ? 'bg-red-500 text-white' : 'bg-gray-800/90 text-white'}`}
            >
              {TikTokIcons.like}
            </button>
            <span className="text-white text-xs font-semibold mt-1 text-center block min-w-[48px]">{likeCount}</span>
          </div>

          {/* Comments */}
          <div className="flex flex-col items-center">
            <button
              onClick={toggleComments}
              aria-label={t('comments') || "التعليقات"}
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center transition-all bg-gray-800/90 text-white shadow-lg hover:scale-105"
            >
              {TikTokIcons.comment}
            </button>
            <span className="text-white text-xs font-semibold mt-1 text-center block min-w-[48px]">{commentCount}</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center relative">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              aria-label={t('share') || "مشاركة"}
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center transition-all bg-gray-800/90 text-white shadow-lg hover:scale-105"
            >
              {TikTokIcons.share}
            </button>
            <span className="text-white text-xs font-semibold mt-1 text-center block min-w-[48px]">{shareCount}</span>
          </div>

          {/* More/Report */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setShowReportMenu(!showReportMenu)}
              aria-label={t('more') || "المزيد"}
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center transition-all bg-gray-800/90 text-white shadow-lg hover:scale-105"
            >
              ...
            </button>
          </div>


        </div>
      </div>
    </div>
  );

  // ✅ العرض النهائي بناءً على نوع الجهاز
  return (
    <div
      className={`relative flex items-center justify-center w-full h-full ${isMobile ? 'bg-black' : 'bg-transparent'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`relative w-full h-full flex flex-col items-center ${isMobile ? '' : 'justify-center'}`}>
        {renderVideoContent()}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && selectedFile && (
          <UploadModal
            isOpen={showUploadModal}
            onClose={() => {
              setShowUploadModal(false);
              setSelectedFile(null);
            }}
            file={selectedFile}
            onUploadSuccess={() => {
              setShowUploadModal(false);
              setSelectedFile(null);
              // Optional: Refresh feed or show notification
              setUploadSuccess(true);
              setTimeout(() => {
                setUploadSuccess(false);
                navigate('/');
              }, 3000);
            }}
            isVideoOwner={video.user_id === user?.id}
            currentVideoId={video.id}
          />
        )}
      </AnimatePresence>

      {/* Share Menu */}
      <AnimatePresence>
        {showShareMenu && (
          <motion.div
            className={`absolute bg-gray-800/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl z-30 share-menu min-w-48 border border-white/10 ${isMobile ? 'left-16 bottom-64' : 'left-20 bottom-72'
              }`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-white font-semibold mb-3 text-center">مشاركة الفيديو</h3>
            <div className="space-y-2">
              <button
                onClick={shareVideo}
                className="w-full text-left px-4 py-3 text-white hover:bg-gray-700/50 rounded-lg flex items-center space-x-3 text-sm transition-all duration-200 active:scale-105"
              >
                <span className="text-xl">🔗</span>
                <span>نسخ الرابط</span>
              </button>
              <button
                onClick={() => shareOnSocialMedia('twitter')}
                className="w-full text-left px-4 py-3 text-white hover:bg-gray-700/50 rounded-lg flex items-center space-x-3 text-sm transition-all duration-200 active:scale-105"
              >
                <span className="text-xl">🐦</span>
                <span>تويتر</span>
              </button>
              <button
                onClick={() => shareOnSocialMedia('facebook')}
                className="w-full text-left px-4 py-3 text-white hover:bg-gray-700/50 rounded-lg flex items-center space-x-3 text-sm transition-all duration-200 active:scale-105"
              >
                <span className="text-xl">📘</span>
                <span>فيسبوك</span>
              </button>
              <button
                onClick={() => shareOnSocialMedia('whatsapp')}
                className="w-full text-left px-4 py-3 text-white hover:bg-gray-700/50 rounded-lg flex items-center space-x-3 text-sm transition-all duration-200 active:scale-105"
              >
                <span className="text-xl">💚</span>
                <span>واتساب</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Menu */}
      <AnimatePresence>
        {showReportMenu && (
          <motion.div
            className={`absolute bg-gray-800/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl z-30 report-menu w-56 border border-white/10 ${isMobile ? 'left-16 bottom-64' : 'left-20 bottom-72'
              }`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-white font-semibold mb-3 text-center">الإبلاغ عن الفيديو</h3>
            <div className="space-y-1">
              {[
                { id: 'spam', label: 'بريد مزعج' },
                { id: 'harassment', label: 'مضايقة' },
                { id: 'inappropriate', label: 'محتوى غير لائق' },
                { id: 'copyright', label: 'حقوق النشر' },
                { id: 'other', label: 'أخرى' }
              ].map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => reportVideo(reason.id)}
                  disabled={isReporting}
                  className="w-full text-left px-4 py-2 text-white hover:bg-gray-700/50 rounded-lg text-sm transition-all duration-200 active:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isReporting ? 'جاري الإبلاغ...' : reason.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Box */}
      <CommentsBox
        videoId={video.id}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        onCommentAdded={handleNewComment}
        onCommentDeleted={handleDeleteComment}
      />

      {/* Chat Box */}
      <AnimatePresence>
        {showChat && isActive && (
          <motion.div
            className={`absolute top-0 right-0 bottom-0 z-30 ${isMobile ? 'w-full' : 'w-80'
              }`}
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ duration: 0.3 }}
          >
            <div className={`h-full bg-black border-l border-gray-700 ${isMobile ? 'rounded-none' : 'rounded-r-2xl'
              }`}>
              <ChatBox
                videoId={video.id}
                videoOwnerId={video.user_id}
                isVideoOwner={video.user_id === user?.id}
                onClose={() => setShowChat(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Notification */}
      <AnimatePresence>
        {reportSuccess && (
          <motion.div
            className={`absolute bg-green-500 text-white px-4 py-2 rounded-lg shadow-2xl z-40 border border-green-400 ${isMobile ? 'top-20 left-4' : 'top-8 left-8'
              }`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center space-x-2">
              <span>{TikTokIcons.check}</span>
              <span>تم الإبلاغ عن الفيديو بنجاح!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Success Notification */}
      <AnimatePresence>
        {uploadSuccess && (
          <motion.div
            className={`absolute bg-purple-600 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 border border-purple-400 flex flex-col items-center ${isMobile ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%]' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-[300px]'}`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl animate-bounce">
                ✅
              </div>
              <div>
                <h3 className="text-xl font-bold">{t('uploadSuccessTitle')}</h3>
                <p className="text-sm opacity-90 mt-1">{t('uploadSuccess')}</p>
              </div>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-2">
                <motion.div
                  className="bg-white h-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, ease: "linear" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoCard;
