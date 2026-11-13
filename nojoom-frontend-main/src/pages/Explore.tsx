import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { exploreApi } from '../services/api';
import VideoCard from '../components/VideoCard';
import UserCard from '../components/UserCard';
import SearchBar from '../components/SearchBar';
import BroadcastTicker from '../components/BroadcastTicker';
import { CardSkeleton, UserSkeleton } from '../components/Skeletons';
import { Video, User } from '../types';
import EmptyState from '../components/EmptyState';

type ContentType = 'videos' | 'users';
type FilterType = 'recommended' | 'trending' | 'popular' | 'latest';

const Explore: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ContentType>('videos');
  const [activeFilter, setActiveFilter] = useState<FilterType>('recommended');
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  // Sync searchQuery with URL params
  useEffect(() => {
    const query = searchParams.get('search') || '';
    if (query !== searchQuery) {
      setSearchQuery(query);
      setPage(1);
      setVideos([]);
      setUsers([]);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // جلب الفيديوهات
  const fetchVideos = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await exploreApi.getExploreVideos({
        page: pageNum,
        filter: activeFilter,
        search: searchQuery || undefined,
        userId: user?.id
      });

      const newVideos = response.data.videos || response.data.data || [];

      if (isRefresh) {
        setVideos(newVideos);
      } else {
        setVideos(prev => [...prev, ...newVideos]);
      }

      setHasMore(newVideos.length > 0 && newVideos.length >= 10);
      setPage(pageNum);
    } catch (err: any) {
      console.error('Failed to fetch videos:', err);
      setError(t('failedLoadVideos'));
    } finally {
      setLoading(false);
    }
  }, [activeFilter, searchQuery, user, loading, t]);

  // جلب المستخدمين
  const fetchUsers = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await exploreApi.getExploreUsers({
        page: pageNum,
        search: searchQuery || undefined,
        userId: user?.id
      });

      const newUsers = response.data.users || response.data.data || [];

      if (isRefresh) {
        setUsers(newUsers);
      } else {
        setUsers(prev => [...prev, ...newUsers]);
      }

      setHasMore(newUsers.length > 0 && newUsers.length >= 10);
      setPage(pageNum);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError(t('failedLoadProfile'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, user, loading, t]);

  // البحث
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
    setVideos([]);
    setUsers([]);
  }, []);

  // تغيير التبويب
  const handleTabChange = (tab: ContentType) => {
    setActiveTab(tab);
    setPage(1);
    setVideos([]);
    setUsers([]);
  };

  // تغيير الفلتر
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setPage(1);
    setVideos([]);
  };

  // Infinite Scroll
  const handleScroll = useCallback(() => {
    if (loading || !hasMore) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= documentHeight - 100) {
      if (activeTab === 'videos') {
        fetchVideos(page + 1);
      } else {
        fetchUsers(page + 1);
      }
    }
  }, [loading, hasMore, page, activeTab, fetchVideos, fetchUsers]);

  // تحديث التفاعلات
  const handleFollowChange = (userId: number, isFollowing: boolean) => {
    setUsers(prev =>
      prev.map(user =>
        user.id === userId
          ? { ...user, is_following: isFollowing }
          : user
      )
    );
  };

  const handleInteraction = (videoId: number, interactionType: string) => {
    if (interactionType === 'like') {
      setVideos(prev =>
        prev.map(video =>
          video.id === videoId
            ? {
              ...video,
              is_liked: !video.is_liked,
              likes: video.is_liked ? (video.likes || 1) - 1 : (video.likes || 0) + 1
            }
            : video
        )
      );
    }
  };

  // التحميل الأولي
  useEffect(() => {
    if (activeTab === 'videos') {
      fetchVideos(1, true);
    } else {
      fetchUsers(1, true);
    }
  }, [activeTab, activeFilter, searchQuery]);

  // إضافة event listener للـ scroll
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div className="min-h-screen bg-white dark:bg-black pt-16 transition-colors duration-300">
      {/* شريط البث المتحرك */}
      <BroadcastTicker />

      {/* 🔹 Redundant SearchBar removed to rely on Navbar search 🔹 */}


      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
        {/* التبويبات الرئيسية */}
        <div className="flex border-b border-white/5 mb-8">
          {(['videos', 'users'] as ContentType[]).map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-[0.15em] transition-all duration-500 border-b-2 ${activeTab === tab
                ? 'border-[rgb(var(--primary-accent))] text-white drop-shadow-[0_0_8px_rgba(var(--primary-accent),0.3)]'
                : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              onClick={() => handleTabChange(tab)}
            >
              {tab === 'videos' ? t('exploreTabVideos') : t('exploreTabCreators')}
            </button>
          ))}
        </div>

        {/* فلاتر الفيديوهات */}
        {activeTab === 'videos' && (
          <div className="flex flex-wrap gap-3 mb-8">
            {(['recommended', 'trending', 'popular', 'latest'] as FilterType[]).map((filter) => (
              <button
                key={filter}
                className={`px-5 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all duration-300 ${activeFilter === filter
                  ? 'bg-[rgb(var(--primary-accent))] text-white shadow-[0_4px_12px_rgba(var(--primary-accent),0.3)] active-glow'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                onClick={() => handleFilterChange(filter)}
              >
                {t(`exploreFilter${filter.charAt(0).toUpperCase() + filter.slice(1)}`)}
              </button>
            ))}
          </div>
        )}

        {/* عرض المحتوى */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-400 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span>⚠️</span>
                <span className="text-sm sm:text-base">{error}</span>
              </div>
              <button
                onClick={() => activeTab === 'videos' ? fetchVideos(1, true) : fetchUsers(1, true)}
                className="text-red-300 hover:text-white underline text-sm"
              >
                {t('exploreRetry')}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'videos' ? (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
              {loading && videos.length === 0 ? (
                Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)
              ) : (
                videos.map((video, index) => (
                  <div key={`${video.id}-${index}`} className="premium-card group aspect-[9/16] overflow-hidden">
                    <VideoCard
                      video={video}
                      isActive={false}
                      onInteraction={handleInteraction}
                      compact={true}
                      tiktokStyle={true}
                      showUserInfo={true}
                    />
                  </div>
                ))
              )}
            </div>

            {videos.length === 0 && !loading && (
              <EmptyState
                icon="🎬"
                title={t('exploreNoVideosFound')}
                description={searchQuery ? t('exploreTryDifferentSearch') : t('exploreCheckBackLater')}
                actionLabel={searchQuery ? t('searchPage.clearSearch') : t('trending')}
                onAction={() => searchQuery ? handleSearch('') : handleFilterChange('trending')}
              />
            )}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
              {loading && users.length === 0 ? (
                Array.from({ length: 15 }).map((_, i) => <UserSkeleton key={i} />)
              ) : (
                users.map((user) => (
                  <div key={user.id} className="premium-card group overflow-hidden p-1">
                    <UserCard
                      user={user}
                      onFollowChange={handleFollowChange}
                      tiktokStyle={true}
                      compact={true}
                    />
                  </div>
                ))
              )}
            </div>

            {users.length === 0 && !loading && (
              <EmptyState
                icon="👥"
                title={t('exploreNoCreatorsFound')}
                description={searchQuery ? t('exploreTryDifferentSearch') : t('exploreNoSuggestedCreators')}
                actionLabel={searchQuery ? t('searchPage.clearSearch') : undefined}
                onAction={() => handleSearch('')}
              />
            )}
          </div>
        )}

        {/* مؤشر التحميل */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-2xl border-2 border-white/5 border-t-[rgb(var(--primary-accent))] animate-spin shadow-[0_0_15px_rgba(var(--primary-accent),0.2)]"></div>
              </div>
              <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">{t('exploreLoadingMore')}</span>
            </div>
          </div>
        )}

        {/* رسالة نهاية المحتوى */}
        {!hasMore && (videos.length > 0 || users.length > 0) && (
          <div className="text-center py-12 text-gray-500 border-t border-gray-800 mt-8">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <span className="text-2xl">✨</span>
              <span className="text-white font-bold">{t('exploreReachedEnd')}</span>
              <span className="text-2xl">✨</span>
            </div>
            <p className="text-gray-500 text-sm">
              {t('exploreComeBackLater')}
            </p>
          </div>
        )}

        {/* زر العودة للأعلى */}
        {(videos.length > 5 || users.length > 8) && (
          <div className="fixed bottom-32 right-8 z-40">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-[rgb(var(--primary-accent))] text-white p-5 rounded-2xl shadow-2xl transition-all duration-500 hover:scale-110 active:scale-95 group active-glow"
            >
              <svg className="w-6 h-6 transform group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;
