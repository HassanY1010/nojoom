import { useState, useEffect } from 'react';
import api from '../../services/api';  // بدلاً من ../services/api
import { getMediaUrl } from '../../utils/urlUtils';
import { useTranslation } from 'react-i18next';

const VideoManagement = ({ showNotification }) => {
  const { t } = useTranslation();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0
  });
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [boostModal, setBoostModal] = useState({ visible: false, videoId: null, score: '1000' });

  const fetchVideos = async (page = 1, searchTerm = '') => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/videos?page=${page}&limit=10&search=${searchTerm}`);
      setVideos(response.data.videos);
      setPagination({
        page: response.data.page,
        totalPages: response.data.totalPages,
        total: response.data.total
      });
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      showNotification(t('adminVideosLoadFailed') || 'Failed to load videos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchVideos(1, search);
  };

  const handleDelete = async (videoId, reason = 'Inappropriate content') => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;

    setActionLoading(videoId);
    try {
      await api.delete(`/admin/videos/${videoId}`, { data: { deletion_reason: reason } });
      fetchVideos(pagination.page, search);
      showNotification(t('adminVideoDeletedSuccess') || 'Video deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete video:', error);
      showNotification(t('adminVideoDeleteFailed') || 'Failed to delete video', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePin = async (videoId) => {
    setActionLoading(videoId);
    try {
      await api.post(`/admin/videos/${videoId}/pin`);
      fetchVideos(pagination.page, search);
      showNotification(t('adminVideoPinnedSuccess') || 'Video pinned successfully', 'success');
    } catch (error) {
      console.error('Failed to pin video:', error);
      showNotification(t('adminVideoPinFailed') || 'Failed to pin video', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpin = async (videoId) => {
    setActionLoading(videoId);
    try {
      await api.post(`/admin/videos/${videoId}/unpin`);
      fetchVideos(pagination.page, search);
      showNotification(t('adminVideoUnpinnedSuccess') || 'Video unpinned successfully', 'success');
    } catch (error) {
      console.error('Failed to unpin video:', error);
      showNotification(t('adminVideoUnpinFailed') || 'Failed to unpin video', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBoost = async () => {
    const { videoId, score } = boostModal;
    setActionLoading(videoId);
    try {
      await api.post(`/admin/videos/${videoId}/boost`, { boost_score: parseInt(score) });
      fetchVideos(pagination.page, search);
      setBoostModal({ visible: false, videoId: null, score: '1000' });
      showNotification(t('adminVideoBoostedSuccess') || 'Video boosted successfully', 'success');
    } catch (error) {
      console.error('Failed to boost video:', error);
      showNotification(t('adminVideoBoostFailed') || 'Failed to boost video', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (video) => {
    if (video.is_pinned) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-200">
          {t('adminPinnedStatus') || 'Pinned'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200">
        {t('adminActiveStatus')}
      </span>
    );
  };

  return (
    <div className="p-6 transition-colors duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('adminVideoManagement')}</h2>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 group-focus-within:opacity-100 transition-opacity">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('adminSearchVideosPlaceholder')}
                className="w-full bg-white/5 dark:bg-white/5 backdrop-blur-md text-gray-900 dark:text-white pl-11 pr-4 py-3 rounded-2xl border border-white/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-xl placeholder-gray-500 font-medium"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-2xl transition-all font-black uppercase tracking-widest shadow-lg shadow-purple-500/30 flex-1 sm:flex-none"
              >
                {t('search')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchVideos(1, '');
                }}
                className="bg-white/5 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-white px-6 py-3 rounded-2xl hover:bg-white/10 transition-all border border-white/10 font-bold flex-1 sm:flex-none"
              >
                {t('adminClear') || t('clear')}
              </button>
            </div>
          </div>
        </form>

        {/* Videos Content - Card view for mobile, Table for desktop */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto"></div>
              <p className="mt-4 font-bold tracking-widest uppercase opacity-50">Loading videos...</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden xl:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5">
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminVideoLabel')}</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminUserLabel')}</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminStats')}</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminStatusLabel')}</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminUploadedLabel')}</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('adminActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {videos.map((video) => (
                      <tr key={video.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-16 w-28 bg-black/40 rounded-xl overflow-hidden shadow-lg border border-white/5">
                              <video
                                className="h-full w-full object-cover"
                                poster={getMediaUrl(video.thumbnail)}
                              >
                              </video>
                            </div>
                            <div className="ml-4 max-w-xs">
                              <div className="text-sm font-black text-gray-900 dark:text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight truncate">
                                {video.description || t('noDescription')}
                              </div>
                              <div className="text-[10px] text-gray-500 font-black mt-1 uppercase tracking-wider">
                                {formatFileSize(video.file_size)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{video.username}</div>
                          <div className="text-xs text-gray-500 font-medium">{video.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-3 text-xs">
                            <div className="flex items-center gap-1 font-black text-blue-500">
                              <span>👁️</span> {video.views || 0}
                            </div>
                            <div className="flex items-center gap-1 font-black text-rose-500">
                              <span>❤️</span> {video.likes_count || 0}
                            </div>
                            {video.pending_reports_count > 0 && (
                              <div className="flex items-center gap-1 font-black text-amber-500">
                                <span>🚩</span> {video.pending_reports_count}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(video)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-[10px] text-gray-500 font-black uppercase tracking-widest">
                          {formatDate(video.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          <button
                            onClick={() => setBoostModal({ visible: true, videoId: video.id, score: '1000' })}
                            disabled={actionLoading === video.id}
                            className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all font-bold"
                            title="Boost Video"
                          >
                            🚀
                          </button>
                          {video.is_pinned ? (
                            <button
                              onClick={() => handleUnpin(video.id)}
                              disabled={actionLoading === video.id}
                              className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-white transition-all font-bold"
                            >
                              {actionLoading === video.id ? '...' : '📌'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePin(video.id)}
                              disabled={actionLoading === video.id}
                              className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all font-bold"
                            >
                              {actionLoading === video.id ? '...' : '📎'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(video.id)}
                            disabled={actionLoading === video.id}
                            className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all font-bold"
                          >
                            {actionLoading === video.id ? '...' : '🗑️'}
                          </button>
                          <button
                            onClick={() => setSelectedVideo(video)}
                            className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 hover:bg-purple-500 hover:text-white transition-all font-bold"
                          >
                            👁️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="xl:hidden p-4 space-y-4">
                {videos.map((video) => (
                  <div key={video.id} className="bg-white/5 rounded-3xl p-4 border border-white/5 group relative overflow-hidden shadow-lg">
                    <div className="flex gap-4 mb-4">
                      <div className="h-24 w-20 bg-black/40 rounded-2xl overflow-hidden flex-shrink-0 relative">
                        <video
                          className="h-full w-full object-cover"
                          poster={getMediaUrl(video.thumbnail)}
                        ></video>
                        <div className="absolute top-1 right-1">
                          {getStatusBadge(video)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-white uppercase tracking-tighter line-clamp-2 mb-2">{video.description || t('noDescription')}</div>
                        <div className="flex items-center gap-2 mb-3">
                          <img className="w-5 h-5 rounded-full object-cover" src={getMediaUrl(video.avatar)} alt="" />
                          <span className="text-xs font-bold text-gray-400 truncate">{video.username}</span>
                        </div>
                        <div className="flex gap-4">
                          <div className="text-[10px] font-black text-blue-500">👁️ {video.views || 0}</div>
                          <div className="text-[10px] font-black text-rose-500">❤️ {video.likes_count || 0}</div>
                          {video.pending_reports_count > 0 && (
                            <div className="text-[10px] font-black text-amber-500">🚩 {video.pending_reports_count}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setBoostModal({ visible: true, videoId: video.id, score: '1000' })}
                          className="px-3 py-2 rounded-xl bg-orange-500/10 text-orange-500 text-xs font-black uppercase tracking-widest"
                        >🚀</button>
                        <button
                          onClick={() => video.is_pinned ? handleUnpin(video.id) : handlePin(video.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${video.is_pinned ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'}`}
                        >{video.is_pinned ? '📌' : '📎'}</button>
                        <button
                          onClick={() => handleDelete(video.id)}
                          className="px-3 py-2 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest"
                        >🗑️</button>
                      </div>
                      <button
                        onClick={() => setSelectedVideo(video)}
                        className="flex-1 sm:flex-none py-2 rounded-xl bg-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-[0.2em] px-4"
                      >
                        {t('adminViewDetails')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {t('adminShowingXOfY', { count: videos.length, total: pagination.total })}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => fetchVideos(pagination.page - 1, search)}
                      disabled={pagination.page === 1 || loading}
                      className="px-3 py-1 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-bold shadow-sm"
                    >
                      {t('previous')}
                    </button>
                    <span className="px-3 py-1 text-gray-900 dark:text-white font-bold">
                      {t('pageOf', { current: pagination.page, total: pagination.totalPages })}
                    </span>
                    <button
                      onClick={() => fetchVideos(pagination.page + 1, search)}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="px-3 py-1 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-bold shadow-sm"
                    >
                      {t('next')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Video Detail Modal */}
      {
        selectedVideo && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row">

              {/* Left Side: Video Player */}
              <div className="w-full md:w-3/5 bg-black flex items-center justify-center relative group">
                <video
                  className="w-full h-full max-h-[50vh] md:max-h-full object-contain"
                  controls
                  autoPlay
                  src={getMediaUrl(selectedVideo.video_url)}
                  poster={getMediaUrl(selectedVideo.thumbnail)}
                >
                  {t('videoTagNotSupported')}
                </video>
                <div className="absolute top-4 left-4">
                  {getStatusBadge(selectedVideo)}
                </div>
              </div>

              {/* Right Side: Details & Actions */}
              <div className="w-full md:w-2/5 flex flex-col bg-gray-900 border-l border-white/5">
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight">
                      {t('adminVideoInformation')}
                    </h3>
                    <button
                      onClick={() => setSelectedVideo(null)}
                      className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full"
                    >
                      ✕
                    </button>
                  </div>

                  {/* User Profile Card */}
                  <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/5 flex items-center gap-4">
                    <img
                      className="h-12 w-12 rounded-full border-2 border-purple-500 object-cover"
                      src={getMediaUrl(selectedVideo.avatar)}
                      alt={selectedVideo.username}
                      onError={(e) => { e.target.src = '/default-avatar.png'; }}
                    />
                    <div>
                      <div className="text-white font-bold text-lg leading-none mb-1">{selectedVideo.username}</div>
                      <div className="text-gray-500 text-xs font-medium">{selectedVideo.email}</div>
                    </div>
                  </div>

                  {/* Video Details */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">{t('adminVideoDescription')}</h4>
                      <p className="text-gray-300 text-sm leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                        {selectedVideo.description || t('noDescription')}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-xs text-gray-500 font-black uppercase mb-1">{t('views')}</div>
                        <div className="text-xl font-black text-white">👁️ {selectedVideo.views || 0}</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-xs text-gray-500 font-black uppercase mb-1">{t('likes')}</div>
                        <div className="text-xl font-black text-white">❤️ {selectedVideo.likes_count || 0}</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-xs text-gray-500 font-black uppercase mb-1">{t('fileSize')}</div>
                        <div className="text-lg font-bold text-white">{selectedVideo.file_size ? formatFileSize(selectedVideo.file_size) : 'N/A'}</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-xs text-gray-500 font-black uppercase mb-1">{t('adminUploadedLabel')}</div>
                        <div className="text-sm font-bold text-white">{formatDate(selectedVideo.created_at)}</div>
                      </div>
                    </div>

                    {selectedVideo.pending_reports_count > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                        <div className="flex items-center gap-2 text-amber-500 font-black uppercase tracking-wider text-xs mb-1">
                          <span>⚠️</span> {t('adminPendingReports')}
                        </div>
                        <div className="text-2xl font-black text-amber-400">{selectedVideo.pending_reports_count}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/10 bg-black/20">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">{t('adminQuickActions')}</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => {
                        setBoostModal({ visible: true, videoId: selectedVideo.id, score: '1000' });
                        setSelectedVideo(null);
                      }}
                      className="px-4 py-3 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white rounded-xl transition-all font-black text-sm uppercase tracking-wider border border-orange-500/20 hover:border-orange-500"
                    >
                      🚀 {t('adminBoostVideo')}
                    </button>

                    {selectedVideo.is_pinned ? (
                      <button
                        onClick={() => {
                          handleUnpin(selectedVideo.id);
                          setSelectedVideo(null);
                        }}
                        className="px-4 py-3 bg-yellow-600/10 text-yellow-500 hover:bg-yellow-600 hover:text-white rounded-xl transition-all font-black text-sm uppercase tracking-wider border border-yellow-600/20 hover:border-yellow-600"
                      >
                        📌 {t('adminUnpinVideo')}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          handlePin(selectedVideo.id);
                          setSelectedVideo(null);
                        }}
                        className="px-4 py-3 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-all font-black text-sm uppercase tracking-wider border border-blue-600/20 hover:border-blue-600"
                      >
                        📎 {t('adminPinVideo')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleDelete(selectedVideo.id);
                        setSelectedVideo(null);
                      }}
                      className="px-4 py-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all font-black text-sm uppercase tracking-wider border border-red-600/20 hover:border-red-600"
                    >
                      🗑️ {t('delete')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Boost Modal */}
      {boostModal.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 z-[60]">
          <div className="bg-gray-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">{t('adminBoostVideoTitle')}</h3>
            <p className="text-gray-400 text-sm mb-6 font-bold">{t('adminBoostVideoDesc')}</p>
            <div className="space-y-4">
              <input
                type="number"
                value={boostModal.score}
                onChange={(e) => setBoostModal(prev => ({ ...prev, score: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-black text-center text-2xl"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleBoost}
                  disabled={actionLoading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black py-3 rounded-2xl uppercase tracking-widest shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  {actionLoading ? t('adminBoosting') : t('adminBoostNow')}
                </button>
                <button
                  onClick={() => setBoostModal({ visible: false, videoId: null, score: '1000' })}
                  className="px-6 py-3 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
                >
                  {t('adminCancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default VideoManagement;