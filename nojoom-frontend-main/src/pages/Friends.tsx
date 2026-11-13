import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { getMediaUrl } from '../utils/urlUtils';
import { formatNumber } from '../utils/numberUtils';
import EmptyState from '../components/EmptyState';

interface User {
  id: number;
  username: string;
  avatar: string;
  bio: string;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_online?: boolean;
}

const Friends: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguageStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'followers' | 'following' | 'search'>('following');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchFollowers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/followers');
      setFollowers(response.data.followers || []);
    } catch (error) {
      console.error('Failed to fetch followers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFollowing = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/following');
      setFollowing(response.data.following || []);
    } catch (error) {
      console.error('Failed to fetch following:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuggestedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/suggested-users?limit=20');
      setSuggestedUsers(response.data.data || []);
      setSearchResults(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch suggested users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'followers') fetchFollowers();
    else if (activeTab === 'following') fetchFollowing();
    else if (activeTab === 'search' && !searchQuery) fetchSuggestedUsers();
  }, [activeTab, fetchFollowers, fetchFollowing, fetchSuggestedUsers, searchQuery]);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(suggestedUsers);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFollow = async (userId: number, follow: boolean) => {
    try {
      if (follow) {
        await api.post(`/users/follow/${userId}`);
      } else {
        await api.delete(`/users/follow/${userId}`);
      }

      const updateList = (prev: User[]) =>
        prev.map(u => u.id === userId ? {
          ...u,
          is_following: follow,
          followers_count: follow ? u.followers_count + 1 : u.followers_count - 1
        } : u);

      setSearchResults(updateList);
      setFollowers(updateList);
      setFollowing(updateList);
      setSuggestedUsers(updateList);
    } catch (error) {
      console.error('Follow action failed:', error);
    }
  };

  const displayedUsers = useMemo(() => {
    if (activeTab === 'search') return searchQuery ? searchResults : suggestedUsers;
    if (activeTab === 'followers') return followers;
    return following;
  }, [activeTab, searchQuery, searchResults, suggestedUsers, followers, following]);

  const tabs = [
    { id: 'following' as const, label: t('following'), count: following.length, icon: '🌟' },
    { id: 'followers' as const, label: t('followers'), count: followers.length, icon: '👥' },
    { id: 'search' as const, label: t('discover'), count: null, icon: '🔍' },
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-white pt-24 pb-20 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 lg:px-8">

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-2xl md:text-3xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-white via-gray-400 to-white bg-clip-text text-transparent">
            {t('friendsAndFollowers')}
          </h1>
          <p className="text-gray-400 text-sm md:text-base font-medium max-w-lg mx-auto leading-relaxed">
            {t('followNewPeopleOrSeeWhoFollowsYou')}
          </p>
        </motion.div>

        {/* Tab Navigation - Modern Slider Style */}
        <div className="flex justify-center mb-10">
          <div className="bg-[#121212] p-1.5 rounded-2xl flex gap-1 border border-gray-800/50 shadow-2xl w-full max-w-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl font-black transition-all relative ${activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800/30'
                  }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabFriends"
                    className="absolute inset-0 bg-[rgb(var(--primary-accent))] rounded-xl shadow-lg shadow-[rgba(var(--primary-accent),0.2)]"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 text-xl">{tab.icon}</span>
                <span className="relative z-10 uppercase tracking-widest text-xs font-black">{tab.label}</span>
                {tab.count !== null && (
                  <span className="relative z-10 bg-black/30 px-2 py-0.5 rounded-full text-[10px] border border-white/10">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search Experience - Integrated Discovery */}
        {activeTab === 'search' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <div className="relative group/search">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder={t('searchFriendsAndCreators')}
                className="w-full px-8 py-5 bg-[#121212] border-2 border-gray-800 rounded-3xl text-white focus:outline-none focus:border-[rgb(var(--primary-accent))] transition-all placeholder-gray-600 text-lg font-bold pr-16 shadow-2xl group-hover/search:border-gray-700"
              />
              <div className={`absolute ${isRTL ? 'left-6' : 'right-6'} top-1/2 -translate-y-1/2 flex items-center gap-3`}>
                {searchLoading ? (
                  <div className="w-6 h-6 border-3 border-[rgb(var(--primary-accent))] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-2xl opacity-50 group-hover/search:opacity-100 transition-opacity">🔍</span>
                )}
              </div>
            </div>
            {!searchQuery && (
              <div className="mt-6 flex items-center justify-between px-2">
                <h3 className="text-gray-400 font-black uppercase tracking-widest text-xs">{t('suggestedForYou')}</h3>
                <button
                  onClick={fetchSuggestedUsers}
                  className="text-[rgb(var(--primary-accent))] text-xs font-black uppercase tracking-widest hover:underline active:scale-95 transition-transform"
                >
                  {t('refresh')}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Centered Content Container */}
        <div className="bg-[#121212]/50 rounded-[2.5rem] border border-gray-800/30 overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-8">
            {loading && displayedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-12 h-12 border-4 border-[rgb(var(--primary-accent))] border-t-transparent rounded-full animate-spin mb-6" />
                <p className="text-gray-500 font-bold animate-pulse uppercase tracking-[0.2em]">{t('syncingConnections')}</p>
              </div>
            ) : displayedUsers.length > 0 ? (
              <motion.div
                layout
                className="grid gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {displayedUsers.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-[#1a1a1a] rounded-2xl p-4 sm:p-5 flex items-center justify-between border border-gray-800/50 hover:border-[rgb(var(--primary-accent))]/30 transition-all group/card shadow-lg hover:shadow-[rgba(var(--primary-accent),0.05)]"
                    >
                      <div className="flex items-center gap-5 min-w-0">
                        <div className="relative flex-shrink-0 group/avatar">
                          <div className="p-1 bg-gradient-to-tr from-[rgb(var(--primary-accent))] to-white/20 rounded-full group-hover/avatar:scale-105 transition-transform duration-500">
                            <img
                              src={getMediaUrl(item.avatar)}
                              alt={item.username}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-4 border-[#1a1a1a]"
                              onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }}
                            />
                          </div>
                          {item.is_online && (
                            <div className={`absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-3 border-[#1a1a1a] shadow-lg`} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <Link
                            to={`/profile/${item.username}`}
                            className="font-extrabold text-white hover:text-[rgb(var(--primary-accent))] transition-colors block mb-1 text-base sm:text-lg truncate tracking-tight"
                          >
                            @{item.username}
                          </Link>
                          <p className="text-gray-500 font-medium text-xs sm:text-sm truncate max-w-[150px] sm:max-w-xs mb-2">
                            {item.bio || t('noBioYet')}
                          </p>
                          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                            <span className="flex items-center gap-1.5"><span className="text-[rgb(var(--primary-accent))]/50">👥</span> {formatNumber(item.followers_count)}</span>
                            <span className="flex items-center gap-1.5"><span className="text-white/20">✨</span> {formatNumber(item.following_count)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleFollow(item.id, !item.is_following)}
                        className={`px-8 py-2.5 rounded-full font-black transition-all text-xs sm:text-sm whitespace-nowrap active:scale-90 ${item.is_following
                          ? 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-[rgb(var(--primary-accent))]/10 hover:text-[rgb(var(--primary-accent))] hover:border-[rgb(var(--primary-accent))]/50'
                          : 'bg-white text-black hover:bg-[rgb(var(--primary-accent))] hover:text-white shadow-xl shadow-[rgba(var(--primary-accent),0.1)]'
                          }`}
                      >
                        {item.is_following ? t('following') : t('follow')}
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              /* Unified Empty State Integration */
              <EmptyState
                icon={activeTab === 'search' ? '🔍' : activeTab === 'followers' ? '👥' : '🎬'}
                title={
                  activeTab === 'search'
                    ? (searchQuery ? t('noUsersFound') : t('startSearching'))
                    : activeTab === 'followers' ? t('noFollowersYet') : t('notFollowingAnyone')
                }
                description={
                  activeTab === 'search'
                    ? (searchQuery ? `${t('noResultsFor')} "${searchQuery}"` : t('findPeopleToFollow'))
                    : activeTab === 'followers' ? t('followersWillAppearHere') : t('followPeopleToSeeContent')
                }
                actionLabel={activeTab !== 'search' ? t('discoverNewPeople') : undefined}
                onAction={() => setActiveTab('search')}
              />
            )}
          </div>
        </div>

        {/* Load More Experience */}
        {displayedUsers.length > 0 && displayedUsers.length % 20 === 0 && (
          <div className="text-center mt-12">
            <button
              className="px-12 py-4 bg-[#121212] border border-gray-800 text-white rounded-full font-black hover:bg-gray-800 transition-all shadow-xl active:scale-95 uppercase tracking-widest text-xs"
              onClick={() => console.log('Load more')}
            >
              {t('loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends;

