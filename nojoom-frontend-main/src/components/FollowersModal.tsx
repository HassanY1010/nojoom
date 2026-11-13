import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

interface User {
  id: number;
  username: string;
  avatar: string;
  bio: string;
  created_at: string;
  is_following?: boolean;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
}

// دالة لتنسيق التاريخ (يمكنك تعديلها حسب حاجتك)
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
};

const FollowersModal: React.FC<FollowersModalProps> = ({ isOpen, onClose, userId }) => {
  const { t } = useTranslation();
  const [followers, setFollowers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // دالة مساعدة للحصول على رابط الصورة الكامل


  // جلب المتابعين عند فتح المودال أو تغيير userId
  useEffect(() => {
    if (isOpen) fetchFollowers();
  }, [isOpen, userId]);

  const fetchFollowers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/users/${userId}/followers`);
      setFollowers(response.data.followers || []);
    } catch (err: any) {
      console.error('Failed to fetch followers:', err);
      setError(err.response?.data?.error || t('failedLoadFollowers'));
    } finally {
      setLoading(false);
    }
  };

  const handleFollowAction = async (targetUserId: number, isCurrentlyFollowing: boolean) => {
    try {
      setActionLoading(targetUserId);

      if (isCurrentlyFollowing) {
        await api.delete(`/users/follow/${targetUserId}`);
        // إزالة المستخدم من القائمة بعد إزالة المتابعة
        setFollowers(prev => prev.filter(user => user.id !== targetUserId));
      } else {
        await api.post(`/users/follow/${targetUserId}`);
        setFollowers(prev => prev.map(user =>
          user.id === targetUserId ? { ...user, is_following: true } : user
        ));
      }
    } catch (err) {
      console.error('Follow action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // تصفية المتابعين بناءً على البحث
  const filteredFollowers = followers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.bio && user.bio.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-white/60 dark:bg-black/80 backdrop-blur-sm transition-colors duration-300">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-black rounded-xl w-full max-w-md p-4 sm:p-6 relative border border-gray-100 dark:border-gray-700 shadow-2xl transition-colors"
          >
            {/* زر الإغلاق */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-500 dark:text-white text-xl font-bold hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
            >
              ×
            </button>

            {/* حقل البحث */}
            <input
              type="text"
              placeholder={t('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg mb-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-inner"
            />

            {/* قائمة المتابعين */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading && <p className="text-gray-400 text-center">{t('loading')}</p>}
              {error && <p className="text-red-500 text-center">{error}</p>}
              {!loading && !error && filteredFollowers.length === 0 && (
                <p className="text-gray-400 text-center">{t('noFollowersFound')}</p>
              )}

              {filteredFollowers.map(user => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/30 hover:border-purple-500/30 dark:hover:border-white/20 transition-all duration-200 shadow-sm"
                >
                  <div className="flex items-center space-x-3 space-x-reverse flex-1 min-w-0">
                    <img
                      src={user.avatar || '/default-avatar.png'}
                      alt={user.username}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 shadow-sm transition-colors"
                      onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }}
                    />
                    <div className="flex-1 min-w-0 transition-colors">
                      <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">@{user.username}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate font-medium">{user.bio || t('noDescription')}</p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 font-medium">{t('followedSince')} {formatDate(user.created_at)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleFollowAction(user.id, true)}
                    disabled={actionLoading === user.id}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-red-700 transition-all duration-200 flex items-center justify-center space-x-1 min-w-16 shadow-md shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading === user.id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>🗑️</span>
                        <span className="hidden xs:inline">{t('removeFollower')}</span>
                      </>
                    )}
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Footer Stats */}
            {!loading && !error && followers.length > 0 && (
              <div className="p-3 sm:p-4 mt-4 border-t border-gray-100 dark:border-gray-700/30 bg-gray-50/50 dark:bg-black/30 rounded-b-xl transition-colors">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{t('showingXofY', { current: filteredFollowers.length, total: followers.length })}</span>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {t('clearSearch')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FollowersModal;
