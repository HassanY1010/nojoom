import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { getMediaUrl } from '../../utils/urlUtils';
import { useTranslation } from 'react-i18next';

const ReportManagement = ({ showNotification }) => {
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    resolved: 0,
    rejected: 0,
    total: 0
  });

  const fetchReports = async (page = 1, status = '') => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/reports?page=${page}&limit=10&status=${status}`);
      setReports(response.data.reports);
      setPagination({
        page: response.data.page,
        totalPages: response.data.totalPages,
        total: response.data.total
      });
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      showNotification(t('adminReportsFailed') || 'Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/reports/stats');
      setStats(response.data.stats || response.data.basicStats || {
        pending: 0,
        resolved: 0,
        rejected: 0,
        total: 0
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, []);

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    fetchReports(1, status);
  };

  const handleStatusUpdate = async (reportId, status, adminNotes = '') => {
    setActionLoading(reportId);
    try {
      await api.patch(`/admin/reports/${reportId}/status`, { status, admin_notes: adminNotes });
      fetchStats();
      setSelectedReport(null);
      showNotification(t('adminReportStatusUpdated') || 'Report status updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update report status:', error);
      showNotification(t('adminReportStatusFailed') || 'Failed to update report status', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteVideo = async (reportId, reason = 'Violation of community guidelines') => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;

    setActionLoading(reportId);
    try {
      await api.post(`/admin/reports/${reportId}/delete-video`, { deletion_reason: reason });
      fetchStats();
      setSelectedReport(null);
      showNotification(t('adminVideoDeletedSuccess') || 'Video deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete video:', error);
      showNotification(t('adminVideoDeleteFailed') || 'Failed to delete video', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async (reportId, reason = 'Multiple violations') => {
    if (!window.confirm('Are you sure you want to ban this user?')) return;

    setActionLoading(reportId);
    try {
      await api.post(`/admin/reports/${reportId}/ban-user`, { ban_reason: reason });
      fetchStats();
      setSelectedReport(null);
      showNotification(t('adminUserBannedSuccess') || 'User banned successfully', 'success');
    } catch (error) {
      console.error('Failed to ban user:', error);
      showNotification(t('adminUserBanFailed') || 'Failed to ban user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200', label: t('adminPending') },
      resolved: { color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200', label: t('adminResolved') },
      rejected: { color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200', label: t('adminRejected') }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${config.color} shadow-sm border border-transparent dark:border-current`}>
        {config.label}
      </span>
    );
  };

  const getReasonBadge = (reason) => {
    const reasonConfig = {
      spam: { color: 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-white', label: t('adminSpam') },
      harassment: { color: 'bg-red-100 dark:bg-red-600 text-red-700 dark:text-white', label: t('adminHarassment') },
      inappropriate: { color: 'bg-orange-100 dark:bg-orange-600 text-orange-700 dark:text-white', label: t('adminInappropriate') },
      copyright: { color: 'bg-purple-100 dark:bg-purple-600 text-purple-700 dark:text-white', label: t('adminCopyright') },
      other: { color: 'bg-blue-100 dark:bg-blue-600 text-blue-700 dark:text-white', label: t('adminOther') }
    };

    const config = reasonConfig[reason] || reasonConfig.other;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${config.color} shadow-sm border border-transparent dark:border-current`}>
        {config.label}
      </span>
    );
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

  return (
    <div className="p-6 transition-colors duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('adminReportManagement')}</h2>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5 shadow-xl group hover:border-purple-500/30 transition-all">
            <div className="text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight group-hover:scale-110 transition-transform origin-left">{stats.total}</div>
            <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{t('adminTotalReports')}</div>
          </div>
          <div className="bg-amber-500/5 backdrop-blur-md rounded-2xl p-4 border border-amber-500/10 shadow-xl group hover:border-amber-500/30 transition-all">
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mb-1 tracking-tight group-hover:scale-110 transition-transform origin-left">{stats.pending}</div>
            <div className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{t('adminPending')}</div>
          </div>
          <div className="bg-emerald-500/5 backdrop-blur-md rounded-2xl p-4 border border-emerald-500/10 shadow-xl group hover:border-emerald-500/30 transition-all">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1 tracking-tight group-hover:scale-110 transition-transform origin-left">{stats.resolved}</div>
            <div className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{t('adminResolved')}</div>
          </div>
          <div className="bg-rose-500/5 backdrop-blur-md rounded-2xl p-4 border border-rose-500/10 shadow-xl group hover:border-rose-500/30 transition-all">
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mb-1 tracking-tight group-hover:scale-110 transition-transform origin-left">{stats.rejected}</div>
            <div className="text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{t('adminRejected')}</div>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => handleStatusFilter('')}
            className={`px-4 py-2 rounded-lg transition-colors font-bold ${statusFilter === '' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
          >
            {t('adminAllReports')}
          </button>
          <button
            onClick={() => handleStatusFilter('pending')}
            className={`px-4 py-2 rounded-lg transition-colors font-bold ${statusFilter === 'pending' ? 'bg-yellow-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
          >
            {t('adminPending')} ({stats.pending})
          </button>
          <button
            onClick={() => handleStatusFilter('resolved')}
            className={`px-4 py-2 rounded-lg transition-colors font-bold ${statusFilter === 'resolved' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
          >
            {t('adminResolved')}
          </button>
          <button
            onClick={() => handleStatusFilter('rejected')}
            className={`px-4 py-2 rounded-lg transition-colors font-bold ${statusFilter === 'rejected' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
          >
            {t('adminRejected')}
          </button>
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2">{t('loading') || 'Loading reports...'}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📝</div>
              <p>{t('adminNoReportsFound')}</p>
              <p className="text-sm mt-1">{t('adminReportsWillAt')}</p>
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/5 p-5 hover:border-purple-500/50 transition-all cursor-pointer shadow-xl group relative overflow-hidden"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {getStatusBadge(report.status)}
                      {getReasonBadge(report.reason)}
                      {report.ai_moderation_score > 0.5 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg shadow-red-500/40 anim-pulse">AI Flagged</span>
                      )}
                    </div>

                    <p className="text-gray-900 dark:text-white mb-3 font-bold text-lg leading-tight group-hover:text-purple-400 transition-colors">
                      {report.description || t('noDescriptionProvided')}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <span className="opacity-50">👤</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300">{report.reporter_username}</span>
                      </div>
                      {report.reported_username && (
                        <div className="flex items-center gap-2">
                          <span className="opacity-50">🎯</span>
                          <span className="font-bold text-rose-500">{report.reported_username}</span>
                        </div>
                      )}
                      {report.video_description && (
                        <div className="flex items-center gap-2 col-span-full">
                          <span className="opacity-50">🎥</span>
                          <span className="italic truncate max-w-md">{report.video_description}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="opacity-50">📅</span>
                        <span>{formatDate(report.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-xl group-hover:bg-purple-500/20 transition-colors">
                      🔍
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">{t('adminViewDetails')}</span>
                  </div>
                </div>

                {/* Decorative background element */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all"></div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {reports.length > 0 && (
          <div className="mt-6 flex justify-center space-x-2">
            <button
              onClick={() => fetchReports(pagination.page - 1, statusFilter)}
              disabled={pagination.page === 1 || loading}
              className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold shadow-sm"
            >
              {t('previous')}
            </button>
            <span className="px-4 py-2 text-gray-900 dark:text-white font-medium">
              {t('pageOf', { current: pagination.page, total: pagination.totalPages })}
            </span>
            <button
              onClick={() => fetchReports(pagination.page + 1, statusFilter)}
              disabled={pagination.page === pagination.totalPages || loading}
              className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold shadow-sm"
            >
              {t('next')}
            </button>
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('adminReportDetails')}</h3>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Report Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-400">{t('adminStatus')}</label>
                      <div className="mt-1">{getStatusBadge(selectedReport.status)}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">{t('adminReason')}</label>
                      <div className="mt-1">{getReasonBadge(selectedReport.reason)}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">{t('adminReporter')}</label>
                      <div className="text-gray-900 dark:text-white font-bold">{selectedReport.reporter_username}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">{t('adminSubmitted')}</label>
                      <div className="text-gray-900 dark:text-white font-medium">{formatDate(selectedReport.created_at)}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedReport.reported_username && (
                      <div>
                        <label className="text-sm text-gray-400">{t('adminReportedUser')}</label>
                        <div className="text-white mt-1">{selectedReport.reported_username}</div>
                      </div>
                    )}
                    {selectedReport.video_description && (
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">{t('adminVideoDescription')}</label>
                        <p className="text-gray-900 dark:text-white font-medium">{selectedReport.video_description}</p>
                      </div>
                    )}

                    {/* AI Moderation Note */}
                    {(selectedReport.ai_moderation_score > 0.5) && (
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold mb-2">
                          <span>🤖</span>
                          <span>{t('adminAiModerationFlag')}</span>
                        </div>
                        <p className="text-xs text-red-500 dark:text-red-300">
                          {t('adminAiModerationNote', { percent: Math.round(selectedReport.ai_moderation_score * 100) })}
                        </p>
                        {selectedReport.ai_moderation_flags && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {JSON.parse(selectedReport.ai_moderation_flags).map((flag, idx) => (
                              <span key={idx} className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedReport.admin_username && (
                      <div>
                        <label className="text-sm text-gray-400">{t('adminHandledBy')}</label>
                        <div className="text-white mt-1">{selectedReport.admin_username}</div>
                      </div>
                    )}
                    {selectedReport.resolved_at && (
                      <div>
                        <label className="text-sm text-gray-400">{t('adminResolvedAt')}</label>
                        <div className="text-white mt-1">{formatDate(selectedReport.resolved_at)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">Report Description</label>
                  <div className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700 italic">
                    {selectedReport.description || 'No description provided'}
                  </div>
                </div>

                {/* Admin Notes */}
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">{t('adminAdminNotes') || t('adminNotes')}</label>
                  <div className="text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 font-medium">
                    {selectedReport.admin_notes}
                  </div>
                </div>

                {/* Video Preview */}
                {selectedReport.video_path && !selectedReport.deleted_by_admin && (
                  <div>
                    <label className="text-sm text-gray-400">{t('adminReportedVideo')}</label>
                    <video
                      className="w-full max-h-64"
                      controls
                      src={getMediaUrl(selectedReport.video_url || selectedReport.video_path)}
                    >
                      {t('videoTagNotSupported')}
                    </video>
                  </div>
                )}

                {/* Actions */}
                {selectedReport.status === 'pending' && (
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('adminActions')}</h4>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleStatusUpdate(selectedReport.id, 'resolved', 'Issue resolved after review')}
                        disabled={actionLoading === selectedReport.id}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === selectedReport.id ? t('adminProcessing') : t('adminMarkResolved')}
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(selectedReport.id, 'rejected', 'False or invalid report')}
                        disabled={actionLoading === selectedReport.id}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === selectedReport.id ? t('adminProcessing') : t('adminRejectReport')}
                      </button>
                      {selectedReport.video_id && !selectedReport.deleted_by_admin && (
                        <button
                          onClick={() => handleDeleteVideo(selectedReport.id)}
                          disabled={actionLoading === selectedReport.id}
                          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === selectedReport.id ? t('adminProcessing') : t('adminDeleteVideo')}
                        </button>
                      )}
                      {selectedReport.reported_user_id && (
                        <button
                          onClick={() => handleBanUser(selectedReport.id)}
                          disabled={actionLoading === selectedReport.id}
                          className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 font-bold shadow-lg shadow-purple-500/20"
                        >
                          {actionLoading === selectedReport.id ? t('adminProcessing') : t('adminBanUser')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportManagement;