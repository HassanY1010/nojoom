import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

interface FollowingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
}

const FollowingModal: React.FC<FollowingModalProps> = ({ isOpen, onClose, userId }) => {
  const { t } = useTranslation();
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // دالة مساعدة للحصول على رابط الصورة الكامل


  useEffect(() => {
    if (isOpen) {
      fetchFollowing();
    }
  }, [isOpen, userId]);

  const fetchFollowing = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/users/${userId}/following`);
      setFollowing(response.data.following || []);
    } catch (error: any) {
      console.error('Failed to fetch following:', error);
      setError(error.response?.data?.error || t('failedLoadFollowing'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (targetUserId: number) => {
    try {
      setActionLoading(targetUserId);
      await api.delete(`/users/follow/${targetUserId}`);
      setFollowing(prev => prev.filter(user => user.id !== targetUserId));
    } catch (error) {
      console.error('Unfollow action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // تصفية المتابَعين بناءً على البحث
  const filteredFollowing = following.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.bio && user.bio.toLowerCase().includes(searchQuery.toLowerCase()))
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

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredFollowing.map(user => (
            <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/30 hover:border-purple-500/30 transition-all duration-200">
              <span className="text-gray-900 dark:text-white font-bold text-sm sm:text-base">@{user.username}</span>
              {user.bio && <span className="text-gray-500 dark:text-gray-400 text-xs font-medium truncate ml-2 max-w-[150px]">{user.bio}</span>}
            </div>
          ))}
        </div>

        {/* Footer Stats */}
        {!loading && !error && following.length > 0 && (
          <div className="p-3 sm:p-4 mt-4 border-t border-gray-100 dark:border-gray-700/30 bg-gray-50/50 dark:bg-black/30 rounded-b-xl transition-colors">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>{t('showingXofY', { current: filteredFollowing.length, total: following.length })}</span>
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

export default FollowingModal;
