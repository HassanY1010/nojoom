import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

interface User {
  id: number;
  username: string;
  avatar: string;
  created_at: string;
  is_following?: boolean;
}

interface LikesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
}

const LikesModal: React.FC<LikesModalProps> = ({ isOpen, onClose, userId }) => {
  const { t } = useTranslation();
  const [likes, setLikes] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // دالة مساعدة للحصول على رابط الصورة الكامل


  // دالة لتنسيق التاريخ
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (isOpen) {
      fetchLikes();
    }
  }, [isOpen, userId]);

  const fetchLikes = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/users/${userId}/likes`);
      setLikes(response.data.likes || []);
    } catch (error: any) {
      console.error('Failed to fetch likes:', error);
      setError(error.response?.data?.error || t('failedLoadLikes'));
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId: number, isFollowing: boolean) => {
    try {
      if (isFollowing) {
        await api.delete(`/users/follow/${targetUserId}`);
      } else {
        await api.post(`/users/follow/${targetUserId}`);
      }

      // تحديث حالة المتابعة محلياً
      setLikes(prev =>
        prev.map(user =>
          user.id === targetUserId ? { ...user, is_following: !isFollowing } : user
        )
      );
    } catch (error) {
      console.error('Follow action failed:', error);
    }
  };

  // تصفية المستخدمين بناءً على البحث
  const filteredLikes = likes.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-white/60 dark:bg-black/80 backdrop-blur-sm transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-black rounded-xl w-full max-w-md p-4 sm:p-6 relative border border-gray-100 dark:border-gray-700 shadow-2xl transition-colors"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 dark:text-white text-xl font-bold hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
        >
          ×
        </button>

        {/* قائمة الإعجابات */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLikes.map(user => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/30 hover:border-purple-500/30 dark:hover:border-white/20 transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center space-x-3 space-x-reverse flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <img
                    src={user.avatar || '/default-avatar.png'}
                    alt={user.username}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 shadow-sm transition-colors"
                    onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }}
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center shadow-sm">
                    <span className="text-[10px] text-white">❤️</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 transition-colors">
                  <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                    @{user.username}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 font-medium">
                    {t('likedSince')} {formatDate(user.created_at)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleFollow(user.id, user.is_following || false)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 flex-shrink-0 shadow-md ${user.is_following
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 shadow-none'
                  : 'bg-purple-600 dark:bg-white text-white dark:text-black hover:bg-purple-700 dark:hover:bg-gray-100 shadow-purple-500/20 dark:shadow-none'
                  }`}
              >
                {user.is_following ? t('following') : t('follow')}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Footer Stats */}
        {!loading && !error && likes.length > 0 && (
          <div className="p-3 sm:p-4 mt-4 border-t border-gray-100 dark:border-gray-700/30 bg-gray-50/50 dark:bg-black/30 rounded-b-xl transition-colors">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>{t('showingXofY', { current: filteredLikes.length, total: likes.length })}</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors font-bold"
                >
                  {t('clearSearch')}
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default LikesModal;
