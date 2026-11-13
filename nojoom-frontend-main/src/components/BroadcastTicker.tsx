import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { socketService } from '../services/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface BroadcastMessage {
  id: number;
  content: string;
  type: 'admin';
  created_at: string;
  username?: string;
  display_count?: number;
  timestamp?: number;
}

const BroadcastTicker: React.FC = () => {
  const { t } = useTranslation();
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [currentBroadcast, setCurrentBroadcast] = useState<BroadcastMessage | null>(null);
  const [visible, setVisible] = useState(false);
  const [displayCount, setDisplayCount] = useState(0);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const socket = socketService.connect();

    if (socket) {
      // استقبال رسائل البث المباشر من الأدمن
      socket.on('broadcast_message', (message: BroadcastMessage) => {
        console.log('📢 Received broadcast message:', message.content);
        setBroadcasts(prev => [...prev, {
          ...message,
          display_count: 0,
          timestamp: Date.now()
        }]);
      });

      // تنظيف عند فك التركيب
      return () => {
        socket.off('broadcast_message');
      };
    }
  }, []);

  useEffect(() => {
    if (broadcasts.length > 0 && !currentBroadcast && !visible) {
      showNextBroadcast();
    }
  }, [broadcasts, currentBroadcast, visible]);

  const showNextBroadcast = () => {
    if (broadcasts.length === 0) {
      setCurrentBroadcast(null);
      setVisible(false);
      setDisplayCount(0);
      setProgress(100);
      return;
    }

    const next = broadcasts[0];
    setCurrentBroadcast(next);
    setVisible(true);
    setDisplayCount(prev => prev + 1);
    setProgress(100);

    console.log(`🔄 Displaying broadcast ${displayCount + 1}/4:`, next.content);

    // شريط التقدم المتحرك
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          clearInterval(progressInterval);
          return 0;
        }
        return prev - (100 / 80); // 4 ثواني = 80 * 50ms
      });
    }, 50);

    // إخفاء الرسالة بعد 4 ثواني
    const hideTimer = setTimeout(() => {
      setVisible(false);
      clearInterval(progressInterval);

      // تأخير بسيط قبل معالجة الرسالة التالية
      setTimeout(() => {
        processCurrentBroadcast();
      }, 300);
    }, 4000);

    return () => {
      clearTimeout(hideTimer);
      clearInterval(progressInterval);
    };
  };

  const processCurrentBroadcast = () => {
    if (!currentBroadcast) return;

    setBroadcasts(prev => {
      const updatedBroadcasts = [...prev];
      const current = updatedBroadcasts[0];

      if (current && current.display_count !== undefined) {
        const newDisplayCount = current.display_count + 1;

        if (newDisplayCount >= 4) {
          // حذف الرسالة بعد ظهورها 4 مرات
          console.log(`🗑️ Removing broadcast after 4 displays:`, current.content);
          updatedBroadcasts.shift();
        } else {
          // زيادة عداد الظهور وإعادتها للنهاية للعرض العشوائي
          current.display_count = newDisplayCount;
          updatedBroadcasts.shift();

          // إدخال الرسالة في موضع عشوائي للنهاية
          const randomPosition = Math.floor(Math.random() * (updatedBroadcasts.length + 1));
          updatedBroadcasts.splice(randomPosition, 0, current);

          console.log(`🔄 Re-queuing broadcast (${newDisplayCount}/4) at position ${randomPosition}:`, current.content);
        }
      } else {
        // إذا لم يكن هناك عداد، إزالة الرسالة
        updatedBroadcasts.shift();
      }

      return updatedBroadcasts;
    });

    setCurrentBroadcast(null);
    setProgress(100);
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      processCurrentBroadcast();
    }, 300);
  };

  // تنظيف الرسائل القديمة تلقائياً (أقدم من 5 دقائق)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setBroadcasts(prev =>
        prev.filter(broadcast =>
          broadcast.timestamp && (now - broadcast.timestamp) < 5 * 60 * 1000
        )
      );
    }, 60000); // كل دقيقة

    return () => clearInterval(cleanupInterval);
  }, []);

  if (!currentBroadcast || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -100, scale: 0.9 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed top-4 left-3 right-3 sm:left-4 sm:right-4 md:left-8 md:right-8 lg:left-16 lg:right-16 xl:left-32 xl:right-32 z-50"
      >
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm relative overflow-hidden">
          {/* نمط خلفية متحرك */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 animate-pulse"></div>

          <div className="relative flex items-start sm:items-center justify-between">
            <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              {/* أيقونة البث */}
              <div className="flex-shrink-0 bg-yellow-400 rounded-full p-1.5 sm:p-2 animate-bounce mt-0.5 sm:mt-0">
                <span className="text-black text-xs sm:text-sm font-bold block">📢</span>
              </div>

              {/* محتوى الرسالة */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col xs:flex-row xs:items-center xs:space-x-2 space-y-1 xs:space-y-0 mb-1.5 sm:mb-2 text-right">
                  <p className="font-bold text-xs sm:text-sm text-white whitespace-nowrap">
                    {t('broadcastImportant')}
                  </p>
                  <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
                    {currentBroadcast.username && (
                      <span className="text-xs bg-white/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                        {t('broadcastFrom')} {currentBroadcast.username}
                      </span>
                    )}
                    <span className="text-xs bg-black/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                      {displayCount}/4
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm opacity-90 break-words leading-relaxed sm:leading-normal text-right">
                  {currentBroadcast.content}
                </p>
              </div>
            </div>

            {/* زر الإغلاق */}
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-white hover:text-gray-200 text-base sm:text-lg transition-colors ml-2 sm:ml-4 bg-black/30 rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-black/40 active:scale-95 mt-0.5 sm:mt-0"
              aria-label={t('broadcastClose')}
            >
              ✕
            </button>
          </div>

          {/* شريط التقدم المتحرك */}
          <div className="w-full bg-white/20 rounded-full h-1 sm:h-1.5 mt-2 sm:mt-3 relative overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-yellow-400 to-amber-400 h-full rounded-full shadow-lg"
              initial={{ width: "100%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.05 }}
            />

            {/* تأثير توهج */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
          </div>

          {/* تأثيرات زخرفية */}
          <div className="absolute top-0 left-0 w-1 h-full bg-white/30 animate-pulse"></div>
          <div className="absolute top-0 right-0 w-1 h-full bg-white/30 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
        </div>

        {/* تأثير الظل الخلفي */}
        <div className="absolute inset-0 bg-blue-500/10 rounded-xl sm:rounded-2xl blur-xl -z-10 transform scale-105"></div>

        {/* تأثيرات إضافية للخلفية */}
        <div className="absolute -inset-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-2xl -z-20 animate-pulse"></div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BroadcastTicker;