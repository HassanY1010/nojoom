import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import EditProfileModal from '../components/EditProfileModal';
import FollowersModal from '../components/FollowersModal';
import FollowingModal from '../components/FollowingModal';
import LikesModal from '../components/LikesModal';
import SettingsModal from '../components/SettingsModal';
import { getMediaUrl } from '../utils/urlUtils';
import { ProfileHeaderSkeleton, ProfileTabsSkeleton } from '../components/ProfileSkeletons';
import { CardSkeleton } from '../components/Skeletons';

interface User {
  id: number;
  username: string;
  email: string;
  avatar: string;
  bio: string;
  followers_count: number;
  following_count: number;
  likes_count: number;
  views_count: number;
  social_links: string;
  country: string;
  created_at: string;
  active_live_id?: number;
  points?: number;
}

interface Video {
  id: number;
  user_id: number;
  path: string;
  thumbnail: string;
  description: string;
  views: number;
  likes: number;
  created_at: string;
  is_liked?: boolean;
  comment_count?: number;
}

interface SocialLinks {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
}

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguageStore();
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'likes'>('videos');
  const [loading, setLoading] = useState(true);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [error, setError] = useState<string>('');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
  const [isFollowingModalOpen, setIsFollowingModalOpen] = useState(false);
  const [isLikesModalOpen, setIsLikesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [showReportMenu, setShowReportMenu] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const isOwnProfile = useMemo(() => currentUser?.id === profileUser?.id, [currentUser?.id, profileUser?.id]);

  const fetchProfileData = useCallback(async () => {
    if (!username) return;
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/users/profile/${username}`);

      setProfileUser(response.data.user);
      setVideos(response.data.videos || []);
      setIsFollowing(response.data.isFollowing || false);

      if (response.data.user.social_links) {
        try {
          const links = typeof response.data.user.social_links === 'string'
            ? JSON.parse(response.data.user.social_links)
            : response.data.user.social_links;
          setSocialLinks(links || {});
        } catch (e) {
          setSocialLinks({});
        }
      }

      if (currentUser?.id === response.data.user.id) {
        const likedResponse = await api.get('/videos/user/liked');
        setLikedVideos(likedResponse.data.videos || []);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || t('failedLoadProfile'));
    } finally {
      setLoading(false);
    }
  }, [username, currentUser?.id, t]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const handleFollow = async () => {
    if (!profileUser) return;
    try {
      if (isFollowing) {
        await api.delete(`/users/follow/${profileUser.id}`);
      } else {
        await api.post(`/users/follow/${profileUser.id}`);
      }
      setIsFollowing(!isFollowing);
      setProfileUser(prev => prev ? {
        ...prev,
        followers_count: isFollowing ? prev.followers_count - 1 : prev.followers_count + 1
      } : null);
    } catch (error: any) {
      setError(error.response?.data?.error || t('followActionFailed'));
    }
  };

  const handleVideoClick = (videoId: number) => {
    navigate(`/video/${videoId}`);
  };

  const handleProfileUpdate = (updatedUser: any) => {
    setProfileUser(updatedUser);
    fetchProfileData();
  };

  const formatNumber = (num?: number): string => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const reportReasons = [
    { id: 'spam', label: t('reportSpam') },
    { id: 'harassment', label: t('reportHarassment') },
    { id: 'inappropriate', label: t('reportInappropriate') },
    { id: 'copyright', label: t('reportCopyright') },
    { id: 'other', label: t('reportOther') }
  ];

  const reportUser = async (reasonId: string) => {
    if (!currentUser) return;
    if (!profileUser) return;
    setIsReporting(true);
    try {
      await api.post(`/reports/user/${profileUser.id}`, {
        reason: reasonId,
        description: t('userReportDescription', { username: profileUser.username })
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportMenu(false);
      }, 2000);
    } catch (error: any) {
      alert(error.response?.data?.error || t('reportFailed'));
    } finally {
      setIsReporting(false);
    }
  };

  if (loading && !profileUser) {
    return (
      <div className="min-h-screen bg-black pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <ProfileHeaderSkeleton />
          <ProfileTabsSkeleton />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error && !profileUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-white text-2xl font-bold mb-4">{t('errorLoadingProfile')}</h2>
          <p className="text-gray-400 mb-8">{error}</p>
          <div className="flex gap-4 justify-center">
            <button onClick={fetchProfileData} className="px-8 py-3 bg-white text-black font-black rounded-full hover:bg-gray-200 transition-all active:scale-95">
              {t('tryAgain')}
            </button>
            <Link to="/" className="px-8 py-3 bg-gray-900 text-white font-black rounded-full border border-gray-800 hover:bg-gray-800 transition-all active:scale-95">
              {t('goHome')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!profileUser) return null;

  const displayVideos = activeTab === 'videos' ? videos : (isOwnProfile ? likedVideos : []);

  return (
    <div className="min-h-screen bg-[#000000] text-white pt-20 pb-10 transition-colors duration-300">
      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onUpdate={handleProfileUpdate} currentUser={profileUser} />
      <FollowersModal isOpen={isFollowersModalOpen} onClose={() => setIsFollowersModalOpen(false)} userId={profileUser.id} />
      <FollowingModal isOpen={isFollowingModalOpen} onClose={() => setIsFollowingModalOpen(false)} userId={profileUser.id} />
      <LikesModal isOpen={isLikesModalOpen} onClose={() => setIsLikesModalOpen(false)} userId={profileUser.id} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} userId={profileUser.id} />

      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Profile Header Card */}
        <div className="glass-panel rounded-3xl p-8 md:p-12 shadow-2xl mb-12 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[rgb(var(--primary-accent))]/5 blur-[120px] pointer-events-none"></div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
            {/* Avatar Section */}
            <div className="relative">
              <div className="p-1.5 bg-gradient-to-tr from-[rgb(var(--primary-accent))] to-white/20 rounded-full shadow-2xl">
                <img
                  src={getMediaUrl(profileUser.avatar, { width: 200, height: 200, crop: 'fill' })}
                  alt={profileUser.username}
                  className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-4 border-black/50"
                  onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }}
                />
              </div>
              {profileUser.active_live_id && (
                <Link
                  to={`/live/${profileUser.active_live_id}`}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-3 py-1 rounded-full font-extrabold animate-pulse shadow-lg whitespace-nowrap"
                >
                  {t('liveBadge')}
                </Link>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-1 w-full text-center md:text-left rtl:md:text-right">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold mb-2 tracking-tight">@{profileUser.username}</h1>
                  <p className="text-gray-400 text-sm md:text-base font-medium max-w-2xl leading-relaxed">
                    {profileUser.bio || t('noBioYet')}
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  {isOwnProfile ? (
                    <>
                      <button onClick={() => setIsEditModalOpen(true)} className="flex items-center gap-2 px-8 py-3 bg-white text-black rounded-xl font-bold hover:brightness-90 transition-all text-sm shadow-xl active:scale-95">
                        <span className="text-lg">✏️</span> {t('editProfile')}
                      </button>
                      <button onClick={() => setIsSettingsModalOpen(true)} className="p-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all border border-white/10 active:scale-95" title={t('settings')}>
                        ⚙️
                      </button>
                      <Link to="/upload" className="flex items-center gap-2 px-8 py-3 bg-[rgb(var(--primary-accent))] text-black rounded-xl font-bold hover:brightness-110 transition-all text-sm shadow-[0_10px_25px_rgba(var(--primary-accent),0.3)] active:scale-95">
                        <span className="text-lg">📹</span> {t('upload')}
                      </Link>
                    </>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleFollow}
                        className={`px-12 py-3 rounded-xl font-bold transition-all text-base shadow-2xl active:scale-95 ${isFollowing
                          ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                          : 'bg-[rgb(var(--primary-accent))] text-black hover:brightness-110'
                          }`}
                      >
                        {isFollowing ? t('following') : t('follow')}
                      </button>
                      <div className="relative">
                        <button onClick={() => setShowReportMenu(!showReportMenu)} className="p-3 bg-gray-800 text-gray-400 rounded-full hover:text-red-500 transition-all border border-gray-700 active:scale-95">
                          🚩
                        </button>
                        <AnimatePresence>
                          {showReportMenu && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 10 }}
                              className="absolute top-14 right-0 w-56 bg-[#1e1e1e] border border-gray-800 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden"
                            >
                              <div className="px-4 py-2 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-800 mb-2">
                                {t('reportUser')}
                              </div>
                              {reportReasons.map(reason => (
                                <button
                                  key={reason.id}
                                  onClick={() => reportUser(reason.id)}
                                  disabled={isReporting}
                                  className="w-full text-left rtl:text-right px-4 py-2.5 text-sm font-bold text-gray-300 hover:bg-[rgb(var(--primary-accent))] hover:text-black rounded-xl transition-all disabled:opacity-50"
                                >
                                  {reason.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="flex flex-wrap justify-center md:justify-start gap-10 md:gap-12 py-6 border-t border-gray-800/50">
                <button onClick={() => setIsFollowersModalOpen(true)} className="flex flex-col items-center md:items-start group/stat active:scale-95 transition-transform">
                  <span className="text-lg md:text-xl font-bold text-white group-hover:text-[rgb(var(--primary-accent))] transition-colors">{formatNumber(profileUser.followers_count || 0)}</span>
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">{t('followers')}</span>
                </button>
                <button onClick={() => setIsFollowingModalOpen(true)} className="flex flex-col items-center md:items-start group/stat active:scale-95 transition-transform">
                  <span className="text-lg md:text-xl font-bold text-white group-hover:text-[rgb(var(--primary-accent))] transition-colors">{formatNumber(profileUser.following_count || 0)}</span>
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">{t('following')}</span>
                </button>
                <button onClick={() => setIsLikesModalOpen(true)} className="flex flex-col items-center md:items-start group/stat active:scale-95 transition-transform">
                  <span className="text-lg md:text-xl font-bold text-white group-hover:text-[rgb(var(--primary-accent))] transition-colors">{formatNumber(profileUser.likes_count || 0)}</span>
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">{t('likes')}</span>
                </button>
                <div className="flex flex-col items-center md:items-start">
                  <span className="text-lg md:text-xl font-bold text-white tracking-tight">{formatNumber(profileUser.views_count || 0)}</span>
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">{t('views')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-center mb-12">
          <div className="glass-panel p-1.5 rounded-2xl flex gap-1 shadow-2xl overflow-hidden w-full max-w-md border-none">
            {[
              { id: 'videos' as const, label: t('videos'), icon: '🎬' },
              ...(isOwnProfile ? [{ id: 'likes' as const, label: t('likes'), icon: '❤️' }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl font-bold transition-all relative ${activeTab === tab.id ? 'text-black' : 'text-gray-500 hover:text-white'
                  }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabProfile"
                    className="absolute inset-0 bg-[rgb(var(--primary-accent))] rounded-xl shadow-lg shadow-[rgb(var(--primary-accent))]/20"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 text-xl">{tab.icon}</span>
                <span className="relative z-10 uppercase tracking-widest text-xs font-bold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Videos Grid */}
        {displayVideos.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4"
          >
            <AnimatePresence mode="popLayout">
              {displayVideos.map((video) => (
                <motion.div
                  key={video.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className="relative aspect-[9/16] rounded-2xl overflow-hidden border border-gray-800/50 cursor-pointer group hover:border-red-600/50 transition-all shadow-xl"
                  onClick={() => handleVideoClick(video.id)}
                >
                  <img
                    src={getMediaUrl(video.thumbnail || video.path)}
                    alt={video.description}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    loading="lazy"
                  />

                  {/* Glassy Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity"></div>

                  <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white font-black text-xs sm:text-sm">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>{formatNumber(video.views || 0)}</span>
                  </div>

                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-[-10px] group-hover:translate-y-0 duration-300">
                    <div className="bg-[rgb(var(--primary-accent))] shadow-xl p-2.5 rounded-full hover:scale-110 transition-transform active:scale-95">
                      <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                  </div>

                  {/* Subtle Shimmer on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* Empty State - Highly Enhanced */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 px-6 text-center bg-[#121212] rounded-[3rem] border border-gray-800 shadow-inner group/empty relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent pointer-events-none"></div>

            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="w-40 h-40 bg-gray-900 rounded-full flex items-center justify-center mb-10 border border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10"
            >
              <span className="text-7xl drop-shadow-2xl">{activeTab === 'likes' ? '❤️' : '🎬'}</span>
            </motion.div>

            <h2 className="text-3xl md:text-4xl font-black mb-4 relative z-10 tracking-tight">
              {activeTab === 'likes' ? t('noLikedVideosYet') : (isOwnProfile ? t('noVideosYet') : t('userNoVideos'))}
            </h2>
            <p className="text-gray-500 font-bold mb-12 max-w-sm relative z-10 leading-relaxed">
              {activeTab === 'likes' ? t('likedVideosAppearHere') : (isOwnProfile ? t('uploadFirstVideo') : t('userNoVideosDesc'))}
            </p>

            {isOwnProfile && activeTab === 'videos' && (
              <Link
                to="/upload"
                className="group/btn px-16 py-5 bg-white text-black font-black rounded-full hover:bg-gray-200 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 flex items-center gap-4 relative z-10"
              >
                <span className="text-2xl group-hover/btn:rotate-12 transition-transform">📹</span>
                <span className="uppercase tracking-widest text-sm">{t('upload')}</span>
              </Link>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Profile;
