import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAuthStore } from '../store/useAuthStore';
import { searchService } from '../services/searchService';
import VideoCard from '../components/VideoCard';
import UserCard from '../components/UserCard';
import SearchBar from '../components/SearchBar';
import { Video, User } from '../types';
import { AlertTriangle, Clock3, Film, Flame, Hash, Search as SearchIcon, Sparkles, Target } from 'lucide-react';

type SearchType = 'all' | 'videos' | 'users';
type FilterType = 'relevance' | 'trending' | 'latest' | 'hashtags';

const Search: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguageStore();
  const { user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [filterType, setFilterType] = useState<FilterType>('relevance');
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<{ type: string; text: string; avatar?: string; thumbnail?: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [country, setCountry] = useState(user?.country || 'Global');
  const [localizedVideos, setLocalizedVideos] = useState<Video[]>([]);
  const [localizedHashtags, setLocalizedHashtags] = useState<string[]>([]);
  const [localizedLoading, setLocalizedLoading] = useState(false);

  // قائمة الدول المدعومة
  const countries = [
    { code: 'Global', label: t('searchPage.countries.global', 'Global') },
    { code: 'Saudi Arabia', label: t('searchPage.countries.sa', 'Saudi Arabia') },
    { code: 'Egypt', label: t('searchPage.countries.eg', 'Egypt') },
    { code: 'UAE', label: t('searchPage.countries.ae', 'UAE') },
    { code: 'Kuwait', label: t('searchPage.countries.kw', 'Kuwait') },
    { code: 'Qatar', label: t('searchPage.countries.qa', 'Qatar') },
  ];

  // البحث مع debounce والاقتراحات
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        if (!videos.length && !users.length) { // إذا لم نقم بالبحث بالفعل
          fetchSuggestions(searchQuery);
        }
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch();
      setSuggestions([]); // إخفاء الاقتراحات عند بدء البحث الفعلي
    } else {
      clearResults();
      if (user) fetchHistory();
      fetchLocalizedTrends();
    }
  }, [searchType, filterType, country, user?.country]);

  const fetchLocalizedTrends = async () => {
    try {
      setLocalizedLoading(true);
      const data = await searchService.getTrendingLocalized(country);
      setLocalizedVideos(data.videos || []);
      setLocalizedHashtags(data.hashtags || []);
    } catch (err) {
      console.error('Failed to fetch localized trends:', err);
    } finally {
      setLocalizedLoading(false);
    }
  };

  const fetchSuggestions = async (query: string) => {
    try {
      setSuggestionsLoading(true);
      const response = await searchService.getSuggestions(query);
      setSuggestions(response.suggestions || []);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const response = await searchService.getSearchHistory(5);
      setSearchHistory(response.history || []);
      // Reset showHistory if history is empty
      if (!response.history || response.history.length === 0) {
        setShowHistory(false);
      }
    } catch (err: any) {
      console.error('Failed to fetch search history:', err);
      // If unauthorized, don't keep trying
      if (err.response?.status === 401 || err.status === 401) {
        setSearchHistory([]);
      }
    }
  };

  const handleSearch = async (resetPage: boolean = true) => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const currentPage = resetPage ? 1 : page;

      const response = await searchService.search({
        query: searchQuery,
        type: searchType,
        filter: filterType,
        page: currentPage,
        limit: 10
      });

      if (resetPage) {
        setVideos(response.videos || []);
        setUsers(response.users || []);
        setHashtags(response.hashtags || []);
        setPage(1);
      } else {
        setVideos(prev => [...prev, ...(response.videos || [])]);
        setUsers(prev => [...prev, ...(response.users || [])]);
      }

      setHasMore(response.hasMore || false);
    } catch (err: any) {
      setError(err.response?.data?.message || t('failedLoadProfile'));
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setVideos([]);
    setUsers([]);
    setHashtags([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  };

  const loadMore = () => {
    if (!loading && hasMore && searchQuery.trim()) {
      setPage(prev => prev + 1);
      handleSearch(false);
    }
  };

  const handleHashtagClick = (hashtag: string) => {
    setSearchQuery(hashtag);
    setFilterType('hashtags');
  };

  const handleVideoInteraction = useCallback((videoId: number, interactionType: string) => {
    // تحديث حالة الفيديو المحلي بناءً على التفاعل
    if (interactionType === 'like') {
      setVideos(prev => prev.map(video =>
        video.id === videoId
          ? {
            ...video,
            is_liked: !video.is_liked,
            likes: video.is_liked ? video.likes - 1 : video.likes + 1
          }
          : video
      ));
    }
  }, []);

  const handleUserFollow = useCallback((userId: number, isFollowing: boolean) => {
    setUsers(prev => prev.map(user =>
      user.id === userId
        ? {
          ...user,
          is_following: isFollowing,
          followers_count: isFollowing
            ? user.followers_count + 1
            : Math.max(0, user.followers_count - 1)
        }
        : user
    ));
  }, []);

  const handleSwipeUp = (videoId: number) => {
    const currentIndex = videos.findIndex(video => video.id === videoId);
    if (currentIndex < videos.length - 1) {
      setActiveVideoId(videos[currentIndex + 1].id);
    }
  };

  return (
    <div className={`min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pt-16 pb-20 transition-colors duration-300 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* شريط البحث */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchBar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSearch={() => handleSearch(true)}
              suggestions={suggestions}
              onSuggestionClick={(suggestion) => {
                setSearchQuery(suggestion);
                handleSearch(true);
                setSuggestions([]);
              }}
              suggestionsLoading={suggestionsLoading}
            />
          </div>

          {/* اختيار الدولة */}
          <div className="flex-shrink-0">
            <div className="relative group">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full sm:w-48 h-12 px-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl text-sm font-bold appearance-none cursor-pointer focus:border-[rgb(var(--primary-accent))] transition-all outline-none"
              >
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <div className={`absolute inset-y-0 ${isRTL ? 'left-4' : 'right-4'} flex items-center pointer-events-none text-gray-400 group-hover:text-purple-500 transition-colors`}>
                <span className="text-xs">▼</span>
              </div>
            </div>
          </div>
        </div>

        {/* الترندات المحلية عند عدم وجود بحث */}
        {!searchQuery && (
          <div className="space-y-8 mb-12">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[rgb(var(--primary-accent))]" />
                  {t('searchPage.trendingNow', 'Trending Now')} ({countries.find(c => c.code === country)?.label})
                </h3>
              </div>

              {localizedLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-[rgb(var(--primary-accent))] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {localizedVideos.slice(0, 4).map(video => (
                    <div key={video.id} className="aspect-[9/16] relative rounded-xl overflow-hidden bg-gray-900 border border-gray-800 group cursor-pointer" onClick={() => handleHashtagClick(video.description?.split(' ')[0] || '')}>
                      <img src={video.thumbnail} alt={video.description} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-2 left-2 right-2 text-xs text-white truncate font-bold">
                        {video.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {localizedHashtags.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Hash className="w-5 h-5 text-[rgb(var(--primary-accent))]" />
                  {t('searchPage.trendingHashtags', 'Trending Hashtags')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {localizedHashtags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleHashtagClick(`#${tag}`)}
                      className="px-4 py-2 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_26%,transparent)] text-[rgb(var(--primary-accent))] hover:text-white rounded-xl text-sm font-bold transition-all border border-[color-mix(in_srgb,var(--primary)_30%,transparent)]"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* أنواع البحث */}
        <div className={`flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-6 justify-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          {(['all', 'videos', 'users'] as SearchType[]).map(type => (
            <button
              key={type}
              onClick={() => setSearchType(type)}
              className={`ui-chip ${searchType === type ? 'is-active' : ''}`}
            >
              {t(`searchPage.${type}`)}
            </button>
          ))}
        </div>

        {/* الفلاتر */}
        {searchType !== 'users' && (
          <div className={`flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-6 justify-center ${isRTL ? 'flex-row-reverse' : ''}`}>
            {(['relevance', 'trending', 'latest', 'hashtags'] as FilterType[]).map(filter => (
              <button
                key={filter}
                onClick={() => setFilterType(filter)}
              className={`ui-chip ${filterType === filter ? 'is-active' : ''}`}
              >
                {t(`searchPage.${filter}`)}
              </button>
            ))}
          </div>
        )}

        {/* الهاشتاجات المقترحة */}
        {hashtags.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <h3 className="text-gray-900 dark:text-white text-base sm:text-lg font-bold mb-2 sm:mb-3 text-center sm:text-right">
              {t('searchPage.popularHashtags')}
            </h3>
            <div className={`flex flex-wrap gap-1 sm:gap-2 justify-center ${isRTL ? 'flex-row-reverse' : ''}`}>
              {hashtags.slice(0, 8).map(hashtag => (
                <button
                  key={hashtag}
                  onClick={() => handleHashtagClick(hashtag)}
                  className="px-2 py-1 sm:px-3 sm:py-1 bg-[var(--bg-card)] text-[rgb(var(--primary-accent))] rounded-full text-xs sm:text-sm hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] transition-all font-bold border border-[var(--border-subtle)] shadow-sm"
                >
                  #{hashtag}
                </button>
              ))}
              {hashtags.length > 8 && (
                <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm px-2 py-1 font-bold">
                  +{hashtags.length - 8}
                </span>
              )}
            </div>
          </div>
        )}

        {/* رسالة الخطأ */}
        {error && (
            <div className="bg-red-500/20 border border-red-500 text-white p-3 sm:p-4 rounded-lg mb-4 sm:mb-6 text-center sm:text-right">
            <div className="flex items-center justify-center sm:justify-start space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm sm:text-base">{error}</span>
            </div>
          </div>
        )}

        {/* النتائج */}
        <div className="space-y-4 sm:space-y-6">
          {/* عرض المستخدمين */}
          {searchType !== 'videos' && users.length > 0 && (
            <div>
              <h2 className="text-gray-900 dark:text-white text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-center sm:text-right">
                {t('searchPage.users')} <span className="text-gray-500 dark:text-gray-400 text-sm">({users.length})</span>
              </h2>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
              >
                {users.map(user => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onFollowChange={handleUserFollow}
                    compact={true}
                  />
                ))}
              </motion.div>
            </div>
          )}

          {/* عرض الفيديوهات */}
          {searchType !== 'users' && videos.length > 0 && (
            <div>
              <h2 className="text-gray-900 dark:text-white text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-center sm:text-right">
                {t('searchPage.videos')} <span className="text-gray-500 dark:text-gray-400 text-sm">({videos.length})</span>
              </h2>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
              >
                {videos.map(video => (
                  <div key={video.id} className="bg-gray-50 dark:bg-gray-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 border border-gray-100 dark:border-gray-800 hover:border-purple-500/50">
                    <VideoCard
                      video={video}
                      isActive={activeVideoId === video.id}
                      onWatchTimeUpdate={(watchTime) => {
                        // تسجيل وقت المشاهدة للتوصيات
                        searchService.recordInteraction({
                          videoId: video.id,
                          type: 'watch',
                          weight: Math.min(watchTime / 60, 1.0), // وزن بناءً على دقائق المشاهدة
                          metadata: { searchQuery, filterType }
                        }).catch(console.error);
                      }}
                      onSwipeUp={() => handleSwipeUp(video.id)}
                      onInteraction={handleVideoInteraction}
                      compact={true}
                      showStats={true}
                    />
                  </div>
                ))}
              </motion.div>
            </div>
          )}

          {/* لا توجد نتائج */}
          {!loading && searchQuery && videos.length === 0 && users.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 px-4"
            >
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full" />
                <div className="relative w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto border border-gray-100 dark:border-gray-700 shadow-xl">
                  <SearchIcon className="w-9 h-9 text-[rgb(var(--primary-accent))]" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('searchPage.noResults')}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto mb-8 font-medium">
                {t('searchPage.tryDifferentKeywords')}
              </p>
              <button
                onClick={clearResults}
                className="ui-button ui-button--primary ui-button--lg interactive px-8 font-bold rounded-[var(--radius-pill)] active:scale-95"
              >
                {t('searchPage.clearSearch')}
              </button>
            </motion.div>
          )}

          {/* تاريخ البحث */}
          {!searchQuery && !loading && searchHistory.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 px-2">
                <button
                  onClick={async () => {
                    await searchService.clearSearchHistory();
                    setSearchHistory([]);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  {t('searchPage.clearHistory')}
                </button>
                <h3 className="text-gray-900 dark:text-white text-lg font-bold flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-[rgb(var(--primary-accent))]" />
                  {t('searchPage.recentSearches')}
                </h3>
              </div>
              <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {searchHistory.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSearchQuery(item.query);
                      handleSearch(true);
                    }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded-full text-sm transition-all border border-gray-200 dark:border-gray-700 hover:border-purple-500/50 font-bold shadow-sm"
                  >
                    {item.query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* حالة البحث الأولي */}
          {!searchQuery && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 px-4"
            >
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl rounded-full animate-pulse" />
                <div className="relative w-24 h-24 bg-gray-50 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto border border-gray-100 dark:border-gray-700 shadow-2xl rotate-3">
                  <Film className="w-10 h-10 text-[rgb(var(--primary-accent))]" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {t('searchPage.startSearching')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto leading-relaxed font-medium">
                {t('searchPage.searchHint')}
              </p>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-purple-500/30 transition-all shadow-sm">
                  <Target className="w-5 h-5 mb-2 mx-auto text-[rgb(var(--primary-accent))]" />
                  <p className="text-xs text-gray-500 font-bold">{t('searchPage.tip1', { defaultValue: 'Explore trending creators' })}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-purple-500/30 transition-all shadow-sm">
                  <Sparkles className="w-5 h-5 mb-2 mx-auto text-[rgb(var(--primary-accent))]" />
                  <p className="text-xs text-gray-500 font-bold">{t('searchPage.tip2', { defaultValue: 'Find amazing videos by hashtags' })}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* تحميل المزيد */}
          {hasMore && (videos.length > 0 || users.length > 0) && (
            <div className="text-center pt-4 sm:pt-6">
              <button
                onClick={loadMore}
                disabled={loading}
                className="ui-button ui-button--primary ui-button--lg interactive px-6 sm:px-8 rounded-[var(--radius-md)] disabled:opacity-50 font-bold text-sm sm:text-base w-full sm:w-auto"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin"></div>
                    <span>{t('searchPage.loading')}</span>
                  </div>
                ) : (
                  t('searchPage.loadMore')
                )}
              </button>
            </div>
          )}

          {/* تحميل أولي */}
          {loading && page === 1 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-[rgb(var(--primary-accent))] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm sm:text-base font-bold">{t('searchPage.searching')}</span>
              </div>
            </div>
          )}

          {/* نهاية النتائج */}
          {!hasMore && (videos.length > 0 || users.length > 0) && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4 sm:py-6 border-t border-gray-100 dark:border-gray-800 font-bold">
              <p className="text-xs sm:text-sm">{t('searchPage.endOfResults')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;
