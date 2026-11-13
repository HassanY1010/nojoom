import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { userApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { getMediaUrl } from '../utils/urlUtils';
import { formatNumber } from '../utils/numberUtils';

interface UserCardProps {
  user: User;
  onFollowChange: (userId: number, isFollowing: boolean) => void;
  compact?: boolean;      // ✅ أضف
  tiktokStyle?: boolean;  // ✅ أضف
}



const UserCard: React.FC<UserCardProps> = ({ user, onFollowChange, compact, tiktokStyle }) => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(user.is_following || false);
  const [isLoading, setIsLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(user.followers_count);



  // دالة للتعامل مع النقر على البروفايل
  const handleProfileClick = () => {
    if (!currentUser) {
      // إذا لم يكن المستخدم مسجل دخول، توجيهه لصفحة التسجيل
      navigate('/signup');
    } else {
      // إذا كان مسجل دخول، الانتقال للبروفايل
      navigate(`/profile/${user.username}`);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) {
      alert(t('loginToFollow'));
      return;
    }

    if (currentUser.id === user.id) {
      return; // لا يمكن متابعة نفسك
    }

    setIsLoading(true);
    try {
      if (isFollowing) {
        await userApi.unfollowUser(user.id);
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
        onFollowChange(user.id, false);
      } else {
        await userApi.followUser(user.id);
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        onFollowChange(user.id, true);
      }
    } catch (error: any) {
      console.error('Follow action failed:', error);
      if (error.response?.status === 401) {
        alert(t('loginToFollow'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (compact || tiktokStyle) {
    return (
      <div className="flex flex-col items-center text-center p-5 h-full relative group">
        <div onClick={handleProfileClick} className="cursor-pointer relative mb-4">
          <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-[rgb(var(--primary-accent))] to-white/20 shadow-[0_0_15px_rgba(var(--primary-accent),0.2)]">
            <img
              src={getMediaUrl(user.avatar, { width: 140, height: 140, crop: 'fill' })}
              alt={user.username}
              className="w-full h-full rounded-full object-cover border-2 border-black"
              onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }}
            />
          </div>
          {isFollowing && (
            <div className="absolute -bottom-1 -right-1 bg-[rgb(var(--primary-accent))] rounded-full p-1 border-2 border-black shadow-lg">
              <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
              </svg>
            </div>
          )}
        </div>

        <div onClick={handleProfileClick} className="cursor-pointer flex flex-col items-center w-full mb-4">
          <h3 className="text-white font-extrabold text-base tracking-tight w-full hover:text-[rgb(var(--primary-accent))] transition-colors duration-300 uppercase">
            {user.username}
          </h3>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest opacity-80">@{user.username}</p>
        </div>

        {user.bio && (
          <p className="text-gray-400 text-xs line-clamp-2 mb-4 h-8 px-2">
            {user.bio}
          </p>
        )}

        <div className="flex items-center gap-6 mb-6 text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">
          <div className="flex flex-col items-center">
            <span className="text-white text-sm font-bold">{formatNumber(followersCount)}</span>
            <span>{t('followers')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-white text-sm font-bold">{formatNumber(user.following_count)}</span>
            <span>{t('following')}</span>
          </div>
        </div>

        {currentUser?.id !== user.id && (
          <button
            onClick={handleFollow}
            disabled={isLoading}
            className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.15em] transition-all duration-500 shadow-xl ${isFollowing
              ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
              : 'bg-[rgb(var(--primary-accent))] text-black shadow-[0_8px_20px_rgba(var(--primary-accent),0.3)] active-glow'
              } disabled:opacity-50 transform active:scale-95`}
          >
            {isLoading ? '...' : isFollowing ? t('unfollow') : t('follow')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] rounded-xl p-4 flex items-center justify-between border border-gray-800 hover:border-gray-700 transition-all shadow-md group">
      <div className="flex items-center space-x-3 rtl:space-x-reverse">
        <div onClick={handleProfileClick} className="cursor-pointer">
          <div className="w-12 h-12 rounded-full p-0.5 bg-gray-700 group-hover:bg-red-500 transition-colors">
            <img
              src={getMediaUrl(user.avatar, { width: 100, height: 100, crop: 'fill' })}
              alt={user.username}
              className="w-full h-full rounded-full object-cover border-2 border-[#0a0a0a]"
              onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div onClick={handleProfileClick} className="cursor-pointer">
            <h3 className="text-white font-bold truncate group-hover:text-red-500 transition-colors text-sm">
              @{user.username}
            </h3>
          </div>

          <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 font-bold">
            <span className="text-gray-300">{formatNumber(followersCount)}</span>
            <span>{t('followers')}</span>
          </div>
        </div>
      </div>

      {currentUser?.id !== user.id && (
        <button
          onClick={handleFollow}
          disabled={isLoading}
          className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-500 ${isFollowing
            ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
            : 'bg-[rgb(var(--primary-accent))] text-black shadow-lg active-glow'
            } disabled:opacity-50 transform active:scale-95`}
        >
          {isLoading ? '...' : isFollowing ? t('unfollow') : t('follow')}
        </button>
      )}
    </div>
  );
};

export default UserCard;
