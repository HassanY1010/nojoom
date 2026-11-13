import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { socketService } from '../services/socket';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

interface BroadcastMessage {
  id: number;
  content: string;
  type: 'admin';
  created_at: string;
  username?: string;
  display_count?: number;
  timestamp?: number;
}

interface FloatingChatBarProps {
  onOpenChat: () => void;
  isVideoOwner?: boolean;
  hasUploadedBefore?: boolean;
  currentVideoId?: number;
  onOpenUpload?: () => void;
  video?: {
    created_at: string;
  };
}

const FloatingChatBar: React.FC<FloatingChatBarProps> = ({
  onOpenChat,
  isVideoOwner = false,
  hasUploadedBefore = false,
  currentVideoId,
  onOpenUpload,
  video
}) => {
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [currentBroadcast, setCurrentBroadcast] = useState<BroadcastMessage | null>(null);
  const [showButtons, setShowButtons] = useState(true);
  const [displayCount, setDisplayCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // التحقق من انتهاء صلاحية الشات (3 ساعات)
  const isChatExpired = () => {
    if (!video?.created_at) return false;
    const createdTime = new Date(video.created_at).getTime();
    const now = Date.now();
    const threeHoursInMs = 3 * 60 * 60 * 1000;
    return (now - createdTime) > threeHoursInMs;
  };

  const chatExpired = isChatExpired();

  useEffect(() => {
    const socket = socketService.getSocket();

    if (socket) {
      socket.on('broadcast_message', (message: BroadcastMessage) => {
        console.log('📢 FloatingChatBar received broadcast:', message.content);
        setBroadcasts(prev => [...prev, {
          ...message,
          display_count: 0,
          timestamp: Date.now()
        }]);
      });

      return () => {
        socket.off('broadcast_message');
      };
    }
  }, []);

  useEffect(() => {
    if (broadcasts.length > 0 && !currentBroadcast) {
      showNextBroadcast();
    }
  }, [broadcasts, currentBroadcast]);

  const showNextBroadcast = () => {
    if (broadcasts.length === 0) {
      setCurrentBroadcast(null);
      setIsVisible(false);
      return;
    }

    const next = broadcasts[0];
    setCurrentBroadcast(next);
    setIsVisible(true);
    setDisplayCount(prev => prev + 1);

    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        processCurrentBroadcast();
      }, 500);
    }, 5000);

    return () => clearTimeout(hideTimer);
  };

  const processCurrentBroadcast = () => {
    if (!currentBroadcast) return;

    setBroadcasts(prev => {
      const updatedBroadcasts = [...prev];
      const current = updatedBroadcasts[0];

      if (current && current.display_count !== undefined) {
        const newDisplayCount = current.display_count + 1;

        if (newDisplayCount >= 4) {
          updatedBroadcasts.shift();
        } else {
          current.display_count = newDisplayCount;
          updatedBroadcasts.shift();
          const randomPosition = Math.floor(Math.random() * (updatedBroadcasts.length + 1));
          updatedBroadcasts.splice(randomPosition, 0, current);
        }
      } else {
        updatedBroadcasts.shift();
      }

      return updatedBroadcasts;
    });

    setCurrentBroadcast(null);
  };

  const toggleButtons = () => {
    setShowButtons(!showButtons);
  };

  const handleCloseBroadcast = () => {
    setIsVisible(false);
    setTimeout(() => {
      processCurrentBroadcast();
    }, 300);
  };

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setBroadcasts(prev =>
        prev.filter(broadcast =>
          broadcast.timestamp && (now - broadcast.timestamp) < 5 * 60 * 1000
        )
      );
    }, 60000);

    return () => clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    if (showButtons) {
      const autoHideTimer = setTimeout(() => {
        setShowButtons(false);
      }, 10000);

      return () => clearTimeout(autoHideTimer);
    }
  }, [showButtons]);

  return (
    <>
      {/* رسالة انتهاء صلاحية الشات */}
      {chatExpired && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-gradient-to-r from-red-500/90 to-orange-500/90 backdrop-blur-md text-white p-4 rounded-xl shadow-lg border border-white/20 max-w-xs">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <span className="text-2xl">⏰</span>
              <div>
                <p className="font-bold text-sm">انتهى الشات</p>
                <p className="text-xs opacity-90">مضى أكثر من 3 ساعات على هذا الفيديو</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* زر الدردشة العائم وأزرار الناشر */}
      {!chatExpired && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-3">
          {showButtons && (
            <div className="flex flex-col space-y-3 animate-slide-up">

              {/* أزرار الناشر (تظهر فقط لصاحب الفيديو) */}
              {isVideoOwner && (
                <button
                  onClick={onOpenUpload} // يفترض أن يتم تمرير دالة لفتح مودال الرفع/التعديل
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white w-12 h-12 rounded-full shadow-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 flex items-center justify-center text-xl transform hover:scale-110 border border-white/20 backdrop-blur-sm"
                  aria-label={hasUploadedBefore ? t('changeVideo') : t('addVideo')}
                  title={hasUploadedBefore ? t('changeVideo') : t('addVideo')}
                >
                  <span className="animate-pulse">{hasUploadedBefore ? '🔄' : '➕'}</span>
                </button>
              )}

              {/* زر فتح الدردشة */}
              <button
                onClick={onOpenChat}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white w-12 h-12 rounded-full shadow-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center text-xl transform hover:scale-110 border border-white/20 backdrop-blur-sm"
                aria-label={t('chat')}
              >
                <span className="animate-bounce">💬</span>
              </button>
            </div>
          )}

          {/* زر التبديل الرئيسي */}
          <button
            onClick={toggleButtons}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white w-12 h-12 rounded-full shadow-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 flex items-center justify-center text-xl font-bold transform hover:scale-110 border border-white/20 backdrop-blur-sm animate-pulse"
            aria-label={showButtons ? "Hide buttons" : "Show buttons"}
          >
            {showButtons ? '−' : '+'}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
          </button>
        </div>
      )}


      {/* رسائل الجمهور (شريطين ثابتين) */}
      {!chatExpired && currentBroadcast && isVisible && (
        <div className="fixed top-24 left-4 right-4 z-40 animate-fade-in pointer-events-none">
          {/* الشريط الأول */}
          <div className="bg-black/40 backdrop-blur-md text-white p-3 rounded-xl shadow-lg border border-white/10 mb-2 max-w-sm mx-auto transform transition-all hover:scale-105">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="bg-gradient-to-tr from-blue-400 to-blue-600 rounded-full p-1.5 shadow-inner">
                <span className="text-white text-xs font-bold">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 rtl:space-x-reverse mb-0.5">
                  <span className="font-bold text-sm text-blue-300 truncate">
                    {currentBroadcast.username || 'مستخدم'}
                  </span>
                </div>
                <p className="text-sm text-white/90 break-words leading-snug">
                  {currentBroadcast.content}
                </p>
              </div>
            </div>
          </div>

          {/* يمكن إضافة شريط ثاني هنا إذا توفرت رسالة أخرى في الطابور */}
        </div>
      )}
    </>
  );
};

export default FloatingChatBar;

